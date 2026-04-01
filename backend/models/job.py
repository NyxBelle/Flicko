from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from models.database import Base
import uuid

class Job(Base):
    __tablename__ = "jobs"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id  = Column(String, ForeignKey("projects.id"), nullable=False)
    status      = Column(String, default="pending")
    progress    = Column(Integer, default=0)
    message     = Column(String, default="")
    result_url  = Column(Text, default="")
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project     = relationship("Project", back_populates="jobs")