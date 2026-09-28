import { z } from 'zod'
import {
  computeDeckDigestStats,
  createUnsubscribeToken,
  formatDigestEmail,
  formatPausedNoticeEmail,
  verifyUnsubscribeToken,
} from '../domain/deck-digest'
import { legacyStudyCardSchema, type StudyCard } from '../domain/card'
import { deckSyncPayloadSchema } from '../domain/sync'

export interface DigestWorkerEnv {
  SUPABASE_URL?: string | undefined
  SUPABASE_SERVICE_ROLE_KEY?: string | undefined
  RESEND_API_KEY?: string | undefined
  DIGEST_UNSUBSCRIBE_SECRET?: string | undefined
  DIGEST_BASE_URL?: string | undefined
  [key: string]: unknown
}

const claimSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  last_lifetime_reviews: z.number().int().default(0),
  lease_id: z.string().uuid(),
})

const rawDeckSchema = z.object({
  cards: z.array(legacyStudyCardSchema),
})

const deckRowSchema = z.array(z.object({ data: z.unknown().optional() }))

function getSecret(env?: DigestWorkerEnv): string {
  return (
    env?.DIGEST_UNSUBSCRIBE_SECRET ||
    env?.SUPABASE_SERVICE_ROLE_KEY ||
    'jolito-digest-default-secret'
  )
}

function getBaseUrl(env?: DigestWorkerEnv): string {
  return env?.DIGEST_BASE_URL || 'https://joli.to'
}

