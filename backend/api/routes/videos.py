from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from api.dependencies import get_db, get_current_user
from models.video import Video
from services.storage import upload_file
import tempfile, os, uuid

router = APIRouter()

ALLOWED_TYPES = {"video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"}
MAX_SIZE_MB = 500

@router.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    order: int = Form(0),
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"File type {file.content_type} not supported.")

    contents = await file.read()
    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Max {MAX_SIZE_MB}MB.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    r2_key = f"uploads/{user.id}/{project_id}/{uuid.uuid4()}_{file.filename}"
    upload_file(tmp_path, r2_key)
    os.remove(tmp_path)

    video = Video(
        id=str(uuid.uuid4()),
        project_id=project_id,
        filename=file.filename,
        r2_key=r2_key,
        order=order
    )
    db.add(video)
    db.commit()

    return {"video_id": video.id, "filename": file.filename, "order": order}


@router.get("/")
def list_videos(project_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    videos = db.query(Video).filter(Video.project_id == project_id).order_by(Video.order).all()
    return videos
    