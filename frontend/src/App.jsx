import { useState, useCallback, useRef, useEffect } from 'react'
import './index.css'
import { Theme } from '@astryxdesign/core'
import { stoneTheme } from '@astryxdesign/theme-stone/built'
import { VStack, HStack, Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { Text, Heading } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { Icon } from '@astryxdesign/core/Icon'
import { Grid } from '@astryxdesign/core/Grid'
import { Token } from '@astryxdesign/core/Token'
import { ToggleButton, ToggleButtonGroup } from '@astryxdesign/core/ToggleButton'
import { useResizable, ResizeHandle } from '@astryxdesign/core/Resizable'
import {
  ChatComposer,
  ChatComposerInput,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
} from '@astryxdesign/core/Chat'
import { Avatar } from '@astryxdesign/core/Avatar'
import {
  SparklesIcon,
  CodeBracketIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  LightBulbIcon,
  Bars3Icon,
  PlusIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'

import useAuth from './useAuth'
import AuthScreen from './AuthScreen'
import HistorySidebar from './HistorySidebar'
import AnswerPanel from './AnswerPanel'
import HITLModal from './HITLModal'

const API_BASE = ''

const CATEGORIES = [
  { key: 'writing', label: 'Writing', icon: PencilSquareIcon },
  { key: 'coding', label: 'Coding', icon: CodeBracketIcon },
  { key: 'research', label: 'Research', icon: MagnifyingGlassIcon },
  { key: 'creative', label: 'Creative', icon: LightBulbIcon },
]

const CATEGORY_SUGGESTIONS = {
  writing: [
    {
      heading: 'Draft a project brief',
      body: 'Outline goals, deliverables, and timelines',
      prompt: 'Help me draft a comprehensive project brief for a new mobile app.',
    },
    {
      heading: 'Improve research tone',
      body: 'Refine the vocabulary and tone of a text',
      prompt: 'Refine this text to sound more academic and analytical: ',
    },
  ],
  coding: [
    {
      heading: 'Optimize algorithm',
      body: 'Improve time complexity of a function',
      prompt: 'Analyze and optimize this sorting algorithm for large datasets: ',
    },
    {
      heading: 'Explain JWT security',
      body: 'Understand token refreshing best practices',
      prompt: 'Explain the best practices for silent JWT token refresh flows.',
    },
  ],
  research: [
    {
      heading: 'Compare market trends',
      body: 'Analyze pros/cons of vertical tech stacks',
      prompt: 'Research and compare the current trends in autonomous agent frameworks.',
    },
    {
      heading: 'Find best practices',
      body: 'Standard structures for API design',
      prompt: 'What are the industry best practices for REST API error codes?',
    },
  ],
  creative: [
    {
      heading: 'Brainstorm brand names',
      body: 'Generate catchy titles for a startup',
      prompt: 'Brainstorm creative name ideas for a security analytics SaaS.',
    },
    {
      heading: 'Write landing page copy',
      body: 'Draft headlines and value propositions',
      prompt: 'Write landing page copy for a wake-up-to-answers research app.',
    },
  ],
}

export default function App() {
  const auth = useAuth()
  const [isAnonymous, setIsAnonymous] = useState(false)

  // Core research state
  const [isResearching, setIsResearching] = useState(false)
  const [currentQuery, setCurrentQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState([])
  const [searches, setSearches] = useState([])
  const [isThinking, setIsThinking] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Chat Landing category selection
  const [category, setCategory] = useState(null)

  // Session history refresh state
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [refreshHistoryKey, setRefreshHistoryKey] = useState(0)

  // HITL state
  const [hitlQuestion, setHitlQuestion] = useState(null)

  // Resizable panel setup for conversation layout
  const artifactResize = useResizable({
    defaultSize: 550,
    minSizePx: 380,
    maxSizePx: 800,
    autoSaveId: 'querymind-artifact-panel',
  })

  // WebSocket ref
  const wsRef = useRef(null)

  const handleSearch = useCallback(async (goal) => {
    if (!goal.trim()) return

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
      const headers = auth.authHeaders({ 'Content-Type': 'application/json' })
      const response = await fetch(`${API_BASE}/research`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ goal }),
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
      const sessionId = data.session_id
      setActiveSessionId(sessionId)
      setRefreshHistoryKey(k => k + 1)

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
  }, [auth])

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
        // Refresh sidebar history
        setRefreshHistoryKey(k => k + 1)
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
    setActiveSessionId(null)
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }

  const handleLoadSession = useCallback(async (sessionId) => {
    setActiveSessionId(sessionId)
    setIsResearching(false)
    setIsThinking(false)
    setIsDone(true)
    setError(null)
    setHitlQuestion(null)

    try {
      const res = await auth.authFetch(`/sessions/${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        setCurrentQuery(data.goal || '')
        setAnswer(data.answer || '')
        setSources(data.sources || [])
        setSearches([])
      } else {
        setError('Failed to load session details')
      }
    } catch (err) {
      setError('Error loading session')
    }
  }, [auth])

  const isAuthenticated = auth.isAuthenticated || isAnonymous
  const user = auth.user || (isAnonymous ? { name: 'Anonymous User', email: 'anonymous@querymind.ai' } : null)

  if (auth.isLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C1917' }}>
        <div className="thinking-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Theme theme={stoneTheme} mode="dark">
        <AuthScreen onLogin={async (credential) => {
          if (credential === null) {
            setIsAnonymous(true)
          } else {
            await auth.login(credential)
          }
        }} />
      </Theme>
    )
  }

  const isLanding = !isResearching && !isDone && !answer
  const suggestions = category ? CATEGORY_SUGGESTIONS[category] : null

  return (
    <Theme theme={stoneTheme} mode="dark">
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--color-background-body)' }}>
        {/* ── Sidebar ── */}
        <HistorySidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNewSearch={handleNewSearch}
          onLoadSession={handleLoadSession}
          activeSessionId={activeSessionId}
          authFetch={auth.authFetch}
          user={user}
          onLogout={() => {
            auth.logout()
            setIsAnonymous(false)
            handleNewSearch()
          }}
          refreshKey={refreshHistoryKey}
        />

        {/* ── Main panel ── */}
        <VStack style={{ flex: 1, minWidth: 0, height: '100%' }}>
          {/* Header */}
          <HStack justify="between" vAlign="center" style={{ padding: 'var(--spacing-4)', borderBottom: '1px solid var(--color-border)' }} width="100%">
            <HStack gap={3} vAlign="center">
              {!sidebarOpen && (
                <Button
                  label="Open menu"
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={Bars3Icon} size="sm" />}
                  isIconOnly
                  onClick={() => setSidebarOpen(true)}
                />
              )}
              <HStack gap={2} vAlign="center">
                <Icon icon={SparklesIcon} size="sm" style={{ color: 'var(--color-accent)' }} />
                <Heading level={4} style={{ color: 'var(--color-accent)', margin: 0 }}>
                  QueryMind
                </Heading>
              </HStack>
            </HStack>
            {!isLanding && (
              <Button
                label="New Session"
                variant="secondary"
                size="sm"
                icon={<Icon icon={PlusIcon} size="sm" />}
                onClick={handleNewSearch}
              />
            )}
          </HStack>

          {/* ── Landing State (Chat landing page) ── */}
          {isLanding && (
            <Layout height="fill" contentWidth={720} padding={6} style={{ overflowY: 'auto' }}>
              <LayoutContent>
                <VStack gap={8} vAlign="center" style={{ minHeight: '100%', justifyContent: 'center', paddingBottom: '10vh' }}>
                  {/* Greeting */}
                  <VStack gap={2} hAlign="center">
                    <HStack gap={2} vAlign="center">
                      <Icon icon={SparklesIcon} size="md" style={{ color: 'var(--color-accent)' }} />
                      <Text type="large" as="h2" weight="bold">
                        Hi, {user?.name || 'Researcher'}
                      </Text>
                    </HStack>
                    <Heading level={1} type="display-2" justify="center">
                      What would you like to research today?
                    </Heading>
                  </VStack>

                  {/* Composer / Search Bar */}
                  <ChatComposer
                    onSubmit={() => {}}
                    placeholder="Ask autonomous agents to gather web intelligence..."
                    input={
                      <ChatComposerInput
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            const text = e.currentTarget.textContent || ''
                            handleSearch(text)
                          }
                        }}
                        style={{ minHeight: 80 }}
                      />
                    }
                  />

                  {/* Category toggles + suggestions */}
                  <VStack gap={6} hAlign="center" width="100%">
                    <ToggleButtonGroup
                      label="Research Category"
                      value={category}
                      onChange={setCategory}
                      size="lg"
                    >
                      {CATEGORIES.map(cat => (
                        <ToggleButton
                          key={cat.key}
                          value={cat.key}
                          label={cat.label}
                          icon={<Icon icon={cat.icon} size="sm" />}
                        />
                      ))}
                    </ToggleButtonGroup>

                    {suggestions && (
                      <Grid columns={{ minWidth: 280 }} gap={3} width="100%">
                        {suggestions.map(s => (
                          <ClickableCard
                            key={s.heading}
                            label={s.heading}
                            variant="muted"
                            padding={3}
                            onClick={() => handleSearch(s.prompt)}
                          >
                            <VStack gap={0.5}>
                              <Heading level={4}>{s.heading}</Heading>
                              <Text type="body" color="secondary" size="xsm">
                                {s.body}
                              </Text>
                            </VStack>
                          </ClickableCard>
                        ))}
                      </Grid>
                    )}
                  </VStack>
                </VStack>
              </LayoutContent>
            </Layout>
          )}

          {/* ── Conversation State (Split panel conversation) ── */}
          {!isLanding && (
            <div style={{ flex: 1, display: 'flex', width: '100%', minHeight: 0, overflow: 'hidden' }}>
              {/* Left Column: Chat Feed */}
              <VStack style={{ flex: 1, minWidth: 0, height: '100%', borderRight: '1px solid var(--color-border)' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-6)' }}>
                  <ChatMessageList>
                    {/* User message */}
                    {currentQuery && (
                      <ChatMessage sender="user">
                        <ChatMessageBubble>
                          <Text type="body">{currentQuery}</Text>
                        </ChatMessageBubble>
                      </ChatMessage>
                    )}

                    {/* Agent status/message */}
                    <ChatMessage sender="assistant" avatar={<Avatar name="Agent" size="small" />}>
                      <ChatMessageBubble variant="ghost">
                        <Text type="body">
                          {isDone ? 'Research completed. You can view findings in the artifact panel.' : 'Autonomous research agents actively crawling, analyzing, and synthesizing findings...'}
                        </Text>
                      </ChatMessageBubble>
                    </ChatMessage>
                  </ChatMessageList>
                </div>

                {/* Follow up Composer */}
                <div style={{ padding: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-background-surface)' }}>
                  <ChatComposer
                    onSubmit={() => {}}
                    placeholder="Ask a follow-up or refine the research..."
                    input={
                      <ChatComposerInput
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            const text = e.currentTarget.textContent || ''
                            handleSearch(text)
                          }
                        }}
                      />
                    }
                  />
                </div>
              </VStack>

              {/* Resize Handle */}
              <ResizeHandle
                direction="horizontal"
                resizable={artifactResize.props}
                isReversed
                pillPlacement="start"
                hasDivider
                label="Resize results panel"
              />

              {/* Right Column: Resizable Artifact Panel (AnswerPanel) */}
              <Card
                variant="transparent"
                height="100%"
                style={{
                  width: artifactResize.size,
                  flexShrink: 0,
                  overflow: 'hidden',
                  padding: 'var(--spacing-6)',
                  backgroundColor: 'var(--color-background-surface)'
                }}
              >
                <AnswerPanel
                  answer={answer}
                  sources={sources}
                  searches={searches}
                  isThinking={isThinking}
                  isDone={isDone}
                  error={error}
                />
              </Card>
            </div>
          )}
        </VStack>
      </div>

      {/* ── HITL Modal ── */}
      {hitlQuestion && (
        <HITLModal question={hitlQuestion} onSubmit={handleHITLResume} />
      )}
    </Theme>
  )
}

