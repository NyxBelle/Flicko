import os
import shutil
import tempfile
from workers.celery_app import celery_app
from models.database import SessionLocal
from models.job import Job

from services.storage import download_file, upload_file, get_presigned_url
from services.transcription import transcribe_video
from services.scene_detection import detect_scenes
from services.ai_editor import generate_edit_plan
from services.video_renderer import render_video
from services.voice_clone import generate_voiceover


def update_job(db, job_id: str, status: str, progress: int, message: str = "", result_url: str = ""):
    job = db.query(Job).filter(Job.id == job_id).first()
    if job:
        job.status = status
        job.progress = progress
        job.message = message
        job.result_url = result_url
        db.commit()


@celery_app.task(bind=True, max_retries=2)
def process_video_project(self, job_id: str, project_id: str, payload: dict):
    db = SessionLocal()
    work_dir = None

    try:
        # Step 1: Download clips
        update_job(db, job_id, "processing", 5, "Downloading clips...")
        work_dir = tempfile.mkdtemp(prefix=f"flicko_{project_id}_")
        local_clips = []

        for clip in payload["clips"]:
            local_path = os.path.join(work_dir, clip["filename"])
            download_file(clip["key"], local_path)
            local_clips.append(local_path)

        # Step 2: Transcribe
        update_job(db, job_id, "processing", 20, "Transcribing audio...")
        clips_metadata = []
        for local_path, clip in zip(local_clips, payload["clips"]):
            transcript = transcribe_video(local_path)
            scenes = detect_scenes(local_path)
            clips_metadata.append({
                "filename": clip["filename"],
                "duration": scenes[-1]["end_sec"] if scenes else 0,
                "transcript": transcript,
                "scenes": scenes
            })

        # Step 3: AI edit plan
        update_job(db, job_id, "processing", 40, "AI is planning the edit...")
        edit_plan = generate_edit_plan(
            clips_metadata=clips_metadata,
            user_context=payload["user_context"],
            style=payload["style"],
            target_duration=payload["target_duration"],
            include_voiceover=payload["include_voiceover"]
        )

        # Step 4: Voiceover
        if payload.get("include_voiceover") and payload.get("voice_id"):
            update_job(db, job_id, "processing", 55, "Generating voiceover in your voice...")
            vo_path = os.path.join(work_dir, "voiceover.mp3")
            generate_voiceover(
                script=payload.get("voiceover_script") or edit_plan["voiceover"]["script"],
                voice_id=payload["voice_id"],
                output_path=vo_path
            )
            edit_plan["voiceover"]["local_path"] = vo_path

        # Step 5: Background music
        if payload.get("music_key"):
            update_job(db, job_id, "processing", 60, "Loading background music...")
            music_path = os.path.join(work_dir, "music.mp3")
            download_file(payload["music_key"], music_path)
            edit_plan["music_local_path"] = music_path

        # Step 6: Render
        update_job(db, job_id, "processing", 70, "Rendering final video...")
        output_path = os.path.join(work_dir, f"{project_id}_final.mp4")
        render_video(
            edit_plan=edit_plan,
            source_dir=work_dir,
            output_path=output_path
        )

        # Step 7: Upload result
        update_job(db, job_id, "processing", 90, "Uploading finished video...")
        result_key = f"outputs/{project_id}/final.mp4"
        upload_file(output_path, result_key)
        download_url = get_presigned_url(result_key, expires=86400)

        # Step 8: Done
        update_job(db, job_id, "done", 100, "Your video is ready!", result_url=download_url)

    except Exception as exc:
        update_job(db, job_id, "failed", 0, f"Error: {str(exc)}")
        raise self.retry(exc=exc, countdown=30)

    finally:
        db.close()
        if work_dir and os.path.exists(work_dir):
            shutil.rmtree(work_dir)
```

**Ctrl+S**

---

Your `backend/workers` folder should now have:
```
workers/
├── __init__.py
├── celery_app.py
└── tasks.py