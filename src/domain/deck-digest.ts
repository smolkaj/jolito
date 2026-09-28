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
  const subject = `Your Jolito Monthly Progress & Backup — ${monthLabel}`

  const watchlistHtml =
    stats.wordsToWatchOutFor.length > 0
      ? `
      <div style="margin-top: 24px;">
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 12px 0;">Words to watch out for</h3>
        <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
          ${stats.wordsToWatchOutFor
            .map(
              (w) => `
            <tr>
              <td style="padding: 10px 14px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${escapeHtml(w.prompt)}</td>
              <td style="padding: 10px 14px; color: #475569; border-bottom: 1px solid #e2e8f0;">${escapeHtml(w.answer)}</td>
              <td style="padding: 10px 14px; color: #e11d48; text-align: right; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${w.lapses} lapse${w.lapses === 1 ? '' : 's'}</td>
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
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; line-height: 1.5;">
  <div style="display:none;font-size:1px;color:#f8fafc;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    Your monthly Jolito learning progress summary and offline deck backup.
  </div>
  <div style="max-width: 580px; margin: 0 auto; font-size: 13px; color: #64748b; padding-bottom: 12px; text-align: center;">
    Your monthly Jolito deck backup & progress snapshot.
    <a href="${escapeHtml(unsubscribeUrl)}" style="color: #b30060; text-decoration: underline; margin-left: 4px;">Unsubscribe in 1 click</a>
  </div>
  <div style="background-color: #ffffff; max-width: 580px; margin: 0 auto; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background-color: #b30060; color: #ffffff; padding: 24px;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">Jolito Progress & Backup</h1>
      <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">${escapeHtml(monthLabel)}</p>
    </div>
    <div style="padding: 24px;">
      <div style="display: flex; gap: 12px; justify-content: space-between; margin-bottom: 24px; text-align: center;">
        <div style="flex: 1; background: #fdf2f8; border-radius: 8px; padding: 14px 8px; border: 1px solid #fbcfe8;">
          <div style="font-size: 24px; font-weight: 700; color: #b30060;">+${stats.cardsAdded}</div>
          <div style="font-size: 12px; color: #701a75; font-weight: 500; margin-top: 2px;">Cards Added</div>
        </div>
        <div style="flex: 1; background: #f0fdf4; border-radius: 8px; padding: 14px 8px; border: 1px solid #bbf7d0;">
          <div style="font-size: 24px; font-weight: 700; color: #15803d;">${stats.totalReviewsThisPeriod}</div>
          <div style="font-size: 12px; color: #14532d; font-weight: 500; margin-top: 2px;">Reviews Completed</div>
        </div>
        <div style="flex: 1; background: #eff6ff; border-radius: 8px; padding: 14px 8px; border: 1px solid #bfdbfe;">
          <div style="font-size: 24px; font-weight: 700; color: #1d4ed8;">${stats.cardsGraduated}</div>
          <div style="font-size: 12px; color: #1e3a8a; font-weight: 500; margin-top: 2px;">Graduated to Mature</div>
        </div>
      </div>

      <p style="font-size: 15px; color: #334155; margin: 0 0 16px 0;">
        Your deck currently has <strong>${stats.totalCards} cards</strong> (<strong>${stats.matureCards}</strong> in long-term memory).
      </p>

      ${watchlistHtml}

      <div style="margin-top: 28px; padding: 16px; background-color: #f1f5f9; border-radius: 8px; font-size: 13px; color: #475569; border: 1px solid #e2e8f0;">
        <strong>📦 Attached Backup:</strong>
        We've attached your complete deck as <code style="background: #e2e8f0; padding: 2px 4px; border-radius: 4px; font-size: 12px;">jolito-backup.json</code>. You can keep it for your personal archives or restore it directly in Jolito Settings anytime.
      </div>
    </div>
  </div>
</body>
</html>`

  const text = [
    `Your monthly Jolito deck backup & progress snapshot.`,
    `Unsubscribe in 1 click: ${unsubscribeUrl}`,
    ``,
    `Jolito Progress & Backup — ${monthLabel}`,
    `========================================`,
    ``,
    `Highlights:`,
    `• ${stats.cardsAdded} cards added this month`,
    `• ${stats.totalReviewsThisPeriod} reviews completed`,
    `• ${stats.cardsGraduated} cards graduated to long-term memory`,
    ``,
    `Total deck: ${stats.totalCards} cards (${stats.matureCards} mature)`,
    watchlistText,
    ``,
    `Your full deck backup is attached as a JSON file.`,
  ].join('\n')

  return { subject, html, text }
}

export function formatPausedNoticeEmail(
  totalCards: number,
  monthLabel: string,
  unsubscribeUrl: string,
): { subject: string; html: string; text: string } {
  const subject = `Your Jolito Monthly backup (Digests paused) — ${monthLabel}`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; line-height: 1.5;">
  <div style="max-width: 580px; margin: 0 auto; font-size: 13px; color: #64748b; padding-bottom: 12px; text-align: center;">
    Your monthly Jolito deck backup.
    <a href="${escapeHtml(unsubscribeUrl)}" style="color: #b30060; text-decoration: underline; margin-left: 4px;">Unsubscribe in 1 click</a>
  </div>
  <div style="background-color: #ffffff; max-width: 580px; margin: 0 auto; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background-color: #475569; color: #ffffff; padding: 20px 24px;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700;">Monthly Digests Paused</h1>
      <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">${escapeHtml(monthLabel)}</p>
    </div>
    <div style="padding: 24px;">
      <p style="font-size: 15px; color: #334155; margin-top: 0;">
        We noticed you haven't been practicing recently on Jolito. We hate inbox clutter as much as you do, so to keep your email clean, we've <strong>paused your monthly digests</strong>.
      </p>
      <p style="font-size: 14px; color: #475569;">
        Attached is your latest deck backup (${totalCards} cards) for your personal records.
      </p>
      <p style="font-size: 14px; color: #475569;">
        Whenever you're ready to learn again, simply practice a card in Jolito or re-enable digests in Settings.
      </p>
    </div>
  </div>
</body>
</html>`

  const text = [
    `Your monthly Jolito deck backup.`,
    `Unsubscribe in 1 click: ${unsubscribeUrl}`,
    ``,
    `Monthly Digests Paused — ${monthLabel}`,
    `========================================`,
    ``,
    `We noticed you haven't been practicing recently on Jolito. To keep your inbox clean, we've paused your monthly digests.`,
    ``,
    `Attached is your latest backup (${totalCards} cards) for your personal records.`,
    ``,
    `Whenever you're ready to learn again, practice a card in Jolito or re-enable digests in Settings.`,
  ].join('\n')

  return { subject, html, text }
}
