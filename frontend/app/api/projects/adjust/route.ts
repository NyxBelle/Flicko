import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import type { EditDecision, Project } from "@/types";

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

    const { projectId, changes } = await req.json() as {
      projectId: string;
      changes: Partial<Pick<EditDecision, "caption_style" | "audio_treatment" | "pacing">>;
    };

    if (!projectId || !changes) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const p = project as Project;

    if (!p.edit_decisions) {
      return NextResponse.json({ error: "No edit decisions to adjust" }, { status: 400 });
    }

    // Generate fresh signed URLs for source videos
    const videoSignedUrls: string[] = [];
    for (const path of p.video_urls) {
      const { data: signed } = await supabase.storage
        .from("videos")
        .createSignedUrl(path, 25200);
      if (signed) videoSignedUrls.push(signed.signedUrl);
    }

    if (videoSignedUrls.length === 0) {
      return NextResponse.json({ error: "No video files found" }, { status: 400 });
    }

    const updatedDecision: EditDecision = {
      ...(p.edit_decisions as EditDecision),
      ...changes,
    };

    // Fire-and-forget — client polls for status changes
    reRender(p, user.id, updatedDecision, videoSignedUrls).catch(async (err) => {
      console.error("[adjust] Re-render failed:", err);
      await serviceClient()
        .from("projects")
        .update({ status: "failed", error_message: (err as Error).message })
        .eq("id", projectId);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[adjust route]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function reRender(
  project: Project,
  userId: string,
  decision: EditDecision,
  videoUrls: string[],
): Promise<void> {
  const db = serviceClient();

  // Persist updated decision + reset to rendering state
  await db
    .from("projects")
    .update({
      edit_decisions: decision as unknown as Record<string, unknown>,
      status: "rendering",
      render_url: null,
    })
    .eq("id", project.id);

  // Kick off the worker render directly (skip transcription + Claude)
  let renderRes: Response;
  try {
    renderRes = await fetch(`${WORKER_URL}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WORKER_KEY}`,
      },
      body: JSON.stringify({
        video_urls:           videoUrls,
        edit_decision:        decision,
        target_platform:      project.target_platform,
        project_id:           project.id,
        user_id:              userId,
        supabase_url:         process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const msg = (err as Error).name === "TimeoutError"
      ? "Worker did not respond in time."
      : "Could not reach the processing worker.";
    throw new Error(msg);
  }

  if (!renderRes.ok) throw new Error(`Render failed: ${await renderRes.text()}`);

  const { job_id } = await renderRes.json() as { job_id: string };

  // Poll for completion (40-minute hard cap, same as process route)
  for (let i = 0; i < 480; i++) {
    await sleep(5000);
    const pollRes = await fetch(`${WORKER_URL}/render/${job_id}`, {
      headers: { Authorization: `Bearer ${WORKER_KEY}` },
    });
    if (!pollRes.ok) throw new Error(`Poll failed: ${pollRes.status}`);

    const data = await pollRes.json() as {
      status: string;
      output_url?: string;
      error?: string;
    };

    if (data.status === "done" && data.output_url) {
      await db
        .from("projects")
        .update({ status: "done", render_url: data.output_url })
        .eq("id", project.id);
      return;
    }
    if (data.status === "failed") throw new Error(data.error ?? "Render failed");
  }

  throw new Error("Re-render timed out after 40 minutes");
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
