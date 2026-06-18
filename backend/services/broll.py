"""
B-roll service — searches Pexels Video API for matching footage,
downloads a short clip, and trims it to the requested duration.

Requires PEXELS_API_KEY in backend .env
Sign up free at https://www.pexels.com/api/
"""
import os
import subprocess
import requests
from config import settings


PEXELS_VIDEO_URL = "https://api.pexels.com/videos/search"


def _search_pexels(search_terms: list[str], min_duration: int = 3) -> str | None:
    """Return the direct video URL of the best Pexels result, or None."""
    if not settings.PEXELS_API_KEY:
        return None

    for term in search_terms:
        try:
            resp = requests.get(
                PEXELS_VIDEO_URL,
                headers={"Authorization": settings.PEXELS_API_KEY},
                params={"query": term, "per_page": 5, "orientation": "portrait"},
                timeout=10,
            )
            resp.raise_for_status()
            videos = resp.json().get("videos", [])
            for v in videos:
                if v.get("duration", 0) < min_duration:
                    continue
                # Prefer HD portrait files
                for f in v.get("video_files", []):
                    if f.get("quality") in ("hd", "sd") and f.get("width", 0) <= f.get("height", 9999):
                        return f["link"]
        except Exception:
            continue
    return None


def fetch_broll_clip(
    hint: dict,
    work_dir: str,
    index: int,
) -> str | None:
    """
    Download a Pexels b-roll clip for a single b_roll_hint and trim it.

    hint schema (from AI editor):
        {
          "after_order": 2,
          "duration": 3.0,
          "description": "product on a table",
          "search_terms": ["product showcase", "lifestyle product"]
        }

    Returns local path to the trimmed clip, or None if unavailable.
    """
    duration = max(1.0, float(hint.get("duration", 3.0)))
    search_terms: list[str] = hint.get("search_terms") or [hint.get("description", "lifestyle")]

    video_url = _search_pexels(search_terms, min_duration=int(duration))
    if not video_url:
        return None

    raw_path = os.path.join(work_dir, f"_broll_raw_{index}.mp4")
    trimmed_path = os.path.join(work_dir, f"_broll_{index}.mp4")

    # Download
    try:
        with requests.get(video_url, stream=True, timeout=30) as r:
            r.raise_for_status()
            with open(raw_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=1 << 16):
                    f.write(chunk)
    except Exception:
        return None

    # Trim + scale to 1080×1920
    try:
        subprocess.run([
            "ffmpeg", "-y",
            "-ss", "0",
            "-t", str(duration),
            "-i", raw_path,
            "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
            "-r", "30",
            "-c:v", "libx264",
            "-c:a", "aac",
            "-ar", "44100",
            trimmed_path,
        ], check=True, capture_output=True)
        os.remove(raw_path)
        return trimmed_path
    except Exception:
        return None
