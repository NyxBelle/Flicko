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

    const db = serviceClient();

    const [{ data: project }, { data: profile }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).eq("user_id", user.id).single(),
      db.from("profiles").select("tier").eq("id", user.id).single(),
    ]);

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const userTier: string = (profile as { tier?: string } | null)?.tier ?? "free";

    const p = project as Project;
    if (!p.edit_decisions) return NextResponse.json({ error: "No edit decisions to adjust" }, { status: 400 });

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

    // Persist updated decision + set status to rendering immediately
    await db.from("projects").update({
      edit_decisions: updatedDecision as unknown as Record<string, unknown>,
      status: "rendering",
      render_url: null,
    }).eq("id", projectId);

    // Fire render to worker — worker updates Supabase directly on completion.
    // Client-side polling in project/[id]/page.tsx handles the rest.
    // We do NOT poll here — that caused 40-minute Vercel serverless timeouts.
    const renderRes = await fetch(`${WORKER_URL}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WORKER_KEY}`,
      },
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
      await db.from("projects")
        .update({ status: "failed", error_message: `Worker error: ${errText.slice(0, 300)}` })
        .eq("id", projectId);
      return NextResponse.json({ error: "Worker failed to start render" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[adjust route]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
