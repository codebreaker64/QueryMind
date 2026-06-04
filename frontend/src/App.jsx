import { useState, useCallback, useRef } from 'react'
import './index.css'
import SearchBar from './SearchBar'
import AnswerPanel from './AnswerPanel'
import HITLModal from './HITLModal'

/**
 * App — Perplexity-style layout with sidebar + centered search.
 */

const API_BASE = ''

// Sidebar navigation items
const NAV_ITEMS = [
  {
    label: 'New',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
]



export default function App() {
  // Core state
  const [isResearching, setIsResearching] = useState(false)
  const [currentQuery, setCurrentQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState([])
  const [searches, setSearches] = useState([])
  const [isThinking, setIsThinking] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // HITL state
  const [hitlQuestion, setHitlQuestion] = useState(null)

  // WebSocket ref
  const wsRef = useRef(null)

  const handleSearch = useCallback(async (goal) => {
    setCurrentQuery(goal)
    setAnswer('')
    setSources([])
    setSearches([])
    setIsThinking(true)
    setIsDone(false)
    setError(null)
    setHitlQuestion(null)
    setIsResearching(true)

    try {
      const response = await fetch(`${API_BASE}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
      const sessionId = data.session_id

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsHost = window.location.host
      const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/${sessionId}`)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[QueryMind] WebSocket connected:', sessionId)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          handleWebSocketEvent(msg)
        } catch (e) {
          console.error('[QueryMind] Failed to parse WS message:', e)
        }
      }

      ws.onerror = () => {
        setError('Connection error. Please try again.')
        setIsResearching(false)
        setIsThinking(false)
      }

      ws.onclose = () => {
        wsRef.current = null
      }

    } catch (err) {
      setError(err.message || 'Failed to start research')
      setIsResearching(false)
      setIsThinking(false)
    }
  }, [])

  const handleWebSocketEvent = useCallback((msg) => {
    switch (msg.type) {
      case 'searching':
        setIsThinking(true)
        setSearches(prev => [...prev, msg.query])
        break
      case 'source_found':
        if (msg.source) {
          setSources(prev => [...prev, msg.source])
          setSearches(prev => { const u = [...prev]; if (u.length > 0) u.shift(); return u })
        }
        break
      case 'reasoning':
        setIsThinking(true)
        if (msg.content) setAnswer(msg.content)
        if (msg.is_final) setSearches([])
        break
      case 'pause':
        setHitlQuestion(msg.question)
        setIsThinking(false)
        break
      case 'done':
        if (msg.answer) setAnswer(msg.answer)
        if (msg.sources?.length > 0) {
          setSources(prev => {
            const existing = new Set(prev.map(s => s.url))
            return [...prev, ...msg.sources.filter(s => !existing.has(s.url))]
          })
        }
        setIsThinking(false)
        setIsDone(true)
        setIsResearching(false)
        setSearches([])
        break
      case 'error':
        setError(msg.message || 'An unexpected error occurred')
        setIsThinking(false)
        setIsResearching(false)
        setSearches([])
        break
      default:
        break
    }
  }, [])

  const handleHITLResume = useCallback((userAnswer) => {
    setHitlQuestion(null)
    setIsThinking(true)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'resume', answer: userAnswer }))
    }
  }, [])

  const handleNewSearch = () => {
    setCurrentQuery('')
    setAnswer('')
    setSources([])
    setSearches([])
    setIsThinking(false)
    setIsDone(false)
    setError(null)
    setIsResearching(false)
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }

  const isLanding = !isResearching && !isDone && !answer

  return (
    <div className="h-screen flex overflow-hidden">
      {/* ── Sidebar ──────────────────────────────── */}
      <aside
        className={`
          shrink-0 flex flex-col h-full
          bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)]
          transition-all duration-300 ease-out
          ${sidebarOpen ? 'w-56' : 'w-0 border-r-0 overflow-hidden'}
        `}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <span className="text-base font-semibold text-[var(--text-primary)]">QueryMind</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-3 space-y-6  ">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={item.label === 'New' ? handleNewSearch : undefined}
              className={`
                w-full flex items-center gap-4 px-5 py-4.5 rounded-xl text-sm font-medium
                transition-colors cursor-pointer
                ${item.label === 'New'
                  ? 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                }
              `}
            >
              <span className="scale-110 shrink-0">{item.icon}</span>
              {item.label}
            </button>
          ))}

        </nav>
      </aside>

      {/* ── Main content ─────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top bar */}
        <header className="shrink-0 flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isResearching && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] glass-card px-3 py-1.5 animate-fade-in">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                Researching
              </div>
            )}
          </div>
        </header>

        {/* ── Landing state ──────────────────── */}
        {isLanding && (
          <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
            <div className="w-full max-w-xl animate-fade-in-up">
              <h1 className="text-center text-4xl font-light text-[var(--text-primary)] tracking-tight" style={{ marginBottom: '1rem' }}>
                Query<span className="gradient-text font-medium">Mind</span>
              </h1>
              <SearchBar onSearch={handleSearch} isResearching={isResearching} />
            </div>
          </main>
        )}

        {/* ── Chat state ─────────────────────── */}
        {!isLanding && (
          <>
            {/* Scrollable content */}
            <div className="flex-1 overflow-auto px-6 pb-4 flex justify-center">
              <div className="w-full max-w-xl pt-6">
                {/* User query bubble */}
                {currentQuery && (
                  <div className="flex justify-end mb-8 animate-fade-in">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl rounded-tr-sm px-5 py-3 max-w-md">
                      <p className="text-sm text-[var(--text-primary)]">{currentQuery}</p>
                    </div>
                  </div>
                )}

                {/* Answer panel */}
                <AnswerPanel
                  answer={answer}
                  sources={sources}
                  searches={searches}
                  isThinking={isThinking}
                  isDone={isDone}
                  error={error}
                />
              </div>
            </div>

            {/* Fixed bottom input */}
            <div className="shrink-0 px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-primary)] flex justify-center">
              <div className="w-full max-w-xl">
                <SearchBar onSearch={handleSearch} isResearching={isResearching} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── HITL Modal ───────────────────────────── */}
      {hitlQuestion && (
        <HITLModal question={hitlQuestion} onSubmit={handleHITLResume} />
      )}
    </div>
  )
}
