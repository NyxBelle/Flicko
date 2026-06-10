import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { checkAndIncrementUsage } from "@/lib/usage";
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

    // Tier enforcement
    const usageCheck = await checkAndIncrementUsage(user.id);
    if (!usageCheck.allowed) {
      await serviceClient().from("projects")
        .update({ status: "failed", error_message: usageCheck.reason }).eq("id", projectId);
      return NextResponse.json({ error: usageCheck.reason, upgradeRequired: true }, { status: 402 });
    }

    // Generate 7-hour signed URLs for the worker
    const videoSignedUrls: string[] = [];
    for (const path of p.video_urls) {
      const { data: signed } = await supabase.storage.from("videos").createSignedUrl(path, 25200);
      if (signed) videoSignedUrls.push(signed.signedUrl);
    }

    if (videoSignedUrls.length === 0) {
      await serviceClient().from("projects")
        .update({ status: "failed", error_message: "No video files found." }).eq("id", projectId);
      return NextResponse.json({ error: "No video files found" }, { status: 400 });
    }

    // Set status immediately so the UI shows EditingView right away
    await serviceClient().from("projects").update({ status: "transcribing" }).eq("id", projectId);

    // Hand off the full pipeline to Railway — it handles all stages and updates Supabase directly.
    // Vercel returns immediately; no long-running work happens here.
    const workerRes = await fetch(`${WORKER_URL}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${WORKER_KEY}` },
      body: JSON.stringify({
        video_urls:           videoSignedUrls,
        content_context:      p.content_context,
        desired_outcome:      p.desired_outcome,
        target_platform:      p.target_platform,
        audio_preference:     p.audio_preference,
        project_id:           projectId,
        user_id:              user.id,
        supabase_url:         process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        anthropic_api_key:    process.env.ANTHROPIC_API_KEY,
        has_voice_clone:      false,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!workerRes.ok) {
      const errText = await workerRes.text();
      await serviceClient().from("projects")
        .update({ status: "failed", error_message: `Worker error: ${errText.slice(0, 300)}` })
        .eq("id", projectId);
      return NextResponse.json({ error: "Worker failed to start" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, projectId });
  } catch (err) {
    console.error("[process route]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
