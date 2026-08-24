import type { AuthService, AuthUser } from '../../application/ports'

interface StoredSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: AuthUser
}

const STORAGE_KEY = 'jolito-auth-session-v1'
const CONFIG_URL_KEY = 'jolito-supabase-url-v1'
const CONFIG_KEY_KEY = 'jolito-supabase-anon-key-v1'

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

  getSupabaseUrl(): string {
    const custom = this.storage.getItem?.(CONFIG_URL_KEY)?.trim()
    return custom || (this.supabaseUrl ?? '')
  }

  getSupabaseAnonKey(): string {
    const custom = this.storage.getItem?.(CONFIG_KEY_KEY)?.trim()
    return custom || (this.supabaseAnonKey ?? '')
  }

  isConfigured(): boolean {
    return Boolean(this.getSupabaseUrl() && this.getSupabaseAnonKey())
  }

  getBackendConfig(): { url: string; anonKey: string } {
    return {
      url: this.getSupabaseUrl(),
      anonKey: this.getSupabaseAnonKey(),
    }
  }

  setBackendConfig(url: string, anonKey: string): void {
    const trimmedUrl = url.trim().replace(/\/+$/, '')
    const trimmedKey = anonKey.trim()
    if (trimmedUrl && trimmedKey) {
      this.storage.setItem?.(CONFIG_URL_KEY, trimmedUrl)
      this.storage.setItem?.(CONFIG_KEY_KEY, trimmedKey)
    } else {
      this.storage.removeItem?.(CONFIG_URL_KEY)
      this.storage.removeItem?.(CONFIG_KEY_KEY)
    }
  }

  private loadStoredUser(): AuthUser | null {
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
    const url = this.getSupabaseUrl()
    const key = this.getSupabaseAnonKey()
    if (!url || !key) {
      return {
        success: false,
        error: 'Cloud sync backend is not configured.',
      }
    }

    try {
      const res = await fetch(`${url}/auth/v1/otp`, {
        method: 'POST',
        headers: {
          apikey: key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          create_user: true,
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
    const url = this.getSupabaseUrl()
    const key = this.getSupabaseAnonKey()
    if (!url || !key) {
      return {
        success: false,
        error: 'Cloud sync backend is not configured.',
      }
    }

    try {
      const res = await fetch(`${url}/auth/v1/verify`, {
        method: 'POST',
        headers: {
          apikey: key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          token,
          type: 'email',
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
            'Invalid or expired code.',
        }
      }

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

  async signOut(): Promise<void> {
    try {
      const token = this.getAccessToken()
      const url = this.getSupabaseUrl()
      const key = this.getSupabaseAnonKey()
      if (token && url && key) {
        await fetch(`${url}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: key,
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
