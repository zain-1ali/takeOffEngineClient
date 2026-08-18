import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  api,
  ApiError,
  setAccessToken,
  type AuthUser,
} from '../lib/api'

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<{
    needsVerification: true
    email: string
    message: string
  }>
  loginWithGoogle: (credential: string) => Promise<void>
  verifyEmail: (token: string) => Promise<void>
  resetPassword: (token: string, password: string) => Promise<void>
  forgotPassword: (email: string) => Promise<string>
  resendVerification: (email: string) => Promise<string>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthResponse = { user: AuthUser; token: string }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: AuthUser }>('/api/auth/me')
      setUser(data.user)
    } catch {
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await api<{ user: AuthUser }>('/api/auth/me')
        if (!cancelled) setUser(data.user)
      } catch {
        if (!cancelled) {
          setAccessToken(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const applySession = useCallback((data: AuthResponse) => {
    setAccessToken(data.token)
    setUser(data.user)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    applySession(data)
  }, [applySession])

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      return api<{
        needsVerification: true
        email: string
        message: string
      }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      })
    },
    [],
  )

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const data = await api<AuthResponse>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      })
      applySession(data)
    },
    [applySession],
  )

  const verifyEmail = useCallback(
    async (token: string) => {
      const data = await api<AuthResponse>('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      applySession(data)
    },
    [applySession],
  )

  const resetPassword = useCallback(
    async (token: string, password: string) => {
      const data = await api<AuthResponse>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      applySession(data)
    },
    [applySession],
  )

  const forgotPassword = useCallback(async (email: string) => {
    const data = await api<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
    return data.message
  }, [])

  const resendVerification = useCallback(async (email: string) => {
    const data = await api<{ message: string }>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
    return data.message
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } catch (err) {
      if (!(err instanceof ApiError)) {
        // ignore network errors on logout
      }
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      signup,
      loginWithGoogle,
      verifyEmail,
      resetPassword,
      forgotPassword,
      resendVerification,
      logout,
      refresh,
    }),
    [
      user,
      loading,
      login,
      signup,
      loginWithGoogle,
      verifyEmail,
      resetPassword,
      forgotPassword,
      resendVerification,
      logout,
      refresh,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
