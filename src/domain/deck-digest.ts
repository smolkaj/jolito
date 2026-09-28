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

  const isInactive = cards.length > 0 && !hasRecentReview

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
        <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #a1a1aa; margin-bottom: 10px;">Words to watch out for</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
          ${stats.wordsToWatchOutFor
            .map(
              (w) => `
            <tr>
              <td style="padding: 9px 0; font-size: 14px; font-weight: 500; color: #18181b; border-bottom: 1px solid #f4f4f5;">${escapeHtml(w.prompt)}</td>
              <td style="padding: 9px 12px; font-size: 14px; color: #71717a; border-bottom: 1px solid #f4f4f5;">${escapeHtml(w.answer)}</td>
              <td style="padding: 9px 0; font-size: 12px; color: #a1a1aa; text-align: right; border-bottom: 1px solid #f4f4f5; white-space: nowrap;">${w.lapses} ${w.lapses === 1 ? 'lapse' : 'lapses'}</td>
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
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 40px 16px; background-color: #f7f7f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #18181b;">
  <div style="display: none; font-size: 1px; color: #f7f7f8; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${escapeHtml(monthLabel)} progress snapshot and attached offline deck backup.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width: 520px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e4e4e7; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
    <tr>
      <td style="padding: 36px 36px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 32px;">
          <tr>
            <td style="vertical-align: middle;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <img src="https://joli.to/favicon-96x96.png" width="26" height="26" alt="Jolito" style="display: block; width: 26px; height: 26px; border-radius: 6px;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 17px; font-weight: 600; color: #18181b; letter-spacing: -0.01em;">Jolito</span>
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: middle; text-align: right;">
              <a href="${escapeHtml(unsubscribeUrl)}" style="font-size: 12px; color: #a1a1aa; text-decoration: underline;">Unsubscribe</a>
            </td>
          </tr>
        </table>

        <h1 style="margin: 0 0 4px; font-size: 22px; font-weight: 600; color: #18181b; letter-spacing: -0.02em; line-height: 1.25;">Progress &amp; backup</h1>
        <p style="margin: 0 0 28px; font-size: 14px; color: #71717a;">${escapeHtml(monthLabel)}</p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 24px;">
          <tr>
            <td style="width: 33%; vertical-align: top;">
              <div style="font-size: 26px; font-weight: 600; color: #18181b; letter-spacing: -0.02em; line-height: 1;">+${stats.cardsAdded}</div>
              <div style="font-size: 13px; color: #71717a; margin-top: 6px;">Cards added</div>
            </td>
            <td style="width: 33%; vertical-align: top;">
              <div style="font-size: 26px; font-weight: 600; color: #18181b; letter-spacing: -0.02em; line-height: 1;">${stats.totalReviewsThisPeriod}</div>
              <div style="font-size: 13px; color: #71717a; margin-top: 6px;">Reviews</div>
            </td>
            <td style="width: 33%; vertical-align: top;">
              <div style="font-size: 26px; font-weight: 600; color: #18181b; letter-spacing: -0.02em; line-height: 1;">${stats.cardsGraduated}</div>
              <div style="font-size: 13px; color: #71717a; margin-top: 6px;">Graduated</div>
            </td>
          </tr>
        </table>

        <p style="margin: 0 0 28px; font-size: 14px; color: #52525b; line-height: 1.5;">
          Your deck has <strong style="font-weight: 600; color: #18181b;">${stats.totalCards} cards</strong> (${stats.matureCards} in long-term memory).
        </p>

        ${watchlistHtml}

        <div style="height: 1px; background-color: #f4f4f5; margin: 32px 0 20px;"></div>

        <p style="margin: 0; font-size: 13px; color: #71717a; line-height: 1.5;">
          Your deck is attached as an offline JSON backup. Re-import anytime in <strong style="font-weight: 500; color: #3f3f46;">Sync &amp; Account</strong>.
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
    `+${stats.cardsAdded} cards added`,
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
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 40px 16px; background-color: #f7f7f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #18181b;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width: 520px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e4e4e7; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
    <tr>
      <td style="padding: 36px 36px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 32px;">
          <tr>
            <td style="vertical-align: middle;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <img src="https://joli.to/favicon-96x96.png" width="26" height="26" alt="Jolito" style="display: block; width: 26px; height: 26px; border-radius: 6px;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 17px; font-weight: 600; color: #18181b; letter-spacing: -0.01em;">Jolito</span>
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: middle; text-align: right;">
              <a href="${escapeHtml(unsubscribeUrl)}" style="font-size: 12px; color: #a1a1aa; text-decoration: underline;">Unsubscribe</a>
            </td>
          </tr>
        </table>

        <h1 style="margin: 0 0 4px; font-size: 22px; font-weight: 600; color: #18181b; letter-spacing: -0.02em; line-height: 1.25;">Digests paused</h1>
        <p style="margin: 0 0 24px; font-size: 14px; color: #71717a;">${escapeHtml(monthLabel)}</p>

        <p style="margin: 0 0 20px; font-size: 14px; color: #3f3f46; line-height: 1.6;">
          You haven't practiced recently, so we paused monthly emails to keep your inbox clean.
        </p>

        <div style="height: 1px; background-color: #f4f4f5; margin: 28px 0 20px;"></div>

        <p style="margin: 0 0 8px; font-size: 13px; color: #71717a; line-height: 1.5;">
          Your deck (${totalCards} cards) is attached as an offline JSON backup.
        </p>
        <p style="margin: 0; font-size: 13px; color: #a1a1aa; line-height: 1.5;">
          Digests will resume automatically when you practice again.
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
