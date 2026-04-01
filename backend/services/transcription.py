import whisper

model = whisper.load_model("base")

def transcribe_video(video_path: str) -> dict:
    result = model.transcribe(video_path)
    return {
        "text": result["text"],
        "segments": result["segments"]
    }
    