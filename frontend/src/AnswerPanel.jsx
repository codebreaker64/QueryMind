import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import SourceCard from './SourceCard'
import { VStack, HStack } from '@astryxdesign/core/Layout'
import { Text, Heading } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Icon } from '@astryxdesign/core/Icon'
import { Divider } from '@astryxdesign/core/Divider'
import { Token } from '@astryxdesign/core/Token'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import {
  DocumentIcon,
  GlobeAltIcon,
  ArrowDownTrayIcon,
  ClipboardIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

export default function AnswerPanel({
  answer,
  sources,
  searches,
  isThinking,
  isDone,
  error,
}) {
  const [activeTab, setActiveTab] = useState('answer')
  const [copied, setCopied] = useState(false)
  const answerEndRef = useRef(null)

  useEffect(() => {
    if (answerEndRef.current) {
      answerEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [answer, sources, isThinking])

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
  }

  const handleDownloadMD = () => {
    downloadAsFile(answer, 'querymind-research.md', 'text/markdown')
  }

  const handleDownloadTXT = () => {
    const plainText = answer
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
    downloadAsFile(plainText, 'querymind-research.txt', 'text/plain')
  }

  const handleDownloadHTML = () => {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>QueryMind Research</title>
<style>body{font-family:system-ui,sans-serif;max-width:700px;margin:2rem auto;padding:0 1rem;line-height:1.7;color:#222}
h1,h2,h3{color:#111}a{color:#0066cc}blockquote{border-left:3px solid #ccc;padding-left:1rem;color:#555}</style>
</head><body>${answer}</body></html>`
    downloadAsFile(html, 'querymind-research.html', 'text/html')
  }

  return (
    <VStack gap={4} hAlign="stretch" className="animate-fade-in-up" style={{ height: '100%', overflow: 'hidden' }}>
      {/* ── Tabs ──────────────────────────────────── */}
      <HStack gap={2} style={{ borderBottom: '1px solid var(--color-border)' }}>
        <Button
          label="Answer"
          variant="ghost"
          onClick={() => setActiveTab('answer')}
          icon={<Icon icon={DocumentIcon} size="sm" />}
          style={{
            borderBottom: activeTab === 'answer' ? '2px solid var(--color-accent)' : 'none',
            borderRadius: 0,
            paddingBottom: 8,
          }}
        />
        <Button
          label={`Sources (${sources.length})`}
          variant="ghost"
          onClick={() => setActiveTab('links')}
          icon={<Icon icon={GlobeAltIcon} size="sm" />}
          style={{
            borderBottom: activeTab === 'links' ? '2px solid var(--color-accent)' : 'none',
            borderRadius: 0,
            paddingBottom: 8,
          }}
        />
      </HStack>

      {/* Tab Content Container */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
        {/* ── Answer Tab ─────────────────────────────── */}
        {activeTab === 'answer' && (
          <VStack gap={4} hAlign="stretch">
            {/* Active searches indicator */}
            {searches.length > 0 && (
              <VStack gap={2} hAlign="stretch">
                {searches.map((query, i) => (
                  <Card key={i} padding={3} variant="muted">
                    <HStack gap={2} vAlign="center">
                      <Icon icon={ArrowPathIcon} size="sm" className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                      <Text type="supporting" color="secondary">
                        Searching: "{query}"
                      </Text>
                    </HStack>
                  </Card>
                ))}
              </VStack>
            )}

            {/* Thinking state */}
            {isThinking && !answer && (
              <HStack gap={3} vAlign="center" style={{ paddingBlock: 12 }}>
                <div className="thinking-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <Text type="supporting" color="secondary">
                  Analyzing sources and formulating research response...
                </Text>
              </HStack>
            )}

            {/* Markdown Answer */}
            {answer && (
              <VStack gap={2} hAlign="stretch">
                <div className="markdown-content">
                  <ReactMarkdown>{answer}</ReactMarkdown>
                </div>
                {isThinking && (
                  <span
                    className="inline-block"
                    style={{
                      width: 8,
                      height: 18,
                      backgroundColor: 'var(--color-accent)',
                      animation: 'blink 1s infinite',
                      alignSelf: 'flex-start'
                    }}
                  />
                )}
              </VStack>
            )}

            {/* Error display */}
            {error && (
              <Card padding={4} style={{ borderColor: 'var(--color-error)' }}>
                <HStack gap={3} vAlign="start">
                  <Icon icon={ExclamationTriangleIcon} size="md" style={{ color: 'var(--color-error)' }} />
                  <VStack gap={1}>
                    <Text type="label" weight="semibold" style={{ color: 'var(--color-error)' }}>
                      Research Error
                    </Text>
                    <Text type="supporting" color="secondary">
                      {error}
                    </Text>
                  </VStack>
                </HStack>
              </Card>
            )}

            {/* ── Action bar ──────────────────────────── */}
            {answer && isDone && (
              <VStack gap={2}>
                <Divider />
                <HStack justify="between" vAlign="center" style={{ paddingTop: 8 }}>
                  <HStack gap={2} vAlign="center">
                    {/* Download Dropdown */}
                    <DropdownMenu
                      button={{
                        label: 'Download',
                        variant: 'secondary',
                        size: 'sm',
                        icon: <Icon icon={ArrowDownTrayIcon} size="sm" />,
                      }}
                      menuWidth={180}
                      items={[
                        { label: 'Markdown (.md)', onClick: handleDownloadMD },
                        { label: 'Plain Text (.txt)', onClick: handleDownloadTXT },
                        { label: 'HTML Page (.html)', onClick: handleDownloadHTML },
                      ]}
                    />

                    {/* Copy Button */}
                    <Button
                      label={copied ? "Copied" : "Copy"}
                      variant="secondary"
                      size="sm"
                      icon={<Icon icon={copied ? CheckIcon : ClipboardIcon} size="sm" />}
                      onClick={handleCopy}
                    />
                  </HStack>

                  {sources.length > 0 && (
                    <Token label={`${sources.length} Sources Checked`} variant="blue" />
                  )}
                </HStack>
              </VStack>
            )}
          </VStack>
        )}

        {/* ── Links Tab ──────────────────────────────── */}
        {activeTab === 'links' && (
          <VStack gap={2} hAlign="stretch">
            {sources.length === 0 ? (
              <VStack gap={3} hAlign="center" style={{ paddingBlock: 48 }}>
                <Icon icon={GlobeAltIcon} size="lg" color="secondary" style={{ opacity: 0.3 }} />
                <Text type="supporting" color="secondary">
                  No sources discovered yet.
                </Text>
              </VStack>
            ) : (
              sources.map((source, i) => (
                <SourceCard key={`${source.url}-${i}`} source={source} index={i} />
              ))
            )}
          </VStack>
        )}
      </div>

      <div ref={answerEndRef} />
    </VStack>
  )
}
