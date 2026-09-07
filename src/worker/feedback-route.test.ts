import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  escapeHtml,
  formatHtmlEmail,
  formatPlainTextEmail,
  handleFeedbackRequest,
  sendFeedbackNotification,
  type FeedbackPayload,
  type SendEmailBinding,
} from './feedback-route'

interface FeedbackResponseBody {
  error?: string
  success?: boolean
  emailDispatched?: boolean
  provider?: string
  issues?: unknown[]
}

describe('feedback-route', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('formatters', () => {
    it('escapes html entities correctly', () => {
      expect(escapeHtml('<script>"alert(\'XSS\')&"</script>')).toBe(
        '&lt;script&gt;&quot;alert(&#39;XSS&#39;)&amp;&quot;&lt;/script&gt;',
      )
    })

    it('formats plain text email with submission details and context', () => {
      const payload: FeedbackPayload = {
        message: 'Need dark mode toggle',
        email: 'user@example.com',
        user_id: 'usr_123',
        context: { route: '#/settings' },
      }
      const text = formatPlainTextEmail(payload)
      expect(text).toContain('Jolito User Feedback')
      expect(text).toContain('Need dark mode toggle')
      expect(text).toContain('Sender: user@example.com')
      expect(text).toContain('Account: Authenticated (usr_123)')
      expect(text).toContain('#/settings')
    })

    it('formats plain text email for anonymous guest cleanly', () => {
      const payload: FeedbackPayload = {
        message: 'Great app!',
        email: 'guest@jolito.app',
        user_id: null,
        context: {},
      }
      const text = formatPlainTextEmail(payload)
      expect(text).toContain('Sender: Anonymous Guest (no email provided)')
      expect(text).toContain('Account: Guest (no account)')
    })

    it('formats html email with styled table and escaped message for authenticated user', () => {
      const payload: FeedbackPayload = {
        message: 'Could you add <b>audio speed</b> controls?',
        email: 'speedy@example.com',
        user_id: 'usr_789',
        context: { speed: 1.0 },
      }
      const html = formatHtmlEmail(payload)
      expect(html).toContain('&lt;b&gt;audio speed&lt;/b&gt;')
      expect(html).toContain('speedy@example.com')
      expect(html).toContain('Authenticated')
      expect(html).toContain('usr_789')
      expect(html).toContain('Client Context')
    })

    it('formats html email for anonymous guest without misleading placeholders or empty context drawer', () => {
      const payload: FeedbackPayload = {
        message: 'Hello from a guest',
        email: null,
        user_id: null,
        context: {},
      }
      const html = formatHtmlEmail(payload)
      expect(html).toContain('Anonymous Guest (no email provided)')
      expect(html).toContain('Guest (no account)')
      expect(html).not.toContain('Client Context')
      expect(html).not.toContain('guest@jolito.app')
    })
  })

  describe('sendFeedbackNotification', () => {
    it('uses SEND_EMAIL binding when available', async () => {
      const sendSpy = vi
        .fn<
          (msg: {
            from: string
            to: string
            subject: string
            text: string
            html: string
          }) => Promise<void>
        >()
        .mockResolvedValue(undefined)
      const mockSendEmail: SendEmailBinding = { send: sendSpy }
      const payload: FeedbackPayload = {
        message: 'Audio playback is crystal clear!',
        email: 'audio@example.com',
        user_id: 'usr_abc',
        context: {},
      }

      const result = await sendFeedbackNotification(payload, {
        SEND_EMAIL: mockSendEmail,
        FEEDBACK_NOTIFICATION_EMAIL: 'custom@example.com',
        FEEDBACK_SENDER_EMAIL: 'notify@joli.to',
      })

      expect(result.dispatched).toBe(true)
      expect(result.provider).toBe('cloudflare-send-email')
      expect(sendSpy).toHaveBeenCalledTimes(1)
      const callArgs = sendSpy.mock.calls[0]?.[0]
      expect(callArgs?.from).toBe('notify@joli.to')
      expect(callArgs?.to).toBe('custom@example.com')
      expect(callArgs?.subject).toContain('[Jolito Feedback]')
      expect(callArgs?.subject).toContain('Audio playback is crystal clear!')
      expect(callArgs?.text).toContain('Audio playback is crystal clear!')
      expect(callArgs?.html).toContain('Audio playback is crystal clear!')
    })

    it('falls back to Resend API when RESEND_API_KEY is configured', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ id: 'resend_123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const payload: FeedbackPayload = {
        message: 'Resend fallback test',
        email: 'resend@example.com',
        user_id: null,
        context: {},
      }

      const result = await sendFeedbackNotification(payload, {
        RESEND_API_KEY: 're_test_key_123',
      })

      expect(result.dispatched).toBe(true)
      expect(result.provider).toBe('resend')
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer re_test_key_123',
            'Content-Type': 'application/json',
          },
        }),
      )
    })

    it('throws when Resend API fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('API rate limit exceeded', { status: 429 }),
      )

      const payload: FeedbackPayload = {
        message: 'Should fail',
        email: 'fail@example.com',
        user_id: null,
        context: {},
      }

      await expect(
        sendFeedbackNotification(payload, { RESEND_API_KEY: 'bad_key' }),
      ).rejects.toThrow('Resend API failed (HTTP 429)')
    })

    it('simulates dispatch to console when no email provider is configured', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const payload: FeedbackPayload = {
        message: 'Local offline dev message',
        email: 'dev@example.com',
        user_id: null,
        context: {},
      }

      const result = await sendFeedbackNotification(payload, {})
      expect(result.dispatched).toBe(false)
      expect(result.provider).toBe('simulated-console')
      expect(logSpy).toHaveBeenCalled()
    })
  })

  describe('handleFeedbackRequest HTTP handler', () => {
    it('handles OPTIONS preflight with 204 status and CORS headers', async () => {
      const req = new Request('https://joli.to/api/feedback', {
        method: 'OPTIONS',
      })
      const res = await handleFeedbackRequest(req)
      expect(res.status).toBe(204)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    })

    it('rejects unsupported HTTP methods with 405', async () => {
      const req = new Request('https://joli.to/api/feedback', { method: 'GET' })
      const res = await handleFeedbackRequest(req)
      expect(res.status).toBe(405)
      const body = (await res.json()) as FeedbackResponseBody
      expect(body.error).toBe('Method not allowed')
    })

    it('returns 400 for malformed JSON body', async () => {
      const req = new Request('https://joli.to/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{',
      })
      const res = await handleFeedbackRequest(req)
      expect(res.status).toBe(400)
      const body = (await res.json()) as FeedbackResponseBody
      expect(body.error).toContain('Invalid JSON')
    })

    it('returns 400 for empty or whitespace message', async () => {
      const req = new Request('https://joli.to/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '   ' }),
      })
      const res = await handleFeedbackRequest(req)
      expect(res.status).toBe(400)
      const body = (await res.json()) as FeedbackResponseBody
      expect(body.error).toContain('Please enter a message')
    })

    it('returns 400 for invalid email address format', async () => {
      const req = new Request('https://joli.to/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Valid message',
          email: 'not-an-email',
        }),
      })
      const res = await handleFeedbackRequest(req)
      expect(res.status).toBe(400)
      const body = (await res.json()) as FeedbackResponseBody
      expect(body.error).toContain('Invalid email address')
    })

    it('successfully processes notification and returns 200', async () => {
      const sendSpy = vi.fn().mockResolvedValue(undefined)
      const mockEnv = {
        SEND_EMAIL: { send: sendSpy },
      }

      const req = new Request('https://joli.to/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Great pronunciation guide!',
          email: 'user@example.com',
          user_id: 'usr_xyz',
          context: { version: '1.2.0' },
        }),
      })

      const res = await handleFeedbackRequest(req, mockEnv)
      expect(res.status).toBe(200)
      const body = (await res.json()) as FeedbackResponseBody
      expect(body.success).toBe(true)
      expect(body.emailDispatched).toBe(true)
      expect(body.provider).toBe('cloudflare-send-email')
      expect(sendSpy).toHaveBeenCalledTimes(1)
    })

    it('passes user email as replyTo when available', async () => {
      const sendSpy = vi
        .fn<
          (msg: {
            from: string
            to: string
            subject: string
            text: string
            html: string
            replyTo?: string | undefined
          }) => Promise<void>
        >()
        .mockResolvedValue(undefined)
      const mockEnv = {
        SEND_EMAIL: { send: sendSpy },
      }

      const req = new Request('https://joli.to/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Please reply to my question',
          email: 'inquiry@example.com',
          user_id: null,
          context: {},
        }),
      })

      const res = await handleFeedbackRequest(req, mockEnv)
      expect(res.status).toBe(200)
      const callArgs = sendSpy.mock.calls[0]?.[0]
      expect(callArgs?.replyTo).toBe('inquiry@example.com')
    })

    it('does not fail request if email dispatch encounters an exception', async () => {
      const sendSpy = vi
        .fn()
        .mockRejectedValue(new Error('SMTP connection timed out'))
      const mockEnv = {
        SEND_EMAIL: { send: sendSpy },
      }

      const req = new Request('https://joli.to/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Feedback should survive email outage',
        }),
      })

      const res = await handleFeedbackRequest(req, mockEnv)
      expect(res.status).toBe(200)
      const body = (await res.json()) as FeedbackResponseBody
      expect(body.success).toBe(true)
      expect(body.emailDispatched).toBe(false)
    })
  })
})
