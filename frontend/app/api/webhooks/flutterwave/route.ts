import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyFlutterwaveSignature } from "@/lib/payments/flutterwave";

// Must be raw body — do not parse
export const dynamic = "force-dynamic";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function applyTierUpgrade(userId: string, tier: string, transactionId: string, provider: "flutterwave") {
  const supabase = serviceClient();

  // Update profile tier
  await supabase.from("profiles").update({ tier }).eq("id", userId);

  // Upsert subscription
  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      tier,
      provider,
      provider_transaction_id: transactionId,
      status: "active",
      current_period_end: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    },
    { onConflict: "user_id" }
  );

  // Reset monthly usage counter for upgraded user
  const period = new Date().toISOString().slice(0, 7);
  await supabase
    .from("usage_counters")
    .upsert(
      { user_id: userId, period, edits_used: 0 },
      { onConflict: "user_id,period" }
    );
}

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("verif-hash") ?? "";
    const rawBody = await req.text();

    // Verify Flutterwave webhook signature
    if (!verifyFlutterwaveSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as {
      event: string;
      data?: {
        status: string;
        tx_ref: string;
        id: number;
        meta?: { userId?: string; tier?: string };
      };
    };

    if (
      payload.event === "charge.completed" &&
      payload.data?.status === "successful"
    ) {
      const { meta, id } = payload.data;
      if (meta?.userId && meta?.tier) {
        await applyTierUpgrade(meta.userId, meta.tier, String(id), "flutterwave");
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Flutterwave webhook error]", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
