import { afterEach, describe, expect, it, vi } from 'vitest'
import worker, { type SignupAlertsEnv } from './signup-alerts'

const notification = {
  user_id: 'a0000000-0000-4000-8000-000000000001',
  email: 'learner@example.com',
  verified_at: '2026-09-10T12:00:00+00:00',
  lease_id: 'b0000000-0000-4000-8000-000000000001',
}

function environment(): SignupAlertsEnv {
  return {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    SIGNUP_NOTIFICATION_EMAIL: 'maintainer@example.com',
    SEND_EMAIL: { send: vi.fn().mockResolvedValue({ messageId: 'mail-1' }) },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('scheduled signup alerts', () => {
  it('sends the claimed identity and records provider acceptance', async () => {
    const env = environment()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json([notification]))
      .mockResolvedValueOnce(Response.json(true))
    vi.stubGlobal('fetch', fetchMock)
    await worker.scheduled({}, env)
    expect(env.SEND_EMAIL.send).toHaveBeenCalledWith({
      from: 'a@joli.to',
      to: 'maintainer@example.com',
      subject: 'New Jolito learner',
      text: 'A new learner joined Jolito.\n\nEmail: learner@example.com\nVerified: 2026-09-10T12:00:00+00:00\nAccount: a0000000-0000-4000-8000-000000000001',
    })
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({
      p_user_id: notification.user_id,
      p_lease_id: notification.lease_id,
      p_delivered: true,
    })
  })

  it('records failure for retry and fails the cron invocation visibly', async () => {
    const env = environment()
    vi.mocked(env.SEND_EMAIL.send).mockRejectedValue(
      new Error('Provider unavailable'),
    )
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json([notification]))
      .mockResolvedValueOnce(Response.json(true))
    vi.stubGlobal('fetch', fetchMock)
    await expect(worker.scheduled({}, env)).rejects.toThrow(
      '1 signup notification attempt failed',
    )
    expect(
      JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string),
    ).toMatchObject({ p_delivered: false })
  })

  it('does not acknowledge or send when the claim request fails', async () => {
    const env = environment()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('unavailable', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(worker.scheduled({}, env)).rejects.toThrow(
      'claim_signup_notifications failed (HTTP 503)',
    )
    expect(env.SEND_EMAIL.send).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports receipt failure without pretending delivery is durable', async () => {
    const env = environment()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json([notification]))
        .mockResolvedValueOnce(new Response('', { status: 503 })),
    )
    await expect(worker.scheduled({}, env)).rejects.toThrow(
      '1 signup notification attempt failed',
    )
    expect(env.SEND_EMAIL.send).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed claims before sending any mail', async () => {
    const env = environment()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json([notification, { email: 'forged' }])),
    )
    await expect(worker.scheduled({}, env)).rejects.toThrow()
    expect(env.SEND_EMAIL.send).not.toHaveBeenCalled()
  })

  it('finishes immediately when there are no new learners', async () => {
    const env = environment()
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]))
    vi.stubGlobal('fetch', fetchMock)
    await worker.scheduled({}, env)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(env.SEND_EMAIL.send).not.toHaveBeenCalled()
  })
})
