from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from jose import jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from api.dependencies import get_db
from models.user import User
from config import settings
import uuid

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

@router.post("/register")
def register(payload: dict, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload["email"]).first()
    if existing:
        raise HTTPException(400, "Email already registered.")
    user = User(
        id=str(uuid.uuid4()),
        email=payload["email"],
        hashed_pw=pwd_context.hash(payload["password"])
    )
    db.add(user)
    db.commit()
    return {"access_token": create_token(user.id), "token_type": "bearer"}

@router.post("/login")
def login(payload: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload["email"]).first()
    if not user or not pwd_context.verify(payload["password"], user.hashed_pw):
        raise HTTPException(401, "Invalid email or password.")
    return {"access_token": create_token(user.id), "token_type": "bearer"}