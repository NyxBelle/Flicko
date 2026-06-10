import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// OpenShorts calls this when ElevenLabs finishes cloning
export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (apiKey !== process.env.OPENSHORTS_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { voice_clone_id, elevenlabs_voice_id, status, error } =
      await req.json() as {
        voice_clone_id: string;
        elevenlabs_voice_id?: string;
        status: "ready" | "failed";
        error?: string;
      };

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    await supabase
      .from("voice_clones")
      .update({
        status,
        elevenlabs_voice_id: elevenlabs_voice_id ?? null,
      })
      .eq("id", voice_clone_id);

    if (error) {
      console.error(`[Voice clone ${voice_clone_id}] Failed:`, error);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Voice webhook error]", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
