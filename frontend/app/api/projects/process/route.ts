import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { checkAndIncrementUsage } from "@/lib/usage";
import { makeEditDecision } from "@/lib/claude/editor";
import type { Project } from "@/types";

const WORKER_URL = process.env.OPENSHORTS_SERVICE_URL!;
const WORKER_KEY = process.env.OPENSHORTS_API_KEY ?? "flicko-dev-key";

function serviceClient() {
  return createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function updateProjectStatus(
  projectId: string,
  status: Project["status"],
  extra?: Partial<Project>
) {
  await serviceClient()
    .from("projects")
    .update({ status, ...extra })
    .eq("id", projectId);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId } = await req.json() as { projectId: string };
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const { data: project, error: pErr } = await supabase
      .from("projects").select("*").eq("id", projectId).eq("user_id", user.id).single();

    if (pErr || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const p = project as Project;

    // ── Tier enforcement — server-side only ──────────────────────────────────
    const usageCheck = await checkAndIncrementUsage(user.id);
    if (!usageCheck.allowed) {
      await updateProjectStatus(projectId, "failed", { error_message: usageCheck.reason });
      return NextResponse.json({ error: usageCheck.reason, upgradeRequired: true }, { status: 402 });
    }

    // Generate signed URLs (7-hour TTL — enough time for the full pipeline)
    const videoSignedUrls: string[] = [];
    for (const path of p.video_urls) {
      const { data: signed } = await supabase.storage.from("videos").createSignedUrl(path, 25200);
      if (signed) videoSignedUrls.push(signed.signedUrl);
    }

    if (videoSignedUrls.length === 0) {
      await updateProjectStatus(projectId, "failed", { error_message: "No video files found." });
      return NextResponse.json({ error: "No video files found" }, { status: 400 });
    }

    // Fire-and-forget — respond immediately, pipeline runs in background
    runPipeline(p, user.id, videoSignedUrls).catch(async (err) => {
      console.error("[Pipeline error]", err);
      await updateProjectStatus(projectId, "failed", {
        error_message: (err as Error).message ?? "Unexpected error.",
      });
    });

    return NextResponse.json({ ok: true, projectId });
  } catch (err) {
    console.error("[process route]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Shape returned by the worker's /transcribe endpoint
interface TranscribeResult {
  transcript: string;
  duration_seconds: number;
  openshorts_clips: Array<{
    clip_index: number;
    start: number;
    end: number;
    video_url: string;
    transcript: string;
  }>;
  transcript_words: Array<{ word: string; start: number; end: number }>;
}

async function runPipeline(project: Project, userId: string, videoUrls: string[]) {
  const db = serviceClient();

  // ── Stage 1: Transcription via OpenShorts (inside the worker) ────────────
  await updateProjectStatus(project.id, "transcribing");

  let txRes: Response;
  try {
    txRes = await fetch(`${WORKER_URL}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${WORKER_KEY}` },
      body: JSON.stringify({ video_urls: videoUrls }),
      signal: AbortSignal.timeout(360_000), // 6-minute hard cap
    });
  } catch (err) {
    const msg = (err as Error).name === "TimeoutError"
      ? "Transcription timed out after 6 minutes. Check Terminal 2."
      : "Could not reach the processing worker. Make sure Terminal 2 (flicko_worker.py) is running on port 8001.";
    throw new Error(msg);
  }
  if (!txRes.ok) throw new Error(`Transcription failed: ${await txRes.text()}`);

  const txData = await txRes.json() as TranscribeResult;
  const { transcript, duration_seconds, openshorts_clips, transcript_words } = txData;

  await db.from("projects").update({ transcript }).eq("id", project.id);

  // ── Stage 2: Understand context ──────────────────────────────────────────
  await updateProjectStatus(project.id, "analyzing");

  const { data: voiceClone } = await db
    .from("voice_clones")
    .select("elevenlabs_voice_id, status")
    .eq("user_id", userId)
    .eq("status", "ready")
    .maybeSingle();

  // ── Stage 3: Claude makes creative decisions ─────────────────────────────
  await updateProjectStatus(project.id, "deciding");

  const editDecision = await makeEditDecision({
    transcript,
    contentContext: project.content_context,
    desiredOutcome: project.desired_outcome,
    targetPlatform: project.target_platform,
    audioPreference: project.audio_preference,
    videoDurationSeconds: duration_seconds,
    hasVoiceClone: !!(voiceClone as { elevenlabs_voice_id: string } | null)?.elevenlabs_voice_id,
    openShortsClips: openshorts_clips,   // ← tells Claude which face-tracked clips are available
  });

  await db
    .from("projects")
    .update({ edit_decisions: editDecision as unknown as Record<string, unknown> })
    .eq("id", project.id);

  // ── Stage 4: Edit + render via worker (OpenShorts clips → FFmpeg → Hyperframes) ─
  await updateProjectStatus(project.id, "editing");

  let renderRes: Response;
  try {
    renderRes = await fetch(`${WORKER_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${WORKER_KEY}` },
      body: JSON.stringify({
        video_urls:           videoUrls,
        edit_decision:        editDecision,
        target_platform:      project.target_platform,
        project_id:           project.id,
        user_id:              userId,
        supabase_url:         process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        openshorts_clips,
        transcript_words,
      }),
      signal: AbortSignal.timeout(30_000), // 30s to kick off the job
    });
  } catch (err) {
    const msg = (err as Error).name === "TimeoutError"
      ? "Render job timed out starting. Check Terminal 2."
      : "Lost connection to the processing worker during render. Check Terminal 2.";
    throw new Error(msg);
  }
  if (!renderRes.ok) throw new Error(`Render failed: ${await renderRes.text()}`);

  const { job_id: renderJobId } = await renderRes.json() as { job_id: string };

  // ── Stage 5: Poll until Hyperframes finishes ─────────────────────────────
  await updateProjectStatus(project.id, "rendering");

  const renderPath = await pollRender(renderJobId);
  await updateProjectStatus(project.id, "done", { render_url: renderPath });
}

async function pollRender(jobId: string, maxAttempts = 480, intervalMs = 5000): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(intervalMs);
    const res = await fetch(`${WORKER_URL}/render/${jobId}`, {
      headers: { Authorization: `Bearer ${WORKER_KEY}` },
    });
    if (!res.ok) throw new Error(`Render poll failed: ${res.status}`);
    const data = await res.json() as { status: string; output_url?: string; error?: string };
    if (data.status === "done" && data.output_url) return data.output_url;
    if (data.status === "failed") throw new Error(data.error ?? "Render failed");
  }
  throw new Error("Render timed out after 40 minutes");
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
