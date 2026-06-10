import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPaystackSignature } from "@/lib/payments/paystack";

export const dynamic = "force-dynamic";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function applyTierUpgrade(
  userId: string,
  tier: string,
  transactionRef: string
) {
  const supabase = serviceClient();

  await supabase.from("profiles").update({ tier }).eq("id", userId);

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      tier,
      provider: "paystack",
      provider_transaction_id: transactionRef,
      status: "active",
      current_period_end: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    },
    { onConflict: "user_id" }
  );

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
    const signature = req.headers.get("x-paystack-signature") ?? "";
    const rawBodyBuffer = Buffer.from(await req.arrayBuffer());

    // Verify Paystack HMAC-SHA512 signature
    if (!verifyPaystackSignature(rawBodyBuffer, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBodyBuffer.toString()) as {
      event: string;
      data?: {
        status: string;
        reference: string;
        metadata?: {
          userId?: string;
          tier?: string;
        };
      };
    };

    if (
      payload.event === "charge.success" &&
      payload.data?.status === "success"
    ) {
      const { metadata, reference } = payload.data;
      if (metadata?.userId && metadata?.tier) {
        await applyTierUpgrade(metadata.userId, metadata.tier, reference);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Paystack webhook error]", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
