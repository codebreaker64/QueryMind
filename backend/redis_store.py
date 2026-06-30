"""
redis_store.py — Redis session persistence for QueryMind.

Stores research sessions (query, answer, sources, timestamps) in Redis
keyed by user_id. Sessions expire after 30 days by default.
Falls back to in-memory dict if Redis is unavailable.
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

# Default TTL: 30 days in seconds
DEFAULT_TTL = 30 * 24 * 60 * 60


class RedisStore:
    """Async Redis wrapper for session persistence."""

    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        self._fallback: dict[str, dict] = {}
        self._using_fallback = False

    async def connect(self) -> None:
        """Establish Redis connection, or fall back to in-memory."""
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
        try:
            self._redis = aioredis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
            )
            # Test connection
            await self._redis.ping()
            logger.info("Connected to Redis at %s", redis_url)
        except Exception as e:
            logger.warning(
                "Redis unavailable (%s), falling back to in-memory store. "
                "Sessions will not persist across restarts.",
                e,
            )
            self._redis = None
            self._using_fallback = True

    async def disconnect(self) -> None:
        """Close Redis connection."""
        if self._redis:
            await self._redis.aclose()

    # ── Key helpers ────────────────────────────────────────────────

    @staticmethod
    def _session_key(user_id: str, session_id: str) -> str:
        return f"qm:session:{user_id}:{session_id}"

    @staticmethod
    def _index_key(user_id: str) -> str:
        return f"qm:sessions:{user_id}"

    # ── CRUD ───────────────────────────────────────────────────────

    async def save_session(
        self,
        user_id: str,
        session_id: str,
        data: dict,
        ttl: int = DEFAULT_TTL,
    ) -> None:
        """
        Save a research session.

        Args:
            user_id:    Owner's user ID (or "anonymous" for unauthenticated).
            session_id: Unique session identifier.
            data:       Dict with keys: goal, answer, sources, searches,
                        created_at, updated_at.
            ttl:        Time-to-live in seconds.
        """
        # Ensure timestamps
        now = datetime.now(timezone.utc).isoformat()
        data.setdefault("created_at", now)
        data["updated_at"] = now
        data["session_id"] = session_id

        payload = json.dumps(data, ensure_ascii=False, default=str)

        if self._redis and not self._using_fallback:
            pipe = self._redis.pipeline()
            pipe.set(self._session_key(user_id, session_id), payload, ex=ttl)
            # Add to user's session index (sorted set, score = timestamp)
            score = datetime.fromisoformat(data["created_at"]).timestamp()
            pipe.zadd(self._index_key(user_id), {session_id: score})
            pipe.expire(self._index_key(user_id), ttl)
            await pipe.execute()
        else:
            # In-memory fallback
            if user_id not in self._fallback:
                self._fallback[user_id] = {}
            self._fallback[user_id][session_id] = data

    async def get_session(
        self, user_id: str, session_id: str
    ) -> Optional[dict]:
        """Retrieve a single session by ID."""
        if self._redis and not self._using_fallback:
            raw = await self._redis.get(
                self._session_key(user_id, session_id)
            )
            if raw:
                return json.loads(raw)
            return None
        else:
            return (
                self._fallback.get(user_id, {}).get(session_id)
            )

    async def list_sessions(self, user_id: str) -> list[dict]:
        """
        Return all session summaries for a user, newest first.

        Each summary: { session_id, goal, created_at, updated_at, source_count }
        """
        if self._redis and not self._using_fallback:
            # Get all session IDs from sorted set (newest first)
            session_ids = await self._redis.zrevrange(
                self._index_key(user_id), 0, -1
            )
            sessions = []
            for sid in session_ids:
                raw = await self._redis.get(
                    self._session_key(user_id, sid)
                )
                if raw:
                    data = json.loads(raw)
                    sessions.append({
                        "session_id": data.get("session_id", sid),
                        "goal": data.get("goal", ""),
                        "created_at": data.get("created_at", ""),
                        "updated_at": data.get("updated_at", ""),
                        "source_count": len(data.get("sources", [])),
                        "has_answer": bool(data.get("answer")),
                    })
            return sessions
        else:
            user_sessions = self._fallback.get(user_id, {})
            sessions = []
            for sid, data in user_sessions.items():
                sessions.append({
                    "session_id": sid,
                    "goal": data.get("goal", ""),
                    "created_at": data.get("created_at", ""),
                    "updated_at": data.get("updated_at", ""),
                    "source_count": len(data.get("sources", [])),
                    "has_answer": bool(data.get("answer")),
                })
            # Sort newest first
            sessions.sort(key=lambda s: s["created_at"], reverse=True)
            return sessions

    async def delete_session(self, user_id: str, session_id: str) -> bool:
        """Delete a session. Returns True if it existed."""
        if self._redis and not self._using_fallback:
            pipe = self._redis.pipeline()
            pipe.delete(self._session_key(user_id, session_id))
            pipe.zrem(self._index_key(user_id), session_id)
            results = await pipe.execute()
            return results[0] > 0
        else:
            user_sessions = self._fallback.get(user_id, {})
            if session_id in user_sessions:
                del user_sessions[session_id]
                return True
            return False
