import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { makeEditDecision } from "@/lib/claude/editor";
import type { EditDecision, Project, RefinementEntry } from "@/types";

// Claude calls can take up to ~30s; give the function room to breathe
export const maxDuration = 90;

const WORKER_URL = process.env.OPENSHORTS_SERVICE_URL!;
const WORKER_KEY = process.env.OPENSHORTS_API_KEY ?? "flicko-dev-key";

function serviceClient() {
  return createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId, feedback } = await req.json() as { projectId: string; feedback: string };
    if (!projectId || !feedback?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = serviceClient();
    const { data: project } = await db
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const p = project as Project;
    if (!p.edit_decisions || !p.transcript) {
      return NextResponse.json({ error: "Project not ready for refinement" }, { status: 400 });
    }

    const ed = p.edit_decisions as EditDecision & { video_duration_seconds?: number };
    // Prefer stored duration; fall back to last segment end + buffer for old projects
    const duration = ed.video_duration_seconds
      ?? Math.max(...ed.segments.map(s => s.end), 30) + 15;

    // Mark project as deciding so the UI immediately shows activity
    await db.from("projects").update({ status: "deciding" }).eq("id", projectId);

    // Call Claude with refinement context
    const updatedDecision = await makeEditDecision({
      transcript: p.transcript,
      contentContext: p.content_context,
      desiredOutcome: p.desired_outcome,
      targetPlatform: p.target_platform,
      audioPreference: p.audio_preference,
      videoDurationSeconds: duration,
      hasVoiceClone: false,
      userId: user.id,
      stylePreset: p.style_preset,
      refinementFeedback: feedback.trim(),
      existingDecision: ed,
      refinementHistory: (p.refinement_history ?? []) as RefinementEntry[],
    });

    const newEntry: RefinementEntry = { feedback: feedback.trim(), applied_at: new Date().toISOString() };
    const history = [...((p.refinement_history ?? []) as RefinementEntry[]), newEntry];

    // Generate signed URLs for re-render
    const videoSignedUrls: string[] = [];
    for (const path of p.video_urls) {
      const { data: signed } = await supabase.storage.from("videos").createSignedUrl(path, 25200);
      if (signed) videoSignedUrls.push(signed.signedUrl);
    }
    if (videoSignedUrls.length === 0) {
      return NextResponse.json({ error: "No video files found" }, { status: 400 });
    }

    // Preserve stored duration in the new decision
    const decisionToSave = { ...updatedDecision, video_duration_seconds: duration };

    // Save updated decision + history, kick off render
    await db.from("projects").update({
      edit_decisions: decisionToSave as unknown as Record<string, unknown>,
      refinement_history: history as unknown as Record<string, unknown>[],
      status: "rendering",
      render_url: null,
    }).eq("id", projectId);

    const { data: profile } = await db.from("profiles").select("tier").eq("id", user.id).single();
    const userTier = (profile as { tier?: string } | null)?.tier ?? "free";

    const renderRes = await fetch(`${WORKER_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${WORKER_KEY}` },
      body: JSON.stringify({
        video_urls:           videoSignedUrls,
        edit_decision:        updatedDecision,
        target_platform:      p.target_platform,
        project_id:           projectId,
        user_id:              user.id,
        supabase_url:         process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        user_tier:            userTier,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      await db.from("projects").update({
        status: "failed",
        error_message: `Worker error: ${errText.slice(0, 300)}`,
      }).eq("id", projectId);
      return NextResponse.json({ error: "Worker failed to start render" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[refine route]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
