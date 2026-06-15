import { createClient } from "@supabase/supabase-js";
import { generateCreatorPatterns } from "./claude/patterns";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export interface ReportPerformanceInput {
  userId: string;
  projectId: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  platform: string;
}

export async function reportClipPerformance(input: ReportPerformanceInput): Promise<void> {
  const db = serviceClient();

  await db.from("clip_performance").insert({
    user_id: input.userId,
    project_id: input.projectId,
    views: input.views,
    likes: input.likes,
    shares: input.shares,
    comments: input.comments,
    platform: input.platform,
  });

  const { count } = await db
    .from("clip_performance")
    .select("*", { count: "exact", head: true })
    .eq("user_id", input.userId);

  // Re-run pattern generation after every 3 reports
  if (count && count >= 3 && count % 3 === 0) {
    generateCreatorPatterns(input.userId).catch(console.error);
  }
}
