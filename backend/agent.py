"""
agent.py — Agentic loop (GPT-5.5 + MCP tool calls).

Takes a research goal, sends it to GPT-5.5 with available tools,
and loops: model reasons → calls tool → receives result → repeat.
Streams intermediate events to the frontend via WebSocket.
"""

import asyncio
import json
import os

from openai import AsyncOpenAI

from mcp_server import get_openai_tools, execute_tool
from state import StateManager
from tools.hitl import register_session, unregister_session


# GPT-5.5 model string
MODEL = "gpt-5.5"

# Maximum number of agentic loop iterations to prevent runaway
MAX_STEPS = 20

SYSTEM_PROMPT = """\
You are QueryMind, an expert AI research agent. Your job is to thoroughly \
research the user's question by searching the web and synthesizing findings \
into a comprehensive, well-structured answer.

Guidelines:
1. Start by running 2-4 parallel web searches with diverse, well-crafted queries \
   to get broad coverage of the topic.
2. If the user's question is ambiguous or you need clarification, use the ask_user \
   tool to ask a focused clarifying question. Don't guess — ask.
3. After initial searches, analyze the results and run additional targeted searches \
   if needed to fill gaps.
4. When you have enough information, produce a final answer that is:
   - Well-structured with clear sections and headings (use Markdown)
   - Comprehensive but concise
   - Includes specific facts, numbers, and details from your sources
   - Cites sources inline using [1], [2], etc. notation
5. End your final answer with a "Sources" section listing all referenced URLs.

Important: Do NOT fabricate information. Only include facts found in search results.\
"""


async def run_agent(
    goal: str,
    session_id: str,
    ws_manager,
) -> None:
    """
    Run the agentic research loop.

    Args:
        goal: The user's research question/goal.
        session_id: Unique session identifier.
        ws_manager: WebSocket connection manager for streaming events.
    """
    client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
    state_manager = StateManager()
    tools = get_openai_tools()

    # Register session for HITL
    register_session(session_id)

    # Initialize message history
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": goal},
    ]

    search_history: list[str] = []
    sources_found: list[dict] = []
    step_count = 0

    try:
        while step_count < MAX_STEPS:
            step_count += 1

            # Send "reasoning" status
            await ws_manager.send_event(session_id, {
                "type": "reasoning",
                "content": "",
                "step": step_count,
            })

            # Call GPT-5.5
            response = await client.chat.completions.create(
                model=MODEL,
                messages=messages,
                tools=tools,
                tool_choice="auto",
            )

            choice = response.choices[0]
            message = choice.message

            # Append assistant message to history
            messages.append(message.model_dump())

            # If there are tool calls, execute them
            if message.tool_calls:
                # Process tool calls (potentially in parallel for web_search)
                search_tasks = []
                other_calls = []

                for tool_call in message.tool_calls:
                    fn_name = tool_call.function.name
                    fn_args = json.loads(tool_call.function.arguments)

                    if fn_name == "web_search":
                        search_tasks.append((tool_call, fn_args))
                    else:
                        other_calls.append((tool_call, fn_args))

                # Execute web searches in parallel
                if search_tasks:
                    # Notify frontend about searches
                    for tc, args in search_tasks:
                        query = args.get("query", "")
                        search_history.append(query)
                        await ws_manager.send_event(session_id, {
                            "type": "searching",
                            "query": query,
                        })

                    # Run all searches concurrently
                    search_results = await asyncio.gather(*[
                        execute_tool(
                            name="web_search",
                            arguments=args,
                            session_id=session_id,
                            ws_manager=ws_manager,
                            state_manager=state_manager,
                            agent_context=_build_context(
                                goal, messages, search_history, sources_found, step_count
                            ),
                        )
                        for _, args in search_tasks
                    ])

                    # Process results and send source_found events
                    for (tc, args), result in zip(search_tasks, search_results):
                        # Parse sources from the result text
                        parsed_sources = _parse_sources(result)
                        for source in parsed_sources:
                            sources_found.append(source)
                            await ws_manager.send_event(session_id, {
                                "type": "source_found",
                                "source": source,
                            })

                        # Add tool result to messages
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": result,
                        })

                # Execute other tools (ask_user) sequentially
                for tc, args in other_calls:
                    fn_name = tc.function.name

                    result = await execute_tool(
                        name=fn_name,
                        arguments=args,
                        session_id=session_id,
                        ws_manager=ws_manager,
                        state_manager=state_manager,
                        agent_context=_build_context(
                            goal, messages, search_history, sources_found, step_count
                        ),
                    )

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result,
                    })

            else:
                # No tool calls — this is the final answer
                final_answer = message.content or ""

                await ws_manager.send_event(session_id, {
                    "type": "reasoning",
                    "content": final_answer,
                    "step": step_count,
                    "is_final": True,
                })

                await ws_manager.send_event(session_id, {
                    "type": "done",
                    "answer": final_answer,
                    "sources": sources_found,
                })
                break

        else:
            # Max steps reached
            await ws_manager.send_event(session_id, {
                "type": "done",
                "answer": "I've reached the maximum number of research steps. Here's what I found so far based on my research.",
                "sources": sources_found,
            })

    except Exception as e:
        await ws_manager.send_event(session_id, {
            "type": "error",
            "message": str(e),
        })

    finally:
        # Cleanup
        unregister_session(session_id)
        state_manager.clear(session_id)


def _build_context(
    goal: str,
    messages: list[dict],
    search_history: list[str],
    sources_found: list[dict],
    step_count: int,
) -> dict:
    """Build a serializable agent context dict."""
    # Filter messages to only include serializable content
    serializable_messages = []
    for msg in messages:
        if isinstance(msg, dict):
            serializable_messages.append(msg)
        else:
            # Handle OpenAI message objects
            serializable_messages.append({
                "role": getattr(msg, "role", "unknown"),
                "content": getattr(msg, "content", ""),
            })

    return {
        "goal": goal,
        "messages": serializable_messages,
        "search_history": search_history,
        "partial_findings": sources_found,
        "step_count": step_count,
    }


def _parse_sources(result_text: str) -> list[dict]:
    """
    Parse source information from formatted search results.
    Extracts title, URL, and snippet from each result block.
    """
    sources = []
    lines = result_text.split("\n")

    current_title = ""
    current_url = ""
    current_snippet_lines = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Match result header: [1] Title
        if line.startswith("[") and "]" in line:
            # Save previous source if exists
            if current_title and current_url:
                sources.append({
                    "title": current_title,
                    "url": current_url,
                    "snippet": " ".join(current_snippet_lines)[:200],
                })
                current_snippet_lines = []

            # Parse new source
            bracket_end = line.index("]")
            current_title = line[bracket_end + 1:].strip()
            current_url = ""

        elif line.startswith("URL:"):
            current_url = line[4:].strip()

        else:
            current_snippet_lines.append(line)

    # Don't forget the last source
    if current_title and current_url:
        sources.append({
            "title": current_title,
            "url": current_url,
            "snippet": " ".join(current_snippet_lines)[:200],
        })

    return sources
