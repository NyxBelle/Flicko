from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from models.database import Base
import uuid

class User(Base):
    __tablename__ = "users"

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email         = Column(String, unique=True, nullable=False)
    hashed_pw     = Column(String, nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow)
    is_active     = Column(Boolean, default=True)
    plan          = Column(String, default="free")        # "free" or "pro"
    plan_expires  = Column(DateTime, nullable=True)       # when Pro expires

    projects      = relationship("Project", back_populates="user")
    voice_profile = relationship("VoiceProfile", back_populates="user", uselist=False)
    credits       = relationship("Credit", back_populates="user", uselist=False)