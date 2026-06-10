import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Profile } from "@/types";

function serviceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Gate: Pro tier only
    const { data: profile } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .single();

    if ((profile as Profile | null)?.tier !== "pro") {
      return NextResponse.json(
        { error: "Voice cloning is available on the Pro plan only." },
        { status: 403 }
      );
    }

    // Parse multipart form
    const formData = await req.formData();
    const file = formData.get("sample") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No voice sample provided" }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 50MB." }, { status: 400 });
    }

    // Upload to Supabase voice-samples bucket
    const ext = file.name.split(".").pop() ?? "mp3";
    const path = `${user.id}/${Date.now()}_sample.${ext}`;
    const buffer = await file.arrayBuffer();

    const db = serviceSupabase();
    const { error: uploadError } = await db.storage
      .from("voice-samples")
      .upload(path, buffer, { contentType: file.type });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Create voice_clones row
    const { data: vc, error: vcError } = await db
      .from("voice_clones")
      .insert({
        user_id: user.id,
        sample_url: path,
        status: "processing",
      })
      .select()
      .single();

    if (vcError || !vc) {
      throw new Error("Failed to create voice clone record");
    }

    // Get signed URL for the sample
    const { data: signed } = await db.storage
      .from("voice-samples")
      .createSignedUrl(path, 3600);

    // Dispatch to ElevenLabs via OpenShorts microservice
    const cloneRes = await fetch(
      `${process.env.OPENSHORTS_SERVICE_URL}/voice/clone`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENSHORTS_API_KEY}`,
        },
        body: JSON.stringify({
          voice_clone_id: (vc as { id: string }).id,
          sample_url: signed?.signedUrl,
          user_id: user.id,
          elevenlabs_api_key: process.env.ELEVENLABS_API_KEY,
        }),
      }
    );

    if (!cloneRes.ok) {
      throw new Error(`Voice clone job failed: ${await cloneRes.text()}`);
    }

    return NextResponse.json({ ok: true, voiceCloneId: (vc as { id: string }).id });
  } catch (err) {
    console.error("[Voice upload error]", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Voice upload failed" },
      { status: 500 }
    );
  }
}
