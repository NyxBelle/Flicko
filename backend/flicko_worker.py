"""
Flicko Video Processing Worker v3
─────────────────────────────────
Transcription:  faster-whisper (local, open source, no API key)
Rendering:      Remotion (React-based, open source, no per-render cost)
Fallback:       FFmpeg concat (if Remotion unavailable)

Run:
  pip install fastapi "uvicorn[standard]" requests pydantic faster-whisper
  uvicorn flicko_worker:app --host 0.0.0.0 --port 8001 --reload
"""

import os, uuid, json, tempfile, shutil, subprocess, threading, traceback, time, platform
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Sentry — initialise only when DSN is provided.
# Add SENTRY_DSN to Railway worker env vars to activate.
# Get DSN from sentry.io → your project → Settings → Client Keys.
_SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if _SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
        sentry_sdk.init(
            dsn=_SENTRY_DSN,
            integrations=[StarletteIntegration(), FastApiIntegration()],
            traces_sample_rate=0.2,
            environment=os.getenv("RAILWAY_ENVIRONMENT", "production"),
        )
        print("[sentry] Initialized")
    except ImportError:
        print("[sentry] sentry-sdk not installed — add sentry-sdk[fastapi] to requirements.worker.txt")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Kick off zombie recovery in a daemon thread so it doesn't block startup
    t = threading.Thread(target=_recover_stuck_projects, daemon=True)
    t.start()
    yield


app = FastAPI(title="Flicko Worker", version="3.0.0", lifespan=lifespan)

# Restrict to the frontend origin. Set ALLOWED_ORIGIN in Railway env vars.
# Falls back to "*" only when unset (local dev). Never leave unset in production.
_ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_ALLOWED_ORIGIN],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

_IS_WINDOWS = platform.system() == "Windows"
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")
RENDERER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "renderer")
RENDERER_PUBLIC = os.path.join(RENDERER_DIR, "public")
# Set USE_REMOTION=true in production (Railway). Locally FFmpeg is used — Remotion needs more CPU.
USE_REMOTION = os.getenv("USE_REMOTION", "false").lower() == "true"

_jobs: dict = {}
_whisper_model = None

STUCK_STATUSES = ("transcribing", "analyzing", "deciding", "editing", "rendering")
STUCK_TIMEOUT_MINUTES = 60


def _recover_stuck_projects() -> None:
    """
    On startup, find any projects that were left in a non-terminal status
    (e.g. because the worker restarted mid-render) and mark them failed
    so users see a retry option instead of an infinite spinner.
    Runs once in a background thread at startup, then every 30 minutes.
    """
    # Worker may receive Supabase creds via env vars under either name
    sb_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    sb_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not sb_url or not sb_key:
        print("[recovery] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping recovery")
        return

    import datetime
    cutoff = (
        datetime.datetime.utcnow() - datetime.timedelta(minutes=STUCK_TIMEOUT_MINUTES)
    ).isoformat() + "Z"

    try:
        url = f"{sb_url}/rest/v1/projects"
        params = (
            "status=in.(transcribing,analyzing,deciding,editing,rendering)"
            f"&updated_at=lt.{cutoff}"
        )
        r = requests.patch(
            f"{url}?{params}",
            headers={
                "apikey": sb_key,
                "Authorization": f"Bearer {sb_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json={
                "status": "failed",
                "error_message": "Render timed out — the worker restarted. Please retry.",
            },
            timeout=10,
        )
        if r.status_code in (200, 204):
            print(f"[recovery] Cleared stuck projects older than {STUCK_TIMEOUT_MINUTES}m")
        else:
            print(f"[recovery] Patch returned {r.status_code}: {r.text[:200]}")
    except Exception as e:
        print(f"[recovery] Failed: {e}")

    # Reschedule every 30 minutes
    t = threading.Timer(1800, _recover_stuck_projects)
    t.daemon = True
    t.start()


# ─── Pydantic models ──────────────────────────────────────────────────────────

class TranscribeRequest(BaseModel):
    video_urls: List[str]


class Segment(BaseModel):
    start: float
    end: float
    order: int
    reason: str
    speed: Optional[float] = 1.0  # 0.5 = slow-mo, 1.0 = normal, 2.0 = double speed
    zoom_in: Optional[bool] = False  # slow Ken Burns zoom for key moments


class EditDecision(BaseModel):
    segments: List[Segment]
    pacing: str
    transition_type: str
    audio_treatment: str
    caption_style: str
    energy_level: int
    hook_moment: float
    rationale: str
    editorial_note: Optional[str] = None
    energy_arc: Optional[str] = None
    suggested_title: Optional[str] = None
    hook_text: Optional[str] = None
    mute_original: bool = False
    caption_color: Optional[str] = None


class RenderRequest(BaseModel):
    video_urls: List[str]
    edit_decision: EditDecision
    target_platform: str
    project_id: str
    user_id: str
    supabase_url: str
    supabase_service_key: str
    transcript_words: Optional[List[dict]] = None
    user_tier: str = "free"


# ─── Utilities ────────────────────────────────────────────────────────────────

def _download(url: str, dest: str) -> None:
    r = requests.get(url, stream=True, timeout=180)
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_content(65536):
            f.write(chunk)


def _duration(path: str) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True,
    )
    try:
        return float(r.stdout.strip())
    except (ValueError, TypeError):
        return 0.0


def _vf(platform: str) -> str:
    if platform in ("tiktok", "reels", "shorts"):
        return "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2"
    return "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"


def _upload_supabase(path: str, supabase_url: str, key: str, dest: str) -> None:
    for attempt in range(3):
        try:
            with open(path, "rb") as f:
                r = requests.post(
                    f"{supabase_url}/storage/v1/object/renders/{dest}",
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "video/mp4", "x-upsert": "true"},
                    data=f, timeout=600,
                )
            if not r.ok:
                raise RuntimeError(f"Supabase upload failed ({r.status_code}): {r.text[:400]}")
            return
        except requests.exceptions.ConnectionError as e:
            if attempt == 2:
                raise
            print(f"[upload] DNS/connection error, retrying in 5s (attempt {attempt + 1}/3)...")
            time.sleep(5)