function formatMonthYear(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatFilenameDate(timestamp: number): string {
  const d = new Date(timestamp)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function base64Encode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64')
}

/**
 * Handles unsubscribe requests. Intentionally supports both GET (browser link click)
 * and POST (RFC 8058 List-Unsubscribe=One-Click automated mail client unsubscription).
 */
export async function handleUnsubscribeRequest(
  request: Request,
  env?: DigestWorkerEnv,
): Promise<Response> {
  const url = new URL(request.url)
  const uid = url.searchParams.get('uid')
  const token = url.searchParams.get('token')

  if (!uid || !token) {
    return new Response('Missing required parameters (uid, token).', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const secret = getSecret(env)
  const isValid = await verifyUnsubscribeToken(uid, token, secret)

  if (!isValid) {
    return new Response('Invalid or expired unsubscribe link.', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      '[Digest Unsubscribe] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment',
    )
    return new Response('Server configuration error. Please try again later.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  try {
    const dbRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/rpc/unsubscribe_monthly_digest`,
      {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_user_id: uid }),
      },
    )
    if (!dbRes.ok) {
      console.error(
        `[Digest Unsubscribe] Database RPC failed with status ${dbRes.status}`,
      )
      return new Response(
        'Unable to process unsubscribe request. Please try again later.',
        {
          status: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        },
      )
    }
  } catch (err) {
    console.error('[Digest Unsubscribe] Database RPC failed:', err)
    return new Response(
      'Unable to process unsubscribe request. Please try again later.',
      {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      },
    )
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribed — Jolito</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 40px 16px; display: flex; justify-content: center; }
    .card { background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 480px; width: 100%; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: center; }
    h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; }
    p { font-size: 15px; color: #475569; line-height: 1.5; margin: 0 0 24px 0; }
    .badge { display: inline-block; background: #fdf2f8; color: #b30060; border: 1px solid #fbcfe8; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
    .btn { display: inline-block; background: #b30060; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Unsubscribed</div>
    <h1>Unsubscribed from Jolito Monthly Emails</h1>
    <p>You will no longer receive monthly deck backup or progress emails. Your deck remains safe and synchronized across your devices. You can re-enable this anytime in Sync &amp; Account in the app.</p>
    <a href="${getBaseUrl(env)}" class="btn">Return to Jolito</a>
  </div>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function handleDigestScheduled(
  env?: DigestWorkerEnv,
  nowTimestamp: number = Date.now(),
): Promise<{
  processed: number
  delivered: number
  paused: number
  failures: number
}> {
  if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) {
    console.log(
      '[Digest Scheduled] Skipped: Supabase credentials not configured',
    )
    return { processed: 0, delivered: 0, paused: 0, failures: 0 }
  }

  const claimRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/rpc/claim_monthly_digests`,
    {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_limit: 50 }),
      signal: AbortSignal.timeout(10_000),
    },
  )

  if (!claimRes.ok) {
    throw new Error(`claim_monthly_digests failed (HTTP ${claimRes.status})`)
  }

  const rawClaims: unknown = await claimRes.json()
  const claims = z.array(claimSchema).parse(rawClaims)

  let deliveredCount = 0
  let pausedCount = 0
  let failureCount = 0

  const secret = getSecret(env)
  const baseUrl = getBaseUrl(env)
  const monthLabel = formatMonthYear(nowTimestamp)
  const fileDate = formatFilenameDate(nowTimestamp)

  for (const claim of claims) {
    let deckData: unknown = null
    let deckFetchSuccess = false
    try {
      const deckRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/decks?user_id=eq.${claim.user_id}&select=data`,
        {
          method: 'GET',
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10_000),
        },
      )
      if (deckRes.ok) {
        const rawJson: unknown = await deckRes.json()
        const parsedRows = deckRowSchema.safeParse(rawJson)
        if (parsedRows.success) {
          deckFetchSuccess = true
          if (parsedRows.data.length > 0) {
            deckData = parsedRows.data[0]?.data
          }
        }
      } else {
        console.error(
          `[Digest Dispatch] Deck fetch failed with status ${deckRes.status} for user ${claim.user_id}`,
        )
      }
    } catch (err) {
      console.error('[Digest Dispatch] Deck fetch error:', err)
    }

    if (!deckFetchSuccess) {
      failureCount++
      try {
        await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/finish_monthly_digest`, {
          method: 'POST',
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_user_id: claim.user_id,
            p_lease_id: claim.lease_id,
            p_delivered: false,
            p_new_lifetime_reviews: claim.last_lifetime_reviews,
            p_auto_paused: false,
            p_permanent_failure: false,
          }),
          signal: AbortSignal.timeout(10_000),
        })
      } catch (err) {
        console.error(
          '[Digest Dispatch] Failed to report deck fetch error to finish RPC:',
          err,
        )
      }
      continue
    }

    let cards: StudyCard[] = []
    if (deckData !== null && deckData !== undefined) {
      const parsedSync = deckSyncPayloadSchema.safeParse(deckData)
      if (parsedSync.success) {
        cards = parsedSync.data.cards
      } else {
        const fallbackParsed = rawDeckSchema.safeParse(deckData)
        if (fallbackParsed.success) {
          cards = fallbackParsed.data.cards
        } else {
          console.error(
            `[Digest Dispatch] Schema validation failed for user ${claim.user_id} deck data`,
          )
          failureCount++
          try {
            await fetch(
              `${env.SUPABASE_URL}/rest/v1/rpc/finish_monthly_digest`,
              {
                method: 'POST',
                headers: {
                  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  p_user_id: claim.user_id,
                  p_lease_id: claim.lease_id,
                  p_delivered: false,
                  p_new_lifetime_reviews: claim.last_lifetime_reviews,
                  p_auto_paused: false,
                  p_permanent_failure: false,
                }),
                signal: AbortSignal.timeout(10_000),
              },
            )
          } catch (err) {
            console.error(
              '[Digest Dispatch] Failed to report schema validation failure to finish RPC:',
              err,
            )
          }
          continue
        }
      }
    }

    const stats = computeDeckDigestStats(
      cards,
      nowTimestamp,
      claim.last_lifetime_reviews,
    )
    const token = await createUnsubscribeToken(claim.user_id, secret)
    const unsubscribeUrl = `${baseUrl}/api/digest/unsubscribe?uid=${claim.user_id}&token=${token}`

    const isAutoPaused = stats.isInactive
    const emailData = isAutoPaused
      ? formatPausedNoticeEmail(stats.totalCards, monthLabel, unsubscribeUrl)
      : formatDigestEmail(stats, monthLabel, unsubscribeUrl)

    // Base64 encode canonical deckBackupEnvelopeSchema JSON backup
    const backupEnvelope = {
      version: 4,
      app: 'jolito',
      exportedAt: new Date(nowTimestamp).toISOString(),
      cards,
    }
    const backupJsonString = JSON.stringify(backupEnvelope, null, 2)
    const base64Attachment = base64Encode(backupJsonString)

    let sendSuccess = false
    let isPermanentFailure = false

    if (env.RESEND_API_KEY) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Jolito <a@joli.to>',
            to: claim.email,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text,
            headers: {
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
            attachments: [
              {
                filename: `jolito-backup-${fileDate}.json`,
                content: base64Attachment,
              },
            ],
          }),
          signal: AbortSignal.timeout(15_000),
        })

        if (resendRes.ok) {
          sendSuccess = true
          if (isAutoPaused) {
            pausedCount++
          } else {
            deliveredCount++
          }
        } else {
          failureCount++
          if (
            resendRes.status >= 400 &&
            resendRes.status < 500 &&
            resendRes.status !== 429 &&
            resendRes.status !== 408
          ) {
            isPermanentFailure = true
          }
          console.error(
            `[Digest Dispatch] Resend API failed with status ${resendRes.status}`,
          )
        }
      } catch (err) {
        failureCount++
        console.error('[Digest Dispatch] Delivery attempt error:', err)
      }
    } else {
      console.log(
        '[Digest Dispatch] Simulated dispatch (no RESEND_API_KEY configured):',
        {
          to: claim.email,
          subject: emailData.subject,
          isAutoPaused,
        },
      )
      sendSuccess = true
      if (isAutoPaused) pausedCount++
      else deliveredCount++
    }

    try {
      const finishRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/rpc/finish_monthly_digest`,
        {
          method: 'POST',
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_user_id: claim.user_id,
            p_lease_id: claim.lease_id,
            p_delivered: sendSuccess,
            p_new_lifetime_reviews: stats.currentLifetimeReviews,
            p_auto_paused: isAutoPaused,
            p_permanent_failure: isPermanentFailure,
          }),
          signal: AbortSignal.timeout(10_000),
        },
      )
      if (!finishRes.ok) {
        failureCount++
        console.error(
          `[Digest Dispatch] Finish RPC returned status ${finishRes.status} for user ${claim.user_id}`,
        )
      }
    } catch (err) {
      failureCount++
      console.error('[Digest Dispatch] Finish RPC recording failed:', err)
    }
  }

  return {
    processed: claims.length,
    delivered: deliveredCount,
    paused: pausedCount,
    failures: failureCount,
  }
}
