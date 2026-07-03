"""
main.py — FastAPI app + WebSocket for streaming.

Provides REST and WebSocket endpoints for the QueryMind frontend.
- POST /research → starts a new agent run
- WS /ws/{session_id} → bidirectional streaming of events and HITL answers
- GET/DELETE /sessions → research history management
- POST /upload → file attachment upload
- POST /auth/google, GET /auth/me → authentication
"""

import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    Depends,
    HTTPException,
)
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent import run_agent
from auth import (
    verify_google_token,
    create_jwt,
    get_current_user,
    require_auth,
    get_user_id_from_token,
)
from database import init_db, get_or_create_user
from redis_store import RedisStore
from tools.file_processor import extract_text
from tools.hitl import submit_answer


# Load environment variables from .env file
load_dotenv(dotenv_path="../.env")


# Upload directory
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


# ── SSE Connection Manager ──────────────────────────────────────────

class SessionStreamManager:
    """Manages active Event Queues per session for SSE streaming."""

    def __init__(self):
        self._queues: dict[str, asyncio.Queue] = {}

    def get_queue(self, session_id: str) -> asyncio.Queue:
        if session_id not in self._queues:
            self._queues[session_id] = asyncio.Queue()
        return self._queues[session_id]

    async def send_event(self, session_id: str, event: dict):
        """Put a JSON event into the session's stream queue."""
        if session_id in self._queues:
            await self._queues[session_id].put(event)

    def close_stream(self, session_id: str):
        """Signal the end of the event stream for the session."""
        if session_id in self._queues:
            # Enqueue None as a sentinel to signal end of stream
            asyncio.create_task(self._queues[session_id].put(None))

    def remove_session(self, session_id: str):
        """Clean up session queues."""
        self._queues.pop(session_id, None)

    def is_connected(self, session_id: str) -> bool:
        """Returns True if the queue exists (and SSE client is listening)."""
        return session_id in self._queues


manager = SessionStreamManager()
redis_store = RedisStore()


# ── FastAPI App ─────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    await init_db()
    await redis_store.connect()
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    yield
    # Shutdown
    await redis_store.disconnect()


app = FastAPI(
    title="QueryMind",
    description="AI Research Agent with Human-in-the-Loop",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ──────────────────────────────────────────────────────────

class ResearchRequest(BaseModel):
    goal: str
    session_id: str | None = None
    attachment_ids: list[str] | None = None


class ResearchResponse(BaseModel):
    session_id: str
    status: str


class GoogleAuthRequest(BaseModel):
    id_token: str


class AuthResponse(BaseModel):
    token: str
    user: dict


# ── Auth Endpoints ──────────────────────────────────────────────────

@app.post("/auth/google", response_model=AuthResponse)
async def google_login(request: GoogleAuthRequest):
    """
    Authenticate with Google.
    Accepts a Google ID token, verifies it, creates/finds user, returns JWT.
    """
    google_info = await verify_google_token(request.id_token)

    user = await get_or_create_user(
        google_id=google_info["sub"],
        email=google_info["email"],
        name=google_info.get("name", ""),
        picture=google_info.get("picture", ""),
    )

    token = create_jwt(user["id"], user["email"])

    return AuthResponse(
        token=token,
        user={
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user["picture"],
        },
    )


@app.get("/auth/me")
async def get_me(user: dict = Depends(require_auth)):
    """Get the current authenticated user's profile."""
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user["picture"],
    }


# ── File Upload Endpoint ───────────────────────────────────────────

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    session_id: str = Form(""),
    user: dict | None = Depends(get_current_user),
):
    """
    Upload a file and extract its text content.

    Returns file metadata and a text preview for the frontend.
    """
    # Validate file type
    allowed_extensions = {".pdf", ".csv", ".txt", ".md", ".text", ".log"}
    filename = file.filename or "upload"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(allowed_extensions)}",
        )

    # Read file content
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_UPLOAD_SIZE // (1024*1024)}MB",
        )

    # Save to disk
    file_id = str(uuid.uuid4())
    if not session_id:
        session_id = "unsorted"
    save_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(save_dir, exist_ok=True)
    file_path = os.path.join(save_dir, f"{file_id}_{filename}")

    with open(file_path, "wb") as f:
        f.write(content)

    # Extract text
    extracted = extract_text(file_path, file.content_type or "")
    preview = extracted[:500] + ("…" if len(extracted) > 500 else "")

    return {
        "file_id": file_id,
        "filename": filename,
        "size": len(content),
        "preview": preview,
        "extracted_text": extracted,
    }