def _has_audio_stream(path: str) -> bool:
    """Return True if the file contains at least one audio stream."""
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0",
         "-show_entries", "stream=codec_type", "-of", "csv=p=0", path],
        capture_output=True, text=True,
    )
    return "audio" in r.stdout


def _ffmpeg_cut(src: str, ls: float, le: float, vf_str: str, out: str, speed: float = 1.0) -> None:
    speed = speed if speed and speed > 0 else 1.0
    video_filter = vf_str

    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{ls:.4f}", "-to", f"{le:.4f}", "-i", src,
        "-vf", video_filter,
        "-r", "30", "-c:v", "libx264", "-preset", "fast", "-crf", "22",
    ]

    if _has_audio_stream(src):
        # afftdn removes broadband noise (hiss, hum, wind, AC) without audible artifacts
        audio_filters = ["afftdn=nf=-25"]
        if abs(speed - 1.0) > 0.05:
            pts = 1.0 / speed
            video_filter = f"{vf_str},setpts={pts:.4f}*PTS"
            cmd[cmd.index("-vf") + 1] = video_filter
            if speed <= 0.5:
                audio_filters += ["atempo=0.5", "atempo=1.0"]
            elif speed >= 2.0:
                audio_filters += ["atempo=2.0"]
            else:
                audio_filters += [f"atempo={speed:.4f}"]
        cmd += ["-af", ",".join(audio_filters), "-c:a", "aac", "-ar", "44100", "-ac", "2"]
    else:
        if abs(speed - 1.0) > 0.05:
            pts = 1.0 / speed
            video_filter = f"{vf_str},setpts={pts:.4f}*PTS"
            cmd[cmd.index("-vf") + 1] = video_filter
        cmd += ["-an"]

    cmd.append(out)
    subprocess.run(cmd, check=True, capture_output=True)


# ─── Whisper transcription (local, open source) ───────────────────────────────

def _get_whisper():
    global _whisper_model
    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            print(f"[whisper] Loading '{WHISPER_MODEL_SIZE}' model (downloads on first run)...")
            _whisper_model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
            print("[whisper] Model ready.")
        except ImportError:
            print("[whisper] faster-whisper not installed. Run: pip install faster-whisper")
    return _whisper_model


def _transcribe_local(video_path: str) -> tuple:
    """Returns (transcript_text, transcript_words). Runs fully locally via faster-whisper."""
    model = _get_whisper()
    if model is None:
        return "", []

    segments, _ = model.transcribe(
        video_path,
        word_timestamps=True,
        language="en",
        vad_filter=True,
    )

    parts, words = [], []
    for seg in segments:
        parts.append(seg.text.strip())
        if seg.words:
            for w in seg.words:
                words.append({"word": w.word.strip(), "start": w.start, "end": w.end})

    return " ".join(parts), words


# ─── Remotion renderer (open source) ─────────────────────────────────────────

def _group_to_phrase_captions(words: list, fps: int = 30, max_words: int = 4) -> list:
    """Group word-level timestamps into caption phrases with per-word frame offsets for karaoke highlighting."""
    captions, buf = [], []
    for w in words:
        buf.append(w)
        if len(buf) >= max_words or w["word"].endswith((".", "!", "?", ",")):
            captions.append({
                "text": " ".join(x["word"] for x in buf),
                "startFrame": int(buf[0]["start"] * fps),
                "endFrame": int(buf[-1]["end"] * fps),
                "words": [{"word": x["word"], "startFrame": int(x["start"] * fps)} for x in buf],
            })
            buf = []
    if buf:
        captions.append({
            "text": " ".join(x["word"] for x in buf),
            "startFrame": int(buf[0]["start"] * fps),
            "endFrame": int(buf[-1]["end"] * fps),
            "words": [{"word": x["word"], "startFrame": int(x["start"] * fps)} for x in buf],
        })
    return captions


def _get_music_track_jamendo(client_id: str, energy_level: int, platform: str) -> Optional[str]:
    """
    Fetch a royalty-free track from Jamendo matched to energy level + platform.
    Register at devportal.jamendo.com → create an app → copy the client_id.
    Set JAMENDO_CLIENT_ID on Railway worker to activate.
    Note: commercial SaaS use requires a Jamendo licensing agreement.
    """
    import random

    # Map energy + platform → Jamendo tag query
    if platform in ("linkedin", "youtube"):
        tags = "corporate"
    elif energy_level >= 4:
        tags = "energetic electronic"
    elif energy_level == 3:
        tags = "upbeat pop"
    elif energy_level == 2:
        tags = "chill"
    else:
        tags = "ambient"

    def _fetch(extra_params: dict) -> list:
        base = {
            "client_id":    client_id,
            "format":       "json",
            "limit":        20,
            "audioformat":  "mp32",
            "audiodlformat": "mp32",
            "order":        "popularity_total",
        }
        base.update(extra_params)
        r = requests.get("https://api.jamendo.com/v3.0/tracks/", params=base, timeout=20)
        r.raise_for_status()
        data = r.json()
        if data.get("headers", {}).get("code") != 0:
            print(f"[music] Jamendo API error: {data.get('headers', {}).get('error_message')}")
            return []
        return [t for t in data.get("results", [])
                if t.get("audiodownload_allowed") and t.get("audiodownload")]

    try:
        results = _fetch({"tags": tags})
        if not results:
            # Retry without tag filter
            results = _fetch({})
        if not results:
            print("[music] Jamendo returned no downloadable tracks")
            return None

        chosen = random.choice(results[:10])
        audio_url = chosen["audiodownload"]

        tmp = tempfile.mktemp(suffix=".mp3")
        _download(audio_url, tmp)
        print(f"[music] Jamendo: \"{chosen.get('name', '?')}\" by {chosen.get('artist_name', '?')}")
        return tmp

    except Exception as e:
        print(f"[music] Jamendo failed: {e}")
        return None


