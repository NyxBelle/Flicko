import requests
from config import settings

def transcribe_video(video_path: str) -> dict:
    with open(video_path, "rb") as f:
        response = requests.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
            files={"file": (video_path, f, "video/mp4")},
            data={"model": "whisper-1", "response_format": "verbose_json"}
        )
    response.raise_for_status()
    result = response.json()
    return {
        "text": result.get("text", ""),
        "segments": [
            {
                "start": s.get("start"),
                "end": s.get("end"),
                "text": s.get("text")
            }
            for s in result.get("segments", [])
        ]
    }
