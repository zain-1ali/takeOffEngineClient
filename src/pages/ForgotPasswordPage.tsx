import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { PrimaryButton } from '../components/ui'
import { ApiError } from '../lib/api'
import { ThemeToggle } from '../theme/ThemeToggle'

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      const msg = await forgotPassword(email)
      setMessage(msg)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed')
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
        <h1 className="mt-2 font-display text-xl font-semibold text-ink">Forgot password</h1>
        <p className="mt-1 text-sm text-steel">
          Enter your account email and we’ll send a reset link if it exists.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-4 border border-steel-border bg-panel p-5"
        >
          {error && (
            <p className="text-sm px-3 py-2 text-danger bg-danger-bg border border-danger-border">
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm px-3 py-2 text-ink bg-panel-hover border border-steel-border">
              {message}
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

          <PrimaryButton type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Sending…' : 'Send reset link'}
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
