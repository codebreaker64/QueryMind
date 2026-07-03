"""
agent.py — Agentic loop (GPT-5.5 + MCP tool calls).

Takes a research goal, sends it to GPT-5.5 with available tools,
and loops: model reasons → calls tool → receives result → repeat.
Streams intermediate events to the frontend via Server-Sent Events (SSE).
"""

import asyncio
import json
import logging
import os
import traceback

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

from mcp_server import get_openai_tools, execute_tool
from state import StateManager
from tools.hitl import register_session, unregister_session


# Model string — defaults to gemma-4-31b-it for Gemini compatibility
MODEL = os.environ.get("MODEL_NAME", "gemma-4-31b-it")

# Maximum number of agentic loop iterations to prevent runaway (defaults to 15)
MAX_STEPS = int(os.environ.get("MAX_STEPS", "15"))

# Maximum total execution time in seconds for the agentic loop (defaults to 90 seconds)
MAX_TIME_LIMIT = float(os.environ.get("MAX_TIME_LIMIT", "300.0"))

# Delay in seconds between agent steps to prevent hitting rate limits (defaults to 2.0 seconds)
STEP_DELAY = float(os.environ.get("STEP_DELAY", "2.0"))

PERSONA_PROMPT = """\
You are QueryMind, a highly intelligent, warm, and human-like conversational research partner.
- Voice: Friendly, curious, engaging, and professional yet accessible.
- Style: Natural and conversational. Avoid stiff templates like "Certainly, I can help with that" or "Here is the information." Jump straight into the response or transition naturally.
- Explanations: Explain complex topics clearly, as if you are discussing them with an intelligent colleague.
- Formatting: Keep markdown styling clean and elegant. Bullet points, bold text, and numbered lists should serve readability and clarity, not overwhelm the text.

Formatting Rules (follow these strictly):
- Write in continuous prose with natural transitions. Do not convert paragraphs into bulleted lists unless the content is genuinely list-like (e.g. step-by-step instructions or a set of unrelated items).
- Never use markdown tables. Present comparative or structured data in clear, flowing sentences instead.
- Do not bold individual words or phrases inside sentences for emphasis. Bold is reserved for headings or genuinely critical standalone labels only.
- Do not use H3 (###) headers to separate every paragraph. Use headers sparingly, only when the response has multiple major sections that genuinely benefit from clear delineation.
- Write as if you are a smart colleague explaining this in a well-spaced Slack message or email — clear, concise, and narrative-driven. Not a structured database dump.
"""

RESEARCH_SYSTEM_PROMPT = PERSONA_PROMPT + """\
Your job is to thoroughly address the user's queries by conducting deep web research.

Guidelines:
1. BEFORE searching: if the user's question is broad, ambiguous, or could have multiple valid interpretations, you MUST use the ask_user tool first to clarify their intent.
2. Conduct Web Research: Run parallel web searches with diverse, well-crafted queries to get broad coverage.
3. Refine Search: Analyze the results and run additional targeted searches if needed to fill gaps.
4. Formulate final response: When you have enough information, produce a comprehensive, well-structured final answer with specific facts, numbers, and details from your sources (with inline citations like [1], [2], etc., citing sources).
5. Citing sources: End your final answer with a "Sources" section listing all referenced URLs.
"""

QA_SYSTEM_PROMPT = PERSONA_PROMPT + """\
You are answering a question about the existing research findings. You do not have access to web search tools or real-time web access for this turn.

Below are the compiled research findings from previous steps. Answer the user's question directly and conversationally using ONLY the provided findings:

=== COMPILED RESEARCH FINDINGS ===
{findings_archive}
==================================

Answer the user's query clearly, referencing the findings above.
"""


