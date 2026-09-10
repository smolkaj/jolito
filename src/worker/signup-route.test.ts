import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  escapeHtml,
  formatHtmlSignupEmail,
  formatPlainTextSignupEmail,
  handleSignupRequest,
  sendSignupNotification,
  type SendEmailBinding,
  type SignupPayload,
} from './signup-route'

interface SignupResponseBody {
  error?: string
  success?: boolean
  emailDispatched?: boolean
  provider?: string
  emailError?: string
  issues?: unknown[]
}

describe('signup-route', () => {
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

    it('formats plain text email with learner details and context', () => {
      const payload: SignupPayload = {
        email: 'learner@example.com',
        user_id: 'usr_abc123',
        context: { platform: 'ios', standalone: true },
      }
      const text = formatPlainTextSignupEmail(payload)
      expect(text).toContain('New Jolito Sign-up!')
      expect(text).toContain('learner@example.com')
      expect(text).toContain('usr_abc123')
      expect(text).toContain('platform')
      expect(text).toContain('ios')
    })

    it('formats html email with styled table and branded header', () => {
      const payload: SignupPayload = {
        email: 'student<1>@example.com',
        user_id: 'usr_xyz789',
        context: { platform: 'web' },
      }
      const html = formatHtmlSignupEmail(payload)
      expect(html).toContain('student&lt;1&gt;@example.com')
      expect(html).toContain('usr_xyz789')
      expect(html).toContain('New Jolito Sign-up')
      expect(html).toContain('Client Context')
      expect(html).toContain('#b30060')
    })

    it('formats html email cleanly without client context drawer if context is empty', () => {
      const payload: SignupPayload = {
        email: 'plain@example.com',
        user_id: 'usr_plain',
        context: {},
      }
      const html = formatHtmlSignupEmail(payload)
      expect(html).toContain('plain@example.com')
      expect(html).not.toContain('Client Context')
    })
  })

  describe('sendSignupNotification', () => {
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
      const payload: SignupPayload = {
        email: 'learner@example.com',
        user_id: 'usr_1',
      }

      const res = await sendSignupNotification(payload, {
        SEND_EMAIL: mockSendEmail,
        SIGNUP_NOTIFICATION_EMAIL: 'notify@joli.to',
        FEEDBACK_SENDER_EMAIL: 'noreply@joli.to',
      })

      expect(res.dispatched).toBe(true)
      expect(res.provider).toBe('cloudflare-send-email')
      expect(sendSpy).toHaveBeenCalledTimes(1)
      const callArgs = sendSpy.mock.calls[0]?.[0]
      expect(callArgs?.to).toBe('notify@joli.to')
      expect(callArgs?.from).toBe('noreply@joli.to')
      expect(callArgs?.subject).toBe(
        '[Jolito Sign-up] New learner: learner@example.com',
      )
      expect(callArgs?.text).toContain('learner@example.com')
      expect(callArgs?.html).toContain('learner@example.com')
    })

    it('falls back to FEEDBACK_NOTIFICATION_EMAIL when SIGNUP_NOTIFICATION_EMAIL is omitted', async () => {
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

      const res = await sendSignupNotification(
        { email: 'fallback@example.com', user_id: 'u2' },
        {
          SEND_EMAIL: { send: sendSpy },
          FEEDBACK_NOTIFICATION_EMAIL: 'maintainer@joli.to',
        },
      )

      expect(res.dispatched).toBe(true)
      const callArgs = sendSpy.mock.calls[0]?.[0]
      expect(callArgs?.to).toBe('maintainer@joli.to')
    })

    it('uses RESEND_API_KEY when SEND_EMAIL binding is missing', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ id: 'resend-123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const payload: SignupPayload = {
        email: 'resend-user@example.com',
        user_id: 'usr_resend',
      }

      const res = await sendSignupNotification(payload, {
        RESEND_API_KEY: 're_test_key_123',
        SIGNUP_NOTIFICATION_EMAIL: 'team@joli.to',
      })

      expect(res.dispatched).toBe(true)
      expect(res.provider).toBe('resend')
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

    it('throws when Resend API returns an error response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('API rate limit reached', { status: 429 }),
      )

      const payload: SignupPayload = {
        email: 'err@example.com',
        user_id: 'usr_err',
      }

      await expect(
        sendSignupNotification(payload, {
          RESEND_API_KEY: 're_fail',
        }),
      ).rejects.toThrow('Resend API failed (HTTP 429): API rate limit reached')
    })

    it('falls back to simulated console dispatch when no email binding or API key is provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const payload: SignupPayload = {
        email: 'simulated@example.com',
        user_id: 'usr_sim',
      }

      const res = await sendSignupNotification(payload, {})
      expect(res.dispatched).toBe(false)
      expect(res.provider).toBe('simulated-console')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[Signup Notification] Simulated email dispatch',
        ),
        expect.objectContaining({
          to: 'a@joli.to',
          from: 'a@joli.to',
        }),
      )
    })
  })

  describe('handleSignupRequest', () => {
    it('handles CORS OPTIONS preflight request', async () => {
      const req = new Request('https://joli.to/api/signup', {
        method: 'OPTIONS',
      })
      const res = await handleSignupRequest(req)
      expect(res.status).toBe(204)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    })

    it('returns 405 Method Not Allowed for non-POST requests', async () => {
      const req = new Request('https://joli.to/api/signup', {
        method: 'GET',
      })
      const res = await handleSignupRequest(req)
      expect(res.status).toBe(405)
      const data = (await res.json()) as SignupResponseBody
      expect(data.error).toBe('Method not allowed')
    })

    it('returns 400 Bad Request for malformed JSON body', async () => {
      const req = new Request('https://joli.to/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{',
      })
      const res = await handleSignupRequest(req)
      expect(res.status).toBe(400)
      const data = (await res.json()) as SignupResponseBody
      expect(data.error).toBe('Invalid JSON request body.')
    })

    it('returns 400 Bad Request for invalid email or missing user_id', async () => {
      const req = new Request('https://joli.to/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email',
          user_id: '',
        }),
      })
      const res = await handleSignupRequest(req)
      expect(res.status).toBe(400)
      const data = (await res.json()) as SignupResponseBody
      expect(data.error).toContain('Invalid email')
    })

    it('accepts valid signup request and dispatches email', async () => {
      const sendSpy = vi.fn().mockResolvedValue(undefined)
      const req = new Request('https://joli.to/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'valid.learner@example.com',
          user_id: 'usr_valid_456',
          context: { platform: 'ios' },
        }),
      })

      const res = await handleSignupRequest(req, {
        SEND_EMAIL: { send: sendSpy },
        SIGNUP_NOTIFICATION_EMAIL: 'team@joli.to',
      })

      expect(res.status).toBe(200)
      const data = (await res.json()) as SignupResponseBody
      expect(data.success).toBe(true)
      expect(data.emailDispatched).toBe(true)
      expect(data.provider).toBe('cloudflare-send-email')
    })

    it('survives email dispatch failure without failing the 200 response', async () => {
      const req = new Request('https://joli.to/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'fail@example.com',
          user_id: 'usr_fail',
        }),
      })

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const res = await handleSignupRequest(req, {
        SEND_EMAIL: {
          send: vi
            .fn()
            .mockRejectedValue(new Error('SMTP connection timed out')),
        },
      })

      expect(res.status).toBe(200)
      const data = (await res.json()) as SignupResponseBody
      expect(data.success).toBe(true)
      expect(data.emailDispatched).toBe(false)
      expect(data.provider).toBe('error')
      expect(data.emailError).toContain('SMTP connection timed out')
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })
})
