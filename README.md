# QueryMind

**AI-powered research agent with human-in-the-loop** — A Perplexity-style web application that searches the web, asks clarifying questions, and delivers comprehensive answers with cited sources.

![QueryMind](https://img.shields.io/badge/QueryMind-AI%20Research%20Agent-6366f1?style=for-the-badge)



https://github.com/user-attachments/assets/c80ddf09-8af8-4381-914c-cc3bfa2e2a70



---

## Architecture

```
┌──────────────┐    WebSocket     ┌──────────────┐    Gemini API    ┌──────────┐
│   React UI   │ ◄──────────────► │   FastAPI     │ ◄─────────────► │  Gemma 4 │
│  (Vite)      │                  │   Backend     │                  └──────────┘
└──────────────┘                  │               │    Tavily API   ┌──────────┐
                                  │   Agent Loop  │ ◄─────────────► │  Tavily  │
                                  │   MCP Server  │                  │  Search  │
                                  └──────────────┘                  └──────────┘
```

### Key Features
- **Parallel Web Search** — Runs multiple Tavily searches concurrently with rate limiting
- **Human-in-the-Loop** — Agent pauses mid-workflow to ask clarifying questions
- **Streaming Answers** — Progressive display of reasoning and sources via WebSocket
- **Cited Sources** — Every claim is backed by numbered citations with source cards
- **State Persistence** — Agent state serialized to JSON for seamless pause/resume

---

## Tech Stack

| Layer    | Technology                       |
|----------|----------------------------------|
| Frontend | React + Tailwind CSS v4 (Vite)   |
| Backend  | Python + FastAPI                 |
| LLM      | Gemma 4 (Gemini API)             |
| Search   | Tavily Python SDK                |
| Protocol | MCP Python SDK                   |
| Async    | asyncio + Semaphore              |

---

## Setup

### Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **Gemini API key**
- **Tavily API key** ([get one free](https://tavily.com))

### 1. Clone & configure environment

```bash
# Copy the environment template
cp .env.example .env

# Edit .env and add your API keys
# GEMINI_API_KEY=AQ...
# TAVILY_API_KEY=tvly-...
```

### 2. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

### 4. Run the application

**Terminal 1 — Backend:**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173` and will proxy API requests to the backend on port 8000.

---

## Example Usage

1. Open `http://localhost:5173` in your browser
2. Type: *"What are the best open-source alternatives to Notion in 2026?"*
3. Watch as the agent runs parallel searches and source cards appear
4. If the agent needs clarification, a modal will appear — answer and click **Resume Research**
5. Read the comprehensive, cited answer that streams in

---

## Project Structure

```
querymind/
├── backend/
│   ├── main.py              # FastAPI app + WebSocket streaming
│   ├── agent.py             # Agentic loop (Gemma 4 + tool calls)
│   ├── mcp_server.py        # MCP tool registration + dispatch
│   ├── state.py             # JSON state serialization
│   └── tools/
│       ├── search.py        # Tavily web search with rate limiting
│       └── hitl.py          # Human-in-the-loop pause/resume
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main layout + WebSocket management
│   │   ├── SearchBar.jsx    # Perplexity-style query input
│   │   ├── AnswerPanel.jsx  # Streaming answer + source display
│   │   ├── HITLModal.jsx    # Clarification modal
│   │   ├── SourceCard.jsx   # Citation tile component
│   │   └── index.css        # Design system + dark theme
│   └── index.html
├── .env.example
└── README.md
```

---

## License

MIT
