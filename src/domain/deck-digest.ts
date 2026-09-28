import type { StudyCard } from './card'

export interface TrickyWord {
  prompt: string
  answer: string
  lapses: number
}

export interface DeckDigestStats {
  cardsAdded: number
  cardsGraduated: number
  totalReviewsThisPeriod: number
  currentLifetimeReviews: number
  totalCards: number
  matureCards: number
  wordsToWatchOutFor: TrickyWord[]
  isInactive: boolean
}

const INACTIVITY_WINDOW_MS = 45 * 24 * 60 * 60 * 1000
const PERIOD_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const MATURE_INTERVAL_DAYS = 21

export function computeDeckDigestStats(
  cards: StudyCard[],
  nowTimestamp: number,
  previousLifetimeReviews = 0,
): DeckDigestStats {
  const periodStart = nowTimestamp - PERIOD_WINDOW_MS
  let cardsAdded = 0
  let cardsGraduated = 0
  let currentLifetimeReviews = 0
  let matureCards = 0
  let hasRecentReview = false
  let hasRecentAddition = false

  const candidatesForWatchlist: Array<{
    prompt: string
    answer: string
    lapses: number
    stability: number
  }> = []

  for (const card of cards) {
    const { schedule, createdAt } = card
    const lastReviewedAt = schedule.lastReviewedAt ?? 0

    if (createdAt >= periodStart) {
      cardsAdded++
    }

    if (createdAt >= nowTimestamp - INACTIVITY_WINDOW_MS) {
      hasRecentAddition = true
    }

    if (lastReviewedAt >= nowTimestamp - INACTIVITY_WINDOW_MS) {
      hasRecentReview = true
    }

    if (schedule.intervalDays >= MATURE_INTERVAL_DAYS) {
      matureCards++
      if (schedule.state === 'review' && lastReviewedAt >= periodStart) {
        cardsGraduated++
      }
    }

    currentLifetimeReviews += schedule.reviews

    if (schedule.lapses > 0) {
      candidatesForWatchlist.push({
        prompt: card.prompt,
        answer: card.answer,
        lapses: schedule.lapses,
        stability: schedule.stability ?? 1,
      })
    }
  }

  // Sort watchlist by lapses desc, then stability asc
  candidatesForWatchlist.sort((a, b) => {
    if (b.lapses !== a.lapses) return b.lapses - a.lapses
    return a.stability - b.stability
  })

  const wordsToWatchOutFor: TrickyWord[] = candidatesForWatchlist
    .slice(0, 4)
    .map(({ prompt, answer, lapses }) => ({ prompt, answer, lapses }))

  const totalReviewsThisPeriod = Math.max(
    0,
    currentLifetimeReviews - previousLifetimeReviews,
  )

  const isInactive = !hasRecentReview && !hasRecentAddition

  return {
    cardsAdded,
    cardsGraduated,
    totalReviewsThisPeriod,
    currentLifetimeReviews,
    totalCards: cards.length,
    matureCards,
    wordsToWatchOutFor,
    isInactive,
  }
}

export async function createUnsubscribeToken(
  userId: string,
  secret: string,
  subtleCrypto: SubtleCrypto = crypto.subtle,
): Promise<string> {
  const enc = new TextEncoder()
  const key = await subtleCrypto.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await subtleCrypto.sign('HMAC', key, enc.encode(userId))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyUnsubscribeToken(
  userId: string,
  token: string,
  secret: string,
  subtleCrypto: SubtleCrypto = crypto.subtle,
): Promise<boolean> {
  if (!token || typeof token !== 'string') return false
  const expectedToken = await createUnsubscribeToken(
    userId,
    secret,
    subtleCrypto,
  )
  if (token.length !== expectedToken.length) return false
  let mismatch = 0
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i)
  }
  return mismatch === 0
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatDigestEmail(
  stats: DeckDigestStats,
  monthLabel: string,
  unsubscribeUrl: string,
): { subject: string; html: string; text: string } {
  const subject = `[Jolito] Progress & Backup - ${monthLabel}`

  const watchlistHtml =
    stats.wordsToWatchOutFor.length > 0
      ? `
      <div style="margin-top: 28px;">
        <div class="subtext" style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #5f6e66; margin-bottom: 10px;">Words to watch out for</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
          ${stats.wordsToWatchOutFor
            .map(
              (w) => `
            <tr>
              <td class="watchlist-item" style="padding: 9px 0; font-size: 14px; font-weight: 500; color: #121815; border-bottom: 1px solid #ede8df;">${escapeHtml(w.prompt)}</td>
              <td class="watchlist-sub" style="padding: 9px 12px; font-size: 14px; color: #5f6e66; border-bottom: 1px solid #ede8df;">${escapeHtml(w.answer)}</td>
              <td class="watchlist-sub" style="padding: 9px 0; font-size: 12px; color: #5f6e66; text-align: right; border-bottom: 1px solid #ede8df; white-space: nowrap;">${w.lapses} ${w.lapses === 1 ? 'lapse' : 'lapses'}</td>
            </tr>
          `,
            )
            .join('')}
        </table>
      </div>`
      : ''

  const watchlistText =
    stats.wordsToWatchOutFor.length > 0
      ? `\nWords to watch out for:\n` +
        stats.wordsToWatchOutFor
          .map((w) => `• ${w.prompt} (${w.answer}) — ${w.lapses} lapses`)
          .join('\n')
      : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(subject)}</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    @media only screen and (max-width: 480px) {
      .email-card-content {
        padding: 24px 20px !important;
      }
    }
    @media (prefers-color-scheme: dark) {
      body, .email-body-bg {
        background-color: #0d1210 !important;
        color: #fdf5f8 !important;
      }
      .email-card {
        background-color: #161e1a !important;
        border-color: #2b3832 !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
      }
      .brand-title, .title-text, .metric-value, .highlight-text {
        color: #fdf5f8 !important;
      }
      .subtext, .metric-label, .explainer-text, .footer-note {
        color: #8d9c94 !important;
      }
      .body-paragraph {
        color: #b7c4bd !important;
      }
      .divider-line {
        background-color: #2b3832 !important;
      }
      .watchlist-item {
        color: #fdf5f8 !important;
        border-bottom-color: #2b3832 !important;
      }
      .watchlist-sub {
        color: #8d9c94 !important;
        border-bottom-color: #2b3832 !important;
      }
      .unsubscribe-link {
        color: #8d9c94 !important;
      }
    }
  </style>
