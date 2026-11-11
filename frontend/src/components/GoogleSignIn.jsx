import { useEffect, useRef } from 'react'

// One shared loader and one shared callback: Google Identity Services may only
// be initialised once per page, but the landing page shows the button twice.
let scriptPromise = null
let activeHandler = null

function loadGoogle() {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google)
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        callback: (response) => activeHandler?.(response),
        auto_select: false,
        ux_mode: 'popup',
      })
      resolve(window.google)
    }
    script.onerror = () => reject(new Error('Google sign-in could not load'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

export default function GoogleSignIn({ onCredential, width = 300, theme = 'filled_black' }) {
  const ref = useRef(null)
  const handlerRef = useRef(onCredential)
  useEffect(() => {
    handlerRef.current = onCredential
  }, [onCredential])

  useEffect(() => {
    let cancelled = false
    loadGoogle()
      .then((google) => {
        if (cancelled || !ref.current) return
        ref.current.innerHTML = ''
        google.accounts.id.renderButton(ref.current, {
          theme,
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [width, theme])

  // Whichever button the visitor clicks last owns the callback.
  return (
    <div
      ref={ref}
      className="qm-google"
      onPointerDown={() => {
        activeHandler = (r) => handlerRef.current?.(r)
      }}
      onFocusCapture={() => {
        activeHandler = (r) => handlerRef.current?.(r)
      }}
      style={{ minHeight: 44 }}
    />
  )
}
