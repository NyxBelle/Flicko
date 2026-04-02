from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from models.database import Base
import uuid

class Credit(Base):
    __tablename__ = "credits"

    id           = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id      = Column(String, ForeignKey("users.id"), nullable=False)
    balance      = Column(Integer, default=5)        # 5 for free, 100 for pro
    last_reset   = Column(DateTime, default=datetime.utcnow)
    created_at   = Column(DateTime, default=datetime.utcnow)

    user         = relationship("User", back_populates="credits")