def _get_music_track_supabase(supabase_url: str, key: str, energy_level: int) -> Optional[str]:
    """Fallback: fetch a track from the Supabase 'music' bucket."""
    try:
        import random
        r = requests.post(
            f"{supabase_url}/storage/v1/object/list/music",
            headers={"Authorization": f"Bearer {key}", "apikey": key, "Content-Type": "application/json"},
            json={"prefix": "", "limit": 100, "offset": 0},
            timeout=10,
        )
        if not r.ok:
            print(f"[music] Supabase music bucket unavailable ({r.status_code})")
            return None
        files = [f for f in r.json() if isinstance(f, dict) and f.get("name", "").lower().endswith(".mp3")]
        if not files:
            print("[music] No .mp3 files in Supabase 'music' bucket")
            return None

        tier = "high" if energy_level >= 4 else ("medium" if energy_level >= 2 else "low")
        matching = [f for f in files if tier in f["name"].lower()]
        chosen = random.choice(matching if matching else files)
        track_name = chosen["name"]

        r2 = requests.post(
            f"{supabase_url}/storage/v1/object/sign/music/{track_name}",
            headers={"Authorization": f"Bearer {key}", "apikey": key, "Content-Type": "application/json"},
            json={"expiresIn": 3600},
            timeout=10,
        )
        if not r2.ok:
            return None
        data = r2.json()
        signed = data.get("signedURL") or data.get("signedUrl") or ""
        if not signed:
            return None
        full_url = f"{supabase_url}{signed}" if signed.startswith("/") else signed

        tmp = tempfile.mktemp(suffix=".mp3")
        _download(full_url, tmp)
        print(f"[music] Supabase track: {track_name}")
        return tmp
    except Exception as e:
        print(f"[music] Supabase fallback failed: {e}")
        return None


def _get_music_track(supabase_url: str, key: str, energy_level: int, platform: str = "", duration_s: float = 30.0) -> Optional[str]:
    """
    Get a background music track.
    Priority: Jamendo API (if JAMENDO_CLIENT_ID set) → Supabase 'music' bucket (self-hosted MP3s).
    """
    jamendo_id = os.getenv("JAMENDO_CLIENT_ID", "")
    if jamendo_id:
        track = _get_music_track_jamendo(jamendo_id, energy_level, platform)
        if track:
            return track
        print("[music] Jamendo failed, trying Supabase bucket fallback...")
    return _get_music_track_supabase(supabase_url, key, energy_level)


def _apply_watermark(video_path: str, out_path: str) -> bool:
    """Burn a subtle 'flicko.app' text watermark into the bottom-left corner for free-tier videos."""
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", video_path,
                "-vf",
                (
                    "drawtext=text='flicko.app'"
                    ":fontsize=24"
                    ":fontcolor=white@0.80"
                    ":x=18"
                    ":y=h-th-18"
                    ":shadowx=1:shadowy=1:shadowcolor=black@0.55"
                ),
                "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                "-c:a", "copy",
                out_path,
            ],
            check=True, capture_output=True,
        )
        return os.path.exists(out_path)
    except Exception as e:
        print(f"[watermark] Failed (skipping): {e}")
        return False


def _mix_music(video_path: str, music_path: str, out_path: str, voice_vol: float = 0.55, music_vol: float = 0.22) -> bool:
    """Mix background music into video. Lowers original audio and layers music at lower volume."""
    try:
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", video_path,
                "-stream_loop", "-1", "-i", music_path,
                "-filter_complex",
                f"[0:a]volume={voice_vol}[v];[1:a]volume={music_vol}[m];[v][m]amix=inputs=2:duration=first:dropout_transition=2[out]",
                "-map", "0:v",
                "-map", "[out]",
                "-c:v", "copy",
                "-c:a", "aac",
                "-ar", "44100",
                "-shortest",
                out_path,
            ],
            check=True, capture_output=True,
        )
        return os.path.exists(out_path)
    except Exception as e:
        print(f"[music] Mix failed: {e}")
        return False


def _run_remotion(
    job_id: str,
    clip_paths: list,
    clip_durations: list,
    captions: list,
    ed: EditDecision,
    platform: str,
    out_path: str,
    extracted_segs: Optional[list] = None,
) -> bool:
    if not USE_REMOTION:
        return False
    if not os.path.isdir(os.path.join(RENDERER_DIR, "node_modules")):
        print(f"[remotion] node_modules not found. Run: cd backend/renderer && npm install")
        return False

    os.makedirs(RENDERER_PUBLIC, exist_ok=True)
    fps = 30
    is_vertical = platform in ("tiktok", "reels", "shorts")
    prefix = job_id[:8]

    # Copy extracted clips into renderer/public/ so Remotion's static file server can serve them
    clip_names = []
    for i, path in enumerate(clip_paths):
        name = f"{prefix}_{i:04d}.mp4"
        shutil.copy2(path, os.path.join(RENDERER_PUBLIC, name))
        clip_names.append(name)

    segs_for_clips = extracted_segs if extracted_segs and len(extracted_segs) == len(clip_names) else [None] * len(clip_names)
    props = {
        "clips": [
            {"name": name, "durationInFrames": max(1, int(dur * fps)), "zoomIn": bool(seg.zoom_in) if seg else False}
            for name, dur, seg in zip(clip_names, clip_durations, segs_for_clips)
        ],
        "captions": captions,
        "captionStyle": ed.caption_style,
        "transitionType": ed.transition_type,
        "hookText": ed.hook_text or ed.suggested_title or "",
        "captionColor": ed.caption_color or "#FFFFFF",
        "width": 1080 if is_vertical else 1920,
        "height": 1920 if is_vertical else 1080,
    }

    # Write props to a temp file to avoid shell-escaping issues on Windows
    props_file = os.path.join(RENDERER_DIR, f"props_{prefix}.json")
    with open(props_file, "w") as f:
        json.dump(props, f)

    # Prefer the local binary (avoids npx overhead and version drift on Railway)
    remotion_bin = os.path.join(RENDERER_DIR, "node_modules", ".bin", "remotion")
    if os.path.exists(remotion_bin) and not _IS_WINDOWS:
        cmd_prefix = [remotion_bin]
    else:
        cmd_prefix = ["npx", "--yes", "remotion"]

    render_cmd = cmd_prefix + [
        "render",
        "src/index.ts", "FlickoVideo",
        out_path,
        f"--props={props_file}",
        "--concurrency=2",
    ]

    # On Linux (Docker / Railway) add headless Chromium flags
    if not _IS_WINDOWS:
        chromium_path = os.getenv("PUPPETEER_EXECUTABLE_PATH", "/usr/bin/chromium")
        if os.path.exists(chromium_path):
            render_cmd.append(f"--browser-executable-path={chromium_path}")
        render_cmd.append("--gl=angle")
        render_cmd.append("--chromium-flags=--no-sandbox --disable-setuid-sandbox")

    try:
        result = subprocess.run(
            render_cmd,
            cwd=RENDERER_DIR,
            capture_output=True,
            text=True,
            timeout=600,
            shell=_IS_WINDOWS,
        )
        if result.returncode != 0:
            print(f"[remotion] render failed:\n{result.stderr[-1500:]}")
            return False
        return os.path.exists(out_path)
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        print(f"[remotion] Error: {e}")
        return False
    finally:
        # Clean up public clips and props file
        for name in clip_names:
            try:
                os.remove(os.path.join(RENDERER_PUBLIC, name))
            except Exception:
                pass
        try:
            os.remove(props_file)
        except Exception:
            pass


