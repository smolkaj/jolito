import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseAuthService } from './auth-service'

describe('SupabaseAuthService', () => {
  let mockStorage: Record<string, string> = {}
  const fakeStorage: Storage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value
    },
    removeItem: (key: string) => {
      delete mockStorage[key]
    },
    clear: () => {
      mockStorage = {}
    },
    key: () => null,
    length: 0,
  }

  beforeEach(() => {
    mockStorage = {}
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads existing unexpired session from storage', async () => {
    mockStorage['jolito-auth-session-v1'] = JSON.stringify({
      accessToken: 'token-abc',
      refreshToken: 'refresh-xyz',
      expiresAt: Date.now() + 100000,
      user: { id: 'u1', email: 'test@example.com' },
    })

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )
    const user = await service.getUser()
    expect(user?.email).toBe('test@example.com')
    expect(service.getAccessToken()).toBe('token-abc')
  })

  it('clears expired session from storage', async () => {
    mockStorage['jolito-auth-session-v1'] = JSON.stringify({
      accessToken: 'token-old',
      refreshToken: 'refresh-old',
      expiresAt: Date.now() - 5000,
      user: { id: 'u1', email: 'old@example.com' },
    })

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )
    const user = await service.getUser()
    expect(user).toBeNull()
    expect(mockStorage['jolito-auth-session-v1']).toBeUndefined()
  })

  it('sends magic link OTP and handles network error gracefully', async () => {
    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    )

    const res = await service.sendMagicLink('hello@example.com')
    expect(res.success).toBe(true)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Connection failed')),
    )
    const failRes = await service.sendMagicLink('hello@example.com')
    expect(failRes.success).toBe(false)
    expect(failRes.error).toBe('Connection failed')
  })

  it('verifies OTP token and saves new session', async () => {
    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'new-token',
            refresh_token: 'new-refresh',
            expires_in: 3600,
            user: { id: 'usr-42', email: 'learner@example.com' },
          }),
      }),
    )

    const verifyRes = await service.verifyOtp('learner@example.com', '123456')
    expect(verifyRes.success).toBe(true)

    const user = await service.getUser()
    expect(user?.id).toBe('usr-42')
    expect(user?.email).toBe('learner@example.com')
  })

  it('signs out and clears stored session', async () => {
    mockStorage['jolito-auth-session-v1'] = JSON.stringify({
      accessToken: 'token-abc',
      refreshToken: 'refresh-xyz',
      expiresAt: Date.now() + 100000,
      user: { id: 'u1', email: 'test@example.com' },
    })

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    await service.signOut()
    expect(await service.getUser()).toBeNull()
    expect(mockStorage['jolito-auth-session-v1']).toBeUndefined()
  })

  it('notifies listeners on auth state change', async () => {
    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )
    const listener = vi.fn()

    const unsubscribe = service.onAuthStateChange(listener)
    expect(listener).toHaveBeenCalledWith(null)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'tok',
            refresh_token: 'ref',
            expires_in: 3600,
            user: { id: 'u2', email: 'u2@example.com' },
          }),
      }),
    )

    await service.verifyOtp('u2@example.com', '654321')
    expect(listener).toHaveBeenCalledWith({ id: 'u2', email: 'u2@example.com' })

    unsubscribe()
  })
})
