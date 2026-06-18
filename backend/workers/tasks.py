import os
import shutil
import tempfile
import json
from workers.celery_app import celery_app
from models.database import SessionLocal
from models.job import Job

from services.storage import download_file, upload_file, get_presigned_url
from services.transcription import transcribe_video
from services.scene_detection import detect_scenes
from services.ai_editor import generate_edit_plan
from services.video_renderer import render_video
from services.voice_clone import generate_voiceover
from services.beat_sync import get_beat_timestamps, snap_cuts_to_beats
from services.captions import generate_srt, generate_word_timed_srt, remove_filler_words
from services.broll import fetch_broll_clip


def update_job(db, job_id: str, status: str, progress: int, message: str = "", result_url: str = "", edit_plan_json: str = ""):
    job = db.query(Job).filter(Job.id == job_id).first()
    if job:
        job.status = status
        job.progress = progress
        job.message = message
        job.result_url = result_url
        if edit_plan_json:
            job.edit_plan_json = edit_plan_json
        db.commit()


@celery_app.task(bind=True, max_retries=2)
def process_video_project(self, job_id: str, project_id: str, payload: dict):
    db = SessionLocal()
    work_dir = None

    try:
        # Step 1: Download clips
        update_job(db, job_id, "processing", 5, "Downloading your clips...")
        work_dir = tempfile.mkdtemp(prefix=f"flicko_{project_id}_")
        local_clips = []

        for clip in payload["clips"]:
            local_path = os.path.join(work_dir, clip["filename"])
            download_file(clip["key"], local_path)
            local_clips.append(local_path)

        # Step 2: Transcribe all clips
        update_job(db, job_id, "processing", 15, "Listening to your clips...")
        clips_metadata = []
        all_segments = []

        for local_path, clip in zip(local_clips, payload["clips"]):
            transcript = transcribe_video(local_path)
            scenes = detect_scenes(local_path)

            cleaned_segments = remove_filler_words(transcript.get("segments", []))
            transcript["segments"] = cleaned_segments
            all_segments.extend(cleaned_segments)

            clips_metadata.append({
                "filename": clip["filename"],
                "duration": scenes[-1]["end_sec"] if scenes else 0,
                "transcript": transcript,
                "scenes": scenes
            })

        # Step 3: Generate word-timed SRT captions (CapCut-style)
        update_job(db, job_id, "processing", 25, "Generating captions...")
        srt_path = os.path.join(work_dir, "captions.srt")
        all_words = []
        for meta in clips_metadata:
            all_words.extend(meta.get("transcript", {}).get("words", []))
        full_transcript = {"segments": all_segments, "words": all_words}
        generate_word_timed_srt(full_transcript, srt_path)

        # Step 4: AI generates viral edit plan
        update_job(db, job_id, "processing", 35, "AI is crafting your edit...")
        edit_plan = generate_edit_plan(
            clips_metadata=clips_metadata,
            user_context=payload["user_context"],
            style=payload["style"],
            target_duration=payload["target_duration"],
            include_voiceover=payload["include_voiceover"],
            platform=payload.get("platform", "tiktok"),
            db=db
        )

        # Attach captions path and style to edit plan
        if os.path.exists(srt_path):
            edit_plan["captions_srt_path"] = srt_path
        # Prefer frontend caption_style over AI default; map common AI output names
        _style_map = {"bold_white": "bold_center", "bold": "bold_center"}
        incoming_style = payload.get("caption_style") or edit_plan.get("caption_style", "bold_center")
        edit_plan["caption_style"] = _style_map.get(incoming_style, incoming_style)

        # Merge frontend color grade decision into edit plan
        if payload.get("color_grade"):
            edit_plan["color_grade"] = payload["color_grade"]

        # Store edit plan for self-learning
        edit_plan_json = json.dumps(edit_plan)
        update_job(db, job_id, "processing", 42, "Edit plan ready...", edit_plan_json=edit_plan_json)

        # Step 5: Download music and snap cuts to beats
        # Priority: Jamendo URL from frontend > uploaded music_key
        music_path = None
        music_track_url = payload.get("music_track_url")
        if music_track_url:
            update_job(db, job_id, "processing", 48, "Downloading music track...")
            music_path = os.path.join(work_dir, "music.mp3")
            import urllib.request
            urllib.request.urlretrieve(music_track_url, music_path)
        elif payload.get("music_key"):
            update_job(db, job_id, "processing", 48, "Loading music track...")
            music_path = os.path.join(work_dir, "music.mp3")
            download_file(payload["music_key"], music_path)

        if music_path and os.path.exists(music_path):
            update_job(db, job_id, "processing", 50, "Syncing cuts to music beats...")
            edit_plan["music_local_path"] = music_path
            beat_times = get_beat_timestamps(music_path)
            if beat_times:
                edit_plan["clips"] = snap_cuts_to_beats(edit_plan["clips"], beat_times)

        # Step 6: Fetch and inject b-roll clips (if AI suggested any)
        b_roll_hints = edit_plan.get("b_roll_hints") or payload.get("b_roll_hints") or []
        if b_roll_hints:
            update_job(db, job_id, "processing", 58, "Fetching b-roll footage...")
            clips = edit_plan["clips"]
            # Insert b-roll clips after the referenced order position
            inserts: list[tuple[int, dict]] = []
            for idx, hint in enumerate(b_roll_hints):
                broll_path = fetch_broll_clip(hint, work_dir, idx)
                if not broll_path:
                    continue
                # Find insert position: after clip with matching order
                after_order = hint.get("after_order", 0)
                insert_pos = next(
                    (i + 1 for i, c in enumerate(clips) if c.get("order", i) == after_order),
                    len(clips),
                )
                broll_clip = {
                    "source_file": os.path.basename(broll_path),
                    "start_sec": 0,
                    "end_sec": float(hint.get("duration", 3.0)),
                    "purpose": "broll",
                    "energy_level": "medium",
                    "transition_in": "cut",
                    "transition_out": "cut",
                    "music_duck": True,
                    "text_overlay": "",
                    "text_position": "bottom",
                    "notes": hint.get("description", "b-roll"),
                    "_local_path": broll_path,
                }
                inserts.append((insert_pos, broll_clip))
                # Copy the file into work_dir so renderer can find it by filename
                dest = os.path.join(work_dir, os.path.basename(broll_path))
                if not os.path.exists(dest):
                    import shutil as _sh
                    _sh.copy2(broll_path, dest)

            # Apply inserts in reverse order to preserve positions
            for pos, clip in sorted(inserts, key=lambda x: x[0], reverse=True):
                clips.insert(pos, clip)
            edit_plan["clips"] = clips

        # Step 7: Generate voiceover
        if payload.get("include_voiceover") and payload.get("voice_id"):
            update_job(db, job_id, "processing", 62, "Generating voiceover in your voice...")
            vo_path = os.path.join(work_dir, "voiceover.mp3")
            generate_voiceover(
                script=payload.get("voiceover_script") or edit_plan["voiceover"]["script"],
                voice_id=payload["voice_id"],
                output_path=vo_path
            )
            edit_plan["voiceover"]["local_path"] = vo_path

        # Step 8: Render final video
        update_job(db, job_id, "processing", 70, "Rendering your video...")
        output_path = os.path.join(work_dir, f"{project_id}_final.mp4")
        render_video(
            edit_plan=edit_plan,
            source_dir=work_dir,
            output_path=output_path,
            is_free_plan=payload.get("is_free_plan", False)
        )

        # Step 9: Upload result
        update_job(db, job_id, "processing", 90, "Uploading your finished video...")
        result_key = f"outputs/{project_id}/final.mp4"
        upload_file(output_path, result_key)
        download_url = get_presigned_url(result_key, expires=86400)

        # Step 10: Done
        update_job(db, job_id, "done", 100, "Your video is ready!", result_url=download_url)

    except Exception as exc:
        update_job(db, job_id, "failed", 0, f"Something went wrong: {str(exc)}")
        raise self.retry(exc=exc, countdown=30)

    finally:
        db.close()
        if work_dir and os.path.exists(work_dir):
            shutil.rmtree(work_dir)