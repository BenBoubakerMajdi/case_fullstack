"""
Streaming service for the Data Analysis Agent.

Responsibilities:
- Loading CSV datasets from the data/ directory
- Running the PydanticAI agent with real-time tool call streaming
- Streaming SSE events to the frontend progressively
- Cleaning and streaming the final answer word by word for a typing effect

Architecture decision:
    We use agent.iter() (PydanticAI node streaming) for real-time tool call
    visibility. This gives us access to each node as it executes — we can
    emit tool_call events immediately when the agent invokes a tool, and
    tool_result events immediately when the tool returns, without waiting
    for the entire run to complete.

    The typing effect is achieved by streaming the final text answer
    word by word after all tools have completed.
"""

import asyncio
import json
import re
import sys
from pathlib import Path
from typing import AsyncGenerator

import pandas as pd
from dotenv import load_dotenv
from pydantic_ai.messages import (
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
)

# ---------------------------------------------------------------------------
# Path bootstrap — must happen before local imports
# ---------------------------------------------------------------------------
ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from agent.agent import create_agent
from agent.context import AgentContext

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Exported so routes can reference the same data directory
DATA_DIR = ROOT / "data"

# Matches <thinking>...</thinking> blocks in agent responses
THINKING_PATTERN = re.compile(r"<thinking>(.*?)</thinking>", re.DOTALL)

# Used to sanitize CSV filenames into valid SQL table names
CSV_NAME_PATTERN = re.compile(r"[^a-zA-Z0-9_]")

# Patterns for leaked tool output prefixes in final text
_LEAKED_TABLE_TAG = re.compile(r"<TABLE_JSON:[^>]*>")
_LEAKED_PLOTLY_JSON = re.compile(r"PLOTLY_JSON:\{.*?\}", re.DOTALL)
_LEAKED_TABLE_JSON = re.compile(r"TABLE_JSON:\{.*?\}", re.DOTALL)

# Delay between words when streaming the final answer (typing effect)
WORD_STREAM_DELAY = 0.06


# ---------------------------------------------------------------------------
# Dataset loading
# ---------------------------------------------------------------------------
def load_datasets() -> tuple[dict[str, pd.DataFrame], str]:
    """
    Load all CSV files from the data/ directory into DataFrames.

    Each filename is sanitized into a valid SQL table name so DuckDB
    can reference it directly in queries.

    Returns:
        Tuple of (datasets dict, dataset_info string for system prompt).
    """
    if not DATA_DIR.exists():
        return {}, "No datasets available. Add CSV files to the data/ directory."

    datasets: dict[str, pd.DataFrame] = {}
    info_lines: list[str] = []

    for csv_file in sorted(DATA_DIR.glob("*.csv")):
        name = CSV_NAME_PATTERN.sub("_", csv_file.stem).strip("_").lower()
        df = pd.read_csv(csv_file)
        datasets[name] = df
        cols = ", ".join(df.columns.tolist())
        info_lines.append(
            f"- **{name}** ({df.shape[0]} rows, {df.shape[1]} columns)\n"
            f"  Columns: {cols}"
        )

    if not info_lines:
        return {}, "No datasets available. Add CSV files to the data/ directory."

    return datasets, "\n".join(info_lines)


# ---------------------------------------------------------------------------
# SSE helpers
# ---------------------------------------------------------------------------
def _build_event(payload: dict) -> str:
    """Serialize a payload dict into an SSE-formatted data line."""
    return f"data: {json.dumps(payload)}\n\n"


def _parse_tool_args(args: str | dict) -> dict:
    """Safely coerce tool arguments into a plain dict."""
    if isinstance(args, dict):
        return args
    if isinstance(args, str):
        try:
            return json.loads(args)
        except json.JSONDecodeError:
            return {"raw": args}
    return {}


def _parse_tool_result(content: str) -> dict:
    """
    Convert a tool return string into the appropriate SSE event dict.

    PLOTLY_JSON → visualization event
    TABLE_JSON  → table event
    anything else → tool_result event
    """
    if content.startswith("PLOTLY_JSON:"):
        try:
            plotly_data = json.loads(content[len("PLOTLY_JSON:"):])
            return {"type": "visualization", "plotly_data": plotly_data}
        except json.JSONDecodeError:
            pass

    if content.startswith("TABLE_JSON:"):
        try:
            table_data = json.loads(content[len("TABLE_JSON:"):])
            return {
                "type": "table",
                "table_columns": table_data.get("columns", []),
                "table_data": table_data.get("data", []),
            }
        except json.JSONDecodeError:
            pass

    return {"type": "tool_result", "tool_result": content}


def _clean_final_answer(text: str) -> str:
    """Remove leaked tool output prefixes from the agent's final text."""
    text = _LEAKED_TABLE_TAG.sub("", text)
    text = _LEAKED_PLOTLY_JSON.sub("", text)
    text = _LEAKED_TABLE_JSON.sub("", text)
    return text.strip()


