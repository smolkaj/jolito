import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAlertDedupeCacheForTests,
  escapeHtml,
  formatHtmlAlert,
  formatPlainTextAlert,
  handleSyncAlertRequest,
  sendSyncAnomalyEmail,
  type SyncAlertWorkerEnv,
  type SyncAnomalyAlert,
} from './sync-alert-route'
import type { SendEmailBinding } from './email-binding'

describe('sync-alert-route', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearAlertDedupeCacheForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const sampleAlert: SyncAnomalyAlert = {
    userId: '6ab42be4-f6a2-4161-864f-b1c71335595e',
    revision: 651,
    clientVersion: 4,
    deviceId: 'dev-123456',
    issues: [
      {
        path: ['data', 'updatedAt'],
        code: 'invalid_type',
        message: 'Invalid input: expected string, received number',
        expected: 'string',
        received: 'number',
      },
    ],
  }

  describe('formatters', () => {
    it('escapes html entities correctly', () => {
      expect(escapeHtml('<script>"alert(\'XSS\')&"</script>')).toBe(
        '&lt;script&gt;&quot;alert(&#39;XSS&#39;)&amp;&quot;&lt;/script&gt;',
      )
    })

    it('formats plain text alert email with complete details', () => {
      const text = formatPlainTextAlert(sampleAlert)
      expect(text).toContain('JOLITO CLOUD SYNC ANOMALY ALERT')
      expect(text).toContain('User ID: 6ab42be4-f6a2-4161-864f-b1c71335595e')
      expect(text).toContain('Remote Revision: 651')
      expect(text).toContain('Client Collection Version: 4')
      expect(text).toContain('Device ID: dev-123456')
      expect(text).toContain('• Path: data.updatedAt')
      expect(text).toContain('Code: invalid_type')
      expect(text).toContain('Expected: string')
      expect(text).toContain('Received: number')
    })

    it('formats plain text alert email with unknown/null revision gracefully', () => {
      const text = formatPlainTextAlert({
        ...sampleAlert,
        revision: null,
        clientVersion: undefined,
        deviceId: undefined,
      })
      expect(text).toContain('Remote Revision: Unknown / Missing')
      expect(text).toContain('Client Collection Version: Unknown')
      expect(text).toContain('Device ID: Unknown')
    })

    it('formats HTML alert email with styled anomaly banner and cards', () => {
      const html = formatHtmlAlert(sampleAlert)
      expect(html).toContain('Cloud Sync Schema Anomaly')
      expect(html).toContain('6ab42be4-f6a2-4161-864f-b1c71335595e')
      expect(html).toContain('data.updatedAt')
      expect(html).toContain('invalid_type')
      expect(html).toContain('Invalid input: expected string, received number')
      expect(html).toContain('Expected:')
      expect(html).toContain('Received:')
    })
  })

  describe('sendSyncAnomalyEmail', () => {
    it('dispatches via Cloudflare SEND_EMAIL binding when present', async () => {
      const sendMock = vi
        .fn<
          (msg: {
            from: string
            to: string
            subject: string
            text: string
            html?: string
          }) => Promise<void>
        >()
        .mockResolvedValue(undefined)
      const mockBinding: SendEmailBinding = { send: sendMock }
      const env: SyncAlertWorkerEnv = {
        SEND_EMAIL: mockBinding,
        FEEDBACK_NOTIFICATION_EMAIL: 'maintainer@example.com',
        FEEDBACK_SENDER_EMAIL: 'alerts@example.com',
      }

      const result = await sendSyncAnomalyEmail(sampleAlert, env)

      expect(result.dispatched).toBe(true)
      expect(result.provider).toBe('cloudflare-send-email')
      expect(sendMock).toHaveBeenCalledTimes(1)
      const callArgs = sendMock.mock.calls[0]?.[0]
      expect(callArgs?.to).toBe('maintainer@example.com')
      expect(callArgs?.from).toBe('alerts@example.com')
      expect(callArgs?.subject).toContain('[Jolito Alert]')
      expect(callArgs?.subject).toContain('6ab42be4')
    })

    it('dispatches via Resend API when RESEND_API_KEY is present and SEND_EMAIL is absent', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 'resend-123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      vi.stubGlobal('fetch', fetchSpy)

      const env: SyncAlertWorkerEnv = {
        RESEND_API_KEY: 're_test_key_123',
        FEEDBACK_NOTIFICATION_EMAIL: 'maintainer@example.com',
      }

      const result = await sendSyncAnomalyEmail(sampleAlert, env)

      expect(result.dispatched).toBe(true)
      expect(result.provider).toBe('resend')
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
        }),
      )
      const call = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(call[1].headers).toEqual({
        Authorization: 'Bearer re_test_key_123',
        'Content-Type': 'application/json',
      })
      expect(typeof call[1].body).toBe('string')
    })

    it('throws error when Resend API returns non-200', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response('API rate limit exceeded', {
          status: 429,
        }),
      )
      vi.stubGlobal('fetch', fetchSpy)

      const env: SyncAlertWorkerEnv = {
        RESEND_API_KEY: 're_test_key_123',
      }

      await expect(sendSyncAnomalyEmail(sampleAlert, env)).rejects.toThrow(
        'Resend API failed (HTTP 429): API rate limit exceeded',
      )
    })

    it('falls back to console log when no provider is configured', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const result = await sendSyncAnomalyEmail(sampleAlert, {})

      expect(result.dispatched).toBe(false)
      expect(result.provider).toBe('simulated-console')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Sync Anomaly Alert]'),
        expect.any(Object),
      )
    })
  })

  describe('handleSyncAlertRequest', () => {
    it('returns 204 for OPTIONS preflight with CORS headers', async () => {
      const req = new Request('https://joli.to/api/alerts/sync-anomaly', {
        method: 'OPTIONS',
      })
      const res = await handleSyncAlertRequest(req)
      expect(res.status).toBe(204)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    })

    it('returns 405 for GET requests', async () => {
      const req = new Request('https://joli.to/api/alerts/sync-anomaly', {
        method: 'GET',
      })
      const res = await handleSyncAlertRequest(req)
      expect(res.status).toBe(405)
    })

    it('returns 400 for malformed JSON', async () => {
      const req = new Request('https://joli.to/api/alerts/sync-anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{',
      })
      const res = await handleSyncAlertRequest(req)
      expect(res.status).toBe(400)
      const data = (await res.json()) as Record<string, unknown>
      expect(data).toEqual({ error: 'Invalid JSON request body.' })
    })

    it('returns 400 when required fields are missing', async () => {
      const req = new Request('https://joli.to/api/alerts/sync-anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: '',
          issues: [],
        }),
      })
      const res = await handleSyncAlertRequest(req)
      expect(res.status).toBe(400)
      const data = (await res.json()) as { error: string }
      expect(data.error).toBe('Validation failed')
    })

    it('successfully processes valid alert and returns 200', async () => {
      const req = new Request('https://joli.to/api/alerts/sync-anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleAlert),
      })
      const res = await handleSyncAlertRequest(req, {})
      expect(res.status).toBe(200)
      const data = (await res.json()) as {
        success: boolean
        delivered: boolean
      }
      expect(data.success).toBe(true)
    })

    it('deduplicates alerts for the same user and revision within window', async () => {
      const makeRequest = () =>
        new Request('https://joli.to/api/alerts/sync-anomaly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sampleAlert),
        })

      const firstRes = await handleSyncAlertRequest(makeRequest(), {})
      expect(firstRes.status).toBe(200)
      const firstData = (await firstRes.json()) as { deduped?: boolean }
      expect(firstData.deduped).toBeUndefined()

      // Second immediate request with same userId and revision
      const secondRes = await handleSyncAlertRequest(makeRequest(), {})
      expect(secondRes.status).toBe(200)
      const secondData = (await secondRes.json()) as { deduped?: boolean }
      expect(secondData.deduped).toBe(true)
    })

    it('returns 502 if email provider fails', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response('Internal Server Error', {
          status: 500,
        }),
      )
      vi.stubGlobal('fetch', fetchSpy)

      const req = new Request('https://joli.to/api/alerts/sync-anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleAlert),
      })

      const res = await handleSyncAlertRequest(req, {
        RESEND_API_KEY: 're_bad_key',
      })
      expect(res.status).toBe(502)
      const data = (await res.json()) as Record<string, unknown>
      expect(data).toEqual({ error: 'Failed to dispatch alert email.' })
    })
  })
})
