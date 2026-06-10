import { createHmac } from "crypto";

const PS_BASE = "https://api.paystack.co";

// Paystack amounts are in kobo (1 NGN = 100 kobo)
const PLAN_AMOUNTS_KOBO: Record<string, number> = {
  starter: 1500000, // ₦15,000 ($10 equivalent)
  pro: 2250000,     // ₦22,500 ($15 equivalent)
};

export async function createPaystackPaymentLink(params: {
  email: string;
  userId: string;
  tier: string;
  callbackUrl: string;
}): Promise<string> {
  const amount = PLAN_AMOUNTS_KOBO[params.tier];
  if (!amount) throw new Error(`Invalid tier: ${params.tier}`);

  const res = await fetch(`${PS_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    },
    body: JSON.stringify({
      email: params.email,
      amount,
      currency: "NGN",
      callback_url: params.callbackUrl,
      metadata: {
        userId: params.userId,
        tier: params.tier,
        cancel_action: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      },
    }),
  });

  const data = await res.json() as {
    status: boolean;
    data?: { authorization_url: string };
    message?: string;
  };

  if (!res.ok || !data.status || !data.data?.authorization_url) {
    throw new Error(data.message ?? "Paystack checkout failed");
  }

  return data.data.authorization_url;
}

export function verifyPaystackSignature(
  rawBody: Buffer,
  signature: string
): boolean {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!secret) return false;
  const hash = createHmac("sha512", secret).update(rawBody).digest("hex");
  return hash === signature;
}
