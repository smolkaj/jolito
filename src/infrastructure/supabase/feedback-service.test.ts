import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseFeedbackService } from './feedback-service'
import type { AuthService, AuthUser } from '../../application/ports'

describe('SupabaseFeedbackService', () => {
  const mockUser: AuthUser = {
    id: 'user-456',
    email: 'learner@example.com',
  }

  let mockAuth: AuthService
  let refreshSessionSpy: ReturnType<typeof vi.fn<() => Promise<string | null>>>

  beforeEach(() => {
    refreshSessionSpy = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValue('refreshed-access-token')
    mockAuth = {
      getUser: vi.fn().mockResolvedValue(mockUser),
      getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
      refreshSession: refreshSessionSpy,
      sendMagicLink: vi.fn(),
      verifyOtp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects empty or invalid feedback message before network request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const service = new SupabaseFeedbackService(
      mockAuth,
      'https://supabase.example.com',
      'anon-key',
    )

    const result = await service.submitFeedback(
      {
        message: '   ',
      },
      mockUser,
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Please enter a message')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('requires backend configuration', async () => {
    const service = new SupabaseFeedbackService(mockAuth, '', '')
    const result = await service.submitFeedback(
      { message: 'Something broke' },
      mockUser,
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('not configured')
  })

  it('requires authenticated token', async () => {
    mockAuth.getAccessToken = vi.fn().mockResolvedValue(null)
    const service = new SupabaseFeedbackService(
      mockAuth,
      'https://supabase.example.com',
      'anon-key',
    )

    const result = await service.submitFeedback(
      { message: 'Something broke' },
      mockUser,
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Sign in')
  })

  it('successfully posts feedback to Supabase REST endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 201,
      }),
    )

    const service = new SupabaseFeedbackService(
      mockAuth,
      'https://supabase.example.com',
      'anon-key',
    )

    const result = await service.submitFeedback(
      {
        message: 'Add nuance note for "ahorita"',
        context: { route: '#/study' },
      },
      mockUser,
    )

    expect(result.success).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://supabase.example.com/rest/v1/feedback',
      expect.anything(),
    )
    const callArgs = fetchSpy.mock.calls[0]
    const callOptions = callArgs?.[1]
    expect(callOptions?.method).toBe('POST')
    expect(callOptions?.headers).toEqual({
      'Content-Type': 'application/json',
      apikey: 'anon-key',
      Authorization: 'Bearer mock-access-token',
      Prefer: 'return=minimal',
    })
    expect(callOptions?.body).toBe(
      JSON.stringify({
        user_id: 'user-456',
        email: 'learner@example.com',
        message: 'Add nuance note for "ahorita"',
        context: { route: '#/study' },
      }),
    )
  })

  it('refreshes token and retries on 401 response', async () => {
    let callCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve(new Response('Unauthorized', { status: 401 }))
      }
      return Promise.resolve(new Response(null, { status: 201 }))
    })

    const refreshSpy = vi.spyOn(mockAuth, 'refreshSession')

    const service = new SupabaseFeedbackService(
      mockAuth,
      'https://supabase.example.com',
      'anon-key',
    )

    const result = await service.submitFeedback(
      { message: 'Great app!' },
      mockUser,
    )

    expect(result.success).toBe(true)
    expect(refreshSpy).toHaveBeenCalled()
    expect(callCount).toBe(2)
  })

  it('handles server errors gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    )

    const service = new SupabaseFeedbackService(
      mockAuth,
      'https://supabase.example.com',
      'anon-key',
    )

    const result = await service.submitFeedback(
      { message: 'Test feedback' },
      mockUser,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('handles network failure gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('Network offline'),
    )

    const service = new SupabaseFeedbackService(
      mockAuth,
      'https://supabase.example.com',
      'anon-key',
    )

    const result = await service.submitFeedback(
      { message: 'Test feedback' },
      mockUser,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network offline')
  })

  it('submits guest feedback using anon credentials and null user_id', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 201,
      }),
    )

    const service = new SupabaseFeedbackService(
      mockAuth,
      'https://supabase.example.com',
      'anon-key',
    )

    const result = await service.submitFeedback(
      {
        message: 'Guest feedback from landing page',
        context: { view: 'welcome', version: '0.1.0' },
      },
      null,
    )

    expect(result.success).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://supabase.example.com/rest/v1/feedback',
      expect.objectContaining({
        method: 'POST',
        headers: {
          apikey: 'anon-key',
          Authorization: 'Bearer anon-key',
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          user_id: null,
          email: 'guest@jolito.app',
          message: 'Guest feedback from landing page',
          context: { view: 'welcome', version: '0.1.0' },
        }),
      }),
    )
  })

  it('does not attempt session refresh on 401 when user is null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    )

    const service = new SupabaseFeedbackService(
      mockAuth,
      'https://supabase.example.com',
      'anon-key',
    )

    const result = await service.submitFeedback(
      { message: 'Guest feedback' },
      null,
    )

    expect(result.success).toBe(false)
    expect(refreshSessionSpy).not.toHaveBeenCalled()
  })

  it('parses structured PostgREST JSON errors and logs details', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const postgrestErrorJson = JSON.stringify({
      code: 'PGRST205',
      details: null,
      hint: null,
      message: "Could not find the table 'public.feedback' in the schema cache",
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(postgrestErrorJson, {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const service = new SupabaseFeedbackService(
      mockAuth,
      'https://supabase.example.com',
      'anon-key',
    )

    const result = await service.submitFeedback(
      { message: 'Feedback on unmigrated table' },
      null,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe(
      "Could not find the table 'public.feedback' in the schema cache",
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      '[FeedbackService] Submission failed:',
      expect.objectContaining({
        status: 404,
        code: 'PGRST205',
        message:
          "Could not find the table 'public.feedback' in the schema cache",
      }),
    )
  })

  it('dispatches notification to notifyEndpoint on successful submission', async () => {
    const fetchCalls: { url: string; options: RequestInit | undefined }[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      fetchCalls.push({ url, options: init })
      return Promise.resolve(new Response(null, { status: 201 }))
    })

    const service = new SupabaseFeedbackService(
      mockAuth,
      'https://supabase.example.com',
      'anon-key',
      '/api/feedback',
    )

    const result = await service.submitFeedback(
      { message: 'Feedback with notification' },
      mockUser,
    )

    expect(result.success).toBe(true)
    expect(fetchCalls.length).toBe(2)
    // First call: Supabase PostgREST
    expect(fetchCalls[0]?.url).toBe(
      'https://supabase.example.com/rest/v1/feedback',
    )
    // Second call: Edge notification route
    expect(fetchCalls[1]?.url).toContain('/api/feedback')
    expect(fetchCalls[1]?.options?.headers).toMatchObject({
      'Content-Type': 'application/json',
    })
    expect(fetchCalls[1]?.options?.keepalive).toBe(true)
  })

  it('resolves https://joli.to origin when running in native Capacitor on iOS', async () => {
    const fetchCalls: { url: string }[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      fetchCalls.push({ url })
      return Promise.resolve(new Response(null, { status: 201 }))
    })

    const originalLocation = window.location
    try {
      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'capacitor:',
          origin: 'capacitor://localhost',
        },
        writable: true,
      })

      const service = new SupabaseFeedbackService(
        mockAuth,
        'https://supabase.example.com',
        'anon-key',
        '/api/feedback',
      )

      await service.submitFeedback(
        { message: 'Feedback from iOS native app' },
        mockUser,
      )

      expect(fetchCalls.length).toBe(2)
      expect(fetchCalls[1]?.url).toBe('https://joli.to/api/feedback')
    } finally {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
      })
    }
  })

  it('tolerates notification dispatch errors without failing feedback submission', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let callIdx = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      callIdx++
      if (callIdx === 1) {
        // Supabase DB insertion succeeds
        return Promise.resolve(new Response(null, { status: 201 }))
      }
      // Notification dispatch throws network error
      return Promise.reject(new Error('Edge worker offline'))
    })

    const service = new SupabaseFeedbackService(
      mockAuth,
      'https://supabase.example.com',
      'anon-key',
      '/api/feedback',
    )

    const result = await service.submitFeedback(
      { message: 'Submission succeeds even if notification fails' },
      mockUser,
    )

    expect(result.success).toBe(true)
    // Wait for microtask queue
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(warnSpy).toHaveBeenCalledWith(
      '[FeedbackService] Non-fatal notification dispatch error:',
      expect.any(Error),
    )
  })
})
