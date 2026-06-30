import { Card } from '@astryxdesign/core/Card'
import { VStack, HStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { Icon } from '@astryxdesign/core/Icon'
import { Token } from '@astryxdesign/core/Token'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid'

export default function SourceCard({ source, index }) {
  const { title, url, snippet } = source

  let domain = ''
  try {
    const parsed = new URL(url)
    domain = parsed.hostname.replace('www.', '')
  } catch {
    domain = url
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      id={`source-card-${index}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      className="animate-fade-in-up"
    >
      <Card padding={3} variant="muted" className="hover:border-accent transition-all duration-200">
        <HStack gap={3} vAlign="start" width="100%">
          {/* Favicon */}
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-element)',
            backgroundColor: 'var(--color-background-body)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
            marginTop: 2
          }}>
            <img
              src={faviconUrl}
              alt=""
              style={{ width: 16, height: 16 }}
              onError={(e) => { e.target.style.display = 'none' }}
            />
          </div>

          {/* Content */}
          <VStack gap={1} style={{ flex: 1, minWidth: 0 }}>
            <HStack gap={2} vAlign="center" justify="between" width="100%">
              <HStack gap={2} vAlign="center" style={{ minWidth: 0, flex: 1 }}>
                <Text type="label" weight="semibold" style={{ truncate: true, color: 'var(--color-text-primary)' }}>
                  {title || 'Untitled Source'}
                </Text>
                <Token label={String(index + 1)} variant="blue" size="sm" />
              </HStack>
              <Icon icon={ArrowTopRightOnSquareIcon} size="sm" style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }} />
            </HStack>
            <Text type="supporting" color="secondary" size="xsm">
              {domain}
            </Text>
            {snippet && (
              <Text type="body" color="secondary" size="sm" style={{ lineClamp: 2 }}>
                {snippet}
              </Text>
            )}
          </VStack>
        </HStack>
      </Card>
    </a>
  )
}

