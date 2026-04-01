from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from api.dependencies import get_db, get_current_user
from models.job import Job

router = APIRouter()

@router.get("/{job_id}")
def get_job_status(job_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    return {
        "status": job.status,
        "progress": job.progress,
        "message": job.message,
        "result_url": job.result_url
    }