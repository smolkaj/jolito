import type { StudyCard } from './card'
import { cardDifficultyLevel, cardMasteryLevel } from './scheduler'

export interface TrickyWord {
  prompt: string
  answer: string
  lapses: number
  difficulty?: number
}

export interface MasteredWord {
  prompt: string
  answer: string
  bubbles: number
  isGraduated: boolean
}

export interface DeckDigestStats {
  cardsAdded: number
  cardsGraduated: number
  totalReviewsThisPeriod: number
  currentLifetimeReviews: number
  totalCards: number
  wordsToWatchOutFor: TrickyWord[]
  topMasteredWords: MasteredWord[]
  isInactive: boolean
}

const INACTIVITY_WINDOW_MS = 45 * 24 * 60 * 60 * 1000
const PERIOD_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export function computeDeckDigestStats(
  cards: StudyCard[],
  nowTimestamp: number,
  previousLifetimeReviews = 0,
): DeckDigestStats {
  const periodStart = nowTimestamp - PERIOD_WINDOW_MS
  let cardsAdded = 0
  let cardsGraduated = 0
  let currentLifetimeReviews = 0
  let hasRecentReview = false
  let hasRecentAddition = false

  const candidatesForWatchlist: Array<{
    prompt: string
    answer: string
    lapses: number
    stability: number
    difficulty: number
  }> = []

  const candidatesForMastery: Array<{
    prompt: string
    answer: string
    bubbles: number
    isGraduated: boolean
    stability: number
    reviews: number
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

    currentLifetimeReviews += schedule.reviews

    if (lastReviewedAt >= periodStart) {
      const bubbles = cardMasteryLevel(schedule)
      if (bubbles === 3) {
        cardsGraduated++
      }
      if (bubbles >= 1) {
        candidatesForMastery.push({
          prompt: card.prompt,
          answer: card.answer,
          bubbles,
          isGraduated: bubbles === 3,
          stability: schedule.stability ?? 1,
          reviews: schedule.reviews,
        })
      }
    }

    if (schedule.lapses > 0 && lastReviewedAt >= periodStart) {
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

  // Sort mastery by bubbles desc, then stability desc, then reviews desc
  candidatesForMastery.sort((a, b) => {
    if (b.bubbles !== a.bubbles) return b.bubbles - a.bubbles
    if (b.stability !== a.stability) return b.stability - a.stability
    return b.reviews - a.reviews
  })

  const topMasteredWords: MasteredWord[] = candidatesForMastery
    .slice(0, 3)
    .map(({ prompt, answer, bubbles, isGraduated }) => ({
      prompt,
      answer,
      bubbles,
      isGraduated,
    }))

  // Sort watchlist by lapses desc, then stability asc
  candidatesForWatchlist.sort((a, b) => {
    if (b.lapses !== a.lapses) return b.lapses - a.lapses
    return a.stability - b.stability
  })

  const wordsToWatchOutFor: TrickyWord[] = candidatesForWatchlist
    .slice(0, 3)
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
    wordsToWatchOutFor,
    topMasteredWords,
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

export function formatDigestPeriodRange(
  endTimestamp: number,
  periodDays = 30,
): string {
  const endDate = new Date(endTimestamp)
  const startDate = new Date(endTimestamp - periodDays * 24 * 60 * 60 * 1000)
  const startMonth = startDate.toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  })
  const startDay = startDate.getUTCDate()
  const startYear = startDate.getUTCFullYear()
  const endMonth = endDate.toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  })
  const endDay = endDate.getUTCDate()
  const endYear = endDate.getUTCFullYear()

  if (startYear === endYear) {
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${endYear}`
  }
  return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`
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
  periodLabel: string,
  unsubscribeUrl: string,
): { subject: string; html: string; text: string } {
  const subject = `[Jolito] Progress Report - ${periodLabel}`

  const topMasteredWords = stats.topMasteredWords ?? []
  const wordsToWatchOutFor = stats.wordsToWatchOutFor ?? []

  const allGraduated =
    topMasteredWords.length > 0 && topMasteredWords.every((w) => w.isGraduated)
  const hasGraduatedInTop = topMasteredWords.some((w) => w.isGraduated)

  const masterySectionTitle = allGraduated ? 'Freshly mastered' : 'Top progress'
  const masterySectionStory = allGraduated
    ? topMasteredWords.length === 1
      ? 'This word crossed into long-term memory this month:'
      : 'These words crossed into long-term memory this month:'
    : hasGraduatedInTop
      ? 'Your strongest words and latest milestones this month:'
      : 'Your strongest words gaining momentum this month:'

  const masteredHtml =
    topMasteredWords.length > 0
      ? `
      <div style="margin-top: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 6px;">
          <tr>
            <td style="vertical-align: middle; padding-right: 7px;">
              ${renderMasteryBubblesSvg(3, 24, 8)}
            </td>
            <td style="vertical-align: middle;">
              <span class="section-title" style="font-size: 14px; font-weight: 750; color: #121815; letter-spacing: -0.01em;">${masterySectionTitle}</span>
            </td>
          </tr>
        </table>
        <p class="section-story" style="margin: 0 0 12px; font-size: 13.5px; color: #5f6e66; line-height: 1.45;">
          ${masterySectionStory}
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="mastery-card" style="width: 100%; border-collapse: separate; border-spacing: 0; background-color: #ffffff; border: 1px solid #e2ddd3; border-radius: 14px; overflow: hidden;">
          ${topMasteredWords
            .map(
              (w, i) => `
            <tr>
              <td class="watchlist-cell" style="padding: 12px 16px; vertical-align: middle; ${i < topMasteredWords.length - 1 ? 'border-bottom: 1px solid #e2ddd3;' : ''}">
                <div class="watchlist-item" style="font-size: 15px; font-weight: 700; color: #121815; line-height: 1.3; overflow-wrap: break-word;">${escapeHtml(w.prompt)}</div>
                <div class="watchlist-sub" style="font-size: 13px; color: #5f6e66; line-height: 1.3; margin-top: 2px; overflow-wrap: break-word;">${escapeHtml(w.answer)}</div>
              </td>
              <td class="watchlist-indicator" style="padding: 12px 16px; vertical-align: middle; text-align: right; white-space: nowrap; ${i < topMasteredWords.length - 1 ? 'border-bottom: 1px solid #e2ddd3;' : ''}">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right">
                  <tr>
                    <td style="vertical-align: middle; padding-right: 8px;">
                      ${renderMasteryBubblesSvg(w.bubbles, 34, 11)}
                    </td>
                    <td style="vertical-align: middle;">
                      <span class="mastered-pill" style="display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 700; background-color: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; border-radius: 9999px;">
                        ${w.bubbles === 3 ? 'Mastered' : `${w.bubbles} ${w.bubbles === 1 ? 'bubble' : 'bubbles'}`}
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

  const masteredText =
    topMasteredWords.length > 0
      ? `\n${masterySectionTitle}:\n${masterySectionStory}\n` +
        topMasteredWords
          .map(
            (w) =>
              `• ${w.prompt} (${w.answer}) — ${w.bubbles}/3 bubbles${w.bubbles === 3 ? ' (Mastered)' : ''}`,
          )
          .join('\n')
      : ''

  const watchlistHtml =
    wordsToWatchOutFor.length > 0
      ? `
      <div style="margin-top: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 6px;">
          <tr>
            <td style="vertical-align: middle; padding-right: 7px;">
              ${renderChiliIconSvg(true, 17)}
            </td>
            <td style="vertical-align: middle;">
              <span class="section-title" style="font-size: 14px; font-weight: 750; color: #121815; letter-spacing: -0.01em;">The spiciest words</span>
            </td>
          </tr>
        </table>
        <p class="section-story" style="margin: 0 0 12px; font-size: 13.5px; color: #5f6e66; line-height: 1.45;">
          A few words made you sweat this month. In Jolito, chilies track difficulty—here are the words with the most stumbles:
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="watchlist-card" style="width: 100%; border-collapse: separate; border-spacing: 0; background-color: #ffffff; border: 1px solid #e2ddd3; border-radius: 14px; overflow: hidden;">
          ${wordsToWatchOutFor
            .map(
              (w, i) => `
            <tr>
              <td class="watchlist-cell" style="padding: 12px 16px; vertical-align: middle; ${i < wordsToWatchOutFor.length - 1 ? 'border-bottom: 1px solid #e2ddd3;' : ''}">
                <div class="watchlist-item" style="font-size: 15px; font-weight: 700; color: #121815; line-height: 1.3; overflow-wrap: break-word;">${escapeHtml(w.prompt)}</div>
                <div class="watchlist-sub" style="font-size: 13px; color: #5f6e66; line-height: 1.3; margin-top: 2px; overflow-wrap: break-word;">${escapeHtml(w.answer)}</div>
              </td>
              <td class="watchlist-indicator" style="padding: 12px 16px; vertical-align: middle; text-align: right; white-space: nowrap; ${i < wordsToWatchOutFor.length - 1 ? 'border-bottom: 1px solid #e2ddd3;' : ''}">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right">
                  <tr>
                    <td style="vertical-align: middle; padding-right: 8px;">
                      ${renderChiliMeterSvg(w.difficulty ?? 2, 13)}
                    </td>
                    <td style="vertical-align: middle;">
                      <span class="stumble-pill" style="display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 700; background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 9999px;">
                        ${w.lapses} ${w.lapses === 1 ? 'stumble' : 'stumbles'}
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
    wordsToWatchOutFor.length > 0
      ? `\nThe spiciest words:\nA few words made you sweat this month. In Jolito, chilies track difficulty—here are the words with the most stumbles:\n` +
        wordsToWatchOutFor
          .map(
            (w) =>
              `• ${w.prompt} (${w.answer}) — ${w.difficulty ?? 2}/3 chilies, ${w.lapses} ${w.lapses === 1 ? 'stumble' : 'stumbles'}`,
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
      .email-card {
        padding: 28px 20px !important;
        border-radius: 14px !important;
      }
      .metric-card td {
        padding: 12px 6px 10px !important;
      }
      .metric-value {
        font-size: 20px !important;
      }
      .metric-label {
        font-size: 10px !important;
      }
      .watchlist-cell {
        padding: 10px 12px !important;
      }
      .watchlist-item {
        font-size: 14px !important;
      }
      .watchlist-sub {
        font-size: 12.5px !important;
      }
      .watchlist-indicator {
        padding: 10px 12px !important;
      }
    }
    @media (prefers-color-scheme: dark) {
      body, .email-body-bg {
        background-color: #0d1210 !important;
        color: #fdf5f8 !important;
      }
      .brand-wordmark, .email-title, .section-title, .highlight-title {
        color: #fdf5f8 !important;
      }
      .brand-logo-badge {
        background-color: #ffffff !important;
        border-color: #384640 !important;
      }
      .email-card {
        background-color: #161e1a !important;
        border-color: #2b3832 !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
      }
      .subtext, .explainer-text, .footer-text, .section-story, .mastery-note {
        color: #8d9c94 !important;
      }
      .email-paragraph {
        color: #b7c4bd !important;
      }
      .highlight-text {
        color: #fdf5f8 !important;
      }
      .metric-card {
        background-color: #1a221e !important;
        border-color: #2b3832 !important;
      }
      .metric-card .metric-neutral {
        color: #fdf5f8 !important;
      }
      .metric-card .metric-rosa {
        color: #f472b6 !important;
      }
      .metric-card .metric-verde {
        color: #4ade80 !important;
      }
      .metric-card .metric-label {
        color: #8d9c94 !important;
      }
      .mastery-card, .watchlist-card {
        background-color: #161e1a !important;
        border-color: #2b3832 !important;
      }
      .watchlist-item {
        color: #fdf5f8 !important;
      }
      .watchlist-sub {
        color: #8d9c94 !important;
      }
      .watchlist-cell,
      .watchlist-indicator {
        border-bottom-color: #2b3832 !important;
      }
      .mastered-pill {
        background-color: #12281a !important;
        color: #86efac !important;
        border-color: #1b4d2e !important;
      }
      .stumble-pill {
        background-color: #3b1212 !important;
        color: #fca5a5 !important;
        border-color: #4a1e1e !important;
      }
      .backup-callout {
        background-color: #1a221e !important;
        border-color: #2b3832 !important;
      }
      .footer-brand-link, .unsubscribe-link {
        color: #b7c4bd !important;
      }
    }
  </style>
</head>
<body class="email-body-bg" style="margin: 0; padding: 0; background-color: #fdf5f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #121815;">
  <div style="display: none; font-size: 1px; color: #fdf5f8; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Progress report for ${escapeHtml(periodLabel)} and offline deck backup.
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-body-bg" style="background-color: #fdf5f8; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Brand Header / Wordmark (Stylistically aligned with sign-in email) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; margin-bottom: 24px;">
          <tr>
            <td align="center" style="padding: 12px 0 0 0;">
              <a href="https://joli.to" target="_blank" style="text-decoration: none; display: inline-block;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align: middle; padding-right: 10px;">
                      <div class="brand-logo-badge" style="background-color: #ffffff; border: 1px solid #e2ddd3; border-radius: 8px; width: 32px; height: 32px; display: inline-block; box-shadow: 0 1px 3px rgba(18, 24, 21, 0.08); line-height: 0; font-size: 0; text-align: center; vertical-align: middle;">
                        <img src="https://joli.to/favicon-96x96.png" width="26" height="26" alt="" role="presentation" style="display: inline-block; width: 26px; height: 26px; margin-top: 2px; border: 0; outline: none;" />
                      </div>
                    </td>
                    <td style="vertical-align: middle;">
                      <span class="brand-wordmark" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.03em; color: #121815; text-decoration: none;">Jolito</span>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
        </table>

        <!-- Main Card Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-card" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2ddd3; border-radius: 18px; box-shadow: 0 4px 18px rgba(18, 24, 21, 0.05); overflow: hidden; padding: 36px 32px;">
          <tr>
            <td>
              <h1 class="email-title" style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 750; letter-spacing: -0.025em; color: #121815; line-height: 1.2;">Progress Report</h1>
              <div class="subtext" style="margin: 0 0 20px 0; font-size: 13.5px; font-weight: 500; color: #5f6e66;">${escapeHtml(periodLabel)}</div>

              <p class="email-paragraph" style="margin: 0 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #3b4740; line-height: 1.5;">
                Here is how your Mexican Spanish moved over the last 30 days:
              </p>

              <!-- Unified Stat Cards with Brand Color Accents on Metrics -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-bottom: 12px;">
                <tr>
                  <td style="width: 32%; vertical-align: top;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="metric-card" style="width: 100%; background-color: #fcfbf9; border: 1px solid #e2ddd3; border-radius: 12px;">
                      <tr>
                        <td style="padding: 14px 8px 12px; text-align: center;">
                          <div class="metric-value metric-rosa" style="font-size: 24px; font-weight: 800; color: #e4007c; letter-spacing: -0.03em; line-height: 1;">${stats.cardsAdded}</div>
                          <div class="metric-label" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #5f6e66; margin-top: 6px;">New cards</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width: 2%;"></td>
                  <td style="width: 32%; vertical-align: top;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="metric-card" style="width: 100%; background-color: #fcfbf9; border: 1px solid #e2ddd3; border-radius: 12px;">
                      <tr>
                        <td style="padding: 14px 8px 12px; text-align: center;">
                          <div class="metric-value metric-neutral" style="font-size: 24px; font-weight: 800; color: #121815; letter-spacing: -0.03em; line-height: 1;">${stats.totalReviewsThisPeriod}</div>
                          <div class="metric-label" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #5f6e66; margin-top: 6px;">Reviews</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width: 2%;"></td>
                  <td style="width: 32%; vertical-align: top;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="metric-card" style="width: 100%; background-color: #fcfbf9; border: 1px solid #e2ddd3; border-radius: 12px;">
                      <tr>
                        <td style="padding: 14px 8px 12px; text-align: center;">
                          <div class="metric-value metric-verde" style="font-size: 24px; font-weight: 800; color: #15803d; letter-spacing: -0.03em; line-height: 1;">${stats.cardsGraduated}</div>
                          <div class="metric-label" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #5f6e66; margin-top: 6px;">Mastered</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${
                stats.cardsGraduated > 0
                  ? `<p class="mastery-note" style="margin: 0 0 24px 0; font-size: 13.5px; color: #5f6e66; line-height: 1.5;">
                ${stats.cardsGraduated === 1 ? '1 card' : `${stats.cardsGraduated} cards`} reached long-term memory (3 bubbles) ${renderMasteryBubblesSvg(3, 34, 11)} this month.
              </p>`
                  : ''
              }

              ${masteredHtml}

              ${watchlistHtml}

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="backup-callout" style="width: 100%; margin-top: 24px; background-color: #fdf5f8; border: 1px solid #e2ddd3; border-radius: 14px;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <div class="highlight-title" style="font-size: 14.5px; font-weight: 750; color: #121815; margin-bottom: 6px; letter-spacing: -0.01em;">
                      Your vocabulary belongs to you
                    </div>
                    <div class="explainer-text" style="font-size: 13.5px; color: #5f6e66; line-height: 1.5;">
                      Most language apps trap your progress in their servers. We don't believe in that. Attached is an offline JSON copy of your complete deck (${stats.totalCards} cards). It's yours to keep, inspect, or restore anytime in <strong class="highlight-text" style="font-weight: 700; color: #121815;">Deck &rarr; Backup &amp; Import</strong>.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Email Footer (outside card, styled like sign-in email) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; margin-top: 24px;">
          <tr>
            <td align="center" style="padding: 0 16px;">
              <p class="footer-text" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #5f6e66; text-align: center;">
                Sent because <a href="https://joli.to" target="_blank" class="footer-brand-link" style="color: #5f6e66; text-decoration: underline;">Jolito</a> sync is on. <a href="${escapeHtml(unsubscribeUrl)}" class="unsubscribe-link" style="color: #5f6e66; text-decoration: underline;">Unsubscribe</a> anytime.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `Jolito — Progress Report (${periodLabel})`,
    `========================================`,
    ``,
    `Here is how your Mexican Spanish moved over the last 30 days:`,
    ``,
    `• ${stats.cardsAdded} new cards`,
    `• ${stats.totalReviewsThisPeriod} reviews`,
    `• ${stats.cardsGraduated} mastered`,
    ``,
    stats.cardsGraduated > 0
      ? `${stats.cardsGraduated === 1 ? '1 card' : `${stats.cardsGraduated} cards`} reached long-term memory (3 bubbles) this month.`
      : null,
    masteredText,
    watchlistText,
    ``,
    `Your vocabulary belongs to you:`,
    `Most language apps trap your progress in their servers. We don't believe in that. Attached is an offline JSON copy of your complete deck (${stats.totalCards} cards). It's yours to keep, inspect, or restore anytime in Deck → Backup & Import.`,
    ``,
    `Sent because Jolito (https://joli.to) sync is on. Unsubscribe anytime: ${unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, html, text }
}

export function formatPausedNoticeEmail(
  totalCards: number,
  periodLabel: string,
  unsubscribeUrl: string,
): { subject: string; html: string; text: string } {
  const subject = `[Jolito] Progress Report (paused) - ${periodLabel}`

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
      .email-card {
        padding: 28px 20px !important;
        border-radius: 14px !important;
      }
    }
    @media (prefers-color-scheme: dark) {
      body, .email-body-bg {
        background-color: #0d1210 !important;
        color: #fdf5f8 !important;
      }
      .brand-wordmark, .email-title, .highlight-title {
        color: #fdf5f8 !important;
      }
      .brand-logo-badge {
        background-color: #ffffff !important;
        border-color: #384640 !important;
      }
      .email-card {
        background-color: #161e1a !important;
        border-color: #2b3832 !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
      }
      .subtext, .explainer-text, .footer-text {
        color: #8d9c94 !important;
      }
      .email-paragraph {
        color: #b7c4bd !important;
      }
      .backup-callout {
        background-color: #1a221e !important;
        border-color: #2b3832 !important;
      }
      .footer-brand-link, .unsubscribe-link {
        color: #b7c4bd !important;
      }
    }
  </style>
</head>
<body class="email-body-bg" style="margin: 0; padding: 0; background-color: #fdf5f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #121815;">
  <div style="display: none; font-size: 1px; color: #fdf5f8; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Monthly progress emails are paused while you're away. Offline deck backup attached.
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-body-bg" style="background-color: #fdf5f8; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Brand Header / Wordmark -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; margin-bottom: 24px;">
          <tr>
            <td align="center" style="padding: 12px 0 0 0;">
              <a href="https://joli.to" target="_blank" style="text-decoration: none; display: inline-block;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align: middle; padding-right: 10px;">
                      <div class="brand-logo-badge" style="background-color: #ffffff; border: 1px solid #e2ddd3; border-radius: 8px; width: 32px; height: 32px; display: inline-block; box-shadow: 0 1px 3px rgba(18, 24, 21, 0.08); line-height: 0; font-size: 0; text-align: center; vertical-align: middle;">
                        <img src="https://joli.to/favicon-96x96.png" width="26" height="26" alt="" role="presentation" style="display: inline-block; width: 26px; height: 26px; margin-top: 2px; border: 0; outline: none;" />
                      </div>
                    </td>
                    <td style="vertical-align: middle;">
                      <span class="brand-wordmark" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.03em; color: #121815; text-decoration: none;">Jolito</span>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
        </table>

        <!-- Main Card Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-card" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2ddd3; border-radius: 18px; box-shadow: 0 4px 18px rgba(18, 24, 21, 0.05); overflow: hidden; padding: 36px 32px;">
          <tr>
            <td>
              <h1 class="email-title" style="margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 750; letter-spacing: -0.025em; color: #121815; line-height: 1.2;">Digests paused</h1>
              <div class="subtext" style="margin: 0 0 20px 0; font-size: 13.5px; font-weight: 500; color: #5f6e66;">${escapeHtml(periodLabel)}</div>

              <p class="email-paragraph" style="margin: 0 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #3b4740; line-height: 1.5;">
                You haven't practiced recently, so we paused monthly emails to keep your inbox clean.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="backup-callout" style="width: 100%; background-color: #fdf5f8; border: 1px solid #e2ddd3; border-radius: 14px;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <div class="highlight-title" style="font-size: 14.5px; font-weight: 750; color: #121815; margin-bottom: 6px; letter-spacing: -0.01em;">
                      Your vocabulary is safe (${totalCards} cards)
                    </div>
                    <div class="explainer-text" style="font-size: 13.5px; color: #5f6e66; line-height: 1.5;">
                      Your complete deck is attached as an offline backup. Whenever you want to practice again, simply open Jolito—monthly digests will resume automatically.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Email Footer (outside card) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; margin-top: 24px;">
          <tr>
            <td align="center" style="padding: 0 16px;">
              <p class="footer-text" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #5f6e66; text-align: center;">
                Sent because <a href="https://joli.to" target="_blank" class="footer-brand-link" style="color: #5f6e66; text-decoration: underline;">Jolito</a> sync is on. <a href="${escapeHtml(unsubscribeUrl)}" class="unsubscribe-link" style="color: #5f6e66; text-decoration: underline;">Unsubscribe</a> anytime.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `Jolito — Digests paused (${periodLabel})`,
    `=======================================`,
    ``,
    `You haven't practiced recently, so we paused monthly emails to keep your inbox clean.`,
    ``,
    `Your vocabulary is safe (${totalCards} cards):`,
    `Your complete deck is attached as an offline backup. Whenever you want to practice again, simply open Jolito—monthly digests will resume automatically.`,
    ``,
    `Sent because Jolito (https://joli.to) sync is on. Unsubscribe anytime: ${unsubscribeUrl}`,
  ].join('\n')

  return { subject, html, text }
}
