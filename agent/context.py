"""
Agent context for PydanticAI dependency injection.

This module defines the shared state passed to all agent tools
during a single agent.run() call. Each tool receives a RunContext[AgentContext]
and can read/write the context to share data between tool calls.

Key design decision — dataframe_history:
    The agent sometimes batches multiple query_data calls before calling
    visualize_web. Without history, each new query overwrites current_dataframe,
    causing visualizations to use the wrong data.

    Solution: query_data appends each result to dataframe_history with an index.
    visualize_web accepts a query_index parameter to retrieve the correct snapshot.
    This makes visualization order-independent regardless of agent batching behavior.
"""

from dataclasses import dataclass, field
from typing import Optional

import pandas as pd


@dataclass
class AgentContext:
    """
    Shared state injected into all agent tools via PydanticAI dependency injection.

    Lifecycle:
        A fresh AgentContext is created for each user question in stream.py.
        It is passed to agent.run() as the deps argument and remains alive
        for the entire duration of that run, including all tool calls.

    Attributes:
        datasets:           All loaded CSV datasets keyed by sanitized table name.
                            Used by query_data to register tables with DuckDB.

        dataset_info:       Formatted string describing datasets and columns.
                            Stored here for reference but primarily used in
                            the system prompt via create_agent().

        current_dataframe:  The DataFrame from the most recent query_data call.
                            Legacy field — prefer dataframe_history[index] for
                            multi-query scenarios to avoid overwrite issues.

        dataframe_history:  Ordered list of DataFrame snapshots, one per
                            query_data call. Index 0 = first query, 1 = second, etc.
                            visualize_web uses query_index to retrieve the correct
                            DataFrame when the agent batches multiple queries.
    """

    # All CSV datasets loaded from data/ — keyed by sanitized SQL table name
    datasets: dict[str, pd.DataFrame] = field(default_factory=dict)

    # Human-readable dataset summary injected into the agent system prompt
    dataset_info: str = ""

    # Most recent query result — overwritten on each query_data call
    # Use dataframe_history for reliable multi-query access
    current_dataframe: Optional[pd.DataFrame] = None

    # Append-only history of query results — indexed by query call order
    # Reset to [] at the start of each question in stream_agent_response()
    dataframe_history: list[pd.DataFrame] = field(default_factory=list)
