import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPaystackPaymentLink } from "@/lib/payments/paystack";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tier } = await req.json() as { tier: string };
    if (!["starter", "pro"].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const url = await createPaystackPaymentLink({
      email: user.email!,
      userId: user.id,
      tier,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success`,
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[Paystack billing error]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
