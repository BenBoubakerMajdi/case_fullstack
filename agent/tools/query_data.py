"""
query_data tool — SQL execution engine for the Data Analysis Agent.

Executes DuckDB SQL queries against in-memory DataFrames loaded from CSV files.
Each result is stored in the AgentContext history so visualize_web can
reference it by index even when the agent batches multiple queries.
"""

import duckdb
from pydantic_ai import RunContext

from agent.context import AgentContext

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Results with this many rows or fewer are shown in full.
# Above this threshold, only the first 5 rows are previewed.
# Rationale: the agent needs full data for small result sets to correctly
# identify max/min values without running additional queries.
_FULL_PREVIEW_THRESHOLD = 20


# ---------------------------------------------------------------------------
# Tool
# ---------------------------------------------------------------------------
async def query_data(
    ctx: RunContext[AgentContext],
    sql: str,
    description: str,
) -> str:
    """
    Execute a SQL query against the loaded datasets and return a summary.

    How it works:
        1. Registers all loaded DataFrames as DuckDB in-memory tables
        2. Executes the SQL query
        3. Stores the result in both current_dataframe and dataframe_history
        4. Returns a formatted summary including a data preview

    The [QUERY_INDEX:N] tag in the response is critical — it tells the agent
    which index to pass to visualize_web's query_index parameter so the
    correct DataFrame is used even when queries are batched.

    Why in-memory DuckDB instead of persistent storage:
        Each query creates a fresh DuckDB connection to avoid state pollution
        between queries. DataFrames are registered per-connection, which is
        fast for the dataset sizes we handle (<10k rows).

    Args:
        ctx: PydanticAI RunContext carrying the AgentContext dependency.
        sql: DuckDB-compatible SQL query. Table names must match dataset names.
             Use double quotes for column names with spaces: "Column Name".
        description: Human-readable description of what this query does.
                     Shown in the frontend tool call block.

    Returns:
        Formatted string containing:
        - Success/error status
        - Result dimensions (rows x columns)
        - Column names
        - Full data preview (≤20 rows) or first 5 rows (>20 rows)
        - [QUERY_INDEX:N] tag for visualize_web reference
    """
    if not ctx.deps.datasets:
        return "Error: No datasets loaded. Add CSV files to the data/ directory."

    try:
        # Fresh connection per query — avoids state pollution between calls
        with duckdb.connect(database=":memory:") as conn:
            # Register all DataFrames as virtual tables
            for name, df in ctx.deps.datasets.items():
                conn.register(name, df)

            result_df = conn.execute(sql).fetchdf()

        # Store result in context for downstream tool access
        ctx.deps.current_dataframe = result_df
        ctx.deps.dataframe_history.append(
            result_df.copy())  # Copy prevents mutation

        # Show full data for small results — agent needs complete data to
        # correctly answer ranking questions (highest, lowest, top N)
        if result_df.shape[0] <= _FULL_PREVIEW_THRESHOLD:
            preview = result_df.to_string(index=False)
            preview_label = "Full data"
        else:
            preview = result_df.head(5).to_string(index=False)
            preview_label = "Preview (first 5 rows)"

        # The QUERY_INDEX tag is parsed by the agent to know which
        # dataframe_history slot to pass as query_index to visualize_web
        query_index = len(ctx.deps.dataframe_history) - 1

        return (
            f"Query executed successfully.\n"
            f"Result: {result_df.shape[0]} rows x {result_df.shape[1]} columns\n"
            f"Columns: {', '.join(result_df.columns.tolist())}\n"
            f"{preview_label}:\n{preview}\n"
            f"[QUERY_INDEX:{query_index}]"
        )

    except Exception as e:
        # Return error as string so the agent can self-correct the SQL
        # rather than crashing the entire tool call chain
        return f"Error executing SQL query: {e}"
