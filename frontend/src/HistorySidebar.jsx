import { useState, useEffect, useCallback } from 'react'
import { PanelLeftClose, Plus, Search, History, Trash2, LogOut } from 'lucide-react'
import MoteGlyph from './components/MoteGlyph'

/**
 * HistorySidebar: brand, new research, searchable session history grouped by date,
 * and the signed-in user.
 */
export default function HistorySidebar({
  isOpen,
  onClose,
  onNewSearch,
  onLoadSession,
  activeSessionId,
  authFetch,
  user,
  onLogout,
  refreshKey,
}) {
  const [sessions, setSessions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Fetch sessions on mount and when refreshKey changes
  const fetchSessions = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await authFetch('/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch (err) {
      console.error('[HistorySidebar] Failed to fetch sessions:', err)
    } finally {
      setIsLoading(false)
    }
  }, [authFetch])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions, refreshKey])

  // Delete a session
  const handleDelete = async (sessionId) => {
    try {
      await authFetch(`/sessions/${sessionId}`, { method: 'DELETE' })
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId))
      setDeleteConfirm(null)
    } catch (err) {
      console.error('[HistorySidebar] Failed to delete session:', err)
    }
  }

  // Group sessions by date
  const groupedSessions = groupByDate(
    sessions.filter((s) =>
      searchFilter
        ? s.goal.toLowerCase().includes(searchFilter.toLowerCase())
        : true
    )
  )

  return (
    <aside className={`qm-sidebar ${isOpen ? 'is-open' : ''}`} aria-label="Research history" aria-hidden={!isOpen}>
      <div className="qm-sidebar-head">
        <button type="button" onClick={onNewSearch} className="qm-sidebar-brand" title="Back to start">
          <MoteGlyph size={28} />
          <span>QueryMind</span>
        </button>
        <button type="button" onClick={onClose} className="qm-icon-btn" aria-label="Close sidebar">
          <PanelLeftClose size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="qm-sidebar-new">
        <button type="button" onClick={onNewSearch} className="qm-app-btn qm-app-btn-primary">
          <Plus size={18} aria-hidden="true" />
          New research
        </button>
      </div>

      {sessions.length > 0 && (
        <div className="qm-sidebar-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search your history"
            aria-label="Search your history"
          />
        </div>
      )}

      <div className="qm-sidebar-list">
        {isLoading && sessions.length === 0 ? (
          <div className="qm-sidebar-empty">
            <div className="thinking-dots" aria-label="Loading history">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="qm-sidebar-empty">
            <History size={22} aria-hidden="true" />
            <p>Your past research will show up here.</p>
          </div>
        ) : (
          Object.entries(groupedSessions).map(([group, items]) => (
            <div key={group} className="qm-sidebar-group">
              <h3>{group}</h3>
              <ul>
                {items.map((session) => {
                  const active = activeSessionId === session.session_id
                  const confirming = deleteConfirm === session.session_id
                  return (
                    <li key={session.session_id} className={`qm-session ${active ? 'is-active' : ''}`}>
                      <button
                        type="button"
                        onClick={() => onLoadSession(session.session_id)}
                        className="qm-session-open"
                        aria-current={active ? 'true' : undefined}
                      >
                        <span className="qm-session-goal">{session.goal || 'Untitled'}</span>
                        <span className="qm-session-time">{formatRelativeTime(session.created_at)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirming) {
                            handleDelete(session.session_id)
                          } else {
                            setDeleteConfirm(session.session_id)
                            setTimeout(() => setDeleteConfirm(null), 3000)
                          }
                        }}
                        className={`qm-session-delete ${confirming ? 'is-confirming' : ''}`}
                        aria-label={confirming ? 'Press again to delete' : 'Delete this session'}
                        title={confirming ? 'Press again to delete' : 'Delete'}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        {confirming && <span>Delete?</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      <div className="qm-sidebar-user">
        {user ? (
          <>
            {user.picture ? (
              <img src={user.picture} alt="" className="qm-avatar" referrerPolicy="no-referrer" />
            ) : (
              <span className="qm-avatar qm-avatar-initial">{(user.name || user.email || '?')[0].toUpperCase()}</span>
            )}
            <div className="qm-sidebar-user-text">
              <p>{user.name || user.email}</p>
              {user.name && user.email && <span>{user.email}</span>}
            </div>
            <button type="button" onClick={onLogout} className="qm-icon-btn" aria-label="Sign out" title="Sign out">
              <LogOut size={16} aria-hidden="true" />
            </button>
          </>
        ) : (
          <p className="qm-sidebar-anon">Not signed in</p>
        )}
      </div>
    </aside>
  )
}

function groupByDate(sessions) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const groups = {}

  for (const session of sessions) {
    const date = new Date(session.created_at)
    let group

    if (date >= today) {
      group = 'Today'
    } else if (date >= yesterday) {
      group = 'Yesterday'
    } else if (date >= weekAgo) {
      group = 'Previous 7 Days'
    } else {
      group = 'Older'
    }

    if (!groups[group]) groups[group] = []
    groups[group].push(session)
  }

  return groups
}

function formatRelativeTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
