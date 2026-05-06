"""
FastAPI application entry point for the Data Analysis Agent API.
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import engine, Base
from backend.routes.chat import router as chat_router
from backend.routes.conversations import router as conversations_router


app = FastAPI(
    title="Matr — Data Analysis Agent API",
    description=(
        "A FastAPI backend that wraps a PydanticAI data analysis agent, "
        "streaming responses via Server-Sent Events to a React frontend. "
        "See /docs for the interactive API documentation."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
_PRODUCTION_ORIGIN = os.getenv("ALLOWED_ORIGIN", "")
_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
]
if _PRODUCTION_ORIGIN:
    _ALLOWED_ORIGINS.append(_PRODUCTION_ORIGIN)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Startup — create tables if they don't exist
# ---------------------------------------------------------------------------


@app.on_event("startup")
async def startup():
    """
    Create all database tables on startup if they don't exist.

    Uses SQLAlchemy's create_all which is safe to run multiple times —
    it only creates tables that don't already exist.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(chat_router, prefix="/api", tags=["Chat"])
app.include_router(conversations_router, prefix="/api", tags=["Conversations"])

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get(
    "/health",
    tags=["Health"],
    summary="Health check",
)
async def health() -> dict:
    return {
        "status": "ok",
        "message": "Matr Data Analysis Agent API is running.",
    }
