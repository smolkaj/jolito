import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseFeedbackService } from './feedback-service'
import type { AuthService, AuthUser } from '../../application/ports'

describe('SupabaseFeedbackService', () => {
  const mockUser: AuthUser = {
    id: 'user-456',
    email: 'learner@example.com',
  }

  let mockAuth: AuthService

  beforeEach(() => {
    mockAuth = {
      getUser: vi.fn().mockResolvedValue(mockUser),
      getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
      refreshSession: vi.fn().mockResolvedValue('refreshed-access-token'),
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
        category: 'suggestion',
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
      { category: 'bug', message: 'Something broke' },
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
      { category: 'bug', message: 'Something broke' },
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
        category: 'spanish',
        message: 'Add nuance note for "ahorita"',
        context: { route: '#/study' },
      },
      mockUser,
    )

    expect(result.success).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://supabase.example.com/rest/v1/feedback',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'anon-key',
          Authorization: 'Bearer mock-access-token',
        }),
        body: JSON.stringify({
          user_id: 'user-456',
          email: 'learner@example.com',
          category: 'spanish',
          message: 'Add nuance note for "ahorita"',
          context: { route: '#/study' },
        }),
      }),
    )
  })

  it('refreshes token and retries on 401 response', async () => {
    let callCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        return new Response('Unauthorized', { status: 401 })
      }
      return new Response(null, { status: 201 })
    })

    const service = new SupabaseFeedbackService(
      mockAuth,
      'https://supabase.example.com',
      'anon-key',
    )

    const result = await service.submitFeedback(
      { category: 'suggestion', message: 'Great app!' },
      mockUser,
    )

    expect(result.success).toBe(true)
    expect(mockAuth.refreshSession).toHaveBeenCalled()
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
      { category: 'other', message: 'Test feedback' },
      mockUser,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('handles network failure gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'))

    const service = new SupabaseFeedbackService(
      mockAuth,
      'https://supabase.example.com',
      'anon-key',
    )

    const result = await service.submitFeedback(
      { category: 'other', message: 'Test feedback' },
      mockUser,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network offline')
  })
})
