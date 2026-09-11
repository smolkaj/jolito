import { z } from 'zod'
import type { AuthService, AuthUser } from '../../application/ports'
import { unwrapDomainBoundOtp } from '../../domain/auth'
import { getCanonicalOrigin } from '../browser/host'
import { withRequestDeadline } from '../request-lifetime'

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

export class SessionStorageError extends Error {
  constructor() {
    super(
      'Your sign-in session could not be saved on this device. Free some browser storage and try again.',
    )
  }
}

type DeletionRequest = {
  ownerId: string
  generation: number
  controller: AbortController
  dispatched: boolean
}

const STORAGE_KEY = 'jolito-auth-session-v1'
const REFRESH_MARGIN_MS = 5 * 60 * 1000 // 5 minutes before expiry
const RETRY_BACKOFF_MS = 60 * 1000 // 1 minute retry backoff if offline

export class SupabaseAuthService implements AuthService {
  private listeners: Set<(user: AuthUser | null) => void> = new Set()
  private currentUser: AuthUser | null = null
  readonly storedUserBeforeRedirect: AuthUser | null
  private generation = 0
  private readonly lifetime = new AbortController()
  private get destroyed() {
    return this.lifetime.signal.aborted
  }
  private boundStorageHandler: ((event: StorageEvent) => void) | null = null
  private redirectAuthOccurred = false
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  private inFlightRefresh: {
    ownerId: string
    promise: Promise<string | null>
    preserveSessionOnRejection: boolean
  } | null = null
  private accountDeletion: DeletionRequest | null = null
  private boundVisibilityHandler: (() => void) | null = null
  private boundOnlineHandler: (() => void) | null = null
  private supabaseUrl: string
  private supabaseAnonKey: string
  private storage: Storage

  constructor(
    supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? '',
    supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    storage: Storage = typeof window !== 'undefined'
      ? window.localStorage
      : ({} as Storage),
    beforeRedirect?: (storedOwner: AuthUser | null) => void,
  ) {
    this.supabaseUrl = (supabaseUrl || '').replace(/\/+$/, '')
    this.supabaseAnonKey = supabaseAnonKey
    this.storage = storage
    this.storedUserBeforeRedirect = this.loadStoredSession()?.user ?? null
    // Ownership must be durable before a redirect can replace the persisted identity.
    beforeRedirect?.(this.storedUserBeforeRedirect)
    this.currentUser = this.loadStoredUser()
    this.setupLifecycleListeners()
    this.scheduleNextRefresh()
  }

  getCurrentUser(): AuthUser | null {
    return this.destroyed ? null : this.currentUser
  }

  private isCurrent(generation: number): boolean {
    return !this.destroyed && generation === this.generation
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
    const session = this.loadOwnedSession()
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

      if (!this.saveSession(session)) throw new SessionStorageError()
      this.redirectAuthOccurred = true

      // Clean the URL hash so tokens are removed from browser address bar
      if (window.history && window.history.replaceState) {
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search,
        )
      }

