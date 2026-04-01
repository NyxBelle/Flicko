import requests
import os
from config import settings

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"

def clone_voice(sample_audio_path: str, voice_name: str, user_id: str) -> str:
    url = f"{ELEVENLABS_BASE}/voices/add"
    with open(sample_audio_path, "rb") as f:
        response = requests.post(
            url,
            headers={"xi-api-key": settings.ELEVENLABS_API_KEY},
            data={"name": f"{voice_name}_{user_id}"},
            files={"files": (os.path.basename(sample_audio_path), f, "audio/mpeg")}
        )
    response.raise_for_status()
    return response.json()["voice_id"]


def generate_voiceover(script: str, voice_id: str, output_path: str) -> str:
    url = f"{ELEVENLABS_BASE}/text-to-speech/{voice_id}"
    response = requests.post(
        url,
        headers={
            "xi-api-key": settings.ELEVENLABS_API_KEY,
            "Content-Type": "application/json"
        },
        json={
            "text": script,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.85
            }
        }
    )
    response.raise_for_status()
    with open(output_path, "wb") as f:
        f.write(response.content)
    return output_path
