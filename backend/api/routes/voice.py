from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from api.dependencies import get_db, get_current_user
from models.voice_profile import VoiceProfile
from services.storage import upload_file
from services.voice_clone import clone_voice
from datetime import datetime
import tempfile, os, uuid

router = APIRouter()

@router.post("/upload-sample")
async def upload_voice_sample(
    file: UploadFile = File(...),
    consent: bool = Form(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    if not consent:
        raise HTTPException(400, "Voice cloning requires explicit consent.")

    if file.content_type not in {"audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a"}:
        raise HTTPException(400, "Please upload an MP3, WAV, or M4A file.")

    contents = await file.read()

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    r2_key = f"voice_samples/{user.id}/{uuid.uuid4()}.mp3"
    upload_file(tmp_path, r2_key)

    voice_id = clone_voice(tmp_path, voice_name=user.email.split("@")[0], user_id=user.id)
    os.remove(tmp_path)

    profile = db.query(VoiceProfile).filter(VoiceProfile.user_id == user.id).first()
    if not profile:
        profile = VoiceProfile(user_id=user.id)
        db.add(profile)

    profile.elevenlabs_id = voice_id
    profile.sample_r2_key = r2_key
    profile.consent_given = True
    profile.consent_at = datetime.utcnow()
    db.commit()

    return {"voice_id": voice_id, "message": "Voice profile created successfully."}


@router.get("/profile")
def get_voice_profile(db: Session = Depends(get_db), user=Depends(get_current_user)):
    profile = db.query(VoiceProfile).filter(VoiceProfile.user_id == user.id).first()
    if not profile:
        return {"has_voice": False}
    return {
        "has_voice": True,
        "voice_id": profile.elevenlabs_id,
        "created_at": profile.created_at
    }
