import subprocess
import os


# ── SRT helpers ───────────────────────────────────────────────────────────────

def _fmt_ts(seconds: float) -> str:
    h  = int(seconds // 3600)
    m  = int((seconds % 3600) // 60)
    s  = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def generate_srt(transcript: dict, output_path: str) -> str:
    """Sentence-level SRT from Whisper segments (fallback / LinkedIn style)."""
    segments = transcript.get("segments", [])
    if not segments:
        return ""

    lines = []
    idx = 1
    for seg in segments:
        text = seg.get("text", "").strip()
        if not text:
            continue
        lines.append(f"{idx}\n{_fmt_ts(seg['start'])} --> {_fmt_ts(seg['end'])}\n{text}\n")
        idx += 1

    content = "\n".join(lines)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
    return output_path


def generate_word_timed_srt(transcript: dict, output_path: str, words_per_chunk: int = 3) -> str:
    """
    Word-level SRT — groups words into small chunks for CapCut-style captions.
    Falls back to sentence-level if word timestamps aren't available.
    """
    words = transcript.get("words", [])
    if not words:
        return generate_srt(transcript, output_path)

    chunks = []
    for i in range(0, len(words), words_per_chunk):
        group = words[i: i + words_per_chunk]
        start = group[0].get("start", 0)
        end   = group[-1].get("end", start + 0.5)
        text  = " ".join(w.get("word", "").strip() for w in group)
        if text:
            chunks.append({"start": start, "end": end, "text": text})

    lines = []
    for idx, chunk in enumerate(chunks, 1):
        lines.append(f"{idx}\n{_fmt_ts(chunk['start'])} --> {_fmt_ts(chunk['end'])}\n{chunk['text']}\n")

    content = "\n".join(lines)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
    return output_path


# ── Caption style → FFmpeg ASS force_style ───────────────────────────────────

_STYLES: dict[str, str] = {
    # Bold white centered — TikTok / Reels default
    "bold_center": (
        "FontName=Arial Black,FontSize=20,PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&H00000000,BackColour=&H80000000,"
        "Bold=1,Outline=2,Shadow=1,Alignment=2,MarginV=100"
    ),
    # Accent-coloured word-by-word pop — viral_highlight
    "viral_highlight": (
        "FontName=Arial Black,FontSize=22,PrimaryColour=&H0040D080,"
        "OutlineColour=&H00000000,Bold=1,Outline=2,Shadow=0,"
        "Alignment=2,MarginV=100"
    ),
    # Quiet lower-third — minimal_bottom
    "minimal_bottom": (
        "FontName=Arial,FontSize=14,PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&H00000000,Bold=0,Outline=1,Shadow=0,"
        "Alignment=2,MarginV=40"
    ),
    # LinkedIn / professional
    "professional": (
        "FontName=Arial,FontSize=13,PrimaryColour=&H00FFFFFF,"
        "BackColour=&HA0000000,Bold=0,Outline=0,Shadow=0,"
        "Alignment=2,MarginV=30"
    ),
    # Legacy aliases
    "tiktok":   "FontName=Arial Black,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,Bold=1,Outline=2,Shadow=1,Alignment=2,MarginV=80",
    "youtube":  "FontName=Arial,FontSize=14,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Bold=0,Outline=1,Alignment=2,MarginV=30",
}


def burn_captions(video_path: str, srt_path: str, output_path: str, style: str = "bold_center") -> str:
    """Burn SRT captions into video with the given style."""
    if not os.path.exists(srt_path):
        return video_path

    force_style = _STYLES.get(style, _STYLES["bold_center"])

    # Escape colons in path for FFmpeg on Windows
    safe_srt = srt_path.replace("\\", "/").replace(":", "\\:")

    subprocess.run([
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", f"subtitles={safe_srt}:force_style='{force_style}'",
        "-codec:a", "copy",
        output_path
    ], check=True)

    return output_path


# ── Filler word removal ───────────────────────────────────────────────────────

def remove_filler_words(segments: list) -> list:
    filler = {
        "um", "uh", "like", "you know", "i mean",
        "basically", "literally", "actually", "so",
        "right", "okay", "ok", "yeah", "hmm",
    }
    cleaned = []
    for seg in segments:
        text  = seg.get("text", "").strip().lower()
        words = text.split()
        if len(words) <= 3 and all(w in filler for w in words):
            continue
        cleaned.append(seg)
    return cleaned