async def route_intent(client, model: str, goal: str, conversation_history: list[dict]) -> str:
    """
    Evaluate if the user wants new research or is asking about existing findings.
    Returns 'NEW_RESEARCH' or 'QUERY_FINDINGS'.
    """
    if not conversation_history:
        return "NEW_RESEARCH"

    system_instruction = (
        "You are an intent router for a research agent. Your job is to classify the user's query into one of two categories:\n"
        "1. 'NEW_RESEARCH': The user is asking to search the web for new topics, fresh facts, real-time events, or new questions not already answered in the findings.\n"
        "2. 'QUERY_FINDINGS': The user is asking a follow-up question about the existing findings, asking to summarize them, translate them, format them, explain a detail in them, or continue a conversation about what has already been researched.\n\n"
        "Respond with EXACTLY one of these two words: 'NEW_RESEARCH' or 'QUERY_FINDINGS'. Do not output any other text or reasoning."
    )

    history_snippets = []
    # Send last 6 messages for context
    for msg in conversation_history[-6:]:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            history_snippets.append(f"{role.capitalize()}: {content[:300]}")

    context = "\n".join(history_snippets)

    prompt = (
        f"Conversation history:\n{context}\n\n"
        f"Latest User Query: {goal}\n\n"
        f"Category:"
    )

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            max_tokens=5,
            temperature=0.0
        )
        val = response.choices[0].message.content.strip().upper()
        if "QUERY_FINDINGS" in val:
            return "QUERY_FINDINGS"
        return "NEW_RESEARCH"
    except Exception as e:
        logger.error("Router error, defaulting to NEW_RESEARCH: %s", e)
        return "NEW_RESEARCH"


