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


def _ffmpeg_cut(src: str, ls: float, le: float, vf_str: str, out: str, speed: float = 1.0) -> None:
    speed = speed if speed and speed > 0 else 1.0
    video_filter = vf_str
    audio_filters = []

    if abs(speed - 1.0) > 0.05:
        pts = 1.0 / speed
        video_filter = f"{vf_str},setpts={pts:.4f}*PTS"
        # atempo range is 0.5–2.0; chain two passes for extreme values
        if speed <= 0.5:
            audio_filters = ["atempo=0.5", "atempo=1.0"]  # 0.5x
        elif speed >= 2.0:
            audio_filters = ["atempo=2.0"]
        else:
            audio_filters = [f"atempo={speed:.4f}"]

    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{ls:.4f}", "-to", f"{le:.4f}", "-i", src,
        "-vf", video_filter,
        "-r", "30", "-c:v", "libx264", "-preset", "fast", "-crf", "22",
    ]
    if audio_filters:
        cmd += ["-af", ",".join(audio_filters)]
    cmd += ["-c:a", "aac", "-ar", "44100", "-ac", "2", out]
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
    """Group word-level timestamps into caption phrases with frame numbers."""
    captions, buf = [], []
    for w in words:
        buf.append(w)
        if len(buf) >= max_words or w["word"].endswith((".", "!", "?", ",")):
            captions.append({
                "text": " ".join(x["word"] for x in buf),
                "startFrame": int(buf[0]["start"] * fps),
                "endFrame": int(buf[-1]["end"] * fps),
            })
            buf = []
    if buf:
        captions.append({
            "text": " ".join(x["word"] for x in buf),
            "startFrame": int(buf[0]["start"] * fps),
            "endFrame": int(buf[-1]["end"] * fps),
        })
    return captions


def _get_music_track_pixabay(api_key: str, energy_level: int, platform: str) -> Optional[str]:
    """Fetch a royalty-free track from Pixabay Music API matched to energy level."""
    import random

    # Map energy level → genre + mood + search term
    if energy_level >= 4:
        genre = "electronic"
        mood = "happy"
        q = "upbeat energetic"
    elif energy_level == 3:
        genre = "pop"
        mood = "happy"
        q = "upbeat catchy"
    elif energy_level == 2:
        genre = "pop"
        mood = "neutral"
        q = "chill background"
    else:
        genre = "ambient"
        mood = "calm"
        q = "calm background"

    # LinkedIn → lean more cinematic/professional
    if platform in ("linkedin", "youtube"):
        genre = "cinematic"
        mood = "neutral"
        q = "background corporate"

    try:
        r = requests.get(
            "https://pixabay.com/api/music/",
            params={
                "key": api_key,
                "q": q,
                "genre": genre,
                "mood": mood,
                "order": "popular",
                "per_page": 20,
            },
            timeout=20,
        )
        r.raise_for_status()
        hits = r.json().get("hits", [])

        # Retry without genre/mood filter if no results
        if not hits:
            r2 = requests.get(
                "https://pixabay.com/api/music/",
                params={"key": api_key, "q": q, "order": "popular", "per_page": 20},
                timeout=20,
            )
            r2.raise_for_status()
            hits = r2.json().get("hits", [])

        if not hits:
            print("[music] Pixabay returned no tracks for this query")
            return None

        chosen = random.choice(hits[:10])

        # Pixabay returns the audio URL nested under "audio.url" or flat "audioUrl"
        audio_url = (
            chosen.get("audio", {}).get("url")
            or chosen.get("audioUrl")
            or chosen.get("url")
            or ""
        )
        if not audio_url:
            print("[music] Pixabay hit missing audio URL")
            return None

        tmp = tempfile.mktemp(suffix=".mp3")
        _download(audio_url, tmp)
        print(f"[music] Pixabay track: \"{chosen.get('title', 'untitled')}\" ({chosen.get('duration', '?')}s)")
        return tmp

    except Exception as e:
        print(f"[music] Pixabay fetch failed: {e}")
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


