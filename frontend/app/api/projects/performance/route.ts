import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reportClipPerformance } from "@/lib/projects.functions";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId, views, likes, shares, comments, platform } = await req.json();
    if (!projectId || !platform) {
      return NextResponse.json({ error: "projectId and platform required" }, { status: 400 });
    }

    await reportClipPerformance({
      userId: user.id,
      projectId,
      views: Math.max(0, Number(views) || 0),
      likes: Math.max(0, Number(likes) || 0),
      shares: Math.max(0, Number(shares) || 0),
      comments: Math.max(0, Number(comments) || 0),
      platform,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[performance route]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
