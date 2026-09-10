import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserSignupNotificationService } from './signup-notification-service'

describe('BrowserSignupNotificationService', () => {
  let mockStorage: Record<string, string>
  let setItemSpy: (key: string, value: string) => void
  let storage: Storage

  beforeEach(() => {
    vi.restoreAllMocks()
    mockStorage = {}
    setItemSpy = vi.fn((key: string, value: string) => {
      mockStorage[key] = value
    })
    storage = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: setItemSpy,
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key]
      }),
      clear: vi.fn(() => {
        mockStorage = {}
      }),
      length: 0,
      key: vi.fn(() => null),
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('dispatches signup notification to endpoint and records in storage on success', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const service = new BrowserSignupNotificationService('/api/signup', storage)
    const result = await service.notifySignup({
      email: 'learner@example.com',
      userId: 'user-123',
      context: { platform: 'web' },
    })

    expect(result.success).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/signup'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'learner@example.com',
          user_id: 'user-123',
          context: { platform: 'web' },
        }),
        keepalive: true,
      }),
    )
    expect(setItemSpy).toHaveBeenCalledWith(
      'jolito-signup-notified-user-123',
      'true',
    )
  })

  it('skips network dispatch if user was already notified in storage', async () => {
    mockStorage['jolito-signup-notified-user-123'] = 'true'
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const service = new BrowserSignupNotificationService('/api/signup', storage)
    const result = await service.notifySignup({
      email: 'learner@example.com',
      userId: 'user-123',
    })

    expect(result.success).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('resolves capacitor: protocol to https://joli.to origin', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('window', {
      location: { protocol: 'capacitor:', origin: 'capacitor://localhost' },
    })

    const service = new BrowserSignupNotificationService('/api/signup', storage)
    const result = await service.notifySignup({
      email: 'ios@example.com',
      userId: 'user-ios',
    })

    expect(result.success).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://joli.to/api/signup',
      expect.anything(),
    )
  })

  it('handles network failure non-fatally and does not record in storage so it can retry', async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValue(new Error('Network offline or timed out'))
    vi.stubGlobal('fetch', fetchSpy)
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const service = new BrowserSignupNotificationService('/api/signup', storage)
    const result = await service.notifySignup({
      email: 'learner@example.com',
      userId: 'user-123',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Network offline or timed out')
    expect(setItemSpy).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('returns failure when endpoint returns non-ok HTTP status', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal server error'),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const service = new BrowserSignupNotificationService('/api/signup', storage)
    const result = await service.notifySignup({
      email: 'learner@example.com',
      userId: 'user-123',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('HTTP 500')
    expect(setItemSpy).not.toHaveBeenCalled()
  })
})
