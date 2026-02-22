from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.api.mind_maps import router as mind_maps_router
from app.models.mind_map import MindMap  # Needed for SQLModel metadata

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the database on startup
    init_db()
    yield

app = FastAPI(title="MyMindMap Backend", lifespan=lifespan)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mind_maps_router)

@app.get("/")
async def root():
    return {"message": "Welcome to MyMindMap API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