</head>
<body class="email-body-bg" style="margin: 0; padding: 40px 16px; background-color: #fdf5f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #121815;">
  <div style="display: none; font-size: 1px; color: #fdf5f8; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${escapeHtml(monthLabel)} progress snapshot and attached offline deck backup.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="email-card" style="max-width: 520px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2ddd3; box-shadow: 0 1px 4px rgba(18, 24, 21, 0.04);">
    <tr>
      <td class="email-card-content" style="padding: 36px 36px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 32px;">
          <tr>
            <td style="vertical-align: middle;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <img src="https://joli.to/favicon-96x96.png" width="26" height="26" alt="" role="presentation" style="display: block; width: 26px; height: 26px; border-radius: 6px;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <span class="brand-title" style="font-size: 17px; font-weight: 600; color: #121815; letter-spacing: -0.01em;">Jolito</span>
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: middle; text-align: right;">
              <a href="${escapeHtml(unsubscribeUrl)}" class="unsubscribe-link" style="font-size: 12px; color: #5f6e66; text-decoration: underline;">Unsubscribe</a>
            </td>
          </tr>
        </table>

        <h1 class="title-text" style="margin: 0 0 4px; font-size: 22px; font-weight: 600; color: #121815; letter-spacing: -0.02em; line-height: 1.25;">Progress &amp; backup</h1>
        <p class="subtext" style="margin: 0 0 28px; font-size: 14px; color: #5f6e66;">${escapeHtml(monthLabel)}</p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 24px;">
          <tr>
            <td style="width: 33%; vertical-align: top;">
              <div class="metric-value" style="font-size: 26px; font-weight: 600; color: #121815; letter-spacing: -0.02em; line-height: 1;">+${stats.cardsAdded}</div>
              <div class="metric-label" style="font-size: 13px; color: #5f6e66; margin-top: 6px;">Cards added</div>
            </td>
            <td style="width: 33%; vertical-align: top;">
              <div class="metric-value" style="font-size: 26px; font-weight: 600; color: #121815; letter-spacing: -0.02em; line-height: 1;">${stats.totalReviewsThisPeriod}</div>
              <div class="metric-label" style="font-size: 13px; color: #5f6e66; margin-top: 6px;">Reviews</div>
            </td>
            <td style="width: 33%; vertical-align: top;">
              <div class="metric-value" style="font-size: 26px; font-weight: 600; color: #121815; letter-spacing: -0.02em; line-height: 1;">${stats.cardsGraduated}</div>
              <div class="metric-label" style="font-size: 13px; color: #5f6e66; margin-top: 6px;">Graduated</div>
            </td>
          </tr>
        </table>

        <p class="body-paragraph" style="margin: 0 0 28px; font-size: 14px; color: #3b4740; line-height: 1.5;">
          Your deck has <strong class="highlight-text" style="font-weight: 600; color: #121815;">${stats.totalCards} cards</strong> (${stats.matureCards} in long-term memory).
        </p>

        ${watchlistHtml}

        <div class="divider-line" style="height: 1px; background-color: #ede8df; margin: 32px 0 20px;"></div>

        <p class="explainer-text" style="margin: 0 0 16px; font-size: 13px; color: #5f6e66; line-height: 1.5;">
          Your deck is attached as an offline JSON backup. Re-import anytime in <strong class="highlight-text" style="font-weight: 500; color: #3b4740;">Sync &amp; Account</strong>.
        </p>

        <p class="footer-note" style="margin: 0; font-size: 12px; color: #5f6e66; line-height: 1.5;">
          You're receiving this monthly backup because you have sync enabled. You can <a href="${escapeHtml(unsubscribeUrl)}" class="unsubscribe-link" style="color: #5f6e66; text-decoration: underline;">unsubscribe</a> anytime.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `Jolito — Progress & Backup (${monthLabel})`,
    `==========================================`,
    ``,
    `• +${stats.cardsAdded} cards added`,
    `• ${stats.totalReviewsThisPeriod} reviews completed`,
    `• ${stats.cardsGraduated} cards graduated to long-term memory`,
    ``,
    `Total deck: ${stats.totalCards} cards (${stats.matureCards} mature)`,
    watchlistText,
    ``,
    `Offline backup attached as JSON. Re-import anytime in Sync & Account.`,
    ``,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n')

  return { subject, html, text }
}

