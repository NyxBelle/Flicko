from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from models.database import Base
import uuid

class Project(Base):
    __tablename__ = "projects"

    id              = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id         = Column(String, ForeignKey("users.id"), nullable=False)
    name            = Column(String, nullable=False)
    context         = Column(Text)
    style           = Column(String)
    target_duration = Column(Integer)
    status          = Column(String, default="draft")
    created_at      = Column(DateTime, default=datetime.utcnow)

    user            = relationship("User", back_populates="projects")
    videos          = relationship("Video", back_populates="project")
    jobs            = relationship("Job", back_populates="project")