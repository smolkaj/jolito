import { z } from 'zod'
import type { AuthService, AuthUser } from '../../application/ports'
import { getCanonicalOrigin } from '../browser/host'

const jwtPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
})

const storedSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().default(''),
  expiresAt: z.number().default(() => Date.now() + 3600 * 1000),
  user: z.object({
    id: z.string().min(1),
    email: z.string().optional().default(''),
  }),
})

const supabaseTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().optional().default(3600),
  user: z
    .object({
      id: z.string().min(1),
      email: z.string().optional(),
    })
    .optional(),
})

type StoredSession = z.infer<typeof storedSessionSchema>

const authSessionResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional().default(''),
  expires_in: z.number().optional().default(3600),
  user: z.object({
    id: z.string().min(1),
    email: z.string().optional(),
  }),
})

const STORAGE_KEY = 'jolito-auth-session-v1'
const REFRESH_MARGIN_MS = 5 * 60 * 1000 // 5 minutes before expiry
const RETRY_BACKOFF_MS = 60 * 1000 // 1 minute retry backoff if offline

export class SupabaseAuthService implements AuthService {
  private listeners: Set<(user: AuthUser | null) => void> = new Set()
  private currentUser: AuthUser | null = null
  private redirectAuthOccurred = false
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  private inFlightRefresh: Promise<string | null> | null = null
  private boundVisibilityHandler: (() => void) | null = null
  private boundOnlineHandler: (() => void) | null = null

  constructor(
    private supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? '',
    private supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY ??
      '',
    private storage: Storage = typeof window !== 'undefined'
      ? window.localStorage
      : ({} as Storage),
  ) {
    this.currentUser = this.loadStoredUser()
    this.setupLifecycleListeners()
    this.scheduleNextRefresh()
  }

  isConfigured(): boolean {
    return Boolean(this.supabaseUrl && this.supabaseAnonKey)
  }

  consumeRedirectAuth(): boolean {
    const occurred = this.redirectAuthOccurred
    this.redirectAuthOccurred = false
    return occurred
  }

  getSessionLink(): string | null {
    const session = this.currentUser ? this.loadStoredSession() : null
    if (!session) return null
    const origin = getCanonicalOrigin() ?? 'https://joli.to'
    const remainingSeconds = Math.max(
      60,
      Math.floor((session.expiresAt - Date.now()) / 1000),
    )
    return `${origin}/#access_token=${session.accessToken}&refresh_token=${session.refreshToken}&expires_in=${remainingSeconds}`
  }

  private parseJwtUser(
    accessToken: string,
    fallbackEmail = '',
  ): AuthUser | null {
    try {
      const parts = accessToken.split('.')
      if (parts.length < 2 || !parts[1]) return null
      const base64Url = parts[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const pad = base64.length % 4
      const padded = pad ? base64 + '='.repeat(4 - pad) : base64
      const binary = atob(padded)
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
      const jsonStr = new TextDecoder().decode(bytes)
      const parsedPayload: unknown = JSON.parse(jsonStr)

      const validation = jwtPayloadSchema.safeParse(parsedPayload)
      if (!validation.success) return null

      return {
        id: validation.data.sub,
        email: validation.data.email || fallbackEmail,
      }
    } catch {
      return null
    }
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

      const user = this.parseJwtUser(accessToken)
      if (!user) return null

      const session: StoredSession = {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn * 1000,
        user,
      }

      this.redirectAuthOccurred = true
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

  private loadStoredSession(): StoredSession | null {
    try {
      const raw = this.storage.getItem?.(STORAGE_KEY)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      const validation = storedSessionSchema.safeParse(parsed)
      if (!validation.success) {
        this.storage.removeItem?.(STORAGE_KEY)
        return null
      }
      return validation.data
    } catch {
      return null
    }
  }

  private loadStoredUser(): AuthUser | null {
    const redirectUser = this.processAuthRedirect()
    if (redirectUser) return redirectUser

    const session = this.loadStoredSession()
    return session?.user ?? null
  }

  private scheduleNextRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }

    const session = this.loadStoredSession()
    if (
      !session ||
      !session.refreshToken ||
      !this.supabaseUrl ||
      !this.supabaseAnonKey
    ) {
      return
    }

    const now = Date.now()
    const timeUntilExpiry = session.expiresAt - now
    const isExpiringSoon = timeUntilExpiry <= REFRESH_MARGIN_MS

    if (isExpiringSoon) {
      // Trigger a refresh now, but schedule next retry with backoff if refresh fails
      void this.refreshSession()
      this.refreshTimer = setTimeout(() => {
        this.scheduleNextRefresh()
      }, RETRY_BACKOFF_MS)
      return
    }

    const delayMs = timeUntilExpiry - REFRESH_MARGIN_MS
    const safeDelayMs = Math.min(delayMs, 2147483647)

    this.refreshTimer = setTimeout(() => {
      this.scheduleNextRefresh()
    }, safeDelayMs)
  }