export function formatPausedNoticeEmail(
  totalCards: number,
  monthLabel: string,
  unsubscribeUrl: string,
): { subject: string; html: string; text: string } {
  const subject = `[Jolito] Progress & Backup (paused) - ${monthLabel}`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(subject)}</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    @media only screen and (max-width: 480px) {
      .email-card-content {
        padding: 24px 20px !important;
      }
    }
    @media (prefers-color-scheme: dark) {
      body, .email-body-bg {
        background-color: #0d1210 !important;
        color: #fdf5f8 !important;
      }
      .email-card {
        background-color: #161e1a !important;
        border-color: #2b3832 !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
      }
      .brand-title, .title-text {
        color: #fdf5f8 !important;
      }
      .subtext, .explainer-text, .footer-note {
        color: #8d9c94 !important;
      }
      .body-paragraph {
        color: #b7c4bd !important;
      }
      .divider-line {
        background-color: #2b3832 !important;
      }
      .unsubscribe-link {
        color: #8d9c94 !important;
      }
    }
  </style>
</head>
<body class="email-body-bg" style="margin: 0; padding: 40px 16px; background-color: #fdf5f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #121815;">
  <div style="display: none; font-size: 1px; color: #fdf5f8; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Monthly progress emails are paused while you're away. Offline deck backup attached.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="email-card" style="max-width: 520px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2ddd3; box-shadow: 0 1px 4px rgba(18, 24, 21, 0.04);">
    <tr>
      <td class="email-card-content" style="padding: 36px 36px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 32px;">
          <tr>
            <td style="vertical-align: middle;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <img src="https://joli.to/favicon-96x96.png" width="26" height="26" alt="" role="presentation" style="display: block; width: 26px; height: 26px; border-radius: 6px;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <span class="brand-title" style="font-size: 17px; font-weight: 600; color: #121815; letter-spacing: -0.01em;">Jolito</span>
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: middle; text-align: right;">
              <a href="${escapeHtml(unsubscribeUrl)}" class="unsubscribe-link" style="font-size: 12px; color: #5f6e66; text-decoration: underline;">Unsubscribe</a>
            </td>
          </tr>
        </table>

        <h1 class="title-text" style="margin: 0 0 4px; font-size: 22px; font-weight: 600; color: #121815; letter-spacing: -0.02em; line-height: 1.25;">Digests paused</h1>
        <p class="subtext" style="margin: 0 0 24px; font-size: 14px; color: #5f6e66;">${escapeHtml(monthLabel)}</p>

        <p class="body-paragraph" style="margin: 0 0 20px; font-size: 14px; color: #3b4740; line-height: 1.6;">
          You haven't practiced recently, so we paused monthly emails to keep your inbox clean.
        </p>

        <div class="divider-line" style="height: 1px; background-color: #ede8df; margin: 28px 0 20px;"></div>

        <p class="explainer-text" style="margin: 0 0 8px; font-size: 13px; color: #5f6e66; line-height: 1.5;">
          Your deck (${totalCards} cards) is attached as an offline JSON backup.
        </p>
        <p class="explainer-text" style="margin: 0 0 16px; font-size: 13px; color: #5f6e66; line-height: 1.5;">
          Digests will resume automatically when you practice again.
        </p>

        <p class="footer-note" style="margin: 0; font-size: 12px; color: #5f6e66; line-height: 1.5;">
          You're receiving this notice because you have sync enabled. You can <a href="${escapeHtml(unsubscribeUrl)}" class="unsubscribe-link" style="color: #5f6e66; text-decoration: underline;">unsubscribe</a> anytime.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `Jolito — Digests paused (${monthLabel})`,
    `======================================`,
    ``,
    `You haven't practiced recently, so we paused monthly emails to keep your inbox clean.`,
    ``,
    `Offline backup attached as JSON (${totalCards} cards).`,
    ``,
    `Digests will resume automatically when you practice again.`,
    ``,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n')

  return { subject, html, text }
}