def parse_thinking(text: str) -> tuple[str, str]:
    """
    Extract <thinking> blocks from agent text.

    Returns:
        Tuple of (thinking_content, clean_text_without_thinking_blocks).
    """
    thinking_parts = THINKING_PATTERN.findall(text)
    thinking = "\n".join(t.strip() for t in thinking_parts)
    clean_text = THINKING_PATTERN.sub("", text).strip()
    return thinking, clean_text


# ---------------------------------------------------------------------------
# Real-time message streaming
# ---------------------------------------------------------------------------
async def _stream_messages_realtime(
    new_messages: list,
) -> AsyncGenerator[str, None]:
    """
    Stream SSE events from agent messages with small delays between
    tool calls to create a realistic real-time feel.

    Even though we use agent.run() (batch), we introduce micro-delays
    between each event so the frontend renders them progressively
    instead of all at once — giving the appearance of real-time streaming.

    Args:
        new_messages: List of new PydanticAI messages from this run.

    Yields:
        SSE-formatted strings for each relevant message part.
    """
    for msg in new_messages:

        if isinstance(msg, ModelResponse):
            for part in msg.parts:

                if isinstance(part, TextPart) and part.content.strip():
                    
                    print(f"[DEBUG] TextPart: {repr(part.content[:200])}")
                    
                    thinking, remaining_text = parse_thinking(part.content)
                    if thinking:
                        yield _build_event({
                            "type": "thinking",
                            "content": thinking,
                        })
                        # Small pause after thinking block appears
                        await asyncio.sleep(0.1)

                elif isinstance(part, ToolCallPart):
                    yield _build_event({
                        "type": "tool_call",
                        "tool_name": part.tool_name,
                        "tool_args": _parse_tool_args(part.args),
                    })
                    # Pause after tool call — user reads the arguments
                    await asyncio.sleep(0.3)

        elif isinstance(msg, ModelRequest):
            for part in msg.parts:
                if isinstance(part, ToolReturnPart):
                    event = _parse_tool_result(str(part.content))
                    yield _build_event(event)
                    # Pause after tool result — user sees the result
                    await asyncio.sleep(0.2)
                    

async def _stream_final_answer(
    final_answer: str,
) -> AsyncGenerator[str, None]:
    """
    Stream the final answer word by word for a natural typing effect.

    Emits text_delta events for the typing effect, then a single
    final event for proper markdown rendering.

    Args:
        final_answer: Cleaned final answer text from the agent.

    Yields:
        SSE-formatted text_delta events, then a single final event.
    """
    words = final_answer.split(" ")

    for i, word in enumerate(words):
        yield _build_event({
            "type": "text_delta",
            "content": word + (" " if i < len(words) - 1 else ""),
        })
        await asyncio.sleep(WORD_STREAM_DELAY)

    # Send complete answer for markdown rendering
    yield _build_event({
        "type": "final",
        "content": final_answer,
    })


# ---------------------------------------------------------------------------
# Main public interface
# ---------------------------------------------------------------------------
async def stream_agent_response(
    question: str,
    message_history: list,
) -> AsyncGenerator[str, None]:
    """
    Run the agent and stream SSE events to the frontend in real time.

    Flow:
    1. Load datasets from data/ directory
    2. Run the agent with agent.run() for reliable tool execution
    3. Stream tool calls and results progressively with micro-delays
    4. Clean the final answer and stream it word by word
    5. Update message history for multi-turn conversation support

    Why micro-delays instead of true streaming:
        PydanticAI's run_stream() causes tool calls to be missed when
        text is streamed simultaneously. agent.run() executes all tools
        reliably. We simulate real-time feel by introducing small delays
        between each event — tool calls appear one by one with pauses,
        giving the user the impression of live execution.

    Args:
        question: The user's natural language question.
        message_history: Existing conversation history for multi-turn support.
                         Modified in-place to include this turn's messages.

    Yields:
        SSE-formatted strings representing each step of the agent's response.
    """
    # ── Load datasets ────────────────────────────────────────────────────
    datasets, dataset_info = load_datasets()

    if not datasets:
        yield _build_event({
            "type": "error",
            "content": "No datasets found. Add CSV files to the data/ directory.",
        })
        return

    # ── Initialize agent and context ─────────────────────────────────────
    agent = create_agent(dataset_info)
    context = AgentContext(
        datasets=datasets,
        dataset_info=dataset_info,
        dataframe_history=[],
    )

    try:
        # ── Run agent (reliable tool execution) ──────────────────────────
        result = await agent.run(
            question,
            deps=context,
            message_history=message_history or None,
        )

        all_messages = result.all_messages()
        new_messages = all_messages[len(message_history):]

        # ── Stream tool calls and results with real-time feel ─────────────
        async for event in _stream_messages_realtime(new_messages):
            yield event

        # ── Stream final answer word by word ──────────────────────────────
        _, raw_answer = parse_thinking(result.output)
        final_answer = _clean_final_answer(raw_answer)

        if final_answer:
            async for event in _stream_final_answer(final_answer):
                yield event

        # ── Update conversation history for next turn ─────────────────────
        message_history.clear()
        message_history.extend(all_messages)

        yield _build_event({"type": "done"})

    except Exception as e:
        yield _build_event({
            "type": "error",
            "content": f"Agent error: {str(e)}",
        })
