import { describe, expect, it, vi } from 'vitest'
import {
  handleDigestScheduled,
  handleUnsubscribeRequest,
  type DigestWorkerEnv,
} from './digest-route'
import { createUnsubscribeToken } from '../domain/deck-digest'

describe('digest-route', () => {
  const secret = 'test-digest-secret'
  const validUserId = '11111111-2222-4333-8444-555555555555'

  describe('handleUnsubscribeRequest', () => {
    it('returns 400 when missing query parameters', async () => {
      const req = new Request('https://joli.to/api/digest/unsubscribe')
      const res = await handleUnsubscribeRequest(req, {
        DIGEST_UNSUBSCRIBE_SECRET: secret,
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 when token is invalid or tampered', async () => {
      const req = new Request(
        `https://joli.to/api/digest/unsubscribe?uid=${validUserId}&token=invalid-token`,
      )
      const res = await handleUnsubscribeRequest(req, {
        DIGEST_UNSUBSCRIBE_SECRET: secret,
      })
      expect(res.status).toBe(400)
      const text = await res.text()
      expect(text).toContain('Invalid or expired unsubscribe link')
    })

    it('renders safe confirmation page on GET without mutating database state', async () => {
      const token = await createUnsubscribeToken(validUserId, secret)
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)

      const req = new Request(
        `https://joli.to/api/digest/unsubscribe?uid=${validUserId}&token=${token}`,
        { method: 'GET' },
      )
      const res = await handleUnsubscribeRequest(req, {
        DIGEST_UNSUBSCRIBE_SECRET: secret,
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/html')
      const text = await res.text()
      expect(text).toContain('Unsubscribe confirmation')
      expect(text).toContain(
        'Are you sure you want to stop receiving monthly progress reports',
      )
      expect(text).toContain('<form method="POST"')
      expect(text).toContain('Keep subscription')

      // Invariant: GET never calls database mutation RPC (safe against enterprise link crawlers)
      expect(fetchSpy).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
    })

    it('successfully unsubscribes on POST with valid token and returns friendly confirmation HTML', async () => {
      const token = await createUnsubscribeToken(validUserId, secret)
      const fetchSpy = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(true), { status: 200 }))
      vi.stubGlobal('fetch', fetchSpy)

      const req = new Request(
        `https://joli.to/api/digest/unsubscribe?uid=${validUserId}&token=${token}`,
        { method: 'POST' },
      )
      const res = await handleUnsubscribeRequest(req, {
        DIGEST_UNSUBSCRIBE_SECRET: secret,
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/html')
      const text = await res.text()
      expect(text).toContain("You're unsubscribed")
      expect(text).toContain('Your deck remains safe')

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://test.supabase.co/rest/v1/rpc/unsubscribe_monthly_digest',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ p_user_id: validUserId }),
        }),
      )
      vi.unstubAllGlobals()
    })

    it('returns 500 when database unsubscribe RPC fails on POST', async () => {
      const token = await createUnsubscribeToken(validUserId, secret)
      const fetchSpy = vi
        .fn()
        .mockResolvedValue(new Response('DB error', { status: 500 }))
      vi.stubGlobal('fetch', fetchSpy)

      const req = new Request(
        `https://joli.to/api/digest/unsubscribe?uid=${validUserId}&token=${token}`,
        { method: 'POST' },
      )
      const res = await handleUnsubscribeRequest(req, {
        DIGEST_UNSUBSCRIBE_SECRET: secret,
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      })

      expect(res.status).toBe(500)
      const text = await res.text()
      expect(text).toContain('Unable to process unsubscribe request')
      vi.unstubAllGlobals()
    })

    it('returns 500 when Supabase credentials are missing on POST', async () => {
      const token = await createUnsubscribeToken(validUserId, secret)
      const req = new Request(
        `https://joli.to/api/digest/unsubscribe?uid=${validUserId}&token=${token}`,
        { method: 'POST' },
      )
      const res = await handleUnsubscribeRequest(req, {
        DIGEST_UNSUBSCRIBE_SECRET: secret,
      })

      expect(res.status).toBe(500)
      const text = await res.text()
      expect(text).toContain('Server configuration error')
    })

    it('returns 405 for unsupported HTTP methods', async () => {
      const token = await createUnsubscribeToken(validUserId, secret)
      const req = new Request(
        `https://joli.to/api/digest/unsubscribe?uid=${validUserId}&token=${token}`,
        { method: 'DELETE' },
      )
      const res = await handleUnsubscribeRequest(req, {
        DIGEST_UNSUBSCRIBE_SECRET: secret,
      })
      expect(res.status).toBe(405)
    })
  })

  describe('handleDigestScheduled', () => {
    const leaseId = '22222222-3333-4444-8555-666666666666'
    const activeDeckData = {
      app: 'jolito',
      version: 4,
      updatedAt: '2026-09-28T12:00:00Z',
      deviceId: 'dev-1',
      cards: [
        {
          id: 'c1',
          noteId: 'c1',
          prompt: 'hablar',
          answer: 'to speak',
          direction: 'es-en',
          context: '',
          scene: 'conversation',
          createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
          schedule: {
            state: 'review',
            intervalDays: 25,
            dueAt: Date.now(),
            easeFactor: 2.5,
            reviews: 60,
            lapses: 0,
            lastReviewedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
          },
        },
      ],
      deletedCardIds: [],
    }

    it('claims pending users, computes stats, sends via Resend, and records completion', async () => {
      const sampleClaims = [
        {
          user_id: validUserId,
          email: 'learner@example.com',
          last_lifetime_reviews: 50,
          lease_id: leaseId,
        },
      ]

      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/rpc/claim_monthly_digests')) {
          return Promise.resolve(
            new Response(JSON.stringify(sampleClaims), { status: 200 }),
          )
        }
        if (url.includes('/rest/v1/decks?user_id=')) {
          return Promise.resolve(
            new Response(JSON.stringify([{ data: activeDeckData }]), {
              status: 200,
            }),
          )
        }
        if (url === 'https://api.resend.com/emails') {
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'resend_123' }), { status: 200 }),
          )
        }
        if (url.includes('/rpc/finish_monthly_digest')) {
          return Promise.resolve(
            new Response(JSON.stringify(true), { status: 200 }),
          )
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`))
      })
      vi.stubGlobal('fetch', fetchSpy)

      const env: DigestWorkerEnv = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        RESEND_API_KEY: 're_test_key_123',
        DIGEST_UNSUBSCRIBE_SECRET: secret,
      }

      const result = await handleDigestScheduled(env)
      expect(result.processed).toBe(1)
      expect(result.delivered).toBe(1)
      expect(result.failures).toBe(0)

      // Verify Resend payload
      const resendCall = fetchSpy.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          call[0] === 'https://api.resend.com/emails',
      )
      expect(resendCall).toBeDefined()
      const resendInit = resendCall![1] as { body: string }
      const resendBody = JSON.parse(resendInit.body) as {
        to: string
        subject: string
        attachments: Array<{ filename: string }>
        headers: Record<string, string>
      }
      expect(resendBody.to).toBe('learner@example.com')
      expect(resendBody.subject).toContain('[Jolito] Progress Report')
      expect(resendBody.attachments).toHaveLength(1)
      expect(resendBody.attachments[0]?.filename).toContain('.json')
      expect(resendBody.headers['List-Unsubscribe']).toBeDefined()

      // Verify finish RPC called with updated reviews
      const finishCall = fetchSpy.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('/rpc/finish_monthly_digest'),
      )
      expect(finishCall).toBeDefined()
      const finishInit = finishCall![1] as { body: string }
      const finishBody = JSON.parse(finishInit.body) as {
        p_user_id: string
        p_lease_id: string
        p_delivered: boolean
        p_new_lifetime_reviews: number
        p_auto_paused: boolean
        p_permanent_failure: boolean
      }
      expect(finishBody.p_user_id).toBe(validUserId)
      expect(finishBody.p_lease_id).toBe(leaseId)
      expect(finishBody.p_delivered).toBe(true)
      expect(finishBody.p_new_lifetime_reviews).toBe(60)
      expect(finishBody.p_auto_paused).toBe(false)
      expect(finishBody.p_permanent_failure).toBe(false)

      vi.unstubAllGlobals()
    })

    it('sends paused notice and marks account auto-paused when user is inactive', async () => {
      const inactiveLeaseId = '33333333-4444-4555-8666-777777777777'
      const sampleClaims = [
        {
          user_id: validUserId,
          email: 'inactive@example.com',
          last_lifetime_reviews: 10,
          lease_id: inactiveLeaseId,
        },
      ]

      const inactiveDeckData = {
        app: 'jolito',
        version: 4,
        updatedAt: '2026-07-01T12:00:00Z',
        deviceId: 'dev-1',
        cards: [
          {
            id: 'c1',
            noteId: 'c1',
            prompt: 'antiguo',
            answer: 'ancient',
            direction: 'es-en',
            context: '',
            scene: 'conversation',
            createdAt: Date.now() - 100 * 24 * 60 * 60 * 1000,
            schedule: {
              state: 'review',
              intervalDays: 10,
              dueAt: Date.now() - 50 * 24 * 60 * 60 * 1000,
              easeFactor: 2.5,
              reviews: 10,
              lapses: 0,
              lastReviewedAt: Date.now() - 60 * 24 * 60 * 60 * 1000, // 60 days ago (inactive)
            },
          },
        ],
        deletedCardIds: [],
      }

      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/rpc/claim_monthly_digests')) {
          return Promise.resolve(
            new Response(JSON.stringify(sampleClaims), { status: 200 }),
          )
        }
        if (url.includes('/rest/v1/decks?user_id=')) {
          return Promise.resolve(
            new Response(JSON.stringify([{ data: inactiveDeckData }]), {
              status: 200,
            }),
          )
        }
        if (url === 'https://api.resend.com/emails') {
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'resend_456' }), { status: 200 }),
          )
        }
        if (url.includes('/rpc/finish_monthly_digest')) {
          return Promise.resolve(
            new Response(JSON.stringify(true), { status: 200 }),
          )
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`))
      })
      vi.stubGlobal('fetch', fetchSpy)

      const env: DigestWorkerEnv = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        RESEND_API_KEY: 're_test_key_123',
        DIGEST_UNSUBSCRIBE_SECRET: secret,
      }

      const result = await handleDigestScheduled(env)
      expect(result.processed).toBe(1)
      expect(result.paused).toBe(1)

      const resendCall = fetchSpy.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          call[0] === 'https://api.resend.com/emails',
      )
      expect(resendCall).toBeDefined()
      const resendInit = resendCall![1] as { body: string }
      const resendBody = JSON.parse(resendInit.body) as { subject: string }
      expect(resendBody.subject).toContain('[Jolito] Progress Report (paused)')

      const finishCall = fetchSpy.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('/rpc/finish_monthly_digest'),
      )
      expect(finishCall).toBeDefined()
      const finishInit = finishCall![1] as { body: string }
      const finishBody = JSON.parse(finishInit.body) as {
        p_auto_paused: boolean
        p_permanent_failure: boolean
      }
      expect(finishBody.p_auto_paused).toBe(true)
      expect(finishBody.p_permanent_failure).toBe(false)

      vi.unstubAllGlobals()
    })

    it('flags permanent failure and marks failed when Resend returns 4xx client error', async () => {
      const sampleClaims = [
        {
          user_id: validUserId,
          email: 'invalid@nonexistent.domain',
          last_lifetime_reviews: 10,
          lease_id: leaseId,
        },
      ]

      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/rpc/claim_monthly_digests')) {
          return Promise.resolve(
            new Response(JSON.stringify(sampleClaims), { status: 200 }),
          )
        }
        if (url.includes('/rest/v1/decks?user_id=')) {
          return Promise.resolve(
            new Response(JSON.stringify([{ data: activeDeckData }]), {
              status: 200,
            }),
          )
        }
        if (url === 'https://api.resend.com/emails') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                statusCode: 422,
                message: 'The email address is invalid',
              }),
              { status: 422 },
            ),
          )
        }
        if (url.includes('/rpc/finish_monthly_digest')) {
          return Promise.resolve(
            new Response(JSON.stringify(true), { status: 200 }),
          )
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`))
      })
      vi.stubGlobal('fetch', fetchSpy)

      const env: DigestWorkerEnv = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        RESEND_API_KEY: 're_test_key_123',
        DIGEST_UNSUBSCRIBE_SECRET: secret,
      }

      const result = await handleDigestScheduled(env)
      expect(result.processed).toBe(1)
      expect(result.delivered).toBe(0)
      expect(result.failures).toBe(1)

      const finishCall = fetchSpy.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('/rpc/finish_monthly_digest'),
      )
      expect(finishCall).toBeDefined()
      const finishInit = finishCall![1] as { body: string }
      const finishBody = JSON.parse(finishInit.body) as {
        p_delivered: boolean
        p_permanent_failure: boolean
      }
      expect(finishBody.p_delivered).toBe(false)
      expect(finishBody.p_permanent_failure).toBe(true)

      vi.unstubAllGlobals()
    })

    it('safely skips and resets lease when deck fetch fails without sending blank email', async () => {
      const sampleClaims = [
        {
          user_id: validUserId,
          email: 'learner@example.com',
          last_lifetime_reviews: 10,
          lease_id: leaseId,
        },
      ]

      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/rpc/claim_monthly_digests')) {
          return Promise.resolve(
            new Response(JSON.stringify(sampleClaims), { status: 200 }),
          )
        }
        if (url.includes('/rest/v1/decks?user_id=')) {
          // Simulate 500 error from REST endpoint
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'database failure' }), {
              status: 500,
            }),
          )
        }
        if (url === 'https://api.resend.com/emails') {
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'resend_fail' }), {
              status: 200,
            }),
          )
        }
        if (url.includes('/rpc/finish_monthly_digest')) {
          return Promise.resolve(
            new Response(JSON.stringify(true), { status: 200 }),
          )
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`))
      })
      vi.stubGlobal('fetch', fetchSpy)

      const env: DigestWorkerEnv = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        RESEND_API_KEY: 're_test_key_123',
        DIGEST_UNSUBSCRIBE_SECRET: secret,
      }

      const result = await handleDigestScheduled(env)
      expect(result.processed).toBe(1)
      expect(result.delivered).toBe(0)
      expect(result.failures).toBe(1)

      // Resend API must NOT be called when deck fetch fails
      const resendCall = fetchSpy.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          call[0] === 'https://api.resend.com/emails',
      )
      expect(resendCall).toBeUndefined()

      // Verify finish RPC reports failure with temporary retry lease (not permanent failure)
      const finishCall = fetchSpy.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('/rpc/finish_monthly_digest'),
      )
      expect(finishCall).toBeDefined()
      const finishInit = finishCall![1] as { body: string }
      const finishBody = JSON.parse(finishInit.body) as {
        p_delivered: boolean
        p_permanent_failure: boolean
      }
      expect(finishBody.p_delivered).toBe(false)
      expect(finishBody.p_permanent_failure).toBe(false)

      vi.unstubAllGlobals()
    })

    it('safely skips and reports failure when deck data fails schema validation without sending blank email', async () => {
      const sampleClaims = [
        {
          user_id: validUserId,
          email: 'learner@example.com',
          last_lifetime_reviews: 10,
          lease_id: leaseId,
        },
      ]

      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/rpc/claim_monthly_digests')) {
          return Promise.resolve(
            new Response(JSON.stringify(sampleClaims), { status: 200 }),
          )
        }
        if (url.includes('/rest/v1/decks?user_id=')) {
          return Promise.resolve(
            new Response(
              JSON.stringify([{ data: { invalid_corrupt_structure: true } }]),
              { status: 200 },
            ),
          )
        }
        if (url.includes('/rpc/finish_monthly_digest')) {
          return Promise.resolve(
            new Response(JSON.stringify(true), { status: 200 }),
          )
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`))
      })
      vi.stubGlobal('fetch', fetchSpy)

      const env: DigestWorkerEnv = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        RESEND_API_KEY: 're_test_key_123',
        DIGEST_UNSUBSCRIBE_SECRET: secret,
      }

      const result = await handleDigestScheduled(env)
      expect(result.processed).toBe(1)
      expect(result.delivered).toBe(0)
      expect(result.failures).toBe(1)

      // Resend API must NOT be called with empty or corrupt backup
      const resendCall = fetchSpy.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          call[0] === 'https://api.resend.com/emails',
      )
      expect(resendCall).toBeUndefined()

      // Verify finish RPC reports failure with temporary retry lease
      const finishCall = fetchSpy.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('/rpc/finish_monthly_digest'),
      )
      expect(finishCall).toBeDefined()
      const finishInit = finishCall![1] as { body: string }
      const finishBody = JSON.parse(finishInit.body) as {
        p_delivered: boolean
        p_permanent_failure: boolean
      }
      expect(finishBody.p_delivered).toBe(false)
      expect(finishBody.p_permanent_failure).toBe(false)

      vi.unstubAllGlobals()
    })

    it('does NOT mark permanent failure on transient 429 rate limit errors', async () => {
      const sampleClaims = [
        {
          user_id: validUserId,
          email: 'ratelimited@example.com',
          last_lifetime_reviews: 10,
          lease_id: leaseId,
        },
      ]

      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/rpc/claim_monthly_digests')) {
          return Promise.resolve(
            new Response(JSON.stringify(sampleClaims), { status: 200 }),
          )
        }
        if (url.includes('/rest/v1/decks?user_id=')) {
          return Promise.resolve(
            new Response(JSON.stringify([{ data: activeDeckData }]), {
              status: 200,
            }),
          )
        }
        if (url === 'https://api.resend.com/emails') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                statusCode: 429,
                message: 'Too many requests',
              }),
              { status: 429 },
            ),
          )
        }
        if (url.includes('/rpc/finish_monthly_digest')) {
          return Promise.resolve(
            new Response(JSON.stringify(true), { status: 200 }),
          )
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`))
      })
      vi.stubGlobal('fetch', fetchSpy)

      const env: DigestWorkerEnv = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        RESEND_API_KEY: 're_test_key_123',
        DIGEST_UNSUBSCRIBE_SECRET: secret,
      }

      const result = await handleDigestScheduled(env)
      expect(result.processed).toBe(1)
      expect(result.delivered).toBe(0)
      expect(result.failures).toBe(1)

      const finishCall = fetchSpy.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('/rpc/finish_monthly_digest'),
      )
      expect(finishCall).toBeDefined()
      const finishInit = finishCall![1] as { body: string }
      const finishBody = JSON.parse(finishInit.body) as {
        p_delivered: boolean
        p_permanent_failure: boolean
      }
      expect(finishBody.p_delivered).toBe(false)
      expect(finishBody.p_permanent_failure).toBe(false)

      vi.unstubAllGlobals()
    })

    it('tracks failure when finish RPC returns error', async () => {
      const sampleClaims = [
        {
          user_id: validUserId,
          email: 'learner@example.com',
          last_lifetime_reviews: 10,
          lease_id: leaseId,
        },
      ]

      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/rpc/claim_monthly_digests')) {
          return Promise.resolve(
            new Response(JSON.stringify(sampleClaims), { status: 200 }),
          )
        }
        if (url.includes('/rest/v1/decks?user_id=')) {
          return Promise.resolve(
            new Response(JSON.stringify([{ data: activeDeckData }]), {
              status: 200,
            }),
          )
        }
        if (url === 'https://api.resend.com/emails') {
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'resend_ok' }), { status: 200 }),
          )
        }
        if (url.includes('/rpc/finish_monthly_digest')) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'DB finish error' }), {
              status: 500,
            }),
          )
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`))
      })
      vi.stubGlobal('fetch', fetchSpy)

      const env: DigestWorkerEnv = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        RESEND_API_KEY: 're_test_key_123',
        DIGEST_UNSUBSCRIBE_SECRET: secret,
      }

      const result = await handleDigestScheduled(env)
      expect(result.processed).toBe(1)
      expect(result.delivered).toBe(1)
      expect(result.failures).toBe(1)

      vi.unstubAllGlobals()
    })

    it('skips and does not claim if RESEND_API_KEY is missing', async () => {
      const fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)

      const env: DigestWorkerEnv = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      }

      const result = await handleDigestScheduled(env)
      expect(result.processed).toBe(0)
      expect(result.delivered).toBe(0)
      expect(result.failures).toBe(0)
      expect(fetchSpy).not.toHaveBeenCalled()

      vi.unstubAllGlobals()
    })
  })
})