# ─── Face-tracked reframing ───────────────────────────────────────────────────

def _detect_subject_x_window(video_path: str, start_sec: float, end_sec: float) -> Optional[tuple]:
    """
    Sample frames in [start_sec, end_sec] of a source video and return the
    median detected face x-centre as a fraction of frame width.

    Returns (face_x_fraction, src_width, src_height) where face_x_fraction
    may be None if no face was found (caller should fall back to center crop).
    Returns None entirely if OpenCV is not installed.
    """
    try:
        import cv2
    except ImportError:
        return None

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None

    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if W == 0 or H == 0:
        cap.release()
        return None

    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    duration = max(0.1, end_sec - start_sec)
    n_samples = max(4, min(10, int(duration * 2)))  # ~2 fps, cap at 10
    x_centers = []

    for i in range(n_samples):
        t = start_sec + (i / (n_samples - 1)) * duration
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ret, frame = cap.read()
        if not ret:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=4, minSize=(40, 40)
        )
        if len(faces) > 0:
            fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
            x_centers.append((fx + fw / 2.0) / W)

    cap.release()

    if not x_centers:
        return (None, W, H)

    x_centers.sort()
    median_x = x_centers[len(x_centers) // 2]
    return (median_x, W, H)


def _vf_portrait_with_face(src_w: int, src_h: int, face_x: Optional[float]) -> str:
    """
    Build an FFmpeg vf string targeting 1080×1920 (9:16) portrait output.

    For already-portrait sources: scale/pad without cropping.
    For landscape sources: crop a 9:16 slice centred on the detected face,
    then scale/pad to 1080×1920.  Falls back to a center crop when face_x
    is None (no face detected).
    """
    if src_h >= src_w:
        # Already portrait — no crop needed
        return (
            "scale=1080:1920:force_original_aspect_ratio=decrease,"
            "pad=1080:1920:(ow-iw)/2:(oh-ih)/2"
        )

    # Landscape → portrait: extract a 9:16 vertical slice
    crop_w = min(src_w, int(src_h * 9 / 16))

    if face_x is not None:
        ideal_left = int(face_x * src_w - crop_w / 2)
        x_offset = max(0, min(ideal_left, src_w - crop_w))
    else:
        x_offset = (src_w - crop_w) // 2

    return (
        f"crop={crop_w}:{src_h}:{x_offset}:0,"
        "scale=1080:1920:force_original_aspect_ratio=decrease,"
        "pad=1080:1920:(ow-iw)/2:(oh-ih)/2"
    )


# ─── Render pipeline ──────────────────────────────────────────────────────────

def _do_render(
    job_id: str,
    video_urls: list,
    ed: EditDecision,
    platform: str,
    project_id: str,
    user_id: str,
    supabase_url: str,
    supabase_key: str,
    tx_words: Optional[list],
    user_tier: str = "free",
):
    """
    Renders a video and writes the final status directly to Supabase.
    Raises an exception on failure so callers can handle it.
    No longer depends on _jobs dict for cross-request state.
    """
    work = None
    try:
        work = tempfile.mkdtemp(prefix=f"flicko_{project_id[:8]}_")

        # 1. Download source videos
        sources, src_durs, cumul = [], [], []
        acc = 0.0
        for i, url in enumerate(video_urls):
            p = os.path.join(work, f"src_{i}.mp4")
            _download(url, p)
            d = _duration(p)
            sources.append(p)
            src_durs.append(d)
            cumul.append(acc)
            acc += d

        vf_str = _vf(platform)
        is_vertical = platform in ("tiktok", "reels", "shorts")

        # 2. Extract segments in Claude's editorial order
        segs = sorted(ed.segments, key=lambda s: s.order)
        extracted, ext_durs, extracted_segs = [], [], []

        for idx, seg in enumerate(segs):
            gs, ge = seg.start, seg.end
            out = os.path.join(work, f"clip_{idx:04d}.mp4")
            src_i = max(
                (i for i in range(len(sources)) if cumul[i] <= gs),
                default=0,
            )
            ls = max(0.0, gs - cumul[src_i])
            le = min(ge - cumul[src_i], src_durs[src_i])
            if le <= ls:
                continue

            # For vertical output, attempt face-tracked crop per segment
            seg_vf = vf_str
            if is_vertical:
                try:
                    face_result = _detect_subject_x_window(sources[src_i], ls, le)
                    if face_result is not None:
                        face_x, src_w, src_h = face_result
                        seg_vf = _vf_portrait_with_face(src_w, src_h, face_x)
                        label = f"{face_x:.0%}" if face_x is not None else "center fallback"
                        print(f"[reframe] clip {idx}: face={label}")
                except Exception as fe:
                    print(f"[reframe] clip {idx}: face detection failed ({fe}), using default crop")

            _ffmpeg_cut(sources[src_i], ls, le, seg_vf, out, speed=seg.speed or 1.0)
            if os.path.exists(out):
                extracted.append(out)
                ext_durs.append(_duration(out))
                extracted_segs.append(seg)

        if not extracted:
            raise ValueError("No segments extracted — check edit_decision timestamps")

        # 3. Remap transcript words to output timeline
        out_words = []
        if tx_words:
            t = 0.0
            for seg, dur in zip(extracted_segs, ext_durs):
                for w in tx_words:
                    if seg.start <= w["start"] < seg.end:
                        offset = t + (w["start"] - seg.start)
                        out_words.append({
                            "word": w["word"],
                            "start": offset,
                            "end": offset + (w["end"] - w["start"]),
                        })
                t += dur

        phrase_captions = _group_to_phrase_captions(out_words)

        # 4. Render with Remotion, FFmpeg fallback
        final = os.path.join(work, "final.mp4")
        renderer_used = "remotion"

        if not _run_remotion(job_id, extracted, ext_durs, phrase_captions, ed, platform, final, extracted_segs):
            renderer_used = "ffmpeg"
            print("[worker] Falling back to FFmpeg concat (no transitions/captions)")
            concat_list = os.path.join(work, "concat.txt")
            with open(concat_list, "w") as f:
                for c in extracted:
                    f.write(f"file '{c}'\n")
            subprocess.run(
                ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_list, "-c", "copy", final],
                check=True, capture_output=True,
            )

        # 4b. Mix background music when requested
        if ed.audio_treatment in ("trending_sound", "flicko_decides"):
            output_duration = sum(ext_durs)
            music_path = _get_music_track(supabase_url, supabase_key, ed.energy_level, platform, duration_s=output_duration)
            if music_path:
                mixed = os.path.join(work, "final_mixed.mp4")
                if ed.mute_original:
                    # Chaotic footage: silence original, music at full volume
                    success = _mix_music(final, music_path, mixed, voice_vol=0.0, music_vol=1.0)
                    print("[worker] Chaotic footage — original audio muted, music at 100%")
                else:
                    success = _mix_music(final, music_path, mixed, voice_vol=0.55, music_vol=0.22)
                if success:
                    final = mixed
                    print("[worker] Background music mixed in")
                try:
                    os.remove(music_path)
                except Exception:
                    pass

        # 4c. Watermark for free-tier videos
        if user_tier == "free":
            watermarked = os.path.join(work, "final_watermarked.mp4")
            if _apply_watermark(final, watermarked):
                final = watermarked
                print("[worker] Free-tier watermark applied")

        # 5. Upload to Supabase renders bucket — path starts with user_id so RLS policy allows signed URL creation
        dest_path = f"{user_id}/{project_id}/output_{job_id[:8]}.mp4"
        _upload_supabase(final, supabase_url, supabase_key, dest_path)

        # Write completion directly to Supabase — no in-memory state needed
        _update_project(supabase_url, supabase_key, project_id, {
            "status": "done",
            "render_url": dest_path,
        })
        print(f"[flicko-worker] render {job_id} done → {dest_path} (renderer: {renderer_used})")

    except Exception as exc:
        print(f"[flicko-worker] render {job_id} failed:\n{traceback.format_exc()}")
        raise  # let caller write the failed status
    finally:
        if work and os.path.exists(work):
            shutil.rmtree(work, ignore_errors=True)


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    remotion_ready = os.path.isdir(os.path.join(RENDERER_DIR, "node_modules"))
    return {
        "ok": True,
        "whisper_model": WHISPER_MODEL_SIZE,
        "whisper_status": "loaded" if _whisper_model else "loads on first transcription",
        "remotion": "ready" if remotion_ready else "run: cd backend/renderer && npm install",
        "active_threads": threading.active_count(),
    }


