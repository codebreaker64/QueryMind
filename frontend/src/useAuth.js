import { useState, useEffect, useCallback, useRef } from 'react'

const TOKEN_KEY = 'querymind_token'
const USER_KEY = 'querymind_user'

/**
 * useAuth — Authentication hook for Google OAuth.
 *
 * Manages JWT in localStorage, validates on mount,
 * and provides login/logout functions.
 */
export default function useAuth() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const initializedRef = useRef(false)

  // Validate existing token on mount
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const savedToken = localStorage.getItem(TOKEN_KEY)
    const savedUser = localStorage.getItem(USER_KEY)

    if (savedToken && savedUser) {
      // Try to validate the token
      fetch('/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error('Token expired')
        })
        .then((userData) => {
          setUser(userData)
          setToken(savedToken)
        })
        .catch(() => {
          // Token invalid — clear stored data
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(USER_KEY)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }

    return () => {
      initializedRef.current = false
    }
  }, [])

  const login = useCallback(async (googleIdToken) => {
    const res = await fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: googleIdToken }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login failed' }))
      throw new Error(err.detail || 'Login failed')
    }

    const data = await res.json()
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)

    return data
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  /**
   * Helper: create headers with auth token.
   */
  const authHeaders = useCallback(
    (extra = {}) => {
      const headers = { ...extra }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      return headers
    },
    [token]
  )

  /**
   * Helper: authenticated fetch wrapper.
   */
  const authFetch = useCallback(
    (url, options = {}) => {
      return fetch(url, {
        ...options,
        headers: authHeaders(options.headers || {}),
      })
    },
    [authHeaders]
  )

  return {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    authHeaders,
    authFetch,
  }
}
