from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from api.routes import videos, projects, jobs, voice, auth
from models.database import engine, Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="Flicko API",
    version="1.0.0",
    description="AI Video Editor Backend",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://flicko.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.routes import videos, projects, jobs, voice, auth
app.include_router(auth.router,     prefix="/api/auth",     tags=["Auth"])
app.include_router(videos.router,   prefix="/api/videos",   tags=["Videos"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(jobs.router,     prefix="/api/jobs",     tags=["Jobs"])
app.include_router(voice.router,    prefix="/api/voice",    tags=["Voice"])

@app.get("/health")
def health():
    return {"status": "ok", "service": "flicko-api"}
```

**Ctrl+S** to save.

---

### File 4 — `backend/requirements.txt`

Right-click the **backend** folder → New File → name it `requirements.txt`

Paste this:
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
psycopg2-binary==2.9.9
alembic==1.13.1
pydantic==2.7.1
pydantic-settings==2.2.1
python-multipart==0.0.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
celery[redis]==5.4.0
redis==5.0.4
boto3==1.34.100
openai-whisper==20231117
anthropic==0.27.0
scenedetect[opencv]==0.6.3
moviepy==1.0.3
librosa==0.10.2
requests==2.31.0
ffmpeg-python==0.2.0