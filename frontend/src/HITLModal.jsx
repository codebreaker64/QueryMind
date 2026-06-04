import { useState, useRef, useEffect } from 'react'

/**
 * HITLModal — Pause popup for human-in-the-loop.
 * 
 * Displayed as a glassmorphism modal overlay when the agent calls
 * ask_user. The user types their answer and clicks "Resume Research"
 * to continue the agent loop.
 */
export default function HITLModal({ question, onSubmit }) {
  const [answer, setAnswer] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    // Focus the input when the modal appears
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = answer.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setAnswer('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="
          relative w-full max-w-lg
          animate-scale-in
          rounded-2xl overflow-hidden
          bg-[var(--bg-secondary)]/90 backdrop-blur-xl
          border border-[var(--border-accent)]
          shadow-[0_0_40px_var(--accent-glow),0_20px_60px_rgba(0,0,0,0.5)]
        "
      >
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        <div className="p-6">
          {/* Icon + label */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-glow)] flex items-center justify-center animate-float">
              <svg className="w-5 h-5 text-[var(--accent-bright)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Clarification Needed</h2>
              <p className="text-xs text-[var(--text-muted)]">The research agent needs your input to continue</p>
            </div>
          </div>

          {/* Question */}
          <div className="glass-card p-4 mb-5">
            <p id="hitl-question" className="text-[var(--text-primary)] text-base leading-relaxed font-light">
              {question}
            </p>
          </div>

          {/* Answer form */}
          <form onSubmit={handleSubmit}>
            <div className="relative mb-4">
              <textarea
                ref={inputRef}
                id="hitl-answer-input"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer..."
                rows={3}
                className="
                  w-full bg-[var(--bg-surface)] rounded-xl px-4 py-3
                  text-[var(--text-primary)] text-sm
                  placeholder:text-[var(--text-muted)]
                  border border-[var(--border-subtle)]
                  focus:border-[var(--border-accent)]
                  focus:shadow-[0_0_20px_var(--accent-glow)]
                  outline-none resize-none
                  transition-all duration-200
                "
              />
            </div>

            <button
              id="hitl-resume-button"
              type="submit"
              disabled={!answer.trim()}
              className={`
                w-full py-3 rounded-xl font-medium text-sm
                transition-all duration-200 ease-out
                ${answer.trim()
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-400 hover:to-purple-400 hover:shadow-[0_4px_20px_var(--accent-glow)] active:scale-[0.98] cursor-pointer'
                  : 'bg-[var(--bg-surface-hover)] text-[var(--text-muted)] cursor-not-allowed'
                }
              `}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
                Resume Research
              </span>
            </button>
          </form>

          <p className="text-[10px] text-[var(--text-muted)] text-center mt-3">
            Press Enter to submit • Your answer helps the agent refine its research
          </p>
        </div>
      </div>
    </div>
  )
}
