# QueryMind

**AI-powered research agent with human-in-the-loop** — A Perplexity-style web application that searches the web, asks clarifying questions, and delivers comprehensive answers with cited sources.

![QueryMind](https://img.shields.io/badge/QueryMind-AI%20Research%20Agent-6366f1?style=for-the-badge)



https://github.com/user-attachments/assets/c80ddf09-8af8-4381-914c-cc3bfa2e2a70



---

## Architecture

```
┌──────────────┐  SSE (Streaming)  ┌──────────────┐    Gemini API    ┌──────────┐
│   React UI   │ ◄───────────────  │   FastAPI     │ ◄─────────────► │  Gemma 4 │
│  (Vite)      │  ──────────────►  │   Backend     │                  └──────────┘
└──────────────┘    REST (Post)    │               │    Tavily API   ┌──────────┐
                                   │   Agent Loop  │ ◄─────────────► │  Tavily  │
                                   │   MCP Server  │                  │  Search  │
                                   └──────────────┘                  └──────────┘
```

### Key Features
- **Parallel Web Search** — Runs multiple Tavily searches concurrently with rate limiting
- **Human-in-the-Loop** — Agent pauses mid-workflow to ask clarifying questions
- **Streaming Answers** — Progressive display of reasoning and sources via Server-Sent Events (SSE)
- **Cited Sources** — Every claim is backed by numbered citations with source cards
- **State Persistence** — Agent state serialized to JSON for seamless pause/resume

---

## Tech Stack

| Layer    | Technology                       |
|----------|----------------------------------|
| Frontend | React + Tailwind CSS v4 (Vite)   |
| Backend  | Python + FastAPI (SSE)           |
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
│   ├── main.py              # FastAPI app + SSE streaming
│   ├── agent.py             # Agentic loop (Gemma 4 + tool calls)
│   ├── mcp_server.py        # MCP tool registration + dispatch
│   ├── state.py             # JSON state serialization
│   └── tools/
│       ├── search.py        # Tavily web search with rate limiting
│       └── hitl.py          # Human-in-the-loop pause/resume
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main layout + SSE connection & streaming
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

## Project Documentation & Reflection

### What was built and the problem I was trying to solve
QueryMind is an autonomous, AI-driven research assistant designed to solve "twenty-tab search fatigue." When users research complex or niche topics, they typically spend hours sorting through search engine results, parsing long articles, and manually verifying references. 

QueryMind automates this entire process:
- It processes user goals, searches the web concurrently using Tavily (with custom async rate-limiting), crawls and extracts text, and streams clean synthesis reports via Server-Sent Events (SSE).
- It features a **Human-in-the-Loop (HITL)** system that automatically pauses execution and prompts the user for direction when facing ambiguous queries, resuming cleanly by serializing the agent's memory.

### Approach & Thinking (Decisions, Tradeoffs, Iterations)
- **Tech Stack Choices**: I selected FastAPI for the backend to leverage Python's rich asyncio ecosystem and support seamless streaming. For the UI, I used Vite + React with custom layout and theme components from the `@astryxdesign` stone theme to produce a premium aesthetic.
- **WebSocket to Server-Sent Events (SSE) Migration**: 
  - *Initial Approach*: The project was originally planned around a bidirectional WebSocket interface. 
  - *The Pivot to SSE*: I transitioned the streaming protocol to HTTP-based Server-Sent Events (SSE) because QueryMind's streaming is predominantly unidirectional (agent sending reasoning, sources, and clarification prompts to the client). 
  - *Trade-offs & Benefits*: SSE is simpler to secure (supporting standard HTTP headers for token-based authentication out of the box), automatically handles client-side reconnections, and bypasses proxy/firewall traversal issues common with WebSockets. Client responses (like HITL answers) are handled cleanly via REST POST endpoints, making the API surface more modular.
- **Architectural Trade-offs**: 
  - *Rate-Limiting vs Speed*: Parallel queries are fast but run the risk of hitting API rate-limits. I implemented a semaphore-based queue to throttle requests while maintaining concurrent execution.
  - *Thought Logging vs User Experience*: Gemma output includes thought tokens (`<thought>` or `<|think|>`). To keep the UI user-friendly, I filter out thought blocks on the client and render the output dynamically as markdown via `react-markdown` with refined styling for headings, tables, blockquotes, and lists.
- **Design Iteration**: I began by drafting static prototypes (`code.html` and `1.html`) to visualize the layout and interactive panels before writing the React components.

### Outcome & Results
- **What changed**: The application now renders highly structured research reports beautifully. Bullet lists, comparative tables, and inline citations are highly readable, replacing plain unformatted text.
- **Key Learnings**: React hooks and SSE stream buffering need careful management. I learned to use React's `useRef` and `useCallback` to manage stream state and abort signals dynamically to prevent UI lag or state contamination on subsequent runs.

### Reflection
If starting again today, I would plan more thoroughly at the start, especially researching about the UI/UX. While prototyping with static HTML files helped, establishing design tokens, responsiveness guidelines, and core components early on would have avoided refactoring churn when integrating the custom theme library into React.

---

## License

MIT