@app.post("/transcribe")
def transcribe(req: TranscribeRequest):
    work = None
    try:
        work = tempfile.mkdtemp(prefix="flicko_tx_")
        local_paths, total_dur = [], 0.0

        for i, url in enumerate(req.video_urls):
            p = os.path.join(work, f"src_{i}.mp4")
            _download(url, p)
            total_dur += _duration(p)
            local_paths.append(p)

        if len(local_paths) > 1:
            lst = os.path.join(work, "concat.txt")
            with open(lst, "w") as f:
                for p in local_paths:
                    f.write(f"file '{p}'\n")
            combined = os.path.join(work, "combined.mp4")
            subprocess.run(
                ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", combined],
                check=True, capture_output=True,
            )
            send_path = combined
        else:
            send_path = local_paths[0]

        transcript_text, transcript_words = _transcribe_local(send_path)

        if not transcript_text:
            transcript_text = "[Transcription failed — install faster-whisper: pip install faster-whisper]"

        return {
            "transcript": transcript_text,
            "duration_seconds": total_dur,
            "openshorts_clips": [],
            "transcript_words": transcript_words,
        }
    finally:
        if work and os.path.exists(work):
            shutil.rmtree(work, ignore_errors=True)


@app.post("/render")
def render(req: RenderRequest):
    job_id = str(uuid.uuid4())

    def _run():
        try:
            _do_render(
                job_id,
                req.video_urls,
                req.edit_decision,
                req.target_platform,
                req.project_id,
                req.user_id,
                req.supabase_url,
                req.supabase_service_key,
                req.transcript_words or None,
                req.user_tier,
            )
        except Exception as exc:
            tb = traceback.format_exc()
            print(f"[render] {job_id} failed:\n{tb}")
            last_loc = next(
                (ln.strip() for ln in reversed(tb.splitlines()) if ln.strip().startswith("File")),
                "",
            )
            _update_project(req.supabase_url, req.supabase_service_key, req.project_id, {
                "status": "failed",
                "error_message": f"{type(exc).__name__}: {exc}" + (f"\n\n{last_loc}" if last_loc else ""),
            })

    threading.Thread(target=_run, daemon=True).start()
    return {"job_id": job_id, "ok": True}


