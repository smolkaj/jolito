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
    window.location.hash = ''
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
    expect(await service.getAccessToken()).toBe('token-abc')
  })

  it('refreshes expired session on getAccessToken when refresh_token exists', async () => {
    mockStorage['jolito-auth-session-v1'] = JSON.stringify({
      accessToken: 'token-old',
      refreshToken: 'refresh-valid',
      expiresAt: Date.now() - 5000,
      user: { id: 'u1', email: 'learner@example.com' },
    })

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'token-fresh',
          refresh_token: 'refresh-fresh',
          expires_in: 3600,
          user: { id: 'u1', email: 'learner@example.com' },
        }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const token = await service.getAccessToken()
    expect(token).toBe('token-fresh')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/token?grant_type=refresh_token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refresh_token: 'refresh-valid' }),
      }),
    )

    const rawStored = mockStorage['jolito-auth-session-v1']
    expect(rawStored).toBeDefined()
    const stored = JSON.parse(rawStored || '{}') as {
      accessToken: string
      refreshToken: string
    }
    expect(stored.accessToken).toBe('token-fresh')
    expect(stored.refreshToken).toBe('refresh-fresh')
  })

  it('clears expired session and returns null from getAccessToken when refresh token is rejected with 400 by backend', async () => {
    mockStorage['jolito-auth-session-v1'] = JSON.stringify({
      accessToken: 'token-old',
      refreshToken: 'refresh-revoked',
      expiresAt: Date.now() - 5000,
      user: { id: 'u1', email: 'old@example.com' },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'invalid_grant' }),
      }),
    )

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const token = await service.getAccessToken()
    expect(token).toBeNull()
    expect(await service.getUser()).toBeNull()
    expect(mockStorage['jolito-auth-session-v1']).toBeUndefined()
    service.destroy()
  })

  it('preserves stored user and uses retry backoff when refresh fails offline', async () => {
    mockStorage['jolito-auth-session-v1'] = JSON.stringify({
      accessToken: 'token-old',
      refreshToken: 'refresh-offline',
      expiresAt: Date.now() - 5000,
      user: { id: 'u1', email: 'offline@example.com' },
    })

    const fetchSpy = vi
      .fn()
      .mockRejectedValue(new Error('Network disconnected'))
    vi.stubGlobal('fetch', fetchSpy)

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const user = await service.getUser()
    expect(user?.email).toBe('offline@example.com')
    expect(mockStorage['jolito-auth-session-v1']).toBeDefined()
    // It should not spin loop; only the initial refresh was triggered
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    service.destroy()
  })

  it('deduplicates concurrent refreshSession requests', async () => {
    mockStorage['jolito-auth-session-v1'] = JSON.stringify({
      accessToken: 'token-old',
      refreshToken: 'refresh-concurrent',
      expiresAt: Date.now() - 5000,
      user: { id: 'u1', email: 'concurrent@example.com' },
    })

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'token-shared',
          refresh_token: 'refresh-shared',
          expires_in: 3600,
          user: { id: 'u1', email: 'concurrent@example.com' },
        }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const [t1, t2] = await Promise.all([
      service.refreshSession(),
      service.getAccessToken(),
    ])

    expect(t1).toBe('token-shared')
    expect(t2).toBe('token-shared')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('refreshes expiring session on visibilitychange and online events', async () => {
    mockStorage['jolito-auth-session-v1'] = JSON.stringify({
      accessToken: 'token-old',
      refreshToken: 'refresh-event',
      expiresAt: Date.now() + 1000, // within 5 minute margin
      user: { id: 'u-ev', email: 'event@example.com' },
    })

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'token-fresh-event',
          refresh_token: 'refresh-fresh-event',
          expires_in: 3600,
          user: { id: 'u-ev', email: 'event@example.com' },
        }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    // Simulate tab visibility event
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('online'))

    // Allow async refresh promises to resolve
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetchSpy).toHaveBeenCalled()
    service.destroy()
  })

  it('clears corrupted session data failing schema validation', async () => {
    mockStorage['jolito-auth-session-v1'] = JSON.stringify({
      corrupt: true,
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

  it('cleans up refresh timers and listeners on destroy and signOut', async () => {
    mockStorage['jolito-auth-session-v1'] = JSON.stringify({
      accessToken: 'token-1',
      refreshToken: 'refresh-1',
      expiresAt: Date.now() + 100000,
      user: { id: 'u1', email: 'test@example.com' },
    })

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    service.destroy()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    await service.signOut()
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

  it('returns true when configured with credentials, false when empty', () => {
    const unconfigured = new SupabaseAuthService('', '', fakeStorage)
    expect(unconfigured.isConfigured()).toBe(false)

    const configured = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )
    expect(configured.isConfigured()).toBe(true)
  })

  it('automatically parses session from URL hash redirect and saves session', async () => {
    const fakePayload = {
      sub: 'usr-redirect-99',
      email: 'redirect-user@example.com',
    }
    const fakeToken = `header.${btoa(JSON.stringify(fakePayload))}.signature`

    window.location.hash = `#access_token=${fakeToken}&refresh_token=rt-123&expires_in=7200&token_type=bearer&type=signup`

    const replaceStateSpy = vi.fn()
    window.history.replaceState = replaceStateSpy

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const user = await service.getUser()
    expect(user?.id).toBe('usr-redirect-99')
    expect(user?.email).toBe('redirect-user@example.com')
    expect(await service.getAccessToken()).toBe(fakeToken)
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/')
  })

  it('passes email_redirect_to in sendMagicLink request', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    await service.sendMagicLink('test@example.com')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const callArgs = fetchSpy.mock.calls[0] as [
      string,
      { method: string; body: string },
    ]
    expect(callArgs[0]).toBe('https://example.supabase.co/auth/v1/otp')
    expect(callArgs[1].method).toBe('POST')
    expect(callArgs[1].body).toContain('"email_redirect_to"')
  })

  it('canonicalizes email_redirect_to to https://joli.to when sendMagicLink called on apex workers.dev', async () => {
    vi.stubGlobal('location', {
      hostname: 'jolito.smolkaj.workers.dev',
      origin: 'https://jolito.smolkaj.workers.dev',
    })

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    await service.sendMagicLink('learner@example.com')

    const callArgs = fetchSpy.mock.calls[0] as [
      string,
      { method: string; body: string },
    ]
    const parsedBody = JSON.parse(callArgs[1].body) as {
      email_redirect_to?: string
    }
    expect(parsedBody.email_redirect_to).toBe('https://joli.to')

    vi.unstubAllGlobals()
  })

  it('falls back through OTP verification types until success', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Not email type' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'signup-token',
            refresh_token: 'signup-ref',
            expires_in: 3600,
            user: { id: 'usr-signup', email: 'signup@example.com' },
          }),
      })
    vi.stubGlobal('fetch', fetchSpy)

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const res = await service.verifyOtp('signup@example.com', '654321')
    expect(res.success).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    const user = await service.getUser()
    expect(user?.id).toBe('usr-signup')
  })

  it('clears error hash from address bar when error redirect occurs', async () => {
    window.location.hash = '#error=access_denied&error_code=otp_expired'
    const replaceStateSpy = vi.fn()
    window.history.replaceState = replaceStateSpy

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const user = await service.getUser()
    expect(user).toBeNull()
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/')
  })

  it('tracks and consumes redirect auth state', () => {
    const fakePayload = {
      sub: 'usr-redirect-101',
      email: 'pwa-user@example.com',
    }
    const fakeToken = `header.${btoa(JSON.stringify(fakePayload))}.signature`
    window.location.hash = `#access_token=${fakeToken}&expires_in=3600`

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    expect(service.consumeRedirectAuth()).toBe(true)
    expect(service.consumeRedirectAuth()).toBe(false)
  })

  it('sanitizes formatted token with spaces or dashes during verifyOtp', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'clean-token',
          refresh_token: 'clean-refresh',
          expires_in: 3600,
          user: { id: 'usr-clean', email: 'clean@example.com' },
        }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const res = await service.verifyOtp(' clean@example.com ', ' 123-456 ')
    expect(res.success).toBe(true)

    const callArgs = fetchSpy.mock.calls[0] as [
      string,
      { method: string; body: string },
    ]
    const parsedBody = JSON.parse(callArgs[1].body) as {
      email: string
      token: string
    }
    expect(parsedBody.email).toBe('clean@example.com')
    expect(parsedBody.token).toBe('123456')
  })

  it('provides actionable guidance when OTP is expired or invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: 'Token has expired or is invalid',
          }),
      }),
    )

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const res = await service.verifyOtp('test@example.com', '111222')
    expect(res.success).toBe(false)
    expect(res.error).toContain(
      'Tap the link in your email to open Safari, then tap "Copy session link"',
    )
  })

  it('rejects plain webpage URL without session tokens with clear guidance', async () => {
    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const res = await service.verifyOtp('', 'https://joli.to/')
    expect(res.success).toBe(false)
    expect(res.error).toContain(
      'This webpage link has no session tokens. In Safari, tap "Copy session link"',
    )
  })

  it('exports session link for PWA transfer when authenticated', () => {
    const fakePayload = {
      sub: 'usr-export-1',
      email: 'export@example.com',
    }
    const fakeToken = `header.${btoa(JSON.stringify(fakePayload))}.signature`
    mockStorage['jolito-auth-session-v1'] = JSON.stringify({
      accessToken: fakeToken,
      refreshToken: 'rt-export',
      expiresAt: Date.now() + 100000,
      user: { id: 'usr-export-1', email: 'export@example.com' },
    })

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const link = service.getSessionLink()
    expect(link).toContain('#access_token=')
    expect(link).toContain('refresh_token=rt-export')
  })

  it('verifies pasted session redirect URL in verifyOtp and logs user in', async () => {
    const fakePayload = {
      sub: 'usr-pasted-url',
      email: 'pasted@example.com',
    }
    const fakeToken = `header.${btoa(JSON.stringify(fakePayload))}.signature`
    const pastedUrl = `https://joli.to/#access_token=${fakeToken}&refresh_token=rt-pasted&expires_in=3600`

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const res = await service.verifyOtp('', pastedUrl)
    expect(res.success).toBe(true)

    const user = await service.getUser()
    expect(user?.id).toBe('usr-pasted-url')
    expect(user?.email).toBe('pasted@example.com')
  })

  it('verifies pasted Supabase email verify URL with token parameter as token_hash', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'tok-magic',
          refresh_token: 'ref-magic',
          expires_in: 3600,
          user: { id: 'usr-magic', email: 'magic@example.com' },
        }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const service = new SupabaseAuthService(
      'https://xwqjelkfdcfzyxxblvhp.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const emailLink =
      'https://xwqjelkfdcfzyxxblvhp.supabase.co/auth/v1/verify?token=45ae542bee094273c7281342ece45eed55c2289034b7f15ed7a25e6b&type=magiclink&redirect_to=https://joli.to/'
    const res = await service.verifyOtp('', emailLink)
    expect(res.success).toBe(true)

    const callArgs = fetchSpy.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ]
    expect(callArgs[0]).toBe(
      'https://xwqjelkfdcfzyxxblvhp.supabase.co/auth/v1/verify',
    )
    const parsedBody = JSON.parse(callArgs[1].body) as {
      token_hash?: string
      token?: string
      email?: string
      type?: string
    }
    expect(parsedBody.token_hash).toBe(
      '45ae542bee094273c7281342ece45eed55c2289034b7f15ed7a25e6b',
    )
    expect(parsedBody.type).toBe('magiclink')
    expect(parsedBody.token).toBeUndefined()
    expect(parsedBody.email).toBeUndefined()

    const user = await service.getUser()
    expect(user?.id).toBe('usr-magic')
    expect(user?.email).toBe('magic@example.com')
  })

  it('verifies pasted magic link with token_hash query parameter', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'tok-hash',
          refresh_token: 'ref-hash',
          expires_in: 3600,
          user: { id: 'usr-hash', email: 'hash@example.com' },
        }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const emailLink =
      'https://example.supabase.co/auth/v1/verify?token_hash=45ae542bee094273c7281342ece45eed55c2289034b7f15ed7a25e6b&type=email&redirect_to=https://joli.to'
    const res = await service.verifyOtp('hash@example.com', emailLink)
    expect(res.success).toBe(true)

    const callArgs = fetchSpy.mock.calls[0] as [
      string,
      { method: string; body: string },
    ]
    const parsedBody = JSON.parse(callArgs[1].body) as {
      token_hash?: string
      type?: string
    }
    expect(parsedBody.token_hash).toBe(
      '45ae542bee094273c7281342ece45eed55c2289034b7f15ed7a25e6b',
    )
    expect(parsedBody.type).toBe('email')
  })

  it('verifies pasted 64-character token hash directly without email', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'tok-direct',
          refresh_token: 'ref-direct',
          expires_in: 3600,
          user: { id: 'usr-direct', email: 'direct@example.com' },
        }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const rawHash = '45ae542bee094273c7281342ece45eed55c2289034b7f15ed7a25e6b'
    const res = await service.verifyOtp('', rawHash)
    expect(res.success).toBe(true)

    const callArgs = fetchSpy.mock.calls[0] as [
      string,
      { method: string; body: string },
    ]
    const parsedBody = JSON.parse(callArgs[1].body) as {
      token_hash?: string
      type?: string
    }
    expect(parsedBody.token_hash).toBe(rawHash)
    expect(parsedBody.type).toBe('magiclink')
  })

  it('verifies pasted magic link wrapped in angle brackets or quotes', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'tok-bracket',
          refresh_token: 'ref-bracket',
          expires_in: 3600,
          user: { id: 'usr-bracket', email: 'bracket@example.com' },
        }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const service = new SupabaseAuthService(
      'https://example.supabase.co',
      'anon-key',
      fakeStorage,
    )

    const bracketLink =
      '<https://example.supabase.co/auth/v1/verify?token=45ae542bee094273c7281342ece45eed55c2289034b7f15ed7a25e6b&type=magiclink&redirect_to=https://joli.to/>'
    const res = await service.verifyOtp('', bracketLink)
    expect(res.success).toBe(true)

    const callArgs = fetchSpy.mock.calls[0] as [
      string,
      { method: string; body: string },
    ]
    const parsedBody = JSON.parse(callArgs[1].body) as {
      token_hash?: string
      type?: string
    }
    expect(parsedBody.token_hash).toBe(
      '45ae542bee094273c7281342ece45eed55c2289034b7f15ed7a25e6b',
    )
  })
})
