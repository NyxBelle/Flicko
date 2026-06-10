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
from pathlib import Path
from typing import List, Optional
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Flicko Worker", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_IS_WINDOWS = platform.system() == "Windows"
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")
RENDERER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "renderer")
RENDERER_PUBLIC = os.path.join(RENDERER_DIR, "public")
# Set USE_REMOTION=true in production (Railway). Locally FFmpeg is used — Remotion needs more CPU.
USE_REMOTION = os.getenv("USE_REMOTION", "false").lower() == "true"

_jobs: dict = {}
_whisper_model = None


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
    work = None
    try:
        _jobs[job_id]["status"] = "processing"
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

        # 5. Upload to Supabase renders bucket — path starts with user_id so RLS policy allows signed URL creation
        dest_path = f"{user_id}/{project_id}/output_{job_id[:8]}.mp4"
        _upload_supabase(final, supabase_url, supabase_key, dest_path)

        _jobs[job_id].update({"status": "done", "output_url": dest_path, "renderer": renderer_used})

    except Exception as exc:
        _jobs[job_id].update({"status": "failed", "error": str(exc)})
        print(f"[flicko-worker] render {job_id} failed:\n{traceback.format_exc()}")
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
        "active_jobs": len([j for j in _jobs.values() if j["status"] == "processing"]),
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
    _jobs[job_id] = {"status": "pending", "output_url": None, "error": None}

    threading.Thread(
        target=_do_render,
        args=(job_id, req.video_urls, req.edit_decision, req.target_platform,
              req.project_id, req.user_id, req.supabase_url, req.supabase_service_key,
              req.transcript_words or None),
        daemon=True,
    ).start()

    return {"job_id": job_id}


@app.get("/render/{job_id}")
def get_render(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
