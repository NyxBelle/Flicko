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

app.include_router(auth.router,     prefix="/api/auth",     tags=["Auth"])
app.include_router(videos.router,   prefix="/api/videos",   tags=["Videos"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(jobs.router,     prefix="/api/jobs",     tags=["Jobs"])
app.include_router(voice.router,    prefix="/api/voice",    tags=["Voice"])

@app.get("/health")
def health():
    return {"status": "ok", "service": "flicko-api"}