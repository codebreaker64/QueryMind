import { useState, useRef, useEffect } from 'react'
import { CornerDownLeft } from 'lucide-react'
import MoteGlyph from './components/MoteGlyph'

/**
 * HITLModal: the agent has paused to ask a clarifying question.
 * The run is waiting on this answer, so focus is held here until it is sent.
 */
export default function HITLModal({ question, onSubmit }) {
  const [answer, setAnswer] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = answer.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setAnswer('')
  }

  return (
    <div className="qm-dialog-backdrop">
      <div className="qm-dialog" role="dialog" aria-modal="true" aria-labelledby="hitl-title" aria-describedby="hitl-question">
        <div className="qm-dialog-head">
          <MoteGlyph size={44} mood="curious" />
          <div>
            <h2 id="hitl-title">Quick question before I go on</h2>
            <p>Your answer steers the rest of this run.</p>
          </div>
        </div>

        <p id="hitl-question" className="qm-dialog-question">
          {question}
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="hitl-answer-input" className="qm-visually-hidden">
            Your answer
          </label>
          <textarea
            ref={inputRef}
            id="hitl-answer-input"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e)
            }}
            placeholder="Type your answer"
            rows={3}
          />
          <div className="qm-dialog-actions">
            <span className="qm-dialog-hint">
              <CornerDownLeft size={14} aria-hidden="true" /> Enter to send, Shift + Enter for a new line
            </span>
            <button id="hitl-resume-button" type="submit" className="qm-app-btn qm-app-btn-primary" disabled={!answer.trim()}>
              Continue research
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
