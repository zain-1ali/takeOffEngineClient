import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/api'
import { ThemeToggle } from '../theme/ThemeToggle'

export default function VerifyEmailPage() {
  const { verifyEmail, user } = useAuth()
  const [params] = useSearchParams()
  const token = useMemo(() => params.get('token')?.trim() || '', [params])
  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working')
  const [message, setMessage] = useState('Verifying your email…')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Missing verification token. Open the link from your email again.')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        await verifyEmail(token)
        if (!cancelled) {
          setStatus('ok')
          setMessage('Email verified. You are signed in.')
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setMessage(err instanceof ApiError ? err.message : 'Verification failed')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, verifyEmail])

  return (
    <div className="min-h-full flex items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm border border-steel-border bg-panel p-5">
        <p className="text-[10.5px] tracking-[0.18em] uppercase text-steel font-medium">AgileQS</p>
        <h1 className="mt-2 font-display text-xl font-semibold text-ink">Email verification</h1>
        <p
          className={`mt-3 text-sm leading-relaxed ${
            status === 'error' ? 'text-danger' : 'text-steel'
          }`}
        >
          {message}
        </p>
        <p className="mt-5 text-sm text-steel">
          {status === 'ok' || user ? (
            <Link to="/" className="text-chalk hover:underline">
              Continue to dashboard
            </Link>
          ) : (
            <Link to="/login" className="text-chalk hover:underline">
              Back to sign in
            </Link>
          )}
        </p>
      </div>
    </div>
  )
}
