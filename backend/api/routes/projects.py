from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from api.dependencies import get_db, get_current_user
from models.project import Project
from models.video import Video
from models.job import Job
from services.credits import check_and_deduct_credit
from workers.tasks import process_video_project
import uuid

router = APIRouter()

@router.post("/")
def create_project(payload: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):

    if payload.get("include_voiceover") and user.plan == "free":
        raise HTTPException(403, "Voiceover is a Pro feature. Please upgrade to access it.")

    credit_result = check_and_deduct_credit(db, user)
    if not credit_result["success"]:
        raise HTTPException(403, credit_result["message"])

    if user.plan == "free":
        project_count = db.query(Project).filter(Project.user_id == user.id).count()
        if project_count >= 3:
            raise HTTPException(403, "Free plan is limited to 3 projects. Please upgrade to Pro.")

    project = Project(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name=payload["name"],
        context=payload["context"],
        style=payload.get("style", "cinematic"),
        target_duration=payload.get("target_duration", 60),
        status="processing"
    )
    db.add(project)

    videos = (
        db.query(Video)
        .filter(Video.id.in_(payload["video_ids"]))
        .order_by(Video.order)
        .all()
    )
    if not videos:
        raise HTTPException(400, "No valid videos found for this project.")

    job = Job(id=str(uuid.uuid4()), project_id=project.id, status="pending")
    db.add(job)
    db.commit()

    task_payload = {
        "clips": [{"key": v.r2_key, "filename": v.filename} for v in videos],
        "user_context": payload["context"],
        "style": payload.get("style", "cinematic"),
        "target_duration": payload.get("target_duration", 60),
        "include_voiceover": payload.get("include_voiceover", False),
        "voice_id": user.voice_profile.elevenlabs_id if user.voice_profile else None,
        "voiceover_script": payload.get("voiceover_script"),
        "music_key": payload.get("music_key"),
        "is_free_plan": user.plan == "free",
        "platform": payload.get("platform", "tiktok"),
    }

    process_video_project.delay(job.id, project.id, task_payload)

    return {
        "project_id": project.id,
        "job_id": job.id,
        "status": "processing",
        "credits_remaining": credit_result["balance"]
    }


@router.get("/")
def list_projects(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Project).filter(Project.user_id == user.id).all()


@router.get("/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user.id
    ).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return project