from openai import OpenAI
from config import settings

client = OpenAI(api_key=settings.OPENAI_API_KEY)

def transcribe_video(video_path: str) -> dict:
    with open(video_path, "rb") as f:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            response_format="verbose_json"
        )
    return {
        "text": response.text,
        "segments": [
            {
                "start": s.start,
                "end": s.end,
                "text": s.text
            }
            for s in response.segments
        ]
    }