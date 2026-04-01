from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from models.database import Base
import uuid

class VoiceProfile(Base):
    __tablename__ = "voice_profiles"

    id              = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id         = Column(String, ForeignKey("users.id"), nullable=False)
    elevenlabs_id   = Column(String)
    sample_r2_key   = Column(String)
    consent_given   = Column(Boolean, default=False)
    consent_at      = Column(DateTime)
    created_at      = Column(DateTime, default=datetime.utcnow)

    user            = relationship("User", back_populates="voice_profile")
```

**Ctrl+S**

---

### File — `backend/models/__init__.py`

Right-click the **backend/models** folder → New File → name it `__init__.py`

Leave it **completely empty** and just **Ctrl+S**. This file just tells Python that models is a package.

---

Your `backend/models` folder should now have:
```
models/
├── __init__.py
├── database.py
├── user.py
├── project.py
├── video.py
├── job.py
└── voice_profile.py