import { z } from 'zod'

export const signupPayloadSchema = z.object({
  email: z
    .string({ message: 'Email address is required' })
    .trim()
    .email('Invalid email address'),
  user_id: z
    .string({ message: 'User ID is required' })
    .trim()
    .min(1, 'User ID cannot be empty'),
  context: z.record(z.string(), z.unknown()).optional().default({}),
})

export type SignupPayload = z.input<typeof signupPayloadSchema>

export interface SendEmailBinding {
  send: (message: {
    from: string
    to: string
    subject: string
    text: string
    html: string
    replyTo?: string | undefined
  }) => Promise<void>
}

export interface SignupWorkerEnv {
  SEND_EMAIL?: SendEmailBinding | undefined
  SIGNUP_NOTIFICATION_EMAIL?: string | undefined
  FEEDBACK_NOTIFICATION_EMAIL?: string | undefined
  SIGNUP_SENDER_EMAIL?: string | undefined
  FEEDBACK_SENDER_EMAIL?: string | undefined
  RESEND_API_KEY?: string | undefined
  [key: string]: unknown
}

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatPlainTextSignupEmail(payload: SignupPayload): string {
  const timestamp = new Date().toISOString()
  const contextStr =
    payload.context && Object.keys(payload.context).length > 0
      ? JSON.stringify(payload.context, null, 2)
      : 'None'

  return [
    'New Jolito Sign-up!',
    '==================',
    '',
    'A new learner has signed up for Jolito.',
    '',
    'Learner Details:',
    `- Email: ${payload.email}`,
    `- Account ID: ${payload.user_id}`,
    `- Signed Up At: ${timestamp}`,
    '',
    'Client Context:',
    contextStr,
    '',
    '--',
    'Jolito · Spoken Mexican Spanish at your rhythm',
    'https://joli.to',
  ].join('\n')
}

export function formatHtmlSignupEmail(payload: SignupPayload): string {
  const emailDisplay = `<strong>${escapeHtml(payload.email)}</strong>`
  const accountDisplay = `<span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #475569;">${escapeHtml(payload.user_id)}</span>`
  const timestamp = escapeHtml(new Date().toISOString())
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
  <title>New Jolito Sign-up</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; line-height: 1.5; }
    .card { background-color: #ffffff; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background-color: #b30060; color: #ffffff; padding: 20px 24px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
    .header p { margin: 4px 0 0 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 24px; }
    .welcome-box { background-color: #fdf2f8; border-left: 4px solid #e4007c; border-radius: 4px; padding: 14px 16px; font-size: 14px; line-height: 1.5; color: #831843; margin-bottom: 24px; font-weight: 500; }
    .meta-table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px; }
    .meta-table th, .meta-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #f1f5f9; }
    .meta-table th { color: #64748b; font-weight: 500; width: 130px; }
    .meta-table td { color: #0f172a; font-size: 13px; }
    .context-box { background-color: #0f172a; color: #f8fafc; border-radius: 8px; padding: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; overflow-x: auto; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🎉 New Jolito Sign-up</h1>
      <p>A new learner joined Jolito</p>
    </div>
    <div class="content">
      <div class="welcome-box">A new learner just signed up and synchronized their deck with cloud backup.</div>
      <table class="meta-table">
        <tr>
          <th>Learner Email</th>
          <td>${emailDisplay}</td>
        </tr>
        <tr>
          <th>Account ID</th>
          <td>${accountDisplay}</td>
        </tr>
        <tr>
          <th>Signed Up At</th>
          <td><span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px;">${timestamp}</span></td>
        </tr>
      </table>
      ${
        hasContext
          ? `<div style="font-size: 13px; font-weight: 600; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Client Context</div>
      <pre class="context-box">${contextJson}</pre>`
          : ''
      }
      <div class="footer">
        Jolito · Spoken Mexican Spanish at your rhythm · <a href="https://joli.to" style="color: #e4007c; text-decoration: none;">joli.to</a>
      </div>
    </div>
  </div>
</body>
</html>`
}

export async function sendSignupNotification(
  payload: SignupPayload,
  env?: SignupWorkerEnv,
): Promise<{ dispatched: boolean; provider: string }> {
  const recipient =
    env?.SIGNUP_NOTIFICATION_EMAIL ||
    env?.FEEDBACK_NOTIFICATION_EMAIL ||
    'a@joli.to'
  const sender =
    env?.SIGNUP_SENDER_EMAIL || env?.FEEDBACK_SENDER_EMAIL || 'a@joli.to'
  const subject = `[Jolito Sign-up] New learner: ${payload.email}`
  const text = formatPlainTextSignupEmail(payload)
  const html = formatHtmlSignupEmail(payload)

  if (env?.SEND_EMAIL) {
    await env.SEND_EMAIL.send({
      from: sender,
      to: recipient,
      subject,
      text,
      html,
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
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Resend API failed (HTTP ${res.status}): ${errText}`)
    }
    return { dispatched: true, provider: 'resend' }
  }

  console.log(
    '[Signup Notification] Simulated email dispatch (no email provider binding configured):',
    {
      to: recipient,
      from: sender,
      subject,
    },
  )
  return { dispatched: false, provider: 'simulated-console' }
}

export async function handleSignupRequest(
  request: Request,
  env?: SignupWorkerEnv,
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

  const parsed = signupPayloadSchema.safeParse(body)
  if (!parsed.success) {
    const errorMsg =
      parsed.error.issues?.[0]?.message ??
      parsed.error.message ??
      'Invalid sign-up payload.'
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

  let emailDispatched = false
  let emailProvider: string
  let emailError: string | undefined
  try {
    const res = await sendSignupNotification(payload, env)
    emailDispatched = res.dispatched
    emailProvider = res.provider
  } catch (emailErr) {
    emailProvider = 'error'
    emailError = emailErr instanceof Error ? emailErr.message : String(emailErr)
    console.error(
      '[SignupRoute] Non-fatal notification dispatch error:',
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
