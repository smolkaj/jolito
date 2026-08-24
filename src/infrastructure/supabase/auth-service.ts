import { z } from 'zod'
import type { AuthService, AuthUser } from '../../application/ports'

const jwtPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
})

interface StoredSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: AuthUser
}

const STORAGE_KEY = 'jolito-auth-session-v1'

export class SupabaseAuthService implements AuthService {
  private listeners: Set<(user: AuthUser | null) => void> = new Set()
  private currentUser: AuthUser | null = null

  constructor(
    private supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? '',
    private supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY ??
      '',
    private storage: Storage = typeof window !== 'undefined'
      ? window.localStorage
      : ({} as Storage),
  ) {
    this.currentUser = this.loadStoredUser()
  }

  isConfigured(): boolean {
    return Boolean(this.supabaseUrl && this.supabaseAnonKey)
  }

  private processAuthRedirect(): AuthUser | null {
    if (typeof window === 'undefined' || !window.location) return null
    try {
      const hash = window.location.hash || ''
      if (!hash.includes('access_token=')) {
        if (hash.includes('error=')) {
          // Clear error fragment from address bar
          if (window.history && window.history.replaceState) {
            window.history.replaceState(
              null,
              '',
              window.location.pathname + window.location.search,
            )
          }
        }
        return null
      }

      const searchStr = hash.startsWith('#') ? hash.substring(1) : hash
      const params = new URLSearchParams(searchStr)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token') || ''
      const expiresIn = Number(params.get('expires_in')) || 3600

      if (!accessToken) return null

      // Safe Base64URL and UTF-8 decoding of JWT payload
      const parts = accessToken.split('.')
      if (parts.length < 2) return null
      const base64Url = parts[1]
      if (!base64Url) return null
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const pad = base64.length % 4
      const padded = pad ? base64 + '='.repeat(4 - pad) : base64
      const binary = atob(padded)
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
      const jsonStr = new TextDecoder().decode(bytes)
      const parsedPayload: unknown = JSON.parse(jsonStr)

      const validation = jwtPayloadSchema.safeParse(parsedPayload)
      if (!validation.success) return null

      const user: AuthUser = {
        id: validation.data.sub,
        email: validation.data.email || '',
      }

      const session: StoredSession = {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn * 1000,
        user,
      }

      this.saveSession(session)

      // Clean the URL hash so tokens are removed from browser address bar
      if (window.history && window.history.replaceState) {
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search,
        )
      }

      return user
    } catch {
      return null
    }
  }

  private loadStoredUser(): AuthUser | null {
    const redirectUser = this.processAuthRedirect()
    if (redirectUser) return redirectUser

    try {
      const raw = this.storage.getItem?.(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as StoredSession
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        this.storage.removeItem?.(STORAGE_KEY)
        return null
      }
      return parsed.user
    } catch {
      return null
    }
  }

  private saveSession(session: StoredSession): void {
    try {
      this.storage.setItem?.(STORAGE_KEY, JSON.stringify(session))
      this.currentUser = session.user
      this.notifyListeners()
    } catch {
      // Storage full or unavailable
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => {
      try {
        cb(this.currentUser)
      } catch {
        // Listener error ignored
      }
    })
  }

  getUser(): Promise<AuthUser | null> {
    if (!this.currentUser) {
      this.currentUser = this.loadStoredUser()
    }
    return Promise.resolve(this.currentUser)
  }

  getAccessToken(): string | null {
    try {
      const raw = this.storage.getItem?.(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as StoredSession
      return parsed.accessToken || null
    } catch {
      return null
    }
  }

  async sendMagicLink(
    email: string,
  ): Promise<{ success: boolean; error?: string | undefined }> {
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      return {
        success: false,
        error: 'Cloud sync backend is not configured.',
      }
    }

    try {
      const redirectUrl =
        typeof window !== 'undefined' && window.location
          ? window.location.origin
          : undefined

      const res = await fetch(`${this.supabaseUrl}/auth/v1/otp`, {
        method: 'POST',
        headers: {
          apikey: this.supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          create_user: true,
          email_redirect_to: redirectUrl,
        }),
      })

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as {
          msg?: string
          error_description?: string
          message?: string
        }
        return {
          success: false,
          error:
            errorData.msg ||
            errorData.error_description ||
            errorData.message ||
            'Failed to send sign-in link.',
        }
      }

      return { success: true }
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : 'Network error during sign in.',
      }
    }
  }

  async verifyOtp(
    email: string,
    token: string,
  ): Promise<{ success: boolean; error?: string | undefined }> {
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      return {
        success: false,
        error: 'Cloud sync backend is not configured.',
      }
    }

    // Try types: 'email', 'signup', 'magiclink'
    const types = ['email', 'signup', 'magiclink']
    let lastError = 'Invalid or expired code.'

    for (const otpType of types) {
      try {
        const res = await fetch(`${this.supabaseUrl}/auth/v1/verify`, {
          method: 'POST',
          headers: {
            apikey: this.supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            token,
            type: otpType,
          }),
        })

        if (res.ok) {
          const data = (await res.json()) as {
            access_token: string
            refresh_token: string
            expires_in: number
            user: { id: string; email?: string }
          }

          const user: AuthUser = {
            id: data.user.id,
            email: data.user.email || email,
          }

          this.saveSession({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
            user,
          })

          return { success: true }
        }

        const errorData = (await res.json().catch(() => ({}))) as {
          msg?: string
          error_description?: string
          message?: string
        }
        lastError =
          errorData.msg ||
          errorData.error_description ||
          errorData.message ||
          lastError
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Network error during code verification.',
        }
      }
    }

    return {
      success: false,
      error: lastError,
    }
  }

  async signOut(): Promise<void> {
    try {
      const token = this.getAccessToken()
      if (token && this.supabaseUrl && this.supabaseAnonKey) {
        await fetch(`${this.supabaseUrl}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: this.supabaseAnonKey,
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {})
      }
    } finally {
      this.storage.removeItem?.(STORAGE_KEY)
      this.currentUser = null
      this.notifyListeners()
    }
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    this.listeners.add(callback)
    callback(this.currentUser)
    return () => {
      this.listeners.delete(callback)
    }
  }
}
