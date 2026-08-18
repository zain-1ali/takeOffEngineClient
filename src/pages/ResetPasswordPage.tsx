import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { PrimaryButton } from '../components/ui'
import { ApiError } from '../lib/api'
import { ThemeToggle } from '../theme/ThemeToggle'

export default function ResetPasswordPage() {
  const { resetPassword, user, loading } = useAuth()
  const [params] = useSearchParams()
  const token = useMemo(() => params.get('token')?.trim() || '', [params])
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (!token) {
      setError('Missing reset token. Open the link from your email again.')
      return
    }
    setSubmitting(true)
    try {
      await resetPassword(token, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <p className="text-[10.5px] tracking-[0.18em] uppercase text-steel font-medium">AgileQS</p>
        <h1 className="mt-2 font-display text-xl font-semibold text-ink">Set a new password</h1>
        <p className="mt-1 text-sm text-steel">Choose a password of at least 6 characters.</p>

        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-4 border border-steel-border bg-panel p-5"
        >
          {error && (
            <p className="text-sm px-3 py-2 text-danger bg-danger-bg border border-danger-border">
              {error}
            </p>
          )}
          {!token && (
            <p className="text-sm px-3 py-2 text-danger bg-danger-bg border border-danger-border">
              This page needs a valid reset link from your email.
            </p>
          )}

          <label className="block text-sm">
            <span className="text-steel">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-steel-border bg-panel-hover px-3 py-2 text-ink outline-none"
            />
          </label>

          <label className="block text-sm">
            <span className="text-steel">Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full border border-steel-border bg-panel-hover px-3 py-2 text-ink outline-none"
            />
          </label>

          <PrimaryButton type="submit" disabled={submitting || !token} className="w-full">
            {submitting ? 'Updating…' : 'Update password'}
          </PrimaryButton>
        </form>

        <p className="mt-4 text-sm text-steel text-center">
          <Link to="/login" className="text-chalk hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
