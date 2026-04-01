from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from models.database import Base
import uuid

class Video(Base):
    __tablename__ = "videos"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id  = Column(String, ForeignKey("projects.id"), nullable=False)
    filename    = Column(String, nullable=False)
    r2_key      = Column(String, nullable=False)
    order       = Column(Integer, default=0)
    duration    = Column(Float)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    project     = relationship("Project", back_populates="videos")