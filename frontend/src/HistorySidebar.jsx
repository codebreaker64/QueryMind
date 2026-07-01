import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * HistorySidebar — Fixed glassmorphic sidebar matching the code.html reference design.
 * Includes brand header, new research CTA, static nav links (Research Feed, Knowledge Base,
 * Session History, Settings), dynamic session history, and user profile section.
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
    <aside
      className={`
        hidden md:flex flex-col h-screen glass-panel z-40
        border-r border-white/5 shadow-2xl
        transition-all duration-300 ease-out shrink-0
        ${isOpen ? 'w-64' : 'w-0 border-r-0 overflow-hidden'}
      `}
    >
      {/* Sidebar header - Brand */}
      <div className="px-6 pt-7 pb-5 flex flex-col gap-1 border-b border-white/5">
        <div className="flex items-center justify-between">
          <button
            onClick={onNewSearch}
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all select-none border-none bg-transparent p-0 text-left outline-none"
            title="Go to landing page"
          >
            <img
              alt="QueryMind Logo"
              className="w-8 h-8 rounded-full border border-indigo-500/30"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDf5WGt2gVK3T3yz2uoAU2Z4sx1AcV7vVdf25GgYa29t8rDZ1P3UHsk3NPxjpuInoniODzSpKz6NO_8x1ZvCGrHYLd6RtZks9dR3cSSBXHg9cD9rVxrGTnbeqHaeY925qF6Vaogy-GJ8q2MBycfUHI-2yC11Fu56Pt3FcVmgftb3znbnGDeWQMcU62zh1GycZDlEEAyzgbJimIdl8efKzVknuOLH2_oVAETAEFjjQPpB7GVi8g0aqNILYbg2BQJwygZhes6I0_sodg"
            />
            <h1 className="text-indigo-500 font-headline font-bold text-xl tracking-tight">
              QueryMind
            </h1>
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">menu_open</span>
          </button>
        </div>
      </div>

      {/* New Research CTA */}
      <div className="px-4 pt-5 pb-4">
        <button
          onClick={onNewSearch}
          className="w-full py-2.5 px-4 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg font-semibold text-lg transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] flex items-center justify-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px]">add</span>
          New Research
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="px-3 space-y-1 pb-3">
        <a className="bg-indigo-500/10 text-indigo-400 border-r-2 border-indigo-500 flex items-center gap-3 px-4 py-3 rounded-l-lg cursor-pointer" href="#">
          <span className="material-symbols-outlined">dynamic_feed</span>
          <span className="font-body text-sm font-medium">Research Feed</span>
        </a>
      </nav>

      {/* Search filter for history */}
      {sessions.length > 0 && (
        <div className="px-4 py-3 mx-3">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px] text-slate-500">
              search
            </span>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search history..."
              className="w-full pl-7 pr-3 py-1.5 text-[11px] bg-[#09090b]/50 border border-white/5 rounded-lg text-slate-300 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-colors font-body"
            />
          </div>
        </div>
      )}

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {isLoading && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="thinking-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 px-4">
            <span className="material-symbols-outlined text-3xl text-slate-600 mb-2 opacity-30">
              history
            </span>
            <p className="text-[11px] text-slate-600 font-label">
              No past sessions
            </p>
          </div>
        ) : (
          Object.entries(groupedSessions).map(([group, items]) => (
            <div key={group} className="space-y-1">
              <h3 className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 px-3 mb-2 font-label">
                {group}
              </h3>
              <div className="space-y-0.5">
                {items.map((session) => (
                  <div
                    key={session.session_id}
                    className="group relative rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => onLoadSession(session.session_id)}
                      className={`
                        w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all duration-200 cursor-pointer border relative flex items-center justify-between
                        ${
                          activeSessionId === session.session_id
                            ? 'bg-white/5 border-white/5 text-white font-medium shadow-sm'
                            : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
                        }
                      `}
                    >
                      <div className="truncate pr-4 flex-1 font-body">
                        <p className="truncate leading-normal">
                          {session.goal || 'Untitled'}
                        </p>
                        <span className="text-[9px] text-slate-600 mt-0.5 block font-label">
                          {formatRelativeTime(session.created_at)}
                        </span>
                      </div>

                      <span className={`material-symbols-outlined text-[14px] text-slate-600 transition-all transform duration-200 ${activeSessionId === session.session_id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0'}`}>
                        chevron_right
                      </span>
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (deleteConfirm === session.session_id) {
                          handleDelete(session.session_id)
                        } else {
                          setDeleteConfirm(session.session_id)
                          setTimeout(() => setDeleteConfirm(null), 3000)
                        }
                      }}
                      className={`
                        absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all cursor-pointer z-10
                        ${
                          deleteConfirm === session.session_id
                            ? 'opacity-100 text-red-400 bg-red-500/10'
                            : 'opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 hover:bg-white/5'
                        }
                      `}
                      title={
                        deleteConfirm === session.session_id
                          ? 'Confirm delete'
                          : 'Delete'
                      }
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* User section at bottom */}
      <div className="shrink-0 border-t border-white/5 p-5 bg-[#141416]/30">
        {user ? (
          <div className="flex items-center gap-3">
            {user.picture ? (
              <img
                src={user.picture}
                alt=""
                className="w-8 h-8 rounded-lg border border-white/10"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[#141416] border border-white/10 flex items-center justify-center text-xs font-semibold text-slate-400 shadow-inner">
                {(user.name || user.email || '?')[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0 font-body">
              <p className="text-xs font-semibold text-white truncate font-headline">
                {user.name || user.email}
              </p>
              {user.name && (
                <p className="text-[10px] text-slate-500 truncate font-label">
                  {user.email}
                </p>
              )}
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Sign out"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
            </button>
          </div>
        ) : (
          <div className="text-center py-1 font-label">
            <span className="text-[10px] font-medium text-slate-600">
              Anonymous Session
            </span>
          </div>
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