      return user
    } catch (error) {
      if (error instanceof SessionStorageError) throw error
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

  private loadOwnedSession(
    ownerId = this.currentUser?.id,
  ): StoredSession | null {
    if (this.destroyed) return null
    const session = this.loadStoredSession()
    return ownerId && session?.user.id === ownerId ? session : null
  }

  private loadStoredUser(): AuthUser | null {
    const redirectUser = this.processAuthRedirect()
    if (redirectUser) return redirectUser

    const session = this.loadStoredSession()
    return session?.user ?? null
  }

  private scheduleNextRefresh(): void {
    if (this.destroyed) return
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }

    const session = this.loadOwnedSession()
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
    if (this.destroyed) return null
    const session = this.loadOwnedSession()
    if (!session) return null
    if (this.inFlightRefresh) return this.inFlightRefresh.promise
    if (!session || !session.refreshToken) {
      return session?.accessToken || null
    }

    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      return session.accessToken || null
    }

    const generation = this.generation
    const isCurrent = () =>
      this.isCurrent(generation) &&
      this.loadOwnedSession(session.user.id)?.refreshToken ===
        session.refreshToken
    const attempt = {
      ownerId: session.user.id,
      promise: Promise.resolve<string | null>(null),
      preserveSessionOnRejection:
        this.accountDeletion?.ownerId === session.user.id,
    }
    this.inFlightRefresh = attempt
    attempt.promise = (async () => {
      try {
        return await withRequestDeadline(async (signal) => {
          const res = await fetch(
            `${this.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
            {
              method: 'POST',
              signal,
              headers: {
                apikey: this.supabaseAnonKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                refresh_token: session.refreshToken,
              }),
            },
          )

          if (signal.aborted || !isCurrent()) return null
          if (!res.ok) {
            // If server rejected the refresh token (e.g. 400 invalid grant / expired refresh token)
            if (
              res.status === 400 ||
              res.status === 401 ||
              res.status === 403 ||
              res.status === 422
            ) {
              if (!attempt.preserveSessionOnRejection) this.clearSession()
              return null
            }
            // Server error (5xx) or rate limit: preserve session for offline resilience
            return session.accessToken || null
          }

          const rawData: unknown = await res.json().catch(() => null)
          if (signal.aborted || !isCurrent()) return null
          const parseResult = supabaseTokenResponseSchema.safeParse(rawData)

          if (!parseResult.success) {
            return session.accessToken || null
          }

          const data = parseResult.data
          if (data.user && data.user.id !== session.user.id) return null
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

          return this.saveSession(newSession) ? newSession.accessToken : null
        }, this.lifetime.signal)
      } catch {
        // Network failure (offline, timeout, DNS): preserve session for offline use
        return isCurrent() ? session.accessToken || null : null
      } finally {
        if (this.inFlightRefresh === attempt) this.inFlightRefresh = null
      }
    })()
    return attempt.promise
  }

  private saveSession(session: StoredSession): boolean {
    if (this.destroyed) return false
    try {
      this.storage.setItem?.(STORAGE_KEY, JSON.stringify(session))
      if (this.currentUser?.id !== session.user.id) this.generation++
      this.currentUser = session.user
      this.scheduleNextRefresh()
      this.notifyListeners()
      return true
    } catch {
      return false
    }
  }

  private clearSession(expectedOwnerId?: string): void {
    const persisted = this.loadStoredSession()
    if (expectedOwnerId && persisted && persisted.user.id !== expectedOwnerId) {
      // A storage event may still be queued when a network response arrives.
      this.generation++
      this.inFlightRefresh = null
      this.currentUser = persisted.user
      this.scheduleNextRefresh()
      this.notifyListeners()
      return
    }
    this.generation++
    this.inFlightRefresh = null
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
    this.storage.removeItem?.(STORAGE_KEY)
    this.currentUser = null
    this.notifyListeners()
  }

  private notifyListeners(): void {
    if (this.destroyed) return
    this.listeners.forEach((cb) => {
      try {
        cb(this.currentUser)
      } catch {
        // Listener error ignored
      }
    })
  }

  getUser(): Promise<AuthUser | null> {
    if (this.destroyed) return Promise.resolve(null)
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
    if (this.destroyed) return null
    const generation = this.generation
    const ownerId = this.currentUser?.id
    const session = this.loadOwnedSession(ownerId)
    if (!session) return null

    const isExpiringSoon = session.expiresAt - Date.now() < REFRESH_MARGIN_MS
    if (isExpiringSoon && session.refreshToken) {
      const refreshedToken = await this.refreshSession()
      if (!this.isCurrent(generation) || !this.loadOwnedSession(ownerId))
        return null
      if (refreshedToken) {
        return refreshedToken
      }
      // If refreshSession cleared the session on 400/401, return null
      return this.loadOwnedSession(ownerId)?.accessToken ?? null
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
        console.error('[AuthService] Magic link request failed:', {
          status: res.status,
          errorData,
        })
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
      console.error(
        '[AuthService] Unexpected error requesting magic link:',
        err,
      )
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
    const generation = ++this.generation
    this.inFlightRefresh = null
    const stale = () => ({
      success: false,
      error: 'Your sign-in session changed. Please try again.',
    })
    if (!this.isCurrent(generation)) return stale()
    let persistedSession: string | null
    try {
      persistedSession = this.storage.getItem?.(STORAGE_KEY) ?? null
      const initial =
        persistedSession === null
          ? null
          : storedSessionSchema.safeParse(
              JSON.parse(persistedSession) as unknown,
            )
      if (initial && !initial.success) return stale()
      if ((initial?.data.user.id ?? null) !== (this.currentUser?.id ?? null))
        return stale()
    } catch {
      return { success: false, error: new SessionStorageError().message }
    }
    // Storage events can arrive after the response. Compare the operation's
    // persisted starting session as well as its in-memory identity generation.
    const isCurrent = () => {
      if (!this.isCurrent(generation)) return false
      try {
        return (
          (this.storage.getItem?.(STORAGE_KEY) ?? null) === persistedSession
        )
      } catch {
        return false
      }
    }
    if (!isCurrent()) return stale()
    const cleanEmail = email.trim()
    const rawToken = unwrapDomainBoundOtp(token)

    if (!rawToken) {
      return {
        success: false,
        error: 'Please paste your sign-in link.',
      }
    }

    // 0. Check if rawToken is a plain webpage link without tokens
    if (
      (rawToken.includes('joli.to') ||
        rawToken.includes('workers.dev') ||
        rawToken.includes('localhost')) &&
      !rawToken.includes('access_token=') &&
      !rawToken.includes('token=') &&
      !rawToken.includes('token_hash=')
    ) {
      return {
        success: false,
        error:
          'This webpage link has no session tokens. Tap the link in your email, then tap "Copy sign-in link" in Jolito’s top banner.',
      }
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
          const saved = this.saveSession({
            accessToken,
            refreshToken,
            expiresAt: Date.now() + expiresIn * 1000,
            user,
          })
          return saved
            ? { success: true }
            : { success: false, error: new SessionStorageError().message }
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
        if (!isCurrent()) return stale()
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

          if (!isCurrent()) return stale()
          if (res.ok) {
            const rawJson: unknown = await res.json()
            if (!isCurrent()) return stale()
            const parsed = authSessionResponseSchema.safeParse(rawJson)
            if (parsed.success) {
              const data = parsed.data
              const user: AuthUser = {
                id: data.user.id,
                email: data.user.email || cleanEmail,
              }

              const saved = this.saveSession({
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: Date.now() + data.expires_in * 1000,
                user,
              })

              return saved
                ? { success: true }
                : { success: false, error: new SessionStorageError().message }
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
      if (!isCurrent()) return stale()
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

        if (!isCurrent()) return stale()
        if (res.ok) {
          const rawJson: unknown = await res.json()
          if (!isCurrent()) return stale()
          const parsed = authSessionResponseSchema.safeParse(rawJson)
          if (parsed.success) {
            const data = parsed.data
            const user: AuthUser = {
              id: data.user.id,
              email: data.user.email || cleanEmail,
            }

            const saved = this.saveSession({
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              expiresAt: Date.now() + data.expires_in * 1000,
              user,
            })

            return saved
              ? { success: true }
              : { success: false, error: new SessionStorageError().message }
          }
        }

        const errorData = (await res.json().catch(() => ({}))) as {
          msg?: string
          error_description?: string
          message?: string
        }
        console.error('[AuthService] OTP verification attempt failed:', {
          status: res.status,
          type: otpType,
          errorData,
        })
        const rawError =
          errorData.msg ||
          errorData.error_description ||
          errorData.message ||
          lastError

        if (/expired|invalid/i.test(rawError)) {
          lastError =
            'Invalid or expired link. Tap the link in your email, then tap "Copy sign-in link" in Jolito’s top banner.'
        } else {
          lastError = rawError
        }
      } catch (err) {
        console.error(
          '[AuthService] Unexpected error during OTP verification:',
          err,
        )
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
    if (this.destroyed) return
    const owner = this.currentUser?.id
    if (!owner) return
    const stored = this.loadStoredSession()
    const token = stored?.user.id === owner ? stored.accessToken : undefined
    // Fence immediately; a late logout response must never clear a newer login.
    this.clearSession(owner)
    if (token && this.supabaseUrl && this.supabaseAnonKey) {
      await withRequestDeadline(
        (signal) =>
          fetch(`${this.supabaseUrl}/auth/v1/logout`, {
            method: 'POST',
            headers: {
              apikey: this.supabaseAnonKey,
              Authorization: `Bearer ${token}`,
            },
            signal,
          }),
        this.lifetime.signal,
      ).catch(() => {})
    }
  }

  async deleteAccount(): Promise<{
    success: boolean
    error?: string | undefined
    outcomeUnknown?: boolean
  }> {
    if (!this.supabaseUrl || !this.supabaseAnonKey)
      return { success: false, error: 'Cloud sync backend is not configured.' }
    const ownerId = this.currentUser?.id
    if (this.destroyed || !ownerId || !this.loadOwnedSession(ownerId))
      return { success: false, error: 'Sign in to delete your cloud account.' }
    if (this.accountDeletion)
      return { success: false, error: 'Account deletion is already running.' }

    const deletion: DeletionRequest = {
      ownerId,
      generation: this.generation,
      controller: new AbortController(),
      dispatched: false,
    }
    this.accountDeletion = deletion
    if (this.inFlightRefresh?.ownerId === ownerId)
      this.inFlightRefresh.preserveSessionOnRejection = true
    try {
      return await withRequestDeadline(
        (signal) => this.performAccountDeletion(deletion, signal),
        deletion.controller.signal,
      )
    } catch (error) {
      return {
        success: false,
        ...(deletion.dispatched ? { outcomeUnknown: true } : {}),
        error:
          error instanceof Error ? error.message : 'Account deletion failed.',
      }
    } finally {
      if (this.accountDeletion === deletion) this.accountDeletion = null
    }
  }

  private async performAccountDeletion(
    deletion: DeletionRequest,
    signal: AbortSignal,
  ): Promise<{
    success: boolean
    error?: string | undefined
    outcomeUnknown?: boolean
  }> {
    const { ownerId, generation } = deletion
    const interrupted = () => ({
      success: false,
      ...(deletion.dispatched ? { outcomeUnknown: true } : {}),
      error: 'Account deletion was interrupted. Please try again.',
    })
    const canDispatch = () =>
      !signal.aborted &&
      this.isCurrent(generation) &&
      this.currentUser?.id === ownerId &&
      Boolean(this.loadOwnedSession(ownerId))
    const token = await this.getAccessToken()
    if (signal.aborted) return interrupted()
    if (!token || !canDispatch())
      return { success: false, error: 'Sign in to delete your cloud account.' }

    // One database transaction deletes the account and cascades its owned data.
    const removeAccount = (accessToken: string) => {
      if (!canDispatch())
        throw new Error('Your account changed while deletion was pending.')
      deletion.dispatched = true
      return fetch(`${this.supabaseUrl}/rest/v1/rpc/delete_user_account`, {
        method: 'POST',
        headers: {
          apikey: this.supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal,
      })
    }
    let response = await removeAccount(token)
    if (signal.aborted) return interrupted()
    if (!this.isCurrent(generation) && !response.ok)
      return {
        success: false,
        error: 'Your account changed while deletion was pending.',
      }
    if (response.status === 401) {
      const refreshed = await this.refreshSession()
      if (signal.aborted) return interrupted()
      if (refreshed && canDispatch()) response = await removeAccount(refreshed)
    }
    if (signal.aborted) return interrupted()
    if (!this.isCurrent(generation) && !response.ok)
      return {
        success: false,
        error: 'Your account changed while deletion was pending.',
      }
    if (!response.ok) {
      const parsed = z
        .object({
          message: z.string().optional(),
          details: z.string().nullable().optional(),
          msg: z.string().optional(),
        })
        .safeParse(await response.json().catch(() => null))
      if (signal.aborted) return interrupted()
      return {
        success: false,
        error:
          (parsed.success &&
            (parsed.data.message || parsed.data.details || parsed.data.msg)) ||
          `Failed to delete account (HTTP ${response.status}). Please try again.`,
      }
    }
    // Confirmation invalidates A even after its token changes, while protecting B.
    if (!this.destroyed && this.currentUser?.id === ownerId) {
      try {
        this.clearSession(ownerId)
      } catch {
        // The durable receipt lets the application retry local cleanup.
        return { success: true }
      }
    }
    return { success: true }
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    if (this.destroyed) return () => {}
    this.listeners.add(callback)
    callback(this.currentUser)
    return () => {
      this.listeners.delete(callback)
    }
  }

  private setupLifecycleListeners(): void {
    if (typeof window === 'undefined') return

    this.boundStorageHandler = (event) => {
      if (this.destroyed || (event.key !== null && event.key !== STORAGE_KEY))
        return
      this.generation++
      this.inFlightRefresh = null
      this.currentUser = this.loadStoredSession()?.user ?? null
      this.scheduleNextRefresh()
      this.notifyListeners()
    }
    window.addEventListener('storage', this.boundStorageHandler)
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
    this.lifetime.abort()
    this.accountDeletion?.controller.abort()
    this.generation++
    this.inFlightRefresh = null
    this.listeners.clear()
    if (this.boundStorageHandler && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.boundStorageHandler)
      this.boundStorageHandler = null
    }
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
