import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import SourceCard from './SourceCard'

/**
 * AnswerPanel — Perplexity-style results with Answer/Links tabs,
 * inline citations, and action bar (download, copy).
 */
export default function AnswerPanel({
  answer,
  sources,
  searches,
  isThinking,
  isDone,
  error,
}) {
  const [activeTab, setActiveTab] = useState('answer')
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const answerEndRef = useRef(null)
  const downloadRef = useRef(null)

  useEffect(() => {
    if (answerEndRef.current) {
      answerEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [answer, sources, isThinking])

  // Close download menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (downloadRef.current && !downloadRef.current.contains(e.target)) {
        setShowDownloadMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const hasContent = answer || sources.length > 0 || searches.length > 0 || isThinking || error
  if (!hasContent) return null

  // ── Copy handler ──────────────────────
  const handleCopy = async () => {
    if (!answer) return
    try {
      await navigator.clipboard.writeText(answer)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = answer
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // ── Download handlers ─────────────────
  const downloadAsFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    setShowDownloadMenu(false)
  }

  const handleDownloadMD = () => {
    downloadAsFile(answer, 'querymind-research.md', 'text/markdown')
  }

  const handleDownloadTXT = () => {
    // Simple plain text export
    const plainText = answer
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
    downloadAsFile(plainText, 'querymind-research.txt', 'text/plain')
  }

  const handleDownloadHTML = () => {
    // Build a basic HTML doc
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>QueryMind Research</title>
<style>body{font-family:system-ui,sans-serif;max-width:700px;margin:2rem auto;padding:0 1rem;line-height:1.7;color:#222}
h1,h2,h3{color:#111}a{color:#0066cc}blockquote{border-left:3px solid #ccc;padding-left:1rem;color:#555}</style>
</head><body>${answer}</body></html>`
    downloadAsFile(html, 'querymind-research.html', 'text/html')
  }

  return (
    <div className="w-full animate-fade-in-up">
      {/* ── Tabs ──────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-1 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => setActiveTab('answer')}
          className={`
            flex items-center gap-2 px-4 py-2.5 text-sm font-medium
            border-b-2 -mb-px transition-colors cursor-pointer
            ${activeTab === 'answer'
              ? 'border-[var(--accent-bright)] text-[var(--text-primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }
          `}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          Answer
        </button>
        <button
          onClick={() => setActiveTab('links')}
          className={`
            flex items-center gap-2 px-4 py-2.5 text-sm font-medium
            border-b-2 -mb-px transition-colors cursor-pointer
            ${activeTab === 'links'
              ? 'border-[var(--accent-bright)] text-[var(--text-primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }
          `}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
          Links
          {sources.length > 0 && (
            <span className="text-[10px] bg-[var(--bg-surface-hover)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full">
              {sources.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Answer Tab ─────────────────────────────── */}
      {activeTab === 'answer' && (
        <div className="pt-4">
          {/* Active searches indicator */}
          {searches.length > 0 && (
            <div className="mb-5 animate-fade-in">
              <div className="flex flex-wrap gap-2">
                {searches.map((query, i) => (
                  <div
                    key={i}
                    className="glass-card px-3 py-1.5 text-xs text-[var(--text-secondary)] flex items-center gap-2 animate-slide-in-right"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <svg className="w-3 h-3 text-[var(--accent-bright)] animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Searching "{query}"
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Thinking indicator */}
          {isThinking && !answer && (
            <div className="flex items-center gap-3 py-6 animate-fade-in">
              <div className="thinking-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="text-sm text-[var(--text-muted)]">Analyzing sources and forming response...</span>
            </div>
          )}

          {/* Answer content */}
          {answer && (
            <div className="animate-fade-in">
              <div className="markdown-content">
                <ReactMarkdown>{answer}</ReactMarkdown>
              </div>

              {/* Blinking cursor while streaming */}
              {isThinking && (
                <span className="inline-block w-2 h-5 bg-[var(--accent-bright)] ml-0.5 align-text-bottom" style={{ animation: 'blink 1s infinite' }} />
              )}
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="glass-card p-5 border-[var(--error)]/30 mt-4 animate-scale-in">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[var(--error)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-[var(--error)]">Something went wrong</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Action bar ──────────────────────────── */}
          {answer && isDone && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border-subtle)]">
              {/* Left actions */}
              <div className="flex items-center gap-1">
                {/* Download button */}
                <div className="relative" ref={downloadRef}>
                  <button
                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
                    title="Download"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  </button>

                  {/* Download dropdown */}
                  {showDownloadMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-44 glass-card border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-xl animate-scale-in z-20">
                      <button
                        onClick={handleDownloadMD}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                      >
                        <span className="text-xs font-mono bg-[var(--bg-surface)] px-1.5 py-0.5 rounded">.md</span>
                        Markdown
                      </button>
                      <button
                        onClick={handleDownloadTXT}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                      >
                        <span className="text-xs font-mono bg-[var(--bg-surface)] px-1.5 py-0.5 rounded">.txt</span>
                        Plain Text
                      </button>
                      <button
                        onClick={handleDownloadHTML}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                      >
                        <span className="text-xs font-mono bg-[var(--bg-surface)] px-1.5 py-0.5 rounded">.html</span>
                        HTML Page
                      </button>
                    </div>
                  )}
                </div>

                {/* Copy button */}
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
                  title="Copy text"
                >
                  {copied ? (
                    <svg className="w-4 h-4 text-[var(--success)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                  )}
                </button>

                {/* Sources badge */}
                {sources.length > 0 && (
                  <button
                    onClick={() => setActiveTab('links')}
                    className="flex items-center gap-1.5 ml-2 px-3 py-1.5 rounded-full glass-card text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 text-[var(--accent-bright)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                    </svg>
                    {sources.length} sources
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Links Tab ──────────────────────────────── */}
      {activeTab === 'links' && (
        <div className="pt-4">
          {sources.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-3 opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" />
              </svg>
              <p className="text-sm text-[var(--text-muted)]">No sources found yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sources.map((source, i) => (
                <SourceCard key={`${source.url}-${i}`} source={source} index={i} />
              ))}
            </div>
          )}
        </div>
      )}

      <div ref={answerEndRef} />
    </div>
  )
}
