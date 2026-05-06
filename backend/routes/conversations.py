"""
Conversation routes — CRUD endpoints for conversation history.

Endpoints:
    GET    /conversations          — list all conversations (newest first)
    POST   /conversations          — create a new conversation
    GET    /conversations/:id      — get a conversation with all its messages
    DELETE /conversations/:id      — delete a conversation and all its messages
    PATCH  /conversations/:id      — update conversation title
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.models import Conversation, Message

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter()

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/conversations",
    summary="List all conversations",
    description="Returns all conversations ordered by most recently updated.",
)
async def list_conversations(
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    Return all conversations ordered by updated_at descending.
    Does not include messages — use GET /conversations/:id for that.
    """
    result = await db.execute(
        select(Conversation)
        .order_by(desc(Conversation.updated_at))
    )
    conversations = result.scalars().all()
    return [c.to_dict() for c in conversations]


@router.post(
    "/conversations",
    summary="Create a new conversation",
    description="Creates a new empty conversation and returns it.",
)
async def create_conversation(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Create a new conversation with default title.
    Title is updated to the first question when the user sends a message.
    """
    conversation = Conversation(
        id=uuid.uuid4(),
        title="New conversation",
    )
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return conversation.to_dict()


@router.get(
    "/conversations/{conversation_id}",
    summary="Get a conversation with messages",
    description="Returns a conversation and all its messages for re-rendering.",
)
async def get_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Return a conversation with all its messages.

    Messages include the full SSE events array so the frontend
    can re-render charts, tables, and thinking blocks from history.
    """
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    return {
        **conversation.to_dict(),
        "messages": [m.to_dict() for m in conversation.messages],
    }


@router.delete(
    "/conversations/{conversation_id}",
    summary="Delete a conversation",
    description="Deletes a conversation and all its messages permanently.",
)
async def delete_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Delete a conversation and cascade delete all its messages.
    The CASCADE is handled at the database level via the FK constraint.
    """
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    await db.delete(conversation)
    await db.commit()
    return {"message": "Conversation deleted successfully."}


@router.patch(
    "/conversations/{conversation_id}",
    summary="Update conversation title",
    description="Update the title of a conversation.",
)
async def update_conversation_title(
    conversation_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Update the title of a conversation.

    Called automatically after the first message to set a meaningful
    title derived from the user's question.
    """
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    if "title" in body:
        conversation.title = body["title"][:255]  # Enforce max length
        conversation.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(conversation)
    return conversation.to_dict()
