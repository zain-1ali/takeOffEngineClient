import { useCallback, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { GoogleSignInButton } from '../auth/GoogleSignInButton'
import { PrimaryButton } from '../components/ui'
import { ApiError } from '../lib/api'
import { ThemeToggle } from '../theme/ThemeToggle'

export default function SignupPage() {
  const { user, loading, signup, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onGoogle = useCallback(
    async (credential: string) => {
      setError('')
      setSubmitting(true)
      try {
        await loginWithGoogle(credential)
        navigate('/', { replace: true })
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Google sign-in failed')
      } finally {
        setSubmitting(false)
      }
    },
    [loginWithGoogle, navigate],
  )

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  if (pendingEmail) {
    return (
      <div className="min-h-full flex items-center justify-center p-6 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm border border-steel-border bg-panel p-5">
          <p className="text-[10.5px] tracking-[0.18em] uppercase text-steel font-medium">
            AgileQS
          </p>
          <h1 className="mt-2 font-display text-xl font-semibold text-ink">Check your email</h1>
          <p className="mt-3 text-sm text-steel leading-relaxed">
            We sent a verification link to <span className="text-ink">{pendingEmail}</span>. Open
            it to activate your account, then sign in.
          </p>
          <p className="mt-4 text-sm text-steel text-center">
            <Link to="/login" className="text-chalk hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await signup(name, email, password)
      setPendingEmail(result.email)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Signup failed')
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
        <h1 className="mt-2 font-display text-xl font-semibold text-ink">Create account</h1>
        <p className="mt-1 text-sm text-steel">
          Start modelling takeoffs with a real backend account
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

          <label className="block text-sm">
            <span className="text-steel">Name</span>
            <input
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full border border-steel-border bg-panel-hover px-3 py-2 text-ink outline-none"
            />
          </label>

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
            <span className="text-steel">Password</span>
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

          <PrimaryButton type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Creating…' : 'Create account'}
          </PrimaryButton>

          <div className="flex items-center gap-3 text-[11px] text-steel">
            <span className="flex-1 border-t border-steel-border" />
            or
            <span className="flex-1 border-t border-steel-border" />
          </div>

          <GoogleSignInButton
            onCredential={onGoogle}
            label="signup_with"
            disabled={submitting}
          />
        </form>

        <p className="mt-4 text-sm text-steel text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-chalk hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
