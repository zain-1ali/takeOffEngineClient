import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black'
              size?: 'large' | 'medium' | 'small'
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
              shape?: 'rectangular' | 'pill' | 'circle' | 'square'
              width?: number
              locale?: string
            },
          ) => void
          prompt: () => void
        }
      }
    }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google script failed')))
      if (window.google?.accounts?.id) resolve()
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google script failed'))
    document.head.appendChild(script)
  })
}

export function GoogleSignInButton({
  onCredential,
  label = 'signin_with',
  disabled,
}: {
  onCredential: (credential: string) => void | Promise<void>
  label?: 'signin_with' | 'signup_with' | 'continue_with'
  disabled?: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onCredentialRef = useRef(onCredential)
  onCredentialRef.current = onCredential
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

  useEffect(() => {
    if (!clientId || !hostRef.current) return
    let cancelled = false

    ;(async () => {
      try {
        await loadGisScript()
        if (cancelled || !hostRef.current || !window.google?.accounts?.id) return
        hostRef.current.innerHTML = ''
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            void onCredentialRef.current(response.credential)
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        window.google.accounts.id.renderButton(hostRef.current, {
          theme: 'outline',
          size: 'large',
          text: label,
          shape: 'rectangular',
          width: 320,
        })
      } catch {
        // Button stays empty if GIS fails to load.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [clientId, label])

  if (!clientId) return null

  return (
    <div className="w-full flex justify-center overflow-hidden" aria-label="Continue with Google">
      <div ref={hostRef} className={disabled ? 'pointer-events-none opacity-50' : undefined} />
    </div>
  )
}
