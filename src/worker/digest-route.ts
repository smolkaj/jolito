import { Buffer } from 'node:buffer'
import { z } from 'zod'
import {
  computeDeckDigestStats,
  createUnsubscribeToken,
  formatDigestEmail,
  formatDigestPeriodRange,
  formatPausedNoticeEmail,
  verifyUnsubscribeToken,
} from '../domain/deck-digest'
import {
  collectionVersion,
  legacyStudyCardSchema,
  type StudyCard,
} from '../domain/card'
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
  const url = env?.DIGEST_BASE_URL || 'https://joli.to'
  return url.replace(/\/+$/, '')
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
  <meta name="color-scheme" content="light dark">
  <title>Unsubscribed • Jolito</title>
  <style>
    :root {
      color-scheme: light dark;
      --papel: #fdf5f8;
      --card: #ffffff;
      --ink: #121815;
      --ink-soft: #3b4740;
      --line: #121815;
      --rosa: #e4007c;
      --shadow: 4px 4px 0 var(--line);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --papel: #0d1210;
        --card: #161e1a;
        --ink: #fdf5f8;
        --ink-soft: #b7c4bd;
        --line: #2b3832;
        --shadow: 4px 4px 0 #000000;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--papel);
      color: var(--ink);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      background: var(--card);
      border-radius: 20px;
      border: 2px solid var(--line);
      max-width: 440px;
      width: 100%;
      padding: 32px 28px;
      box-shadow: var(--shadow);
      text-align: center;
    }
    .brand-row {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
    }
    .brand-logo {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: block;
    }
    .brand-name {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--ink);
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--ink);
      margin-bottom: 12px;
    }
    p {
      font-size: 14.5px;
      color: var(--ink-soft);
      line-height: 1.55;
      margin-bottom: 24px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--rosa);
      color: #ffffff;
      border: 2px solid var(--line);
      box-shadow: 2px 2px 0 var(--line);
      padding: 10px 22px;
      border-radius: 9999px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      transition: transform 100ms ease;
    }
    .btn:hover {
      transform: translate(-1px, -1px);
      box-shadow: 3px 3px 0 var(--line);
    }
    .btn:active {
      transform: translate(1px, 1px);
      box-shadow: 1px 1px 0 var(--line);
    }
    .btn:focus-visible {
      outline: 2px solid var(--rosa);
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      .btn {
        transition: none;
      }
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="brand-row">
      <img src="https://joli.to/favicon-96x96.png" class="brand-logo" alt="" role="presentation">
      <span class="brand-name">Jolito</span>
    </div>
    <h1>You're unsubscribed</h1>
    <p>You will no longer receive monthly deck backup or progress emails. Your deck remains safe and synchronized across your devices. You can re-enable this anytime in Sync &amp; Account in the app.</p>
    <a href="${getBaseUrl(env)}" class="btn">Return to Jolito</a>
  </main>
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
  if (
    !env?.SUPABASE_URL ||
    !env?.SUPABASE_SERVICE_ROLE_KEY ||
    !env?.RESEND_API_KEY
  ) {
    console.error(
      '[Digest Scheduled] Skipped: Required credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY) not configured',
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
  const periodLabel = formatDigestPeriodRange(nowTimestamp)
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
      ? formatPausedNoticeEmail(stats.totalCards, periodLabel, unsubscribeUrl)
      : formatDigestEmail(stats, periodLabel, unsubscribeUrl)

    // Base64 encode canonical deckBackupEnvelopeSchema JSON backup
    const backupEnvelope = {
      version: collectionVersion,
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
      failureCount++
      console.error(
        `[Digest Dispatch] Failed: RESEND_API_KEY not configured for delivery to ${claim.email}`,
      )
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
