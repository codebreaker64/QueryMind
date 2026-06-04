"""
mcp_server.py — MCP server exposing web_search and ask_user tools.

Uses the MCP Python SDK to register tools with proper schemas.
Provides helpers to convert tool definitions to OpenAI function-calling
format and to dispatch tool calls from the agent loop.
"""

from mcp.server import Server
from mcp.types import Tool, TextContent
import mcp.types as types

from tools.search import web_search
from tools.hitl import ask_user


# Create MCP server instance
mcp_server = Server("querymind")


# ── Tool definitions ────────────────────────────────────────────────

TOOL_DEFINITIONS: list[dict] = [
    {
        "name": "web_search",
        "description": (
            "Search the web for information on a given query. "
            "Returns formatted results with titles, URLs, and content snippets. "
            "Use this to gather information for the research goal. "
            "You may call this multiple times with different queries to get "
            "comprehensive coverage."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query string.",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "ask_user",
        "description": (
            "Ask the user a clarifying question to refine the research. "
            "Use this when you need more specific direction, want to narrow "
            "down the scope, or need the user's preference before proceeding. "
            "The agent will pause until the user responds."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "The clarifying question to ask the user.",
                },
            },
            "required": ["question"],
        },
    },
]


def get_openai_tools() -> list[dict]:
    """
    Convert tool definitions to OpenAI function-calling format.

    Returns a list of tool objects suitable for the `tools` parameter
    of the OpenAI Chat Completions API.
    """
    return [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["parameters"],
            },
        }
        for tool in TOOL_DEFINITIONS
    ]


async def execute_tool(
    name: str,
    arguments: dict,
    session_id: str,
    ws_manager,
    state_manager,
    agent_context: dict,
) -> str:
    """
    Dispatch a tool call by name.

    Args:
        name: Tool name ('web_search' or 'ask_user').
        arguments: Dict of arguments for the tool.
        session_id: Current session ID.
        ws_manager: WebSocket connection manager.
        state_manager: StateManager for HITL persistence.
        agent_context: Current agent context for state serialization.

    Returns:
        The tool's string result.
    """
    if name == "web_search":
        query = arguments.get("query", "")
        return await web_search(query)

    elif name == "ask_user":
        question = arguments.get("question", "")
        return await ask_user(
            question=question,
            session_id=session_id,
            ws_manager=ws_manager,
            state_manager=state_manager,
            agent_context=agent_context,
        )

    else:
        return f"Error: Unknown tool '{name}'"