@app.get("/render/{job_id}")
def get_render(job_id: str):
    # This endpoint is deprecated — status is now read directly from Supabase projects table.
    raise HTTPException(410, "Poll project status via Supabase, not this endpoint")


# ─── Editor system prompt ─────────────────────────────────────────────────────

_EDITOR_SYSTEM_PROMPT = """You are a senior creative video editor with 15 years of professional experience across social media campaigns, documentaries, branded content, and viral short-form. You have an intuitive read on raw material and you make strong, opinionated creative decisions. You are not trimming a video — you are finding the edit that lives inside the footage.

VARIABLE CLIP DURATION IS YOUR PRIMARY TOOL
- Short clips (0.5–2s): urgency, pace, montage energy
- Medium clips (2–5s): information delivery, setup
- Long clips (5–10s): weight, emotion, comedic timing, revelations
- Cut TIGHT on setup. Hold LONG on reactions, punchlines, emotional peaks. Never cut mid-reaction.

REWIND / REPEAT TECHNIQUE
Replay the same moment by including overlapping timestamps with different "order" values. Use for emphasis, bookends, or reaction structure.

THE ENERGY ARC
Plan a curve: HOOK → BUILD → PEAK → BREATH (optional) → STRONG OUT. Never end mid-thought.
Describe this arc in the "energy_arc" field.

HOOK QUALITY
Choose a hook that: starts in the middle of action/conflict, asks a question the viewer can't leave unanswered, or shows the result first (reverse curiosity).

DEAD AIR IS YOUR ENEMY
Remove filler words, false starts, repeated points, long pauses, tangents. Be ruthless.

MULTIPLE SOURCE CLIPS — when more than one clip is provided:
Every clip was uploaded deliberately. The creator chose each one for a reason — different angle, continuation of a story, a reaction shot, a different scene. Your edit MUST draw from ALL of them.
Do not let audio quality determine which clips get used. A clip with noisier audio is not a clip to skip — it is a clip to be smart about. Use a shorter section of it, pair it with music, or position it where audio quality matters less (cutaway, reaction, visual moment). Never ignore a clip entirely because another one sounds cleaner.
If you only use one clip out of several, you have failed the edit.

SPEED MODIFIERS — use sparingly (max 1–2 per edit)
- 0.5 (slow-mo): punchline reactions, impact moments, emotion
- 2.0 (double speed): montage filler, setup context
- 1.0 (normal): most clips

ZOOM IN — set "zoom_in": true on 1–2 segments maximum per edit.
Use for: the hook moment, a punchline reveal, an emotional peak, or a dramatic statement.
A slow Ken Burns zoom will be applied — the shot gradually pushes in over the clip's duration.
Do NOT zoom every clip. Zero zoom is better than overuse. Never zoom on fast cuts under 1.5s.

PLATFORM TARGETS
- TikTok/Reels: 15–45s
- Shorts: under 60s
- LinkedIn: 45–90s

AUDIO TREATMENT — read the content, then decide. Do not default blindly.

STEP 1 — Is there meaningful speech or sound in this footage?
  YES (talking head, comedy skit, dialogue, interview, reaction, tutorial, storytelling, voiceover narration, a specific sound effect that IS the joke/punchline) → the original audio carries the content. Prioritise "keep_original".
  NO (silent B-roll, ambient visuals, montage clips with no dialogue, action without narration, crowd/event footage where the sound adds nothing) → the original audio is filler. Use "trending_sound".

STEP 2 — What did the user say in the content_context?
  If they describe dialogue, a punchline, a spoken moment, a conversation, a lecture, or a reaction — the audio is the content. Use "keep_original".
  If they describe visuals, a lifestyle clip, a product, action, or say nothing about sound — music is fine.

STEP 3 — Honour the user's audio_preference:
  "flicko_decides"  → apply STEP 1 + STEP 2 above. Make the smart call.
  "trending_sound"  → ALWAYS return "trending_sound" regardless of content.
  "keep_original"   → ALWAYS return "keep_original" regardless of content.
  "voiceover"       → only if has_voice_clone=Yes; otherwise fall back to "flicko_decides" logic.
  NEVER return any value not in: trending_sound | keep_original | voiceover

MUTE ORIGINAL AUDIO — set "mute_original": true ONLY when ALL of these are true:
  1. audio_treatment is "trending_sound"
  2. The original audio is actively harmful to the edit: chaotic background noise, incoherent crowd, wind, hum, or ambient sound that clashes with music
  3. There is no dialogue or intentional sound worth keeping
  When true: original audio is silenced, music plays at full volume.
  When false (default): music is mixed quietly under the original audio.
  NEVER mute original audio when there is any meaningful speech — even if trending_sound is chosen, the speech should be audible under the music.

HOOK TEXT
Write a punchy 4–7 word overlay shown at the start. Hook the viewer before they scroll. Examples: "Wait till the end...", "This changed everything", "Nobody talks about this". No hashtags, no emojis.

CAPTION COLOR — pick ONE hex color that matches this video's energy and vibe.
  High energy / hype:      #FFE500 (yellow), #FF6B35 (orange), #FF1744 (red)
  Fun / comedy:            #7CFC00 (lime), #FF69B4 (pink), #00FF87 (mint)
  Tech / informational:    #00D4FF (cyan), #9B59B6 (purple)
  Clean / professional:    #FFFFFF (white)
  Dramatic / intense:      #FF1744 (red), #FF8C00 (deep orange)
  Choose the single color that best fits the specific content. Never default to white unless the content is genuinely formal.

Return ONLY a valid JSON object, no markdown:
{
  "segments": [{"start": 0.0, "end": 0.0, "order": 1, "reason": "...", "speed": 1.0, "zoom_in": false}],
  "pacing": "fast",
  "transition_type": "cut",
  "audio_treatment": "trending_sound",
  "mute_original": false,
  "caption_style": "bold_center",
  "caption_color": "#FF6B35",
  "energy_level": 4,
  "hook_moment": 0.0,
  "hook_text": "Wait till you see this",
  "energy_arc": "hook → tight setup (4s) → punchline hold (2s) → reaction → out",
  "rationale": "Specific to this content — reference timestamps and explain WHY.",
  "editorial_note": "One sentence of directorial thinking.",
  "suggested_title": "Optional"
}
PACING: slow | medium | fast | very_fast
TRANSITION: cut | fade | zoom | swipe
AUDIO: trending_sound | keep_original | voiceover
CAPTION: bold_center | minimal_bottom | viral_highlight | professional | none
SPEED: 0.5 | 1.0 | 2.0"""


