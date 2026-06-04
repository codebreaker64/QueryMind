"""
hitl.py — ask_user() → pause agent, serialize state, wait for resume.

Implements the human-in-the-loop tool that pauses the agent loop,
sends a question to the frontend via WebSocket, and waits for the
user's answer before continuing.
"""

import asyncio


# Registry of pending HITL events per session
# session_id -> { "event": asyncio.Event, "answer": str | None }
_pending_answers: dict[str, dict] = {}


def register_session(session_id: str) -> None:
    """Create the answer slot for a new session."""
    _pending_answers[session_id] = {
        "event": asyncio.Event(),
        "answer": None,
    }


def unregister_session(session_id: str) -> None:
    """Clean up when a session ends."""
    _pending_answers.pop(session_id, None)


def submit_answer(session_id: str, answer: str) -> None:
    """
    Called when the frontend sends a 'resume' WebSocket event.
    Stores the answer and unblocks the waiting ask_user() call.
    """
    slot = _pending_answers.get(session_id)
    if slot is None:
        return
    slot["answer"] = answer
    slot["event"].set()


async def ask_user(
    question: str,
    session_id: str,
    ws_manager,
    state_manager,
    agent_context: dict,
) -> str:
    """
    Pause the agent and ask the user a clarifying question.

    1. Serializes the current agent state to disk.
    2. Sends a 'pause' WebSocket event with the question.
    3. Waits (non-blocking) for the user to respond.
    4. Returns the user's answer string.

    Args:
        question: The question to ask the user.
        session_id: Current session ID.
        ws_manager: WebSocket connection manager.
        state_manager: StateManager for persistence.
        agent_context: Current agent context dict to serialize.

    Returns:
        The user's answer as a string.
    """
    # Save state in case of disconnection
    state_manager.save(session_id, agent_context)

    # Reset the event for this question
    slot = _pending_answers.get(session_id)
    if slot is None:
        register_session(session_id)
        slot = _pending_answers[session_id]

    slot["event"].clear()
    slot["answer"] = None

    # Send pause event to frontend
    await ws_manager.send_event(session_id, {
        "type": "pause",
        "question": question,
    })

    # Wait for the user's answer (blocks the agent loop, not the event loop)
    await slot["event"].wait()

    answer = slot["answer"] or ""
    return answer