async def run_agent(
    goal: str,
    session_id: str,
    ws_manager,
    redis_store=None,
    user_id: str = "anonymous",
    attachments: list[dict] | None = None,
) -> None:
    """
    Run the agentic research loop.

    Args:
        goal: The user's research question/goal.
        session_id: Unique session identifier.
        ws_manager: WebSocket connection manager for streaming events.
        redis_store: Optional RedisStore for session persistence.
        user_id: Owner's user ID for session scoping.
        attachments: Optional list of dicts with 'filename' and 'content' keys.
    """
    # Resolve the API key
    api_key = os.environ.get("GEMINI_API_KEY", "")
    
    # Use Gemini's OpenAI-compatible base URL if no custom base URL is specified
    base_url = os.environ.get("OPENAI_BASE_URL")
    if not base_url:
        base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"

    client = AsyncOpenAI(
        api_key=api_key,
        base_url=base_url,
        max_retries=5,
    )
    state_manager = StateManager()
    tools = get_openai_tools()

    # Register session for HITL
    register_session(session_id)

    # Build user message with optional attachments
    user_content = _build_user_message(goal, attachments)

    # Load existing session from Redis (for conversation history and findings archive)
    existing_session = None
    if redis_store:
        existing_session = await redis_store.get_session(user_id, session_id)

    # Load session state (findings archive)
    has_research = False
    findings_archive = ""
    clean_history = []

    if existing_session:
        has_research = existing_session.get("has_research", False)
        findings_archive = existing_session.get("findings_archive", "")
        # Filter out system messages to rebuild history
        for msg in existing_session.get("messages", []):
            if msg.get("role") != "system":
                clean_history.append(msg)

    # Determine Phase
    if not has_research:
        phase = "NEW_RESEARCH"
    else:
        phase = await route_intent(client, MODEL, goal, clean_history)

    # Select System Prompt based on phase
    if phase == "NEW_RESEARCH":
        system_prompt = RESEARCH_SYSTEM_PROMPT
    else:
        system_prompt = QA_SYSTEM_PROMPT.format(findings_archive=findings_archive)

    # Reconstruct messages with current phase system prompt at index 0
    messages = [{"role": "system", "content": system_prompt}] + clean_history + [{"role": "user", "content": user_content}]

    search_history: list[str] = existing_session.get("searches", []) if existing_session else []
    sources_found: list[dict] = existing_session.get("sources", []) if existing_session else []
    step_count = 0
    start_time = asyncio.get_event_loop().time()
    completed_normally = False
    reached_limit = None

    try:
        while step_count < MAX_STEPS:
            # Check elapsed time
            elapsed_time = asyncio.get_event_loop().time() - start_time
            if elapsed_time >= MAX_TIME_LIMIT:
                reached_limit = "time"
                break

            # Rate limit / step delay to prevent hitting API quotas
            if step_count > 0 and STEP_DELAY > 0:
                await asyncio.sleep(STEP_DELAY)

            step_count += 1

            # Send "reasoning" status
            await ws_manager.send_event(session_id, {
                "type": "reasoning",
                "content": "",
                "step": step_count,
            })

            # Call Gemini (via OpenAI compatibility layer) with tools gated by active phase
            if phase == "NEW_RESEARCH":
                response = await client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    tools=tools,
                    tool_choice="auto",
                )
            else:
                response = await client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                )

            choice = response.choices[0]
            message = choice.message

            # Append assistant message to history (sanitized for Gemini compatibility)
            messages.append(_sanitize_assistant_message(message))

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

                # Persist to Redis
                if redis_store:
                    current_has_research = has_research
                    current_findings = findings_archive
                    if phase == "NEW_RESEARCH":
                        current_has_research = True
                        current_findings = final_answer

                    await redis_store.save_session(user_id, session_id, {
                        "goal": goal,
                        "answer": final_answer,
                        "sources": sources_found,
                        "searches": search_history,
                        "messages": messages,
                        "has_research": current_has_research,
                        "findings_archive": current_findings,
                        "attachments": [
                            {"filename": a["filename"]}
                            for a in (attachments or [])
                        ],
                    })

                completed_normally = True
                break

        if not completed_normally:
            # Max steps or time limit reached
            reason = "time limit" if reached_limit == "time" else "maximum number of research steps"
            partial_answer = (
                f"I've reached the {reason}. "
                "Here's what I found so far based on my research."
            )
            await ws_manager.send_event(session_id, {
                "type": "done",
                "answer": partial_answer,
                "sources": sources_found,
            })

            # Persist partial result
            if redis_store:
                current_has_research = has_research
                current_findings = findings_archive
                if phase == "NEW_RESEARCH":
                    current_has_research = True
                    current_findings = partial_answer

                await redis_store.save_session(user_id, session_id, {
                    "goal": goal,
                    "answer": partial_answer,
                    "sources": sources_found,
                    "searches": search_history,
                    "messages": messages,
                    "has_research": current_has_research,
                    "findings_archive": current_findings,
                })

    except Exception as e:
        logger.error("Agent error for session %s: %s", session_id, e)
        traceback.print_exc()
        await ws_manager.send_event(session_id, {
            "type": "error",
            "message": str(e),
        })

    finally:
        # Cleanup
        unregister_session(session_id)
        state_manager.clear(session_id)
        if hasattr(ws_manager, "close_stream"):
            ws_manager.close_stream(session_id)


def _build_user_message(
    goal: str,
    attachments: list[dict] | None = None,
) -> str:
    """Build the user message, prepending any attachment content."""
    parts = []

    if attachments:
        for att in attachments:
            filename = att.get("filename", "unknown")
            content = att.get("content", "")
            parts.append(
                f"[Attached file: {filename}]\n{content}\n[End of attachment]"
            )
        parts.append("")  # blank line separator

    parts.append(goal)
    return "\n".join(parts)


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


def _sanitize_assistant_message(message) -> dict:
    """Sanitize assistant message to only keep role, content, and valid tool calls."""
    role = getattr(message, "role", "assistant")
    content = getattr(message, "content", "") or ""
    tool_calls = getattr(message, "tool_calls", None)

    clean = {
        "role": role,
        "content": content,
    }

    if tool_calls:
        clean_calls = []
        for tc in tool_calls:
            clean_calls.append({
                "id": getattr(tc, "id", None),
                "type": getattr(tc, "type", "function"),
                "function": {
                    "name": getattr(tc.function, "name", None),
                    "arguments": getattr(tc.function, "arguments", None),
                }
            })
        clean["tool_calls"] = clean_calls

    return clean
