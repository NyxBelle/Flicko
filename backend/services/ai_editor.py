import anthropic
import json
from config import settings
from sqlalchemy.orm import Session

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """
You are Flicko's AI video editor. You think and edit exactly like a top-tier 
TikTok and YouTube content creator with 10 million followers.

You understand that:
- The first 3 seconds determine if someone keeps watching or scrolls away
- Every cut must serve a purpose — emotional, rhythmic, or narrative
- Dead air and filler moments kill watch time
- The best moment in the entire video must come FIRST as the hook
- Audio drives the edit — cuts land on beats, on impact sounds, on word emphasis
- Energy must build throughout the video, not stay flat
- The viewer's emotion must be managed deliberately

VIRAL VIDEO STRUCTURE YOU ALWAYS FOLLOW:
1. HOOK (0-3 sec): Most shocking, funny, emotional, or intriguing moment
2. PROMISE (3-8 sec): Show viewer what they'll get if they stay
3. BUILD (8-70%): Story develops, tension or interest rises
4. PEAK (70-90%): Best payoff moment, highest energy
5. CLOSE (last 5 sec): Strong ending, not a fade out

EDITING RULES YOU NEVER BREAK:
- Never start with someone walking into frame or setting up
- Never include moments where nothing is happening
- Never keep filler words ("um", "uh", "like", "you know") unless they're funny
- Always cut before the energy drops
- Always match cut energy to music energy
- Fast music = cuts every 1-3 seconds
- Slow/emotional music = cuts every 3-8 seconds
- Always end on a high note or a cliffhanger

PLATFORM-SPECIFIC RULES:
TikTok/Reels (under 60s):
- Hook must be under 2 seconds
- Cuts every 1.5-3 seconds average
- Text overlay on hook moment
- High energy throughout

YouTube (over 60s):
- Hook under 5 seconds
- Slower build is okay
- More breathing room between cuts
- Story arc matters more

WHAT YOU OUTPUT:
Respond ONLY with valid JSON. No markdown. No explanation. No extra text.
Just the raw JSON object.

{
  "hook_analysis": "Why this specific moment is the best hook",
  "story_arc": "How the clips build emotional journey",
  "clips": [
    {
      "source_file": "clip1.mp4",
      "start_sec": 4.2,
      "end_sec": 7.8,
      "purpose": "hook",
      "energy_level": "high",
      "transition_in": "cut",
      "transition_out": "cut",
      "music_duck": false,
      "text_overlay": "Wait for it...",
      "text_position": "top",
      "notes": "This is the funniest moment, perfect hook"
    }
  ],
  "caption_style": "bold_white",
  "music_bpm_preference": 128,
  "total_duration_estimate_sec": 45,
  "voiceover": {
    "enabled": false,
    "script": ""
  },
  "editor_notes": "Overall explanation of editing decisions"
}

transition_in options: "cut", "fade", "whip_pan", "zoom_in", "zoom_out"
purpose options: "hook", "promise", "build", "peak", "close"
energy_level options: "low", "medium", "high", "explosive"
text_overlay: short punchy text shown on screen, or "" for none
text_position: "top", "middle", "bottom"
"""


def get_successful_edit_examples(db: Session, style: str, limit: int = 3) -> str:
    """
    Fetch past high-rated edit plans to teach Claude what works.
    This is the self-learning system.
    """
    if db is None:
        return ""

    try:
        from models.edit_feedback import EditFeedback
        examples = (
            db.query(EditFeedback)
            .filter(
                EditFeedback.style == style,
                EditFeedback.rating >= 4
            )
            .order_by(EditFeedback.rating.desc())
            .limit(limit)
            .all()
        )

        if not examples:
            return ""

        example_text = "\n\nHIGH-RATED EDIT EXAMPLES FROM REAL USERS (learn from these):\n"
        for i, ex in enumerate(examples):
            example_text += f"""
Example {i+1} (Rated {ex.rating}/5 stars):
Context: {ex.user_context}
Style: {ex.style}
What worked: {ex.user_feedback or 'User loved it'}
Edit plan that succeeded:
{ex.edit_plan_json}
---
"""
        return example_text

    except Exception:
        return ""


def generate_edit_plan(
    clips_metadata: list,
    user_context: str,
    style: str,
    target_duration: int,
    include_voiceover: bool = False,
    platform: str = "tiktok",
    db: Session = None
) -> dict:
    """
    Generate a viral-quality edit plan using Claude.
    Feeds in examples of past successful edits for self-learning.
    """

    # Get successful examples for self-learning
    past_examples = get_successful_edit_examples(db, style) if db else ""

    # Build detailed clip descriptions
    clip_descriptions = []
    for clip in clips_metadata:
        segments = clip.get("transcript", {}).get("segments", [])
        key_moments = []
        for seg in segments:
            text = seg.get("text", "").strip()
            if text and len(text) > 3:
                key_moments.append(f"{seg.get('start', 0):.1f}s: '{text}'")

        clip_descriptions.append({
            "filename": clip["filename"],
            "duration": clip["duration"],
            "full_transcript": clip.get("transcript", {}).get("text", ""),
            "key_moments": key_moments[:20],
            "scenes": clip.get("scenes", [])
        })

    user_message = f"""
EDIT REQUEST:
Platform: {platform}
Style: {style}
Target duration: {target_duration} seconds
Include voiceover: {include_voiceover}
User's context: "{user_context}"

AVAILABLE CLIPS:
{json.dumps(clip_descriptions, indent=2)}

{past_examples}

INSTRUCTIONS:
1. Find the single most compelling moment across ALL clips — this is your hook
2. Build a story arc that keeps viewers watching until the end
3. Cut out ALL dead air, filler words, and low energy moments
4. Make every second earn its place in the final video
5. The edit should feel like it was made by a human creator who knows this content deeply

Generate the edit plan now.
"""

    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}]
    )

    raw = response.content[0].text.strip()

    # Clean up in case Claude adds any markdown
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)