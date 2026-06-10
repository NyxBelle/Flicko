const FW_BASE = "https://api.flutterwave.com/v3";

// Flutterwave amounts in NGN
const PLAN_AMOUNTS: Record<string, number> = {
  starter: 15000, // ₦15,000 ($10 equivalent)
  pro: 22500,     // ₦22,500 ($15 equivalent)
};

export async function createFlutterwavePaymentLink(params: {
  email: string;
  userId: string;
  tier: string;
  redirectUrl: string;
}): Promise<string> {
  const amount = PLAN_AMOUNTS[params.tier];
  if (!amount) throw new Error(`Invalid tier: ${params.tier}`);

  const txRef = `flicko-${params.userId}-${params.tier}-${Date.now()}`;

  const res = await fetch(`${FW_BASE}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
    },
    body: JSON.stringify({
      tx_ref: txRef,
      amount,
      currency: "NGN",
      redirect_url: params.redirectUrl,
      customer: { email: params.email },
      meta: { userId: params.userId, tier: params.tier },
      customizations: {
        title: "Flicko",
        description: `${params.tier.charAt(0).toUpperCase() + params.tier.slice(1)} Plan`,
        logo: `${process.env.NEXT_PUBLIC_APP_URL}/icon.png`,
      },
    }),
  });

  const data = await res.json() as { status: string; data?: { link: string }; message?: string };
  if (!res.ok || data.status !== "success" || !data.data?.link) {
    throw new Error(data.message ?? "Flutterwave checkout failed");
  }

  return data.data.link;
}

export function verifyFlutterwaveSignature(
  payload: string,
  signature: string
): boolean {
  const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  if (!expected) return false;
  return signature === expected;
}
