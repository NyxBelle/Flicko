import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchJamendoTrack } from "@/lib/music/jamendo";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { mood, energy, durationSeconds, genre } = await req.json() as {
    mood: string;
    energy: string;
    durationSeconds: number;
    genre?: string;
  };

  if (!mood || !energy || !durationSeconds) {
    return NextResponse.json({ error: "mood, energy, durationSeconds required" }, { status: 400 });
  }

  const track = await searchJamendoTrack({ mood, energy, durationSeconds, genre });
  if (!track) return NextResponse.json({ error: "No track found" }, { status: 404 });

  return NextResponse.json({ track });
}
