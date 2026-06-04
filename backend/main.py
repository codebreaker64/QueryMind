"""
main.py — FastAPI app + WebSocket for streaming.

Provides REST and WebSocket endpoints for the QueryMind frontend.
- POST /research → starts a new agent run
- WS /ws/{session_id} → bidirectional streaming of events and HITL answers
"""

import asyncio
import json
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent import run_agent
from tools.hitl import submit_answer


# Load environment variables from .env file
load_dotenv(dotenv_path="../.env")


# ── WebSocket Connection Manager ────────────────────────────────────

class ConnectionManager:
    """Manages active WebSocket connections per session."""

    def __init__(self):
        self._connections: dict[str, WebSocket] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self._connections[session_id] = websocket

    def disconnect(self, session_id: str):
        self._connections.pop(session_id, None)

    async def send_event(self, session_id: str, event: dict):
        """Send a JSON event to the client for a given session."""
        ws = self._connections.get(session_id)
        if ws:
            try:
                await ws.send_json(event)
            except Exception:
                self.disconnect(session_id)

    def is_connected(self, session_id: str) -> bool:
        return session_id in self._connections


manager = ConnectionManager()


# ── FastAPI App ─────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    yield


app = FastAPI(
    title="QueryMind",
    description="AI Research Agent with Human-in-the-Loop",
    version="1.0.0",
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


class ResearchResponse(BaseModel):
    session_id: str
    status: str


# ── REST Endpoints ──────────────────────────────────────────────────

@app.post("/research", response_model=ResearchResponse)
async def start_research(request: ResearchRequest):
    """
    Start a new research session.
    Returns a session_id that the client uses to connect via WebSocket.
    """
    session_id = str(uuid.uuid4())

    # Start the agent in a background task
    asyncio.create_task(_run_agent_with_delay(request.goal, session_id))

    return ResearchResponse(
        session_id=session_id,
        status="started",
    )


async def _run_agent_with_delay(goal: str, session_id: str):
    """Wait briefly for the WebSocket to connect, then run the agent."""
    # Give the frontend a moment to establish the WebSocket connection
    for _ in range(50):  # Wait up to 5 seconds
        if manager.is_connected(session_id):
            break
        await asyncio.sleep(0.1)

    if not manager.is_connected(session_id):
        return  # Client never connected

    await run_agent(goal, session_id, manager)


# ── WebSocket Endpoint ─────────────────────────────────────────────

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    Bidirectional WebSocket for a research session.

    Server → Client events:
        - searching: agent called web_search
        - source_found: a search result came back
        - reasoning: agent is processing / streaming answer
        - pause: agent called ask_user (HITL)
        - done: final answer ready
        - error: something went wrong

    Client → Server events:
        - resume: user answered HITL question { type: "resume", answer: "..." }
    """
    await manager.connect(session_id, websocket)

    try:
        while True:
            # Listen for messages from the client
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = message.get("type", "")

            if msg_type == "resume":
                # User answered a HITL question
                answer = message.get("answer", "")
                submit_answer(session_id, answer)

    except WebSocketDisconnect:
        manager.disconnect(session_id)
    except Exception:
        manager.disconnect(session_id)


# ── Health Check ────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "QueryMind"}