def _get_music_track(supabase_url: str, key: str, energy_level: int, platform: str = "") -> Optional[str]:
    """Get a background music track. Tries Pixabay first, falls back to Supabase bucket."""
    pixabay_key = os.getenv("PIXABAY_API_KEY", "")
    if pixabay_key:
        track = _get_music_track_pixabay(pixabay_key, energy_level, platform)
        if track:
            return track
        print("[music] Pixabay failed, trying Supabase bucket fallback...")
    return _get_music_track_supabase(supabase_url, key, energy_level)


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

    props = {
        "clips": [
            {"name": name, "durationInFrames": max(1, int(dur * fps))}
            for name, dur in zip(clip_names, clip_durations)
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

        # 2. Extract segments in Claude's editorial order
        segs = sorted(ed.segments, key=lambda s: s.order)
        extracted, ext_durs = [], []

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
            _ffmpeg_cut(sources[src_i], ls, le, vf_str, out, speed=seg.speed or 1.0)
            if os.path.exists(out):
                extracted.append(out)
                ext_durs.append(_duration(out))

        if not extracted:
            raise ValueError("No segments extracted — check edit_decision timestamps")

        # 3. Remap transcript words to output timeline
        out_words = []
        if tx_words:
            t = 0.0
            for seg, dur in zip(segs, ext_durs):
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

        if not _run_remotion(job_id, extracted, ext_durs, phrase_captions, ed, platform, final):
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
            music_path = _get_music_track(supabase_url, supabase_key, ed.energy_level, platform)
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
            )
        except Exception as exc:
            _update_project(req.supabase_url, req.supabase_service_key, req.project_id, {
                "status": "failed",
                "error_message": str(exc),
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

SPEED MODIFIERS — use sparingly (max 1–2 per edit)
- 0.5 (slow-mo): punchline reactions, impact moments, emotion
- 2.0 (double speed): montage filler, setup context
- 1.0 (normal): most clips

PLATFORM TARGETS
- TikTok/Reels: 15–45s
- Shorts: under 60s
- LinkedIn: 45–90s

AUDIO TREATMENT RULES — what to write in "audio_treatment":
  "trending_sound"  → add background music (DEFAULT for TikTok/Reels/Shorts)
  "keep_original"   → keep raw audio only (when dialogue/natural sound IS the content)
  "voiceover"       → AI voice narration (only when has_voice_clone=Yes)
  If USER'S AUDIO PREFERENCE is "flicko_decides": YOU decide. Default "trending_sound" for vertical/entertainment content.
  If USER'S AUDIO PREFERENCE is "trending_sound": ALWAYS return "trending_sound".
  NEVER return "no_voiceover" or any value not in the list above.

MUTE ORIGINAL AUDIO — set "mute_original": true ONLY when:
  - The source footage audio is chaotic, incoherent, or adds no value (e.g. background noise, loud crowd, pointless ambient sound)
  - The footage clearly has no narrative or dialogue worth keeping
  When mute_original is true, the original audio is silenced completely and music plays at full volume.
  When false (default), music is mixed under the original audio.

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
  "segments": [{"start": 0.0, "end": 0.0, "order": 1, "reason": "...", "speed": 1.0}],
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
) -> dict:
    try:
        import anthropic as _anthropic
    except ImportError:
        raise RuntimeError("Install: pip install anthropic")

    system_prompt = _EDITOR_SYSTEM_PROMPT
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
    user_msg = (
        f"VIDEO TRANSCRIPT:\n{transcript}\n\n"
        f"CREATOR'S CONTEXT:\n{content_context}\n\n"
        f"DESIRED OUTCOME:\n{desired_outcome}\n\n"
        f"TARGET PLATFORM: {target_platform}\n"
        f"USER'S AUDIO PREFERENCE: {audio_preference}\n"
        f"VOICE CLONE AVAILABLE: {'Yes' if has_voice_clone else 'No'}\n"
        f"TOTAL VIDEO DURATION: {duration_seconds} seconds\n\n"
        "Make your creative editing decisions now. Return only valid JSON."
    )
    msg = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=2048,
        system=system_prompt,
        messages=[{"role": "user", "content": user_msg}],
    )
    import re
    raw = msg.content[0].text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
    return json.loads(raw)


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
        )
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
        )

    except Exception as exc:
        print(f"[process] {pid} failed:\n{traceback.format_exc()}")
        _update_project(sb_url, sb_key, pid, {"status": "failed", "error_message": str(exc)})
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
