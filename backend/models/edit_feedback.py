from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from models.database import Base
import uuid

class EditFeedback(Base):
    __tablename__ = "edit_feedback"

    id              = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id      = Column(String, ForeignKey("projects.id"), nullable=False)
    user_id         = Column(String, ForeignKey("users.id"), nullable=False)
    rating          = Column(Integer)           # 1-5 stars
    user_feedback   = Column(Text)              # what they said in words
    style           = Column(String)            # cinematic, fast_cut, vlog, highlight
    user_context    = Column(Text)              # what the event was
    edit_plan_json  = Column(Text)              # the full edit plan that was used
    platform        = Column(String)            # tiktok, youtube, instagram
    created_at      = Column(DateTime, default=datetime.utcnow)