"""
Pydantic schemas for the Data Analysis Agent API.

Defines request/response models used by the FastAPI endpoints
and SSE event types streamed to the frontend.
"""

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Represents a user question sent to the agent."""

    question: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The user's natural language question about the data.",
    )

    conversation_id: Optional[str] = Field(
        None,
        description="UUID of the conversation to save messages to. If None, messages are not persisted.",
    )


class SSEEvent(BaseModel):
    """
    Represents a single Server-Sent Event streamed to the frontend.

    Each event has a type that determines how the frontend renders it:

    Agent reasoning:
    - thinking    : Agent's internal reasoning block — rendered collapsible
    - text_delta  : Single word streamed for typing effect — accumulated by frontend

    Tool execution:
    - tool_call   : Tool invocation — shows name and arguments to the user
    - tool_result : Raw string result from a tool execution

    Visualizations:
    - visualization : Plotly figure JSON — rendered as interactive chart
    - table         : Tabular data — rendered as scrollable DataTable

    Final response:
    - final  : Complete answer — replaces text_delta events, rendered as markdown
    - error  : Error message — displayed as an alert block
    - done   : Stream completion signal — marks message as no longer streaming
    """

    type: Literal[
        "thinking",
        "tool_call",
        "tool_result",
        "visualization",
        "table",
        "text",
        "text_delta",   # Individual word streamed for typing effect
        "final",
        "error",
        "done",
    ]

    # ── Text content fields ───────────────────────────────────────────────
    content: Optional[str] = Field(
        None,
        description="Text content for thinking, text_delta, final, and error events.",
    )

    # ── Tool call fields ──────────────────────────────────────────────────
    tool_name: Optional[str] = Field(
        None,
        description="Name of the tool being called or whose result is being returned.",
    )
    tool_args: Optional[dict[str, Any]] = Field(
        None,
        description="Arguments passed to the tool — displayed in the tool call block.",
    )
    tool_result: Optional[str] = Field(
        None,
        description="Raw string result from the tool — displayed in the tool result block.",
    )

    # ── Visualization fields ──────────────────────────────────────────────
    plotly_data: Optional[dict[str, Any]] = Field(
        None,
        description="Plotly figure as JSON dict — rendered as an interactive chart.",
    )
    table_data: Optional[list[dict[str, Any]]] = Field(
        None,
        description="List of row dicts for table events — rendered as a DataTable.",
    )
    table_columns: Optional[list[str]] = Field(
        None,
        description="Ordered list of column names for table events.",
    )
    
class ConversationCreate(BaseModel):
    """Request body for creating a conversation — empty for now."""
    pass

class ConversationTitleUpdate(BaseModel):
    """Request body for updating a conversation title."""
    title: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="New title for the conversation.",
    )
