import { z } from 'zod'
import type { SendEmailBinding } from './email-binding.ts'
export type { SendEmailBinding } from './email-binding.ts'

export const feedbackPayloadSchema = z.object({
  message: z
    .string({ message: 'Feedback message is required' })
    .trim()
    .min(1, 'Please enter a message before sending feedback.')
    .max(5000, 'Feedback message is too long (maximum 5,000 characters).'),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .optional()
    .or(z.literal(''))
    .or(z.null()),
  user_id: z.string().trim().nullable().optional(),
  context: z.record(z.string(), z.unknown()).optional().default({}),
})

export type FeedbackPayload = z.infer<typeof feedbackPayloadSchema>

export interface FeedbackWorkerEnv {
  SEND_EMAIL?: SendEmailBinding | undefined
  FEEDBACK_NOTIFICATION_EMAIL?: string | undefined
  FEEDBACK_SENDER_EMAIL?: string | undefined
  RESEND_API_KEY?: string | undefined
  [key: string]: unknown
}

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

export function formatPlainTextEmail(payload: FeedbackPayload): string {
  const isGuest = !payload.email || payload.email === 'guest@jolito.app'
  const senderDisplay = isGuest
    ? 'Anonymous Guest (no email provided)'
    : payload.email!
  const accountDisplay = payload.user_id
    ? `Authenticated (${payload.user_id})`
    : isGuest
      ? 'Guest (no account)'
      : 'Guest (email provided)'
  const timestamp = new Date().toISOString()
  const contextStr =
    payload.context && Object.keys(payload.context).length > 0
      ? JSON.stringify(payload.context, null, 2)
      : 'None'

  return [
    'Jolito User Feedback',
    '====================',
    '',
    'Message:',
    '----------------------------------------',
    payload.message,
    '----------------------------------------',
    '',
    'Submission Details:',
    `- Sender: ${senderDisplay}`,
    `- Account: ${accountDisplay}`,
    `- Submitted At: ${timestamp}`,
    '',
    'Context:',
    contextStr,
  ].join('\n')
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatHtmlEmail(payload: FeedbackPayload): string {
  const isGuest = !payload.email || payload.email === 'guest@jolito.app'
  const senderDisplay = isGuest
    ? '<span style="color: #64748b; font-style: italic;">Anonymous Guest (no email provided)</span>'
    : `<strong>${escapeHtml(payload.email!)}</strong>`

  const accountDisplay = payload.user_id
    ? `Authenticated <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #64748b;">(${escapeHtml(payload.user_id)})</span>`
    : isGuest
      ? '<span style="color: #64748b;">Guest (no account)</span>'
      : '<span style="color: #64748b;">Guest (email provided)</span>'

  const timestamp = escapeHtml(new Date().toISOString())
  const escapedMessage = escapeHtml(payload.message)
  const hasContext = Boolean(
    payload.context && Object.keys(payload.context).length > 0,
  )
  const contextJson = hasContext
    ? escapeHtml(JSON.stringify(payload.context, null, 2))
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Jolito Feedback</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; line-height: 1.5; }
    .card { background-color: #ffffff; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background-color: #b30060; color: #ffffff; padding: 20px 24px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
    .header p { margin: 4px 0 0 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 24px; }
    .message-box { background-color: #fdf2f8; border-left: 4px solid #e4007c; border-radius: 4px; padding: 16px; font-size: 15px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; color: #1e293b; margin-bottom: 24px; }
    .meta-table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px; }
    .meta-table th, .meta-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #f1f5f9; }
    .meta-table th { color: #64748b; font-weight: 500; width: 120px; }
    .meta-table td { color: #0f172a; font-size: 13px; }
    .context-box { background-color: #0f172a; color: #f8fafc; border-radius: 8px; padding: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>💬 New Jolito Feedback</h1>
      <p>Submitted from Jolito web / iOS client</p>
    </div>
    <div class="content">
      <div class="message-box">${escapedMessage}</div>
      <table class="meta-table">
        <tr>
          <th>Sender</th>
          <td>${senderDisplay}</td>
        </tr>
        <tr>
          <th>Account</th>
          <td>${accountDisplay}</td>
        </tr>
        <tr>
          <th>Timestamp</th>
          <td><span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px;">${timestamp}</span></td>
        </tr>
      </table>
      ${
        hasContext
          ? `<div style="font-size: 13px; font-weight: 600; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Client Context</div>
      <pre class="context-box">${contextJson}</pre>`
          : ''
      }
    </div>
  </div>
</body>
</html>`
}

export async function sendFeedbackNotification(
  payload: FeedbackPayload,
  env?: FeedbackWorkerEnv,
): Promise<{ dispatched: boolean; provider: string }> {
  const recipient = env?.FEEDBACK_NOTIFICATION_EMAIL || 'a@joli.to'
  const sender = env?.FEEDBACK_SENDER_EMAIL || 'a@joli.to'
  const isGuest = !payload.email || payload.email === 'guest@jolito.app'
  const replyTo = !isGuest && payload.email ? payload.email : undefined
  const previewText = payload.message.slice(0, 50).replace(/[\r\n]+/g, ' ')
  const subject = `[Jolito Feedback] ${previewText}${payload.message.length > 50 ? '...' : ''}`
  const text = formatPlainTextEmail(payload)
  const html = formatHtmlEmail(payload)

  if (env?.SEND_EMAIL) {
    await env.SEND_EMAIL.send({
      from: sender,
      to: recipient,
      subject,
      text,
      html,
      ...(replyTo ? { replyTo } : {}),
    })
    return { dispatched: true, provider: 'cloudflare-send-email' }
  }

  if (env?.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender,
        to: recipient,
        subject,
        text,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Resend API failed (HTTP ${res.status}): ${errText}`)
    }
    return { dispatched: true, provider: 'resend' }
  }

  console.log(
    '[Feedback Notification] Simulated email dispatch (no email provider binding configured):',
    {
      to: recipient,
      from: sender,
      subject,
      replyTo,
    },
  )
  return { dispatched: false, provider: 'simulated-console' }
}

export async function handleFeedbackRequest(
  request: Request,
  env?: FeedbackWorkerEnv,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        Allow: 'POST, OPTIONS',
        'Content-Type': 'application/json',
      },
    })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({
        error: 'Invalid JSON request body.',
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }

  const parsed = feedbackPayloadSchema.safeParse(body)
  if (!parsed.success) {
    const errorMsg =
      parsed.error.issues?.[0]?.message ??
      parsed.error.message ??
      'Invalid feedback payload.'
    return new Response(
      JSON.stringify({
        error: errorMsg,
        issues: parsed.error.issues,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }

  const payload = parsed.data

  // Dispatch email notification (non-fatal error handling: submission succeeds even if email fails)
  let emailDispatched = false
  let emailProvider: string
  let emailError: string | undefined
  try {
    const res = await sendFeedbackNotification(payload, env)
    emailDispatched = res.dispatched
    emailProvider = res.provider
  } catch (emailErr) {
    emailProvider = 'error'
    emailError = emailErr instanceof Error ? emailErr.message : String(emailErr)
    console.error(
      '[FeedbackRoute] Non-fatal notification dispatch error:',
      emailErr,
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      emailDispatched,
      provider: emailProvider,
      ...(emailError ? { emailError } : {}),
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    },
  )
}