# ─── Supabase project update (REST, no SDK needed) ────────────────────────────

def _update_project(supabase_url: str, key: str, project_id: str, payload: dict) -> None:
    r = requests.patch(
        f"{supabase_url}/rest/v1/projects?id=eq.{project_id}",
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=payload,
        timeout=30,
    )
    if not r.ok:
        print(f"[supabase] update failed {r.status_code}: {r.text[:200]}")


# ─── Style preset prompts ─────────────────────────────────────────────────────

_PRESET_PROMPTS = {
    "raw_real": (
        "\n\nSTYLE PRESET: Raw & Real\n"
        "Minimal cuts. Let moments breathe — do not over-edit. Prefer medium or slow pacing. "
        "Keep longer segments; only cut dead air and genuine filler. Avoid zoom transitions. "
        "Caption style: minimal_bottom or none. Energy level: 1–3."
    ),
    "high_energy": (
        "\n\nSTYLE PRESET: High Energy\n"
        "Maximise energy. Fast cuts, never linger past the point. "
        "Prefer very_fast pacing, viral_highlight captions. Energy level: 4–5. "
        "Use zoom or swipe transitions. Every segment should land like a punch."
    ),
    "cinematic": (
        "\n\nSTYLE PRESET: Cinematic\n"
        "Slower, intentional pacing. Let music carry the emotional weight. "
        "Build an arc — do not rush to the peak. Hold on visually powerful moments. "
        "Prefer fade transitions. Caption style: minimal_bottom or professional. "
        "Energy level: 2–3. Color grade: cinematic or moody."
    ),
    "educational": (
        "\n\nSTYLE PRESET: Educational\n"
        "Clarity above all. Clean structure, readable captions, easy to follow. "
        "Do not sacrifice comprehension for energy. Keep the full explanation — cut only filler and dead air. "
        "Caption style: bold_center or professional. Energy level: 2–3. Color grade: bright_clean or normalize."
    ),
    "viral_hook": (
        "\n\nSTYLE PRESET: Viral Hook\n"
        "The first 3 seconds are everything. Open with the single most scroll-stopping moment — not the start of the story. "
        "The hook must create a question the viewer physically cannot leave without answering. "
        "Everything after the hook exists to deliver on that promise. Fast, punchy, zero dead air. Energy level: 4–5."
    ),
}


# ─── Claude edit decision (runs on Railway, not Vercel) ───────────────────────

def _make_edit_decision(
    api_key: str,
    transcript: str,
    content_context: str,
    desired_outcome: str,
    target_platform: str,
    audio_preference: str,
    duration_seconds: float,
    has_voice_clone: bool,
    creator_patterns: Optional[list] = None,
    clip_boundaries: Optional[list] = None,  # list of (start, end) tuples in seconds
    style_preset: Optional[str] = None,
) -> dict:
    try:
        import anthropic as _anthropic
    except ImportError:
        raise RuntimeError("Install: pip install anthropic")

    system_prompt = _EDITOR_SYSTEM_PROMPT
    if style_preset and style_preset in _PRESET_PROMPTS:
        system_prompt += _PRESET_PROMPTS[style_preset]
    if creator_patterns:
        lines = "\n".join(
            f"  - {p['pattern_text']} [confidence: {round(p['confidence'] * 100)}%]"
            for p in creator_patterns
        )
        system_prompt += (
            "\n═══════════════════════════════════════════\n"
            "  WHAT HAS WORKED FOR THIS CREATOR BEFORE\n"
            "═══════════════════════════════════════════\n"
            "Based on their past edits and real performance data, these patterns have emerged:\n"
            f"{lines}\n\n"
            "Use these as directional signals — they reflect what's actually resonated with this creator's audience. "
            "Lean into them where the content supports it, but always let the material guide the final cut."
        )

    client = _anthropic.Anthropic(api_key=api_key)

    clip_info = ""
    if clip_boundaries and len(clip_boundaries) > 1:
        lines = []
        for i, (s, e) in enumerate(clip_boundaries, 1):
            lines.append(f"  Clip {i}: {s:.2f}s – {e:.2f}s  ({e - s:.1f}s long)")
        clip_info = (
            f"\nSOURCE CLIPS ({len(clip_boundaries)} uploaded):\n"
            + "\n".join(lines)
            + "\n"
            "Every clip listed above was uploaded intentionally. "
            "Your segments MUST include footage from every source clip — "
            "do not skip any clip entirely regardless of audio quality.\n"
        )

    user_msg = (
        f"VIDEO TRANSCRIPT:\n{transcript}\n\n"
        f"CREATOR'S CONTEXT:\n{content_context}\n\n"
        f"DESIRED OUTCOME:\n{desired_outcome}\n\n"
        f"TARGET PLATFORM: {target_platform}\n"
        f"USER'S AUDIO PREFERENCE: {audio_preference}\n"
        f"VOICE CLONE AVAILABLE: {'Yes' if has_voice_clone else 'No'}\n"
        f"TOTAL VIDEO DURATION: {duration_seconds} seconds\n"
        f"{clip_info}\n"
        "Make your creative editing decisions now. Return only valid JSON."
    )
    import re
    last_exc: Exception = RuntimeError("Claude returned no content")
    for attempt in range(3):
        try:
            msg = client.messages.create(
                model="claude-opus-4-7",
                max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_msg}],
            )
            content_blocks = list(msg.content)  # force list — SDK may return tuple
            if not content_blocks:
                raise RuntimeError(f"Claude returned empty content (stop_reason={msg.stop_reason})")
            raw = content_blocks[0].text.strip()
            if raw.startswith("```"):
                raw = re.sub(r"^```(?:json)?\n?", "", raw)
                raw = re.sub(r"\n?```$", "", raw)
            raw = raw.strip()
            return json.loads(raw)
        except json.JSONDecodeError as e:
            last_exc = RuntimeError(f"Claude returned invalid JSON (attempt {attempt+1}): {e}")
            print(f"[editor] JSON parse failed, retrying: {e}")
        except Exception as e:
            last_exc = e
            print(f"[editor] Attempt {attempt+1} failed: {e}")
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise last_exc