# ── Session Endpoints ──────────────────────────────────────────────

@app.get("/sessions")
async def list_sessions(user: dict | None = Depends(get_current_user)):
    """List all research sessions for the current user."""
    user_id = user["id"] if user else "anonymous"
    sessions = await redis_store.list_sessions(user_id)
    return {"sessions": sessions}


@app.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    user: dict | None = Depends(get_current_user),
):
    """Retrieve a full research session."""
    user_id = user["id"] if user else "anonymous"
    session = await redis_store.get_session(user_id, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user: dict | None = Depends(get_current_user),
):
    """Delete a research session."""
    user_id = user["id"] if user else "anonymous"
    deleted = await redis_store.delete_session(user_id, session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted"}


# ── REST Endpoints ──────────────────────────────────────────────────

@app.post("/research")
async def start_research(
    request: ResearchRequest,
    user: dict | None = Depends(get_current_user),
):
    """
    Start a new research session.
    Returns a Server-Sent Events (SSE) stream representing the agent's progress.
    """
    session_id = request.session_id or str(uuid.uuid4())
    user_id = user["id"] if user else "anonymous"

    # Resolve attachments from uploaded file IDs
    attachments = []
    if request.attachment_ids:
        for aid in request.attachment_ids:
            att = _find_attachment(aid)
            if att:
                attachments.append(att)

    # Initialize the queue for this session ID
    queue = manager.get_queue(session_id)

    # Start the agent task in the background
    asyncio.create_task(
        run_agent(
            request.goal,
            session_id,
            manager,
            redis_store=redis_store,
            user_id=user_id,
            attachments=attachments if attachments else None,
        )
    )

    async def event_generator():
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                
                event_type = event.get("type", "message")
                yield f"event: {event_type}\ndata: {json.dumps(event)}\n\n"
        finally:
            manager.remove_session(session_id)

    return StreamingResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        }
    )


def _find_attachment(file_id: str) -> dict | None:
    """Find an uploaded file by its ID and extract text."""
    for root, _dirs, files in os.walk(UPLOAD_DIR):
        for fname in files:
            if fname.startswith(file_id):
                path = os.path.join(root, fname)
                # Strip the UUID prefix to get original filename
                original_name = fname[len(file_id) + 1:]
                content = extract_text(path)
                return {"filename": original_name, "content": content}
    return None


class ResumeRequest(BaseModel):
    answer: str


@app.post("/sessions/{session_id}/resume")
async def resume_session(session_id: str, request: ResumeRequest):
    """
    Resume the agentic loop with the user's answer to a clarification question.
    """
    submit_answer(session_id, request.answer)
    return {"status": "resumed"}


# ── Health Check ────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "QueryMind"}


# ── Dev / Test Utilities ─────────────────────────────────────────────

@app.post("/test/hitl/{session_id}")
async def test_hitl(session_id: str):
    """
    DEV ONLY — manually fire a 'pause' event on an active WebSocket session.
    Use this to verify the HITL modal without waiting for the LLM to call ask_user.

    Steps:
      1. Start a research session via POST /research
      2. Connect the WebSocket at /ws/{session_id}
      3. POST to /test/hitl/{session_id} to trigger the modal immediately
    """
    if not manager.is_connected(session_id):
        return {"error": "No active WebSocket for this session_id"}
    await manager.send_event(session_id, {
        "type": "pause",
        "question": "This is a test clarification question — what would you like to know more about?",
    })
    return {"status": "pause event sent", "session_id": session_id}
