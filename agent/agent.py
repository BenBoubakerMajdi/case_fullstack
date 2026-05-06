"""
Data Analysis Agent factory.

Creates a PydanticAI agent configured with two tools:
- query_data    : Executes SQL queries against loaded CSV datasets via DuckDB
- visualize_web : Generates Plotly figures/tables and returns them as JSON
                  (web-compatible replacement for the CLI visualize tool)

The agent model is configured via the MODEL environment variable,
allowing easy switching between providers without code changes.

Supported model formats (PydanticAI provider:model syntax):
    openai:gpt-4o          — Best instruction following, recommended
    openai:gpt-4o-mini     — Faster and cheaper, less reliable for complex rules
    anthropic:claude-haiku-4-5-20251001 — Anthropic alternative
"""

import os

from pydantic_ai import Agent

from agent.context import AgentContext
from agent.prompt import get_system_prompt
from agent.tools.query_data import query_data
from agent.tools.visualize_web import visualize_web

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Default model — gpt-4o chosen for reliable multi-rule instruction following.
_DEFAULT_MODEL = "openai:gpt-4o"

# Number of times the agent will retry a failed tool call before giving up.
_AGENT_RETRIES = 3


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------
def create_agent(dataset_info: str) -> Agent[AgentContext]:
    """
    Create and configure a PydanticAI data analysis agent.

    The agent is stateless — a new instance is created per question.
    State is maintained externally via the AgentContext dependency
    and the message_history list passed to agent.run().

    Why create a new agent per question rather than reusing one:
        PydanticAI agents are lightweight objects. Creating a new one
        per question ensures the system prompt always reflects the
        current dataset state without stale context.

    Args:
        dataset_info: Formatted markdown string describing available datasets,
                      injected into the system prompt so the agent knows
                      which tables and columns it can query.

    Returns:
        Fully configured PydanticAI Agent ready for agent.run() calls.
    """
    model = os.getenv("MODEL", _DEFAULT_MODEL)

    agent: Agent[AgentContext] = Agent(
        model=model,
        deps_type=AgentContext,
        system_prompt=get_system_prompt(dataset_info),
        retries=_AGENT_RETRIES,
    )

    # Register tools
    agent.tool(query_data)      # Step 1: query data via SQL
    agent.tool(visualize_web)   # Step 2: visualize query results

    return agent
