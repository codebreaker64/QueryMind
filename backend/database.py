"""
database.py — SQLite user store for QueryMind.

Async SQLite via aiosqlite. Stores user profiles from Google OAuth.
"""

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

import aiosqlite

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "querymind.db")


async def init_db() -> None:
    """Create tables if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id          TEXT PRIMARY KEY,
                google_id   TEXT UNIQUE NOT NULL,
                email       TEXT NOT NULL,
                name        TEXT NOT NULL DEFAULT '',
                picture     TEXT NOT NULL DEFAULT '',
                created_at  TEXT NOT NULL
            )
        """)
        await db.commit()
    logger.info("Database initialized at %s", DB_PATH)


async def get_or_create_user(
    google_id: str,
    email: str,
    name: str = "",
    picture: str = "",
) -> dict:
    """
    Find a user by Google ID, or create one.

    Returns:
        Dict with keys: id, google_id, email, name, picture, created_at
    """
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Try to find existing user
        cursor = await db.execute(
            "SELECT * FROM users WHERE google_id = ?", (google_id,)
        )
        row = await cursor.fetchone()

        if row:
            # Update profile info (name/picture may change)
            await db.execute(
                "UPDATE users SET name = ?, picture = ?, email = ? WHERE google_id = ?",
                (name, picture, email, google_id),
            )
            await db.commit()
            return dict(row)

        # Create new user
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "INSERT INTO users (id, google_id, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, google_id, email, name, picture, now),
        )
        await db.commit()
        logger.info("Created new user: %s (%s)", email, user_id)

        return {
            "id": user_id,
            "google_id": google_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": now,
        }


async def get_user_by_id(user_id: str) -> Optional[dict]:
    """Retrieve a user by internal ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None