# ─── Full pipeline endpoint (all stages on Railway) ───────────────────────────

class CreatorPattern(BaseModel):
    pattern_text: str
    confidence: float
    pattern_category: str


class ProcessRequest(BaseModel):
    video_urls: List[str]
    content_context: str
    desired_outcome: str
    target_platform: str
    audio_preference: str
    project_id: str
    user_id: str
    supabase_url: str
    supabase_service_key: str
    anthropic_api_key: Optional[str] = None
    has_voice_clone: bool = False
    creator_patterns: Optional[List[CreatorPattern]] = None
    user_tier: str = "free"
    style_preset: Optional[str] = None


def _do_process(job_id: str, req: ProcessRequest) -> None:
    sb_url = req.supabase_url
    sb_key = req.supabase_service_key
    pid = req.project_id

    def status(s: str, extra: Optional[dict] = None) -> None:
        payload: dict = {"status": s}
        if extra:
            payload.update(extra)
        _update_project(sb_url, sb_key, pid, payload)

    work = None
    try:
        # Stage 1: Transcription
        status("transcribing")
        work = tempfile.mkdtemp(prefix=f"flicko_{pid[:8]}_")
        local_paths, total_dur = [], 0.0
        clip_boundaries = []  # list of (start_sec, end_sec) per clip

        for i, url in enumerate(req.video_urls):
            p = os.path.join(work, f"src_{i}.mp4")
            _download(url, p)
            dur = _duration(p)
            clip_boundaries.append((total_dur, total_dur + dur))
            total_dur += dur
            local_paths.append(p)

        if not local_paths:
            raise RuntimeError("No video files could be downloaded")
        if len(local_paths) > 1:
            lst = os.path.join(work, "concat.txt")
            with open(lst, "w") as f:
                for p in local_paths:
                    f.write(f"file '{p}'\n")
            combined = os.path.join(work, "combined.mp4")
            subprocess.run(
                ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", combined],
                check=True, capture_output=True,
            )
            send_path = combined
        else:
            send_path = local_paths[0]

        transcript_text, transcript_words = _transcribe_local(send_path)
        if not transcript_text:
            transcript_text = "[Transcription unavailable]"

        _update_project(sb_url, sb_key, pid, {"transcript": transcript_text})

        # Stage 2: Analyze (status beat for UI)
        status("analyzing")

        # Stage 3: Claude edit decision
        status("deciding")
        anthropic_key = req.anthropic_api_key or os.getenv("ANTHROPIC_API_KEY", "")
        if not anthropic_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set on worker")

        patterns_payload = [p.dict() for p in req.creator_patterns] if req.creator_patterns else None
        decision_dict = _make_edit_decision(
            api_key=anthropic_key,
            transcript=transcript_text,
            content_context=req.content_context,
            desired_outcome=req.desired_outcome,
            target_platform=req.target_platform,
            audio_preference=req.audio_preference,
            duration_seconds=total_dur,
            has_voice_clone=req.has_voice_clone,
            creator_patterns=patterns_payload,
            clip_boundaries=clip_boundaries,
            style_preset=req.style_preset,
        )
        # Store duration and word timestamps so the refinement flow can reconstruct
        # captions without re-downloading or re-transcribing the source videos
        decision_dict["video_duration_seconds"] = total_dur
        decision_dict["transcript_words"] = transcript_words
        _update_project(sb_url, sb_key, pid, {"edit_decisions": decision_dict})

        # Stage 4: Edit + render
        status("editing")
        ed = EditDecision(**decision_dict)

        render_job_id = str(uuid.uuid4())
        status("rendering")

        # _do_render raises on failure and writes "done" to Supabase on success
        _do_render(
            render_job_id,
            req.video_urls,
            ed,
            req.target_platform,
            pid,
            req.user_id,
            sb_url,
            sb_key,
            transcript_words,
            req.user_tier,
        )

    except Exception as exc:
        tb = traceback.format_exc()
        print(f"[process] {pid} failed:\n{tb}")
        last_loc = next(
            (ln.strip() for ln in reversed(tb.splitlines()) if ln.strip().startswith("File")),
            "",
        )
        _update_project(sb_url, sb_key, pid, {
            "status": "failed",
            "error_message": f"{type(exc).__name__}: {exc}" + (f"\n\n{last_loc}" if last_loc else ""),
        })
    finally:
        if work and os.path.exists(work):
            shutil.rmtree(work, ignore_errors=True)


@app.post("/process")
def process_video(req: ProcessRequest):
    job_id = str(uuid.uuid4())
    threading.Thread(target=_do_process, args=(job_id, req), daemon=True).start()
    return {"ok": True, "job_id": job_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
