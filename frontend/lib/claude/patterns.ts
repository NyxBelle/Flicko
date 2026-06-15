import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function generateCreatorPatterns(userId: string): Promise<void> {
  const db = serviceClient();

  const [{ data: projects }, { data: performances }] = await Promise.all([
    db
      .from("projects")
      .select("id, target_platform, edit_decisions, title")
      .eq("user_id", userId)
      .eq("status", "done")
      .not("edit_decisions", "is", null)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("clip_performance")
      .select("*")
      .eq("user_id", userId)
      .order("reported_at", { ascending: false })
      .limit(50),
  ]);

  if (!projects?.length || !performances?.length) return;

  const perfMap = new Map(performances.map((p) => [p.project_id, p]));

  const projectSummaries = projects.map((p) => {
    const perf = perfMap.get(p.id);
    const ed = p.edit_decisions as Record<string, unknown> | null;
    return {
      platform: p.target_platform,
      pacing: ed?.pacing ?? null,
      caption_style: ed?.caption_style ?? null,
      audio_treatment: ed?.audio_treatment ?? null,
      energy_level: ed?.energy_level ?? null,
      hook_text: ed?.hook_text ?? null,
      views: perf?.views ?? null,
      likes: perf?.likes ?? null,
      shares: perf?.shares ?? null,
      comments: perf?.comments ?? null,
    };
  });

  const prompt = `You are analyzing a creator's video editing history to find patterns in what performs well.

Edit history with performance data (null = no data reported yet):
${JSON.stringify(projectSummaries, null, 2)}

Identify 2-4 specific patterns about what's working for this creator. Only include patterns supported by actual performance numbers — ignore projects with all-null performance fields.

Return a JSON array only — no markdown, no explanation:
[
  {
    "pattern_text": "Short, plain-language insight the creator can act on (e.g. 'Your fast-paced edits get 2x more shares')",
    "pattern_category": "hook_style" | "pacing" | "length" | "tone" | "platform" | "audio" | "caption",
    "confidence": 0.0 to 1.0
  }
]

confidence scale: 0.4 = 1 data point (weak signal), 0.65 = 2-3 data points (moderate), 0.85+ = 4+ data points (strong).
If there isn't enough data to identify a real pattern, return an empty array [].`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (block.type !== "text") return;

  let raw = block.text.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let patterns: Array<{ pattern_text: string; pattern_category: string; confidence: number }>;
  try {
    patterns = JSON.parse(raw);
  } catch {
    return;
  }

  if (!Array.isArray(patterns) || patterns.length === 0) return;

  // Replace all previous patterns for this user atomically
  await db.from("creator_patterns").delete().eq("user_id", userId);
  await db.from("creator_patterns").insert(
    patterns.map((p) => ({
      user_id: userId,
      pattern_text: p.pattern_text,
      pattern_category: p.pattern_category,
      confidence: Math.min(1, Math.max(0, Number(p.confidence))),
      based_on_clips_count: performances.length,
    })),
  );
}
