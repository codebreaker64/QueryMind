"""
state.py — JSON snapshot: save and restore agent context.

Serializes the full agent state (messages, tool results, step count)
to a JSON file so the agent can pause for human-in-the-loop and resume
without restarting from scratch.
"""

import json
import os
from datetime import datetime, timezone


STATE_DIR = os.path.join(os.path.dirname(__file__), "states")


class StateManager:
    """Manages agent state persistence via JSON files."""

    def __init__(self):
        os.makedirs(STATE_DIR, exist_ok=True)

    def _path(self, session_id: str) -> str:
        return os.path.join(STATE_DIR, f"state_{session_id}.json")

    def save(self, session_id: str, context: dict) -> str:
        """
        Serialize agent context to disk.

        Args:
            session_id: Unique session identifier.
            context: Dict containing at minimum:
                - goal: str
                - messages: list[dict]  (OpenAI message history)
                - search_history: list[str]
                - partial_findings: list[dict]
                - step_count: int

        Returns:
            Path to the saved state file.
        """
        payload = {
            "session_id": session_id,
            "saved_at": datetime.now(timezone.utc).isoformat(),
            "context": context,
        }
        path = self._path(session_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False, default=str)
        return path

    def load(self, session_id: str) -> dict | None:
        """
        Restore agent context from disk.

        Returns:
            The saved context dict, or None if no state file exists.
        """
        path = self._path(session_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        return payload.get("context")

    def clear(self, session_id: str) -> None:
        """Remove the state file for a completed session."""
        path = self._path(session_id)
        if os.path.exists(path):
            os.remove(path)
