import type { JamendoTrack } from "@/types";

const JAMENDO_BASE = "https://api.jamendo.com/v3.0";

const MOOD_TO_TAGS: Record<string, string> = {
  energetic:   "energetic",
  happy:       "happy",
  melancholic: "melancholic",
  chill:       "relaxing",
  epic:        "epic",
  aggressive:  "energetic",
  romantic:    "romantic",
  neutral:     "background",
};

const ENERGY_TO_SPEED: Record<string, string> = {
  verylow:  "verylow",
  low:      "low",
  medium:   "medium",
  high:     "high",
  veryhigh: "veryhigh",
};

export async function searchJamendoTrack(params: {
  mood: string;
  energy: string;
  durationSeconds: number;
  genre?: string;
}): Promise<JamendoTrack | null> {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) return null;

  const tags  = MOOD_TO_TAGS[params.mood]   ?? "background";
  const speed = ENERGY_TO_SPEED[params.energy] ?? "medium";

  // Look for tracks within ±30s of the edit length first, wider fallback if nothing found
  const minDur = Math.max(15, params.durationSeconds - 30);
  const maxDur = params.durationSeconds + 90;

  const buildUrl = (withDuration: boolean) => {
    const url = new URL(`${JAMENDO_BASE}/tracks/`);
    url.searchParams.set("client_id",           clientId);
    url.searchParams.set("format",              "json");
    url.searchParams.set("limit",               "10");
    url.searchParams.set("vocalinstrumental",   "instrumental");
    url.searchParams.set("tags",                tags);
    url.searchParams.set("speed",               speed);
    url.searchParams.set("boost",               "popularity_total");
    url.searchParams.set("audioformat",         "mp32");
    if (withDuration) url.searchParams.set("duration_between", `${minDur}_${maxDur}`);
    if (params.genre) url.searchParams.set("genre", params.genre);
    return url.toString();
  };

  try {
    const res = await fetch(buildUrl(true));
    if (res.ok) {
      const data = await res.json() as { results: JamendoTrack[] };
      if (data.results?.length) return data.results[0];
    }

    // Fallback: drop duration constraint, pick most popular matching mood
    const fallback = await fetch(buildUrl(false));
    if (!fallback.ok) return null;
    const fallbackData = await fallback.json() as { results: JamendoTrack[] };
    return fallbackData.results?.[0] ?? null;
  } catch {
    return null;
  }
}
