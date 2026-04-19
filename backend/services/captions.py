import subprocess
import os
import json


def generate_srt(transcript: dict, output_path: str) -> str:
    """
    Convert Whisper transcript segments into an SRT subtitle file.
    Returns path to the SRT file.
    """
    segments = transcript.get("segments", [])
    if not segments:
        return ""

    srt_content = ""
    for i, seg in enumerate(segments):
        start = seg.get("start", 0)
        end = seg.get("end", 0)
        text = seg.get("text", "").strip()

        if not text:
            continue

        # Format timestamps as HH:MM:SS,mmm
        def fmt(seconds):
            h = int(seconds // 3600)
            m = int((seconds % 3600) // 60)
            s = int(seconds % 60)
            ms = int((seconds % 1) * 1000)
            return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

        srt_content += f"{i+1}\n"
        srt_content += f"{fmt(start)} --> {fmt(end)}\n"
        srt_content += f"{text}\n\n"

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(srt_content)

    return output_path


def burn_captions(video_path: str, srt_path: str, output_path: str, style: str = "tiktok") -> str:
    """
    Burn captions into video using FFmpeg.
    style: "tiktok" = bold white centered, "youtube" = smaller bottom captions
    """
    if not os.path.exists(srt_path):
        return video_path

    if style == "tiktok":
        # Bold white text, black outline, centered
        force_style = (
            "FontName=Arial,"
            "FontSize=18,"
            "PrimaryColour=&H00FFFFFF,"
            "OutlineColour=&H00000000,"
            "BackColour=&H80000000,"
            "Bold=1,"
            "Outline=2,"
            "Shadow=1,"
            "Alignment=2,"
            "MarginV=80"
        )
    else:
        # Smaller, bottom positioned for YouTube
        force_style = (
            "FontName=Arial,"
            "FontSize=14,"
            "PrimaryColour=&H00FFFFFF,"
            "OutlineColour=&H00000000,"
            "Bold=0,"
            "Outline=1,"
            "Alignment=2,"
            "MarginV=30"
        )

    subprocess.run([
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", f"subtitles={srt_path}:force_style='{force_style}'",
        "-codec:a", "copy",
        output_path
    ], check=True)

    return output_path


def remove_filler_words(segments: list) -> list:
    """
    Filter out segments that are just filler words.
    Returns cleaned segments.
    """
    filler_words = {
        "um", "uh", "like", "you know", "i mean",
        "basically", "literally", "actually", "so",
        "right", "okay", "ok", "yeah", "hmm"
    }

    cleaned = []
    for seg in segments:
        text = seg.get("text", "").strip().lower()
        words = text.split()

        # Skip if segment is only filler words
        non_filler = [w for w in words if w not in filler_words]
        if len(non_filler) == 0 and len(words) <= 3:
            continue

        cleaned.append(seg)

    return cleaned