export type AuthUser = {
  id: string
  email: string
  name: string
  emailVerified?: boolean
}

export class ApiError extends Error {
  status: number
  code?: string
  email?: string

  constructor(
    status: number,
    message: string,
    extras?: { code?: string; email?: string },
  ) {
    super(message)
    this.status = status
    this.code = extras?.code
    this.email = extras?.email
  }
}

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''
const TOKEN_KEY = 'takeoff_auth_token'

export function getAccessToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAccessToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // Private mode / blocked storage — requests may still use cookies.
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getAccessToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  })

  const text = await res.text()
  let data: { error?: string; code?: string; email?: string } | null = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      setAccessToken(null)
    }
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, {
      code: data?.code,
      email: data?.email,
    })
  }

  return data as T
}
