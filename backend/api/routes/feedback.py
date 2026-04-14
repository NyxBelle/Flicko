from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from api.dependencies import get_db, get_current_user
from models.edit_feedback import EditFeedback
from models.project import Project
from models.job import Job
import uuid

router = APIRouter()

@router.post("/{project_id}")
def submit_feedback(
    project_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """
    User rates their edit after downloading.
    This feeds the self-learning system.
    payload: { rating: 1-5, feedback: "text", platform: "tiktok" }
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user.id
    ).first()

    if not project:
        raise HTTPException(404, "Project not found")

    # Get the edit plan that was used
    job = db.query(Job).filter(Job.project_id == project_id).first()

    feedback = EditFeedback(
        id=str(uuid.uuid4()),
        project_id=project_id,
        user_id=user.id,
        rating=payload.get("rating"),
        user_feedback=payload.get("feedback", ""),
        style=project.style,
        user_context=project.context,
        edit_plan_json=job.edit_plan_json if job and hasattr(job, "edit_plan_json") else "",
        platform=payload.get("platform", "tiktok")
    )

    db.add(feedback)
    db.commit()

    return {"message": "Thank you for your feedback! Flicko is learning from this."}


@router.get("/stats")
def get_feedback_stats(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Show user their edit history and average ratings."""
    feedbacks = db.query(EditFeedback).filter(
        EditFeedback.user_id == user.id
    ).all()

    if not feedbacks:
        return {"average_rating": 0, "total_edits": 0}

    avg = sum(f.rating for f in feedbacks if f.rating) / len(feedbacks)
    return {
        "average_rating": round(avg, 1),
        "total_edits": len(feedbacks),
        "ratings_breakdown": {
            "5_star": len([f for f in feedbacks if f.rating == 5]),
            "4_star": len([f for f in feedbacks if f.rating == 4]),
            "3_star": len([f for f in feedbacks if f.rating == 3]),
            "2_star": len([f for f in feedbacks if f.rating == 2]),
            "1_star": len([f for f in feedbacks if f.rating == 1]),
        }
    }