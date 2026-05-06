"""
Database connection and session management.

Uses SQLAlchemy async engine with asyncpg driver for PostgreSQL.
The async_sessionmaker provides a session factory used by all endpoints.

Connection string is read from the DATABASE_URL environment variable.
Falls back to a local Docker Compose URL for development convenience.
"""

import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

# Read from environment — set in .env for local dev, in Railway for production
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://matr:matr@localhost:5432/matr",
)

# echo=False in production — set to True locally to see SQL queries
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
)

# Session factory — used by FastAPI dependency injection
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# ---------------------------------------------------------------------------
# Base class for all ORM models
# ---------------------------------------------------------------------------


class Base(DeclarativeBase):
    """Base class that all ORM models inherit from."""
    pass

# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yield an async database session for use in FastAPI endpoints.

    Usage:
        @router.get("/example")
        async def example(db: AsyncSession = Depends(get_db)):
            ...

    The session is automatically closed after the request completes.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
