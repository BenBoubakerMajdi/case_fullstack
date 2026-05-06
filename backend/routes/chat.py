"""
Chat routes for the Data Analysis Agent API.

Endpoints:
    POST   /chat/stream      — Stream agent response via SSE
    DELETE /chat/history     — Reset in-memory conversation history
    GET    /datasets         — List available datasets
    POST   /datasets/upload  — Upload a CSV dataset

Architecture note on message_history:
    In-memory list shared across requests — suitable for development.
    For multi-user support, replace with session-keyed store per user.
"""

import json
import shutil
import uuid
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Conversation, Message
from backend.schemas import ChatRequest
from backend.services.stream import DATA_DIR, load_datasets, stream_agent_response

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter()

# ---------------------------------------------------------------------------
# In-memory conversation history
#
# WARNING: Single shared list — suitable for development only.
# All users share the same conversation context in this implementation.
# Production replacement: keyed dict or Redis store per session_id.
# ---------------------------------------------------------------------------
_message_history: list = []


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/chat/stream",
    summary="Stream agent response",
    description=(
        "Send a question to the agent and receive a streaming SSE response. "
        "Optionally pass a conversation_id to save messages to the database."
    ),
)
async def stream_chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    Stream the agent's response as Server-Sent Events.

    If conversation_id is provided in the request:
    - Saves the user message to the database
    - Saves the assistant response to the database
    - Updates the conversation title from the first question
    """
    # Collect all SSE events for DB storage
    collected_events: list[dict] = []

    async def generate():
        async for event_str in stream_agent_response(
            question=request.question,
            message_history=_message_history,
        ):
            # Parse event for storage
            if event_str.startswith("data: "):
                try:
                    event_data = json.loads(event_str[6:].strip())
                    collected_events.append(event_data)
                except json.JSONDecodeError:
                    pass

            yield event_str

        # Save to DB after streaming completes
        if request.conversation_id:
            await _save_messages_to_db(
                db=db,
                conversation_id=request.conversation_id,
                question=request.question,
                events=collected_events,
            )

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _save_messages_to_db(
    db: AsyncSession,
    conversation_id: str,
    question: str,
    events: list[dict],
) -> None:
    """
    Save user question and assistant response to the database.

    Also updates the conversation title from the first question
    if the title is still the default 'New conversation'.

    Args:
        db:              Database session.
        conversation_id: UUID string of the conversation.
        question:        The user's question text.
        events:          All SSE events collected during streaming.
    """
    try:
        conv_id = uuid.UUID(conversation_id)

        # Fetch conversation
        result = await db.execute(
            select(Conversation).where(Conversation.id == conv_id)
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            return

        # Auto-title from first question
        if conversation.title == "New conversation":
            conversation.title = question[:60] + \
                ("..." if len(question) > 60 else "")

        conversation.updated_at = datetime.now(timezone.utc)

        # Save user message
        user_message = Message(
            id=uuid.uuid4(),
            conversation_id=conv_id,
            role="user",
            content=question,
            events=[{"type": "text", "content": question}],
        )
        db.add(user_message)

        # Extract final answer text for content field
        final_content = ""
        for event in events:
            if event.get("type") == "final":
                final_content = event.get("content", "")
                break

        # Save assistant message with full events for re-rendering
        assistant_message = Message(
            id=uuid.uuid4(),
            conversation_id=conv_id,
            role="assistant",
            content=final_content,
            events=[e for e in events if e.get(
                "type") not in ("done", "text_delta")],
        )
        db.add(assistant_message)

        await db.commit()

    except Exception as e:
        # Don't crash the response if DB save fails
        print(f"Warning: Failed to save messages to DB: {e}")


@router.delete(
    "/chat/history",
    summary="Clear conversation history",
    description="Reset the in-memory conversation history.",
)
async def clear_history() -> dict:
    """Clear the shared in-memory conversation history."""
    global _message_history
    _message_history = []
    return {"message": "Conversation history cleared successfully."}


@router.get(
    "/datasets",
    summary="List available datasets",
    description="Returns metadata for all CSV files in the data/ directory.",
)
async def get_datasets() -> list[dict]:
    """Return metadata for all available datasets."""
    datasets, _ = load_datasets()
    return [
        {
            "name": name,
            "rows": df.shape[0],
            "columns": df.columns.tolist(),
        }
        for name, df in datasets.items()
    ]


@router.post(
    "/datasets/upload",
    summary="Upload a CSV dataset",
    description="Upload a CSV file to the data/ directory.",
)
async def upload_dataset(file: UploadFile = File(...)) -> dict:
    """Save an uploaded CSV file to the data/ directory."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=400, detail="Only CSV files are supported.")

    destination = DATA_DIR / file.filename
    with destination.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    df = pd.read_csv(destination)
    return {
        "message": f"Dataset '{file.filename}' uploaded successfully.",
        "name": file.filename.replace(".csv", "").lower(),
        "rows": df.shape[0],
        "columns": df.columns.tolist(),
    }
