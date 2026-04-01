import anthropic
import json
from config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """
You are Flicko's AI video editor. You receive metadata about uploaded video clips
(transcripts, scene timestamps, durations) and a user's context about their event.

Your job is to produce a precise, structured edit plan as JSON.

Rules:
- Only include the most interesting/relevant moments
- Keep total output under the target_duration_seconds
- Reorder clips if it makes narrative sense
- Add transitions between clips
- Suggest where background music should be louder (no speech) or ducked (speech present)

Respond ONLY with valid JSON, no markdown, no explanation.

Output format:
{
  "clips": [
    {
      "source_file": "clip1.mp4",
      "start_sec": 4.2,
      "end_sec": 11.8,
      "transition_in": "fade",
      "music_duck": true
    }
  ],
  "voiceover": {
    "enabled": false,
    "script": ""
  },
  "total_duration_estimate_sec": 45
}
"""

def generate_edit_plan(
    clips_metadata: list,
    user_context: str,
    style: str,
    target_duration: int,
    include_voiceover: bool = False
) -> dict:
    user_message = f"""
User context: {user_context}
Edit style: {style}
Target duration: {target_duration} seconds
Include voiceover: {include_voiceover}

Clips:
{json.dumps(clips_metadata, indent=2)}

Generate the edit plan.
"""
    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}]
    )

    raw = response.content[0].text.strip()
    return json.loads(raw)
    