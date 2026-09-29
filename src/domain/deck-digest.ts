import type { StudyCard } from './card'
import { cardDifficultyLevel } from './scheduler'

export interface TrickyWord {
  prompt: string
  answer: string
  lapses: number
  difficulty?: number
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
    difficulty: number
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
      const diffLevel = cardDifficultyLevel(schedule)
      candidatesForWatchlist.push({
        prompt: card.prompt,
        answer: card.answer,
        lapses: schedule.lapses,
        stability: schedule.stability ?? 1,
        difficulty:
          diffLevel > 0 ? diffLevel : Math.min(3, Math.max(1, schedule.lapses)),
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
    .map(({ prompt, answer, lapses, difficulty }) => ({
      prompt,
      answer,
      lapses,
      difficulty,
    }))

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

export function renderChiliIconSvg(filled: boolean, size = 15): string {
  if (filled) {
    return `<svg viewBox="0 0 36 36" width="${size}" height="${size}" aria-hidden="true" style="display: inline-block; vertical-align: middle;"><path d="M4.042 27.916c4.89.551 9.458-1.625 13.471-5.946 4.812-5.182 5-13 5-14s11.31-3.056 11 5c-.43 11.196-7.43 20.946-19.917 21.916-5.982.465-9.679-.928-11.387-2.345-2.69-2.231-.751-4.916 1.833-4.625z" fill="#d32f2f"/><path d="M30.545 6.246c.204-1.644.079-3.754-.747-4.853-1.111-1.479-4.431-.765-3.569.113.96.979 2.455 2.254 2.401 4.151-.044-.01-.085-.022-.13-.032-3.856-.869-6.721 1.405-7.167 2.958-.782 2.722 4.065.568 4.68 1.762 1.82 3.53 3.903.155 4.403 1.28s4.097 4.303 4.097.636c0-3.01-1.192-4.903-3.968-6.015z" fill="#15803d"/></svg>`
  }
  return `<svg viewBox="0 0 36 36" width="${size}" height="${size}" aria-hidden="true" style="display: inline-block; vertical-align: middle;"><path d="M4.042 27.916c4.89.551 9.458-1.625 13.471-5.946 4.812-5.182 5-13 5-14s11.31-3.056 11 5c-.43 11.196-7.43 20.946-19.917 21.916-5.982.465-9.679-.928-11.387-2.345-2.69-2.231-.751-4.916 1.833-4.625z" fill="none" stroke="#8d9c94" stroke-width="2"/><path d="M30.545 6.246c.204-1.644.079-3.754-.747-4.853-1.111-1.479-4.431-.765-3.569.113.96.979 2.455 2.254 2.401 4.151-.044-.01-.085-.022-.13-.032-3.856-.869-6.721 1.405-7.167 2.958-.782 2.722 4.065.568 4.68 1.762 1.82 3.53 3.903.155 4.403 1.28s4.097 4.303 4.097.636c0-3.01-1.192-4.903-3.968-6.015z" fill="none" stroke="#8d9c94" stroke-width="2"/></svg>`
}

export function renderChiliMeterSvg(level: number, size = 14): string {
  const safeLevel = Math.max(0, Math.min(3, level))
  const chilies = [1, 2, 3]
    .map((idx) => renderChiliIconSvg(safeLevel >= idx, size))
    .join('')
  return `<span style="display: inline-flex; align-items: center; gap: 2px;" role="img" aria-label="Difficulty: ${safeLevel} of 3 chilies" title="Difficulty: ${safeLevel} of 3 chilies">${chilies}</span>`
}

export function renderMasteryBubblesSvg(
  level: number,
  width = 38,
  height = 12,
): string {
  const safeLevel = Math.max(0, Math.min(3, level))
  const c1 =
    safeLevel >= 1
      ? 'fill="#15803d" stroke="#15803d"'
      : 'fill="none" stroke="#8d9c94"'
  const c2 =
    safeLevel >= 2
      ? 'fill="#15803d" stroke="#15803d"'
      : 'fill="none" stroke="#8d9c94"'
  const c3 =
    safeLevel >= 3
      ? 'fill="#15803d" stroke="#15803d"'
      : 'fill="none" stroke="#8d9c94"'
  return `<svg viewBox="0 0 42 13" width="${width}" height="${height}" aria-hidden="true" style="display: inline-block; vertical-align: middle;"><circle cx="7" cy="6.5" r="4.25" ${c1} stroke-width="1.3"/><circle cx="21" cy="6.5" r="4.25" ${c2} stroke-width="1.3"/><circle cx="35" cy="6.5" r="4.25" ${c3} stroke-width="1.3"/></svg>`
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
        <div style="margin-bottom: 10px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align: middle; padding-right: 7px;">
                ${renderChiliIconSvg(true, 17)}
              </td>
              <td style="vertical-align: middle;">
                <span class="section-title" style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #121815;">Needs attention</span>
              </td>
            </tr>
          </table>
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="watchlist-card" style="width: 100%; border-collapse: separate; border-spacing: 0; background-color: #ffffff; border: 2px solid #121815; border-radius: 12px; box-shadow: 3px 3px 0 #121815; overflow: hidden;">
          ${stats.wordsToWatchOutFor
            .map(
              (w, i) => `
            <tr>
              <td class="watchlist-item" style="padding: 11px 14px; font-size: 15px; font-weight: 700; color: #121815; ${i < stats.wordsToWatchOutFor.length - 1 ? 'border-bottom: 1.5px solid #ede8df;' : ''}">
                ${escapeHtml(w.prompt)}
              </td>
              <td class="watchlist-sub" style="padding: 11px 8px; font-size: 13.5px; color: #5f6e66; ${i < stats.wordsToWatchOutFor.length - 1 ? 'border-bottom: 1.5px solid #ede8df;' : ''}">
                ${escapeHtml(w.answer)}
              </td>
              <td class="watchlist-indicator" style="padding: 11px 14px; text-align: right; white-space: nowrap; ${i < stats.wordsToWatchOutFor.length - 1 ? 'border-bottom: 1.5px solid #ede8df;' : ''}">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right">
                  <tr>
                    <td style="vertical-align: middle; padding-right: 8px;">
                      ${renderChiliMeterSvg(w.difficulty ?? 2, 13)}
                    </td>
                    <td style="vertical-align: middle;">
                      <span class="lapse-pill" style="display: inline-block; padding: 2px 7px; font-size: 11px; font-weight: 700; background-color: #fef2f2; color: #991b1b; border: 1.5px solid #121815; border-radius: 9999px;">
                        ${w.lapses} ${w.lapses === 1 ? 'lapse' : 'lapses'}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `,
            )
            .join('')}
        </table>
      </div>`
      : ''

  const watchlistText =
    stats.wordsToWatchOutFor.length > 0
      ? `\nNeeds attention (spicy cards):\n` +
        stats.wordsToWatchOutFor
          .map(
            (w) =>
              `• ${w.prompt} (${w.answer}) — ${w.difficulty ?? 2}/3 chilies, ${w.lapses} ${w.lapses === 1 ? 'lapse' : 'lapses'}`,
          )
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
        padding: 24px 18px !important;
      }
      .metric-card td {
        padding: 10px 6px 8px !important;
      }
      .metric-value {
        font-size: 20px !important;
      }
      .metric-label {
        font-size: 10px !important;
      }
      .watchlist-item {
        font-size: 14px !important;
        padding: 10px 10px !important;
      }
      .watchlist-sub {
        font-size: 12.5px !important;
        padding: 10px 6px !important;
      }
      .watchlist-indicator {
        padding: 10px 10px !important;
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
        box-shadow: 4px 4px 0 #000000 !important;
      }
      .brand-title, .title-text, .section-title, .highlight-title {
        color: #fdf5f8 !important;
      }
      .subtext, .explainer-text, .footer-note {
        color: #8d9c94 !important;
      }
      .body-paragraph, .deck-summary {
        color: #b7c4bd !important;
      }
      .highlight-text {
        color: #fdf5f8 !important;
      }
      .metric-card-rosa {
        background-color: #24141f !important;
        border-color: #422037 !important;
        box-shadow: 3px 3px 0 #000000 !important;
      }
      .metric-card-rosa .metric-value {
        color: #f472b6 !important;
      }
      .metric-card-rosa .metric-label {
        color: #f9a8d4 !important;
      }
      .metric-card-paper {
        background-color: #1a221e !important;
        border-color: #2b3832 !important;
        box-shadow: 3px 3px 0 #000000 !important;
      }
      .metric-card-paper .metric-value {
        color: #fdf5f8 !important;
      }
      .metric-card-paper .metric-label {
        color: #8d9c94 !important;
      }
      .metric-card-verde {
        background-color: #12281a !important;
        border-color: #1b4d2e !important;
        box-shadow: 3px 3px 0 #000000 !important;
      }
      .metric-card-verde .metric-value {
        color: #4ade80 !important;
      }
      .metric-card-verde .metric-label {
        color: #86efac !important;
      }
      .watchlist-card {
        background-color: #161e1a !important;
        border-color: #2b3832 !important;
        box-shadow: 3px 3px 0 #000000 !important;
      }
      .watchlist-item {
        color: #fdf5f8 !important;
        border-bottom-color: #2b3832 !important;
      }
      .watchlist-sub {
        color: #8d9c94 !important;
        border-bottom-color: #2b3832 !important;
      }
      .watchlist-indicator {
        border-bottom-color: #2b3832 !important;
      }
      .lapse-pill {
        background-color: #3b1212 !important;
        color: #fca5a5 !important;
        border-color: #2b3832 !important;
      }
      .backup-callout {
        background-color: #1a221e !important;
        border-color: #2b3832 !important;
        box-shadow: 3px 3px 0 #000000 !important;
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
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="email-card" style="max-width: 520px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 2px solid #121815; box-shadow: 4px 4px 0 #121815;">
    <tr>
      <td class="email-card-content" style="padding: 32px 32px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 28px;">
          <tr>
            <td style="vertical-align: middle;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <img src="https://joli.to/favicon-96x96.png" width="28" height="28" alt="" role="presentation" style="display: block; width: 28px; height: 28px; border-radius: 7px; border: 1.5px solid #121815;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <span class="brand-title" style="font-size: 18px; font-weight: 800; color: #121815; letter-spacing: -0.02em;">Jolito</span>
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: middle; text-align: right;">
              <a href="${escapeHtml(unsubscribeUrl)}" class="unsubscribe-link" style="font-size: 12px; font-weight: 500; color: #5f6e66; text-decoration: underline;">Unsubscribe</a>
            </td>
          </tr>
        </table>

        <h1 class="title-text" style="margin: 0 0 4px; font-size: 24px; font-weight: 800; color: #121815; letter-spacing: -0.03em; line-height: 1.2;">Progress &amp; backup</h1>
        <p class="subtext" style="margin: 0 0 20px; font-size: 14px; font-weight: 500; color: #5f6e66;">${escapeHtml(monthLabel)}</p>

        <p class="body-paragraph" style="margin: 0 0 20px; font-size: 15px; color: #3b4740; line-height: 1.5;">
          Your deck backup is attached. Here is how your Mexican Spanish moved this month:
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 20px;">
          <tr>
            <td style="width: 32%; vertical-align: top;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="metric-card metric-card-rosa" style="width: 100%; background-color: #fdf0f7; border: 2px solid #121815; border-radius: 12px; box-shadow: 3px 3px 0 #121815;">
                <tr>
                  <td style="padding: 14px 10px 12px; text-align: center;">
                    <div class="metric-value" style="font-size: 24px; font-weight: 800; color: #e4007c; letter-spacing: -0.03em; line-height: 1;">+${stats.cardsAdded}</div>
                    <div class="metric-label" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #5f6e66; margin-top: 6px;">Cards added</div>
                  </td>
                </tr>
              </table>
            </td>
            <td style="width: 2%;"></td>
            <td style="width: 32%; vertical-align: top;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="metric-card metric-card-paper" style="width: 100%; background-color: #f5edf1; border: 2px solid #121815; border-radius: 12px; box-shadow: 3px 3px 0 #121815;">
                <tr>
                  <td style="padding: 14px 10px 12px; text-align: center;">
                    <div class="metric-value" style="font-size: 24px; font-weight: 800; color: #121815; letter-spacing: -0.03em; line-height: 1;">${stats.totalReviewsThisPeriod}</div>
                    <div class="metric-label" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #5f6e66; margin-top: 6px;">Reviews done</div>
                  </td>
                </tr>
              </table>
            </td>
            <td style="width: 2%;"></td>
            <td style="width: 32%; vertical-align: top;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="metric-card metric-card-verde" style="width: 100%; background-color: #f0fdf4; border: 2px solid #121815; border-radius: 12px; box-shadow: 3px 3px 0 #121815;">
                <tr>
                  <td style="padding: 12px 10px 10px; text-align: center;">
                    <div style="margin-bottom: 5px;">${renderMasteryBubblesSvg(3, 36, 11)}</div>
                    <div class="metric-value" style="font-size: 24px; font-weight: 800; color: #15803d; letter-spacing: -0.03em; line-height: 1;">${stats.cardsGraduated}</div>
                    <div class="metric-label" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #15803d; margin-top: 4px;">Graduated</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <p class="deck-summary" style="margin: 0 0 20px; font-size: 13.5px; color: #5f6e66; line-height: 1.5;">
          Total deck: <strong class="highlight-text" style="font-weight: 700; color: #121815;">${stats.totalCards} cards</strong> (${stats.matureCards} at 3 bubbles).
        </p>

        ${watchlistHtml}

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="backup-callout" style="width: 100%; margin-top: 24px; background-color: #fdf0f7; border: 2px solid #121815; border-radius: 12px; box-shadow: 3px 3px 0 #121815;">
          <tr>
            <td style="padding: 14px 16px;">
              <div class="highlight-title" style="font-size: 13px; font-weight: 800; color: #121815; margin-bottom: 2px; letter-spacing: -0.01em;">
                Offline backup attached
              </div>
              <div class="explainer-text" style="font-size: 12.5px; color: #5f6e66; line-height: 1.45;">
                Contains your complete deck (${stats.totalCards} cards). Restore anytime in <strong class="highlight-text" style="font-weight: 700; color: #121815;">Sync &amp; Account</strong>.
              </div>
            </td>
          </tr>
        </table>

        <p class="footer-note" style="margin: 24px 0 0; font-size: 12px; color: #5f6e66; line-height: 1.5; text-align: center;">
          Sent because sync is on. You can <a href="${escapeHtml(unsubscribeUrl)}" class="unsubscribe-link" style="color: #5f6e66; text-decoration: underline;">unsubscribe</a> anytime.
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
    `Your deck backup is attached. Here is how your Mexican Spanish moved this month:`,
    ``,
    `• +${stats.cardsAdded} cards added`,
    `• ${stats.totalReviewsThisPeriod} reviews completed`,
    `• ${stats.cardsGraduated} cards reached 3 bubbles (graduated)`,
    ``,
    `Total deck: ${stats.totalCards} cards (${stats.matureCards} at 3 bubbles).`,
    watchlistText,
    ``,
    `Offline deck backup attached (${stats.totalCards} cards). Restore anytime in Sync & Account.`,
    ``,
    `Unsubscribe: ${unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join('\n')

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
        padding: 24px 18px !important;
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
        box-shadow: 4px 4px 0 #000000 !important;
      }
      .brand-title, .title-text, .highlight-title {
        color: #fdf5f8 !important;
      }
      .subtext, .explainer-text, .footer-note {
        color: #8d9c94 !important;
      }
      .body-paragraph {
        color: #b7c4bd !important;
      }
      .backup-callout {
        background-color: #1a221e !important;
        border-color: #2b3832 !important;
        box-shadow: 3px 3px 0 #000000 !important;
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
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="email-card" style="max-width: 520px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 2px solid #121815; box-shadow: 4px 4px 0 #121815;">
    <tr>
      <td class="email-card-content" style="padding: 32px 32px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 28px;">
          <tr>
            <td style="vertical-align: middle;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <img src="https://joli.to/favicon-96x96.png" width="28" height="28" alt="" role="presentation" style="display: block; width: 28px; height: 28px; border-radius: 7px; border: 1.5px solid #121815;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <span class="brand-title" style="font-size: 18px; font-weight: 800; color: #121815; letter-spacing: -0.02em;">Jolito</span>
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: middle; text-align: right;">
              <a href="${escapeHtml(unsubscribeUrl)}" class="unsubscribe-link" style="font-size: 12px; font-weight: 500; color: #5f6e66; text-decoration: underline;">Unsubscribe</a>
            </td>
          </tr>
        </table>

        <h1 class="title-text" style="margin: 0 0 4px; font-size: 24px; font-weight: 800; color: #121815; letter-spacing: -0.03em; line-height: 1.2;">Digests paused</h1>
        <p class="subtext" style="margin: 0 0 20px; font-size: 14px; font-weight: 500; color: #5f6e66;">${escapeHtml(monthLabel)}</p>

        <p class="body-paragraph" style="margin: 0 0 20px; font-size: 15px; color: #3b4740; line-height: 1.5;">
          You haven't practiced recently, so we paused monthly emails to keep your inbox clean.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="backup-callout" style="width: 100%; margin-bottom: 20px; background-color: #fdf0f7; border: 2px solid #121815; border-radius: 12px; box-shadow: 3px 3px 0 #121815;">
          <tr>
            <td style="padding: 14px 16px;">
              <div class="highlight-title" style="font-size: 13px; font-weight: 800; color: #121815; margin-bottom: 2px;">
                Offline backup attached (${totalCards} cards)
              </div>
              <div class="explainer-text" style="font-size: 12.5px; color: #5f6e66; line-height: 1.45;">
                Your deck is attached as an offline JSON backup. Digests resume automatically when you practice.
              </div>
            </td>
          </tr>
        </table>

        <p class="footer-note" style="margin: 0; font-size: 12px; color: #5f6e66; line-height: 1.5; text-align: center;">
          Sent because sync is on. You can <a href="${escapeHtml(unsubscribeUrl)}" class="unsubscribe-link" style="color: #5f6e66; text-decoration: underline;">unsubscribe</a> anytime.
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
