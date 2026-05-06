"""
visualize_web tool — web-compatible visualization engine for the Data Analysis Agent.

Replaces the CLI visualize tool (which saved HTML files to disk) with a version
that returns Plotly figures as JSON strings. The frontend receives these JSON
strings via SSE and renders them as interactive charts using Plotly.js.

Key differences from the original visualize tool:
    - Returns PLOTLY_JSON:{...} or TABLE_JSON:{...} prefixed strings
    - Uses dataframe_history[query_index] instead of current_dataframe
      to support agent batching (multiple queries before visualizations)
    - Strips import statements from agent code to prevent namespace conflicts
    - Limits table output to 100 rows for frontend performance

Output format:
    PLOTLY_JSON:{plotly_figure_json}  — parsed by _parse_tool_result() in stream.py
    TABLE_JSON:{table_dict_json}      — parsed by _parse_tool_result() in stream.py
"""

import json
from typing import Literal

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from pydantic_ai import RunContext

from agent.context import AgentContext

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Maximum rows returned in table output.
# Limits frontend rendering cost for large datasets.
_MAX_TABLE_ROWS = 100


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _strip_imports(code: str) -> str:
    """
    Remove import statements from agent-generated visualization code.

    Why this is necessary:
        The execution namespace pre-loads pd, px, and go. If the agent writes
        'import plotly.express as px', it shadows the pre-loaded px with a
        fresh import that may have different state, causing subtle errors.
        Stripping imports ensures the agent always uses the injected namespace.

    Args:
        code: Raw Python code string from the agent.

    Returns:
        Code with all 'import' and 'from ... import' lines removed.
    """
    lines = code.split("\n")
    clean_lines = [
        line for line in lines
        if not line.strip().startswith("import ")
        and not line.strip().startswith("from ")
    ]
    return "\n".join(clean_lines)


def _resolve_dataframe(
    ctx: RunContext[AgentContext],
    query_index: int,
) -> pd.DataFrame | None:
    """
    Retrieve the correct DataFrame for this visualization.

    Resolution priority:
        1. dataframe_history[query_index] if query_index is valid
        2. current_dataframe as fallback for single-query scenarios
        3. None if no data is available

    Why we copy:
        exec() may mutate the DataFrame (e.g. df = df.rename(...)).
        Copying prevents the history snapshot from being modified,
        which would corrupt subsequent visualizations using the same index.

    Args:
        ctx: RunContext carrying the AgentContext dependency.
        query_index: Index into dataframe_history. -1 means use latest.

    Returns:
        A copy of the resolved DataFrame, or None if unavailable.
    """
    history = ctx.deps.dataframe_history

    if 0 <= query_index < len(history):
        # Use the specific historical snapshot requested by the agent
        return history[query_index].copy()

    if ctx.deps.current_dataframe is not None:
        # Fallback: use the most recent query result
        return ctx.deps.current_dataframe.copy()

    return None


# ---------------------------------------------------------------------------
# Tool
# ---------------------------------------------------------------------------
async def visualize_web(
    ctx: RunContext[AgentContext],
    code: str,
    title: str,
    result_type: Literal["figure", "table"],
    description: str,
    query_index: int = -1,
) -> str:
    """
    Execute visualization code and return the result as a JSON-prefixed string.

    The returned string is parsed by _parse_tool_result() in stream.py,
    which converts it into the appropriate SSE event type for the frontend.

    Execution environment:
        The agent's code runs in an isolated namespace with these pre-loaded:
        - df  : DataFrame from dataframe_history[query_index]
        - pd  : pandas
        - px  : plotly.express
        - go  : plotly.graph_objects

    Security note:
        exec() is used here because PydanticAI tool calls require dynamic
        code execution for agent-generated visualizations. This is acceptable
        in a controlled single-user development environment but should be
        sandboxed (e.g. RestrictedPython) before any public deployment.

    Args:
        ctx:          PydanticAI RunContext carrying the AgentContext dependency.
        code:         Python code to execute. Must create 'fig' (figure) or
                      'result' (table) variable depending on result_type.
        title:        Human-readable title shown in the frontend chart header.
        result_type:  "figure" → Plotly chart, "table" → DataTable component.
        description:  What this visualization shows (shown in tool call block).
        query_index:  Which dataframe_history slot to use as `df`.
                      Use explicit indices (0, 1, 2...) for batched queries.
                      Default -1 falls back to current_dataframe.

    Returns:
        "PLOTLY_JSON:{json}"  for figures
        "TABLE_JSON:{json}"   for tables
        "Error: ..."          if execution fails (agent will self-correct)
    """
    # ── Resolve the correct DataFrame ────────────────────────────────────
    df = _resolve_dataframe(ctx, query_index)
    if df is None:
        return "Error: No data available. Call query_data first."

    # ── Clean agent code ──────────────────────────────────────────────────
    # Strip imports to prevent namespace shadowing (see _strip_imports docstring)
    clean_code = _strip_imports(code)

    # ── Execute in isolated namespace ─────────────────────────────────────
    try:
        namespace = {
            "df": df,
            "pd": pd,
            "px": px,
            "go": go,
        }

        exec(clean_code, namespace)  # nosec — controlled dev environment only

        # ── Return result in frontend-parseable format ────────────────────
        if result_type == "figure":
            fig = namespace.get("fig")
            if fig is None:
                return (
                    "Error: Code must create a 'fig' variable (Plotly Figure). "
                    "Example: fig = px.bar(df, x='column', y='value')"
                )
            return f"PLOTLY_JSON:{fig.to_json()}"

        elif result_type == "table":
            # Default to full df if agent didn't create a 'result' variable
            result: pd.DataFrame = namespace.get("result", df)
            table_data = {
                "columns": result.columns.tolist(),
                "data": result.head(_MAX_TABLE_ROWS).to_dict(orient="records"),
                "shape": list(result.shape),
            }
            return f"TABLE_JSON:{json.dumps(table_data)}"

        else:
            return (
                f"Error: Unknown result_type '{result_type}'. "
                f"Use 'figure' for charts or 'table' for tabular data."
            )

    except Exception as e:
        # Return error as string so the agent can read it and self-correct
        # rather than crashing the tool call chain
        return f"Error creating visualization: {e}"
