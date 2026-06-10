import { createClient } from "@supabase/supabase-js";
import type { UserTier } from "@/types";
import { TIER_LIMITS } from "@/types";
import { getCurrentPeriod } from "./utils";

// Uses service role to bypass RLS for server-side enforcement
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  editsUsed: number;
  editsLimit: number;
  tier: UserTier;
}

export async function checkAndIncrementUsage(userId: string): Promise<UsageCheckResult> {
  const supabase = getServiceClient();

  // Get user tier
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .single();

  const tier = ((profile as { tier?: string } | null)?.tier ?? "free") as UserTier;
  const limits = TIER_LIMITS[tier];
  const period = limits.period === "lifetime" ? "lifetime" : getCurrentPeriod();

  // Get or create usage counter
  const { data: existing } = await supabase
    .from("usage_counters")
    .select("id, edits_used")
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();

  const editsUsed = (existing as { id: string; edits_used: number } | null)?.edits_used ?? 0;

  if (editsUsed >= limits.edits) {
    return {
      allowed: false,
      reason: `You have used all ${limits.edits} edit${limits.edits === 1 ? "" : "s"} for your ${tier} plan${limits.period === "monthly" ? " this month" : ""}. Upgrade to get more.`,
      editsUsed,
      editsLimit: limits.edits,
      tier,
    };
  }

  // Increment — upsert
  if (existing) {
    await supabase
      .from("usage_counters")
      .update({ edits_used: editsUsed + 1 })
      .eq("id", (existing as { id: string; edits_used: number }).id);
  } else {
    await supabase
      .from("usage_counters")
      .insert({ user_id: userId, period, edits_used: 1 });
  }

  return {
    allowed: true,
    editsUsed: editsUsed + 1,
    editsLimit: limits.edits,
    tier,
  };
}
