"""
auth.py — Google OAuth + JWT authentication for QueryMind.

Verifies Google ID tokens, issues JWTs, and provides a FastAPI
dependency for extracting the current user from requests.
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database import get_or_create_user, get_user_by_id

logger = logging.getLogger(__name__)

# ── Config ──────────────────────────────────────────────────────────

GOOGLE_CLIENT_ID = os.environ.get("VITE_GOOGLE_CLIENT_ID", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "querymind-dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30

GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

security = HTTPBearer(auto_error=False)


# ── Google Token Verification ───────────────────────────────────────

async def verify_google_token(id_token: str) -> dict:
    """
    Verify a Google ID token and return user info.

    Uses Google's tokeninfo endpoint for verification.

    Returns:
        Dict with keys: sub (google_id), email, name, picture
    """
    async with httpx.AsyncClient() as client:
        # Verify the ID token with Google
        resp = await client.get(
            GOOGLE_TOKEN_INFO_URL,
            params={"id_token": id_token},
        )

        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google token",
            )

        token_data = resp.json()

        # Verify the token was issued for our app
        if token_data.get("aud") != GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token not issued for this application",
            )

        # Check token expiry
        if token_data.get("email_verified") != "true":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email not verified",
            )

        return {
            "sub": token_data["sub"],
            "email": token_data.get("email", ""),
            "name": token_data.get("name", token_data.get("email", "")),
            "picture": token_data.get("picture", ""),
        }


# ── JWT Helpers ─────────────────────────────────────────────────────

def create_jwt(user_id: str, email: str) -> str:
    """Create a signed JWT for a user."""
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> Optional[dict]:
    """Decode and validate a JWT. Returns payload or None."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


# ── FastAPI Dependencies ────────────────────────────────────────────

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict]:
    """
    Extract and validate the current user from the Authorization header.

    Returns the user dict if authenticated, or None for unauthenticated
    access (allowing anonymous usage with limited features).
    """
    if credentials is None:
        return None

    payload = decode_jwt(credentials.credentials)
    if payload is None:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    user = await get_user_by_id(user_id)
    return user


async def require_auth(
    user: Optional[dict] = Depends(get_current_user),
) -> dict:
    """
    Dependency that requires authentication.
    Raises 401 if no valid user.
    """
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_user_id_from_token(token: str) -> Optional[str]:
    """Extract user_id from a JWT token string (for WebSocket auth)."""
    payload = decode_jwt(token)
    if payload:
        return payload.get("sub")
    return None
