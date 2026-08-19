import { useCallback, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { GoogleSignInButton } from '../auth/GoogleSignInButton'
import { PrimaryButton } from '../components/ui'
import { ApiError } from '../lib/api'
import { ThemeToggle } from '../theme/ThemeToggle'

export default function LoginPage() {
  const { user, loading, login, loginWithGoogle, resendVerification } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onGoogle = useCallback(
    async (credential: string) => {
      setError('')
      setInfo('')
      setSubmitting(true)
      try {
        await loginWithGoogle(credential)
        navigate(from, { replace: true })
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Google sign-in failed')
      } finally {
        setSubmitting(false)
      }
    },
    [from, loginWithGoogle, navigate],
  )

  if (!loading && user) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setUnverifiedEmail('')
    setSubmitting(true)

    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(err.email || email)
        setError(err.message)
      } else {
        setError(err instanceof ApiError ? err.message : 'Login failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function onResend() {
    const target = unverifiedEmail || email
    if (!target) return
    setError('')
    setInfo('')
    try {
      const result = await resendVerification(target)
      setInfo(
        result.mailSent === false
          ? `${result.message} (If nothing arrives, check the backend console for the link.)`
          : result.message,
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend verification')
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <p className="text-[10.5px] tracking-[0.18em] uppercase text-steel font-medium">AgileQS</p>
        <h1 className="mt-2 font-display text-xl font-semibold text-ink">Sign in</h1>
        <p className="mt-1 text-sm text-steel">Access your takeoff projects</p>

        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-4 border border-steel-border bg-panel p-5"
        >
          {error && (
            <div className="text-sm px-3 py-2 text-danger bg-danger-bg border border-danger-border space-y-2">
              <p>{error}</p>
              {unverifiedEmail && (
                <button
                  type="button"
                  className="text-chalk underline text-xs"
                  onClick={() => void onResend()}
                >
                  Resend verification email
                </button>
              )}
            </div>
          )}
          {info && (
            <p className="text-sm px-3 py-2 text-ink bg-panel-hover border border-steel-border">
              {info}
            </p>
          )}

          <label className="block text-sm">
            <span className="text-steel">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border border-steel-border bg-panel-hover px-3 py-2 text-ink outline-none"
            />
          </label>

          <label className="block text-sm">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-steel">Password</span>
              <Link to="/forgot-password" className="text-xs text-chalk hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-steel-border bg-panel-hover px-3 py-2 text-ink outline-none"
            />
          </label>

          <PrimaryButton type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </PrimaryButton>

          <div className="flex items-center gap-3 text-[11px] text-steel">
            <span className="flex-1 border-t border-steel-border" />
            or
            <span className="flex-1 border-t border-steel-border" />
          </div>

          <GoogleSignInButton onCredential={onGoogle} disabled={submitting} />
        </form>

        <p className="mt-4 text-sm text-steel text-center">
          No account?{' '}
          <Link to="/signup" className="text-chalk hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
