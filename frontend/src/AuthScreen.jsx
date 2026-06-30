import { useState, useEffect, useRef, useCallback } from 'react'
import { VStack, HStack, Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { Text, Heading } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Icon } from '@astryxdesign/core/Icon'
import { Grid } from '@astryxdesign/core/Grid'
import { AspectRatio } from '@astryxdesign/core/AspectRatio'
import { SparklesIcon, ArrowRightIcon } from '@heroicons/react/24/outline'

const GoogleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    width={16}
    height={16}
    aria-hidden="true"
    style={{ marginRight: 8 }}
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
)

const FEATURES = [
  {
    title: 'Parallel Deep Search',
    description: 'Runs multiple concurrent search queries to aggregate information from diverse web sources, news, and academic papers simultaneously.',
    src: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&h=500&q=80',
    alt: 'Parallel search network concept',
  },
  {
    title: 'Human-in-the-Loop',
    description: 'Pauses automatically when encountering ambiguity or key decisions, prompting you to clarify details for the most accurate direction.',
    src: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&h=500&q=80',
    alt: 'Human collaborating with AI interface',
  },
  {
    title: 'Cited & Verified Reports',
    description: 'Generates comprehensive structured reports where every claim and finding is backed by transparent, clickable inline citations.',
    src: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=400&h=500&q=80',
    alt: 'Citations and document verification concept',
  },
]

const galleryImage = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
}

const galleryImageClip = {
  borderRadius: 'var(--radius-container)',
}

const cardStyle = {
  maxWidth: 400,
  width: '100%',
  alignSelf: 'center',
}

export default function AuthScreen({ onLogin }) {
  const [error, setError] = useState(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const googleBtnRef = useRef(null)
  const scriptLoadedRef = useRef(false)

  const handleCredentialResponse = useCallback(
    async (response) => {
      setIsLoggingIn(true)
      setError(null)
      try {
        await onLogin(response.credential)
      } catch (err) {
        setError(err.message || 'Login failed. Please try again.')
      } finally {
        setIsLoggingIn(false)
      }
    },
    [onLogin]
  )

  // Load Google Client
  useEffect(() => {
    if (!googleBtnRef.current || scriptLoadedRef.current) return
    scriptLoadedRef.current = true

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          callback: handleCredentialResponse,
          auto_select: false,
          ux_mode: 'popup',
        })
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 300,
        })
      }
    }
    document.head.appendChild(script)
  }, [handleCredentialResponse])

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflowY: 'auto', backgroundColor: 'var(--color-background-body)' }}>
      <Layout padding={6}>
        <LayoutContent padding={6}>
          <VStack gap={10} hAlign="stretch">
            {/* Header / Brand */}
            <HStack justify="between" vAlign="center" width="100%">
              <HStack gap={2} vAlign="center">
                <Icon icon={SparklesIcon} size="md" color="accent" />
                <Heading level={2} type="display-3" style={{ color: 'var(--color-accent)' }}>
                  QueryMind
                </Heading>
              </HStack>
            </HStack>

            {/* Hero Section (Covering entire viewport page with background video) */}
            <div 
              style={{ 
                position: 'relative',
                minHeight: '80vh', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center',
                textAlign: 'center',
                padding: '2rem',
                borderRadius: 'var(--radius-container)',
                overflow: 'hidden',
                border: '1px solid var(--color-border)',
                backgroundColor: 'rgba(9, 9, 11, 0.4)'
              }}
            >
              {/* Background Video */}
              <video
                autoPlay
                loop
                muted
                playsInline
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  zIndex: 0,
                  opacity: 0.35,
                  filter: 'grayscale(20%) brightness(80%)'
                }}
              >
                <source src="/Hero.mp4" type="video/mp4" />
              </video>

              {/* Dark Gradient Overlay for readability and premium look */}
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: 'radial-gradient(circle at center, rgba(9, 9, 11, 0.4) 0%, rgba(9, 9, 11, 0.8) 100%)',
                  zIndex: 1
                }}
              />

              {/* Hero Content */}
              <VStack gap={4} hAlign="center" style={{ maxWidth: 850, zIndex: 2, position: 'relative' }}>
                <Heading level={1} style={{ fontSize: '3.6rem', fontWeight: 800, lineHeight: '1.15', letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                  The Autonomous AI Research Agent
                </Heading>
                <Text type="body" color="secondary" justify="center" textWrap="balance" style={{ maxWidth: 720, fontSize: '1.35rem', lineHeight: '1.6', marginTop: '1rem' }}>
                  QueryMind searches the web, handles multi-source synthesis, and prompts for clarifications in real-time. Experience parallel research loops that compile fully-cited reports while you focus on what matters.
                </Text>
              </VStack>
            </div>

            {/* Feature Gallery Grid (Images twice as small, text takes over space) */}
            <Grid columns={{ minWidth: 280, repeat: 'fit' }} gap={8} style={{ marginTop: '2rem', marginBottom: '4rem' }}>
              {FEATURES.map((feature, index) => (
                <VStack key={index} gap={4} hAlign="stretch">
                  <AspectRatio ratio={16 / 10} style={galleryImageClip}>
                    <img
                      style={galleryImage}
                      src={feature.src}
                      alt={feature.alt}
                    />
                  </AspectRatio>
                  <VStack gap={2} hAlign="start" style={{ padding: '0 4px' }}>
                    <Heading level={3} style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {feature.title}
                    </Heading>
                    <Text type="body" color="secondary" style={{ fontSize: '1.05rem', lineHeight: '1.5' }}>
                      {feature.description}
                    </Text>
                  </VStack>
                </VStack>
              ))}
            </Grid>

            {/* Login Card Section */}
            <VStack hAlign="center" width="100%" style={{ marginTop: '3rem', marginBottom: '2rem' }}>
              <Card padding={8} style={cardStyle}>
                <VStack gap={6} hAlign="stretch">
                  <VStack gap={1} hAlign="center">
                    <Heading level={3}>Start Researching</Heading>
                    <Text type="supporting" color="secondary">
                      Sign in or continue anonymously to query the mind
                    </Text>
                  </VStack>

                  {error && (
                    <Text type="supporting" style={{ color: 'var(--color-error)', textAlign: 'center' }}>
                      {error}
                    </Text>
                  )}

                  <VStack gap={4} hAlign="center" width="100%">
                    {/* Google OAuth Login Button */}
                    <div style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isLoggingIn ? (
                        <Button
                          label="Signing in..."
                          variant="secondary"
                          size="lg"
                          isDisabled
                          icon={<GoogleIcon />}
                        />
                      ) : (
                        <div ref={googleBtnRef} />
                      )}
                    </div>

                    {/* Continue Anonymously Button */}
                    <Button
                      label="Continue anonymously"
                      variant="secondary"
                      size="lg"
                      onClick={() => onLogin(null)}
                      endContent={<Icon icon={ArrowRightIcon} size="sm" />}
                      width="100%"
                      style={{ maxWidth: 300 }}
                    />
                  </VStack>
                </VStack>
              </Card>
            </VStack>
          </VStack>
        </LayoutContent>
      </Layout>
    </div>
  )
}

