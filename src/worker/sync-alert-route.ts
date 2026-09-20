import { z } from 'zod'
import type { SendEmailBinding } from './email-binding'

export const syncAnomalyIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  code: z.string(),
  message: z.string(),
  expected: z.string().optional(),
  received: z.string().optional(),
})

export const syncAnomalyAlertSchema = z.object({
  userId: z.string().trim().min(1, 'User ID is required'),
  revision: z.number().int().nonnegative().nullable().optional(),
  clientVersion: z.number().int().optional(),
  deviceId: z.string().trim().max(100).optional(),
  issues: z
    .array(syncAnomalyIssueSchema)
    .min(1, 'At least one schema issue is required')
    .max(50),
})

export type SyncAnomalyIssue = z.infer<typeof syncAnomalyIssueSchema>
export type SyncAnomalyAlert = z.infer<typeof syncAnomalyAlertSchema>

export interface SyncAlertWorkerEnv {
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

// In-memory deduplication cache per worker instance (10-minute window)
const alertDedupeCache = new Map<string, number>()
const DEDUPE_WINDOW_MS = 10 * 60 * 1000

export function clearAlertDedupeCacheForTests(): void {
  alertDedupeCache.clear()
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatPlainTextAlert(payload: SyncAnomalyAlert): string {
  const timestamp = new Date().toISOString()
  const lines: string[] = [
    'JOLITO CLOUD SYNC ANOMALY ALERT',
    '================================',
    '',
    'A client encountered a fatal schema validation mismatch while pulling remote deck data.',
    'This user is currently blocked from syncing their account with the cloud.',
    '',
    'Impacted Account Details:',
    `- User ID: ${payload.userId}`,
    `- Remote Revision: ${payload.revision !== undefined && payload.revision !== null ? payload.revision : 'Unknown / Missing'}`,
    `- Client Collection Version: ${payload.clientVersion ?? 'Unknown'}`,
    `- Device ID: ${payload.deviceId ?? 'Unknown'}`,
    `- Detected At: ${timestamp}`,
    '',
    'Schema Validation Issues:',
    '----------------------------------------',
  ]

  for (const issue of payload.issues) {
    const pathStr = issue.path.length > 0 ? issue.path.join('.') : '(root)'
    lines.push(`• Path: ${pathStr}`)
    lines.push(`  Code: ${issue.code}`)
    lines.push(`  Message: ${issue.message}`)
    if (issue.expected) lines.push(`  Expected: ${issue.expected}`)
    if (issue.received) lines.push(`  Received: ${issue.received}`)
    lines.push('')
  }
  lines.push('----------------------------------------')
  lines.push('')
  lines.push(
    'Action Required: Inspect the user row in Supabase `public.decks` to repair malformed data or investigate upstream migration script.',
  )

  return lines.join('\n')
}

export function formatHtmlAlert(payload: SyncAnomalyAlert): string {
  const timestamp = escapeHtml(new Date().toISOString())
  const escapedUser = escapeHtml(payload.userId)
  const escapedRev =
    payload.revision !== undefined && payload.revision !== null
      ? escapeHtml(String(payload.revision))
      : '<span style="color: #94a3b8;">Unknown</span>'
  const escapedClientVer =
    payload.clientVersion !== undefined
      ? escapeHtml(String(payload.clientVersion))
      : '<span style="color: #94a3b8;">Unknown</span>'
  const escapedDevice = payload.deviceId
    ? escapeHtml(payload.deviceId)
    : '<span style="color: #94a3b8;">Unknown</span>'

  const issuesHtml = payload.issues
    .map((issue) => {
      const pathStr = escapeHtml(
        issue.path.length > 0 ? issue.path.join('.') : '(root)',
      )
      const codeStr = escapeHtml(issue.code)
      const messageStr = escapeHtml(issue.message)
      const expectedStr = issue.expected
        ? `<br><span style="color: #64748b;">Expected:</span> <code>${escapeHtml(issue.expected)}</code>`
        : ''
      const receivedStr = issue.received
        ? `<br><span style="color: #64748b;">Received:</span> <code style="color: #e11d48;">${escapeHtml(issue.received)}</code>`
        : ''

      return `
      <li style="margin-bottom: 12px; padding: 10px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px;">
        <strong style="color: #9f1239; font-family: monospace;">${pathStr}</strong>
        <span style="font-size: 11px; background: #ffe4e6; color: #9f1239; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${codeStr}</span>
        <div style="margin-top: 4px; color: #1e293b;">${messageStr}</div>
        ${expectedStr}
        ${receivedStr}
      </li>`
    })
    .join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Jolito Cloud Sync Anomaly Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; padding: 24px;">
  <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 2px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background: #e11d48; padding: 18px 24px; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
        🚨 Cloud Sync Schema Anomaly
      </h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #ffe4e6;">
        A learner was blocked from syncing due to an unparseable remote snapshot.
      </p>
    </div>
    
    <div style="padding: 24px;">
      <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 12px 0;">
        Impacted User Details
      </h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 160px;">User ID:</td>
          <td style="padding: 6px 0; font-family: monospace; font-weight: 600;">${escapedUser}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Remote Revision:</td>
          <td style="padding: 6px 0;">${escapedRev}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Client Collection Version:</td>
          <td style="padding: 6px 0;">${escapedClientVer}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Device ID:</td>
          <td style="padding: 6px 0; font-family: monospace;">${escapedDevice}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Detected At:</td>
          <td style="padding: 6px 0;">${timestamp}</td>
        </tr>
      </table>

      <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 12px 0;">
        Schema Violations
      </h2>
      <ul style="list-style: none; padding: 0; margin: 0 0 24px 0;">
        ${issuesHtml}
      </ul>

      <div style="background: #f1f5f9; border-radius: 8px; padding: 14px; font-size: 13px; color: #475569;">
        <strong>Recommended Action:</strong> Query <code>public.decks</code> in Supabase for <code>user_id = '${escapedUser}'</code> to repair the payload or check recent batch scripts.
      </div>
    </div>
  </div>
</body>
</html>`
}

export async function sendSyncAnomalyEmail(
  payload: SyncAnomalyAlert,
  env?: SyncAlertWorkerEnv,
): Promise<{ dispatched: boolean; provider: string }> {
  const recipient = env?.FEEDBACK_NOTIFICATION_EMAIL || 'a@joli.to'
  const sender = env?.FEEDBACK_SENDER_EMAIL || 'a@joli.to'
  const shortId = payload.userId.slice(0, 8)
  const subject = `[Jolito Alert] Cloud Sync Schema Failure (User ${shortId}...)`
  const text = formatPlainTextAlert(payload)
  const html = formatHtmlAlert(payload)

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

  console.log('[Sync Anomaly Alert] Simulated alert dispatch (no provider):', {
    to: recipient,
    from: sender,
    subject,
  })
  return { dispatched: false, provider: 'simulated-console' }
}

export async function handleSyncAlertRequest(
  request: Request,
  env?: SyncAlertWorkerEnv,
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
      JSON.stringify({ error: 'Invalid JSON request body.' }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }

  const parsed = syncAnomalyAlertSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: 'Validation failed',
        details: parsed.error.issues,
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
  const dedupeKey = `${payload.userId}:${payload.revision ?? 'none'}`
  const now = Date.now()

  // Clean old cache entries if Map gets large
  if (alertDedupeCache.size > 500) {
    for (const [key, timestamp] of alertDedupeCache.entries()) {
      if (now - timestamp > DEDUPE_WINDOW_MS) {
        alertDedupeCache.delete(key)
      }
    }
  }

  const lastAlertTime = alertDedupeCache.get(dedupeKey)
  if (lastAlertTime && now - lastAlertTime < DEDUPE_WINDOW_MS) {
    return new Response(
      JSON.stringify({
        success: true,
        deduped: true,
        message: 'Alert suppressed due to recent duplicate notification.',
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

  try {
    const result = await sendSyncAnomalyEmail(payload, env)
    alertDedupeCache.set(dedupeKey, now)
    return new Response(
      JSON.stringify({
        success: true,
        delivered: result.dispatched,
        provider: result.provider,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (err) {
    console.error('[Sync Anomaly Alert] Email dispatch failed:', err)
    return new Response(
      JSON.stringify({
        error: 'Failed to dispatch alert email.',
      }),
      {
        status: 502,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
