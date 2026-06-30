import { useState, useRef, useEffect } from 'react'

/**
 * SearchBar — Perplexity-style large query input.
 */
export default function SearchBar({ onSearch, isResearching }) {
  const [query, setQuery] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 170) + 'px'
    }
  }, [query])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || isResearching) return
    onSearch(trimmed)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="w-full">
      {/* Search container */}
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden transition-all duration-300 hover:border-[var(--border-accent)] focus-within:border-[var(--border-accent)] focus-within:shadow-[0_0_30px_rgba(99,102,241,0.1)]">

        {/* Textarea row — left padding gives breathing room for the placeholder */}
        <div style={{ paddingLeft: '1.75rem', paddingRight: '1.5rem', paddingTop: '1.5rem', paddingBottom: '0.75rem' }}>
          <textarea
            ref={textareaRef}
            id="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            disabled={isResearching}
            rows={1}
            className="w-full bg-transparent outline-none resize-none text-[var(--text-primary)] text-lg placeholder:text-[var(--text-muted)] disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
          />
        </div>

        {/* Submit button row */}
        <div
          className="flex items-center justify-end"
          style={{ paddingLeft: '1.75rem', paddingRight: '1rem', paddingBottom: '1rem', paddingTop: '0.25rem' }}
        >
          <button
            id="search-button"
            type="button"
            onClick={handleSubmit}
            disabled={!query.trim() || isResearching}
            style={{ padding: '0.7rem' }}
            className={`rounded-full transition-all duration-200 ease-out ${query.trim() && !isResearching
                ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-bright)] hover:scale-105 active:scale-95 cursor-pointer'
                : 'bg-[var(--bg-surface-hover)] text-[var(--text-muted)] cursor-not-allowed'
              }`}
          >
            {isResearching ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
              </svg>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