  async refreshSession(): Promise<string | null> {
    if (this.inFlightRefresh) {
      return this.inFlightRefresh
    }

    const session = this.loadStoredSession()
    if (!session || !session.refreshToken) {
      return session?.accessToken || null
    }

    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      return session.accessToken || null
    }

    this.inFlightRefresh = (async () => {
      try {
        const res = await fetch(
          `${this.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
          {
            method: 'POST',
            headers: {
              apikey: this.supabaseAnonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              refresh_token: session.refreshToken,
            }),
          },
        )

        if (!res.ok) {
          // If server rejected the refresh token (e.g. 400 invalid grant / expired refresh token)
          if (
            res.status === 400 ||
            res.status === 401 ||
            res.status === 403 ||
            res.status === 422
          ) {
            this.clearSession()
            return null
          }
          // Server error (5xx) or rate limit: preserve session for offline resilience
          return session.accessToken || null
        }

        const rawData: unknown = await res.json().catch(() => null)
        const parseResult = supabaseTokenResponseSchema.safeParse(rawData)

        if (!parseResult.success) {
          return session.accessToken || null
        }

        const data = parseResult.data
        const updatedUser: AuthUser = {
          id: data.user?.id || session.user.id,
          email: data.user?.email ?? session.user.email,
        }

        const newSession: StoredSession = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + data.expires_in * 1000,
          user: updatedUser,
        }

        this.saveSession(newSession)
        return newSession.accessToken
      } catch {
        // Network failure (offline, timeout, DNS): preserve session for offline use
        return session.accessToken || null
      } finally {
        this.inFlightRefresh = null
      }
    })()

    return this.inFlightRefresh
  }

  private saveSession(session: StoredSession): void {
    try {
      this.storage.setItem?.(STORAGE_KEY, JSON.stringify(session))
      this.currentUser = session.user
      this.scheduleNextRefresh()
      this.notifyListeners()
    } catch {
      // Storage full or unavailable
    }
  }

  private clearSession(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
    this.storage.removeItem?.(STORAGE_KEY)
    this.currentUser = null
    this.notifyListeners()
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

    const session = this.loadStoredSession()
    if (
      session &&
      session.refreshToken &&
      session.expiresAt - Date.now() < REFRESH_MARGIN_MS
    ) {
      void this.refreshSession()
    }

    return Promise.resolve(this.currentUser)
  }

  async getAccessToken(): Promise<string | null> {
    const session = this.loadStoredSession()
    if (!session) return null

    const isExpiringSoon = session.expiresAt - Date.now() < REFRESH_MARGIN_MS
    if (isExpiringSoon && session.refreshToken) {
      const refreshedToken = await this.refreshSession()
      if (refreshedToken) {
        return refreshedToken
      }
      // If refreshSession cleared the session on 400/401, return null
      return this.loadStoredSession()?.accessToken ?? null
    }

    return session.accessToken || null
  }

  async sendMagicLink(
    email: string,
  ): Promise<{ success: boolean; error?: string | undefined }> {
    const cleanEmail = email.trim()
    if (!cleanEmail) {
      return {
        success: false,
        error: 'Please enter your email address.',
      }
    }

    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      return {
        success: false,
        error: 'Cloud sync backend is not configured.',
      }
    }

    try {
      const redirectUrl = getCanonicalOrigin(
        typeof window !== 'undefined' ? window.location : undefined,
      )

      const res = await fetch(`${this.supabaseUrl}/auth/v1/otp`, {
        method: 'POST',
        headers: {
          apikey: this.supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
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
    const cleanEmail = email.trim()
    let rawToken = token.trim()

    if (!rawToken) {
      return {
        success: false,
        error: 'Please paste your sign-in link.',
      }
    }

    if (rawToken.startsWith('<') && rawToken.endsWith('>')) {
      rawToken = rawToken.slice(1, -1).trim()
    }
    if (
      (rawToken.startsWith('"') && rawToken.endsWith('"')) ||
      (rawToken.startsWith("'") && rawToken.endsWith("'"))
    ) {
      rawToken = rawToken.slice(1, -1).trim()
    }

    // 1. Check if rawToken is a pasted session fragment / URL containing access_token
    if (rawToken.includes('access_token=')) {
      const hashStr = rawToken.includes('#')
        ? rawToken.split('#')[1]
        : rawToken.includes('?')
          ? rawToken.split('?')[1]
          : rawToken
      const params = new URLSearchParams(hashStr)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token') || ''
      const expiresIn = Number(params.get('expires_in')) || 3600

      if (accessToken) {
        const user = this.parseJwtUser(accessToken, cleanEmail)
        if (user) {
          this.saveSession({
            accessToken,
            refreshToken,
            expiresAt: Date.now() + expiresIn * 1000,
            user,
          })
          return { success: true }
        }
      }
    }

    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      return {
        success: false,
        error: 'Cloud sync backend is not configured.',
      }
    }

    // 2. Check if rawToken is a magic link URL containing token or token_hash
    let candidateToken = rawToken.replace(/\s+|-/g, '')
    let candidateType: string | undefined

    if (rawToken.includes('token=') || rawToken.includes('token_hash=')) {
      try {
        const urlStr = rawToken.startsWith('http')
          ? rawToken
          : `https://${rawToken}`
        const parsedUrl = new URL(urlStr)
        const tokenHashParam =
          parsedUrl.searchParams.get('token_hash') ||
          parsedUrl.searchParams.get('token')
        const typeParam = parsedUrl.searchParams.get('type')
        if (tokenHashParam) {
          candidateToken = tokenHashParam
          if (typeParam) candidateType = typeParam
        }
      } catch {
        // Fall back to candidateToken
      }
    }

    // 3. If candidate is a token_hash (from email link or hash token), verify via token_hash
    if (candidateType || candidateToken.length > 20) {
      const hashTypes = Array.from(
        new Set([
          candidateType,
          'magiclink',
          'email',
          'signup',
          'recovery',
          'invite',
        ]),
      ).filter((t): t is string => Boolean(t))

      for (const otpType of hashTypes) {
        try {
          const res = await fetch(`${this.supabaseUrl}/auth/v1/verify`, {
            method: 'POST',
            headers: {
              apikey: this.supabaseAnonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              token_hash: candidateToken,
              type: otpType,
            }),
          })

          if (res.ok) {
            const rawJson: unknown = await res.json()
            const parsed = authSessionResponseSchema.safeParse(rawJson)
            if (parsed.success) {
              const data = parsed.data
              const user: AuthUser = {
                id: data.user.id,
                email: data.user.email || cleanEmail,
              }

              this.saveSession({
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: Date.now() + data.expires_in * 1000,
                user,
              })

              return { success: true }
            }
          }
        } catch {
          // Continue to next type
        }
      }
    }

    // 4. Verification attempt for OTP codes (or fallback if token_hash verification didn't match)
    const types = Array.from(
      new Set([candidateType, 'email', 'signup', 'magiclink']),
    ).filter((t): t is string => Boolean(t))
    let lastError = 'Invalid or expired sign-in link.'

    for (const otpType of types) {
      try {
        const res = await fetch(`${this.supabaseUrl}/auth/v1/verify`, {
          method: 'POST',
          headers: {
            apikey: this.supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: cleanEmail,
            token: candidateToken,
            type: otpType,
          }),
        })

        if (res.ok) {
          const rawJson: unknown = await res.json()
          const parsed = authSessionResponseSchema.safeParse(rawJson)
          if (parsed.success) {
            const data = parsed.data
            const user: AuthUser = {
              id: data.user.id,
              email: data.user.email || cleanEmail,
            }

            this.saveSession({
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              expiresAt: Date.now() + data.expires_in * 1000,
              user,
            })

            return { success: true }
          }
        }

        const errorData = (await res.json().catch(() => ({}))) as {
          msg?: string
          error_description?: string
          message?: string
        }
        const rawError =
          errorData.msg ||
          errorData.error_description ||
          errorData.message ||
          lastError

        if (/expired|invalid/i.test(rawError)) {
          lastError =
            'Invalid or expired sign-in link. If you opened the link in Safari, copy your sign-in link from Safari or request a new email.'
        } else {
          lastError = rawError
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Network error during verification.',
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
      const session = this.loadStoredSession()
      const token = session?.accessToken
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
      this.clearSession()
    }
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    this.listeners.add(callback)
    callback(this.currentUser)
    return () => {
      this.listeners.delete(callback)
    }
  }

  private setupLifecycleListeners(): void {
    if (typeof window === 'undefined') return

    this.boundVisibilityHandler = () => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      ) {
        const session = this.loadStoredSession()
        if (session && session.expiresAt - Date.now() < REFRESH_MARGIN_MS) {
          void this.refreshSession()
        }
      }
    }

    this.boundOnlineHandler = () => {
      const session = this.loadStoredSession()
      if (session && session.expiresAt - Date.now() < REFRESH_MARGIN_MS) {
        void this.refreshSession()
      }
    }

    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', this.boundVisibilityHandler)
    }
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', this.boundOnlineHandler)
    }
  }

  destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
    if (
      typeof document !== 'undefined' &&
      document.removeEventListener &&
      this.boundVisibilityHandler
    ) {
      document.removeEventListener(
        'visibilitychange',
        this.boundVisibilityHandler,
      )
      this.boundVisibilityHandler = null
    }
    if (
      typeof window !== 'undefined' &&
      window.removeEventListener &&
      this.boundOnlineHandler
    ) {
      window.removeEventListener('online', this.boundOnlineHandler)
      this.boundOnlineHandler = null
    }
  }
}
