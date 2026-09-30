import { describe, expect, it } from 'vitest'
import type { StudyCard } from './card'
import {
  computeDeckDigestStats,
  createUnsubscribeToken,
  formatDigestEmail,
  formatDigestPeriodRange,
  formatPausedNoticeEmail,
  renderChiliIconSvg,
  renderChiliMeterSvg,
  renderMasteryBubblesSvg,
  verifyUnsubscribeToken,
} from './deck-digest'

function makeCard(overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    id: 'card-1',
    noteId: 'card-1',
    prompt: 'hablar',
    answer: 'to speak',
    direction: 'es-en',
    context: '',
    scene: 'conversation',
    createdAt: 1727481600000, // 2024-09-28
    contentRevision: 1,
    resetRevision: { generation: 0, at: 0 },
    schedule: {
      state: 'review',
      dueAt: 1727568000000,
      intervalDays: 25,
      easeFactor: 2.5,
      reviews: 5,
      lapses: 0,
      lastReviewedAt: 1727481600000,
      stability: 10,
      difficulty: 3,
    },
    ...overrides,
  }
}

describe('deck-digest domain', () => {
  describe('computeDeckDigestStats', () => {
    const now = 1727524800000 // 2024-09-28 12:00:00 UTC

    it('calculates cards added in the current period', () => {
      const cards: StudyCard[] = [
        makeCard({ id: 'c1', createdAt: now - 5 * 24 * 60 * 60 * 1000 }),
        makeCard({ id: 'c2', createdAt: now - 15 * 24 * 60 * 60 * 1000 }),
        makeCard({ id: 'c3', createdAt: now - 40 * 24 * 60 * 60 * 1000 }),
      ]

      const stats = computeDeckDigestStats(cards, now, 0)
      expect(stats.cardsAdded).toBe(2)
      expect(stats.totalCards).toBe(3)
    })

    it('calculates cards graduated (reached 3 bubbles mastery) reviewed this period', () => {
      const cards: StudyCard[] = [
        makeCard({
          id: 'c1',
          schedule: {
            state: 'review',
            intervalDays: 25,
            dueAt: now,
            easeFactor: 2.5,
            reviews: 4,
            lapses: 0,
            lastReviewedAt: now - 2 * 24 * 60 * 60 * 1000,
            stability: 35, // stability >= 30 -> 3 bubbles (mastered)
          },
        }),
        makeCard({
          id: 'c2',
          schedule: {
            state: 'learning',
            intervalDays: 1,
            dueAt: now,
            easeFactor: 2.5,
            reviews: 2,
            lapses: 1,
            lastReviewedAt: now - 2 * 24 * 60 * 60 * 1000,
            stability: 5,
          },
        }),
        makeCard({
          id: 'c3',
          schedule: {
            state: 'review',
            intervalDays: 30,
            dueAt: now,
            easeFactor: 2.5,
            reviews: 5,
            lapses: 0,
            lastReviewedAt: now - 40 * 24 * 60 * 60 * 1000, // reviewed > 30 days ago
            stability: 35,
          },
        }),
      ]

      const stats = computeDeckDigestStats(cards, now, 0)
      expect(stats.cardsGraduated).toBe(1) // only c1 graduated and active this month
    })

    it('calculates review count delta from baseline', () => {
      const cards: StudyCard[] = [
        makeCard({
          id: 'c1',
          schedule: {
            state: 'review',
            intervalDays: 5,
            dueAt: now,
            easeFactor: 2.5,
            reviews: 12,
            lapses: 1,
          },
        }),
        makeCard({
          id: 'c2',
          schedule: {
            state: 'review',
            intervalDays: 10,
            dueAt: now,
            easeFactor: 2.5,
            reviews: 8,
            lapses: 0,
          },
        }),
      ]
      // total lifetime reviews = 20
      const stats = computeDeckDigestStats(cards, now, 15)
      expect(stats.totalReviewsThisPeriod).toBe(5)
      expect(stats.currentLifetimeReviews).toBe(20)
    })

    it('extracts top tricky words / leeches sorted by lapses descending and stability ascending', () => {
      const cards: StudyCard[] = [
        makeCard({
          id: 'c1',
          prompt: 'fácil',
          answer: 'easy',
          schedule: {
            state: 'review',
            intervalDays: 30,
            dueAt: now,
            easeFactor: 2.5,
            reviews: 10,
            lapses: 0,
            stability: 20,
          },
        }),
        makeCard({
          id: 'c2',
          prompt: 'desarrollar',
          answer: 'to develop',
          schedule: {
            state: 'review',
            intervalDays: 2,
            dueAt: now,
            easeFactor: 2.1,
            reviews: 8,
            lapses: 4,
            stability: 1.2,
            lastReviewedAt: now - 2 * 24 * 60 * 60 * 1000,
          },
        }),
        makeCard({
          id: 'c3',
          prompt: 'acontecer',
          answer: 'to happen',
          schedule: {
            state: 'review',
            intervalDays: 3,
            dueAt: now,
            easeFactor: 2.3,
            reviews: 6,
            lapses: 2,
            stability: 2.5,
            lastReviewedAt: now - 5 * 24 * 60 * 60 * 1000,
          },
        }),
        makeCard({
          id: 'c4',
          prompt: 'platicar',
          answer: 'to chat',
          schedule: {
            state: 'review',
            intervalDays: 2,
            dueAt: now,
            easeFactor: 2.2,
            reviews: 5,
            lapses: 2,
            stability: 1.1,
            lastReviewedAt: now - 1 * 24 * 60 * 60 * 1000,
          },
        }),
        makeCard({
          id: 'c5',
          prompt: 'antiguo',
          answer: 'ancient',
          schedule: {
            state: 'review',
            intervalDays: 2,
            dueAt: now,
            easeFactor: 2.2,
            reviews: 15,
            lapses: 10,
            stability: 0.5,
            lastReviewedAt: now - 45 * 24 * 60 * 60 * 1000, // outside period!
          },
        }),
      ]

      const stats = computeDeckDigestStats(cards, now, 0)
      expect(stats.wordsToWatchOutFor).toHaveLength(3)
      expect(stats.wordsToWatchOutFor[0]?.prompt).toBe('desarrollar')
      expect(stats.wordsToWatchOutFor[1]?.prompt).toBe('platicar')
      expect(stats.wordsToWatchOutFor[2]?.prompt).toBe('acontecer')
      expect(stats.wordsToWatchOutFor.map((w) => w.prompt)).not.toContain(
        'antiguo',
      )
    })

    it('extracts top mastered words sorted by bubbles desc, stability desc, and reviews desc', () => {
      const cards: StudyCard[] = [
        makeCard({
          id: 'c1',
          prompt: 'desarrollar',
          answer: 'to develop',
          schedule: {
            state: 'review',
            intervalDays: 35,
            dueAt: now,
            easeFactor: 2.5,
            reviews: 10,
            lapses: 0,
            stability: 45,
            lastReviewedAt: now - 3 * 24 * 60 * 60 * 1000,
          },
        }),
        makeCard({
          id: 'c2',
          prompt: 'acontecer',
          answer: 'to happen',
          schedule: {
            state: 'review',
            intervalDays: 14,
            dueAt: now,
            easeFactor: 2.5,
            reviews: 6,
            lapses: 1,
            stability: 18,
            lastReviewedAt: now - 5 * 24 * 60 * 60 * 1000,
          },
        }),
        makeCard({
          id: 'c3',
          prompt: 'platicar',
          answer: 'to chat',
          schedule: {
            state: 'review',
            intervalDays: 5,
            dueAt: now,
            easeFactor: 2.5,
            reviews: 3,
            lapses: 0,
            stability: 5,
            lastReviewedAt: now - 1 * 24 * 60 * 60 * 1000,
          },
        }),
        makeCard({
          id: 'c4',
          prompt: 'antiguo',
          answer: 'ancient',
          schedule: {
            state: 'review',
            intervalDays: 40,
            dueAt: now,
            easeFactor: 2.5,
            reviews: 12,
            lapses: 0,
            stability: 50,
            lastReviewedAt: now - 45 * 24 * 60 * 60 * 1000, // old review > 30 days
          },
        }),
      ]

      const stats = computeDeckDigestStats(cards, now, 0)
      expect(stats.topMasteredWords).toHaveLength(3)
      expect(stats.topMasteredWords[0]?.prompt).toBe('desarrollar')
      expect(stats.topMasteredWords[0]?.bubbles).toBe(3)
      expect(stats.topMasteredWords[0]?.isGraduated).toBe(true)
      expect(stats.topMasteredWords[1]?.prompt).toBe('acontecer')
      expect(stats.topMasteredWords[1]?.bubbles).toBe(2)
      expect(stats.topMasteredWords[2]?.prompt).toBe('platicar')
      expect(stats.topMasteredWords[2]?.bubbles).toBe(1)
    })

    it('identifies inactive accounts when no cards have been reviewed or added in 45 days', () => {
      const activeCards: StudyCard[] = [
        makeCard({
          schedule: {
            state: 'review',
            intervalDays: 10,
            dueAt: now,
            easeFactor: 2.5,
            reviews: 3,
            lapses: 0,
            lastReviewedAt: now - 10 * 24 * 60 * 60 * 1000,
          },
        }),
      ]
      const inactiveCards: StudyCard[] = [
        makeCard({
          createdAt: now - 60 * 24 * 60 * 60 * 1000,
          schedule: {
            state: 'review',
            intervalDays: 10,
            dueAt: now,
            easeFactor: 2.5,
            reviews: 3,
            lapses: 0,
            lastReviewedAt: now - 50 * 24 * 60 * 60 * 1000,
          },
        }),
      ]

      expect(computeDeckDigestStats(activeCards, now, 0).isInactive).toBe(false)
      expect(computeDeckDigestStats(inactiveCards, now, 0).isInactive).toBe(
        true,
      )
    })

    it('identifies empty decks as inactive to auto-pause and prevent spam', () => {
      expect(computeDeckDigestStats([], now, 0).isInactive).toBe(true)
    })

    it('identifies accounts with newly added cards as active even without reviews', () => {
      const cardsWithNewAddition: StudyCard[] = [
        makeCard({
          createdAt: now - 10 * 24 * 60 * 60 * 1000,
          schedule: {
            state: 'new',
            intervalDays: 0,
            dueAt: now,
            easeFactor: 2.5,
            reviews: 0,
            lapses: 0,
            lastReviewedAt: 0,
          },
        }),
      ]
      expect(
        computeDeckDigestStats(cardsWithNewAddition, now, 0).isInactive,
      ).toBe(false)
    })
  })

  describe('unsubscribe token HMAC', () => {
    const userId = '11111111-2222-3333-4444-555555555555'
    const secret = 'test-secret-key-for-hmac'

    it('generates and verifies valid token', async () => {
      const token = await createUnsubscribeToken(userId, secret)
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(16)

      const isValid = await verifyUnsubscribeToken(userId, token, secret)
      expect(isValid).toBe(true)
    })

    it('rejects tampered token or wrong userId', async () => {
      const token = await createUnsubscribeToken(userId, secret)
      const isWrongUser = await verifyUnsubscribeToken(
        'wrong-user-id',
        token,
        secret,
      )
      expect(isWrongUser).toBe(false)

      const isTampered = await verifyUnsubscribeToken(
        userId,
        token.slice(0, -4) + 'abcd',
        secret,
      )
      expect(isTampered).toBe(false)

      expect(await verifyUnsubscribeToken(userId, '', secret)).toBe(false)
      expect(await verifyUnsubscribeToken(userId, 'short', secret)).toBe(false)
      expect(
        await verifyUnsubscribeToken(userId, null as unknown as string, secret),
      ).toBe(false)
    })
  })

  describe('formatDigestPeriodRange', () => {
    it('formats period range within the same year', () => {
      const endTimestamp = Date.UTC(2026, 8, 28) // Sep 28, 2026
      const range = formatDigestPeriodRange(endTimestamp, 30)
      expect(range).toBe('Aug 29 – Sep 28, 2026')
    })

    it('formats period range across different calendar years', () => {
      const endTimestamp = Date.UTC(2027, 0, 15) // Jan 15, 2027
      const range = formatDigestPeriodRange(endTimestamp, 30)
      expect(range).toBe('Dec 16, 2026 – Jan 15, 2027')
    })
  })

  describe('formatDigestEmail', () => {
    it('includes Jolito logo, clean header, metrics, and unsubscribe link', () => {
      const stats = {
        cardsAdded: 15,
        cardsGraduated: 8,
        totalReviewsThisPeriod: 120,
        currentLifetimeReviews: 450,
        totalCards: 200,
        wordsToWatchOutFor: [
          { prompt: 'acontecer', answer: 'to happen', lapses: 3 },
        ],
        topMasteredWords: [
          {
            prompt: 'desarrollar',
            answer: 'to develop',
            bubbles: 3,
            isGraduated: true,
          },
          {
            prompt: 'acontecer',
            answer: 'to happen',
            bubbles: 3,
            isGraduated: true,
          },
        ],
        isInactive: false,
      }
      const unsubscribeUrl =
        'https://joli.to/api/digest/unsubscribe?u=123&t=abc'
      const { html, text, subject } = formatDigestEmail(
        stats,
        'Aug 29 – Sep 28, 2026',
        unsubscribeUrl,
      )

      expect(subject).toBe('[Jolito] Progress Report - Aug 29 – Sep 28, 2026')
      expect(html).toContain(
        'https://joli.to/api/digest/unsubscribe?u=123&amp;t=abc',
      )
      expect(html).toContain('alt=""')
      expect(html).toContain('role="presentation"')
      expect(html).toContain('>unsubscribe</a>')
      expect(html).toContain(
        'Progress report for Aug 29 – Sep 28, 2026 and offline deck backup',
      )
      expect(html).toContain('Progress Report</h1>')
      expect(html).toContain(
        'Here is how your Mexican Spanish moved over the last 30 days:',
      )
      // Visual & Metaphor invariants: Bubbles & Chilies
      expect(html).toContain('New cards')
      expect(html).toContain('Reviews')
      expect(html).toContain('Mastered')
      expect(html).toContain('8 cards reached long-term memory (3 bubbles)')
      // Symmetric Mastered Words Section
      expect(html).toContain('Freshly mastered')
      expect(html).toContain(
        'These words crossed into long-term memory this month:',
      )
      expect(html).toContain('desarrollar')
      // The Spiciest Words Section
      expect(html).toContain('The spiciest words')
      expect(html).toContain('A few words made you sweat this month')
      expect(html).toContain('In Jolito, chilies track difficulty')
      expect(html).toContain('Difficulty: 2 of 3 chilies')
      expect(html).toContain('3 stumbles')
      expect(html).toContain('box-shadow: 0 4px 18px rgba(18, 24, 21, 0.05)')
      expect(html).toContain('Your vocabulary belongs to you')
      expect(html).toContain(
        'Most language apps trap your progress in their servers.',
      )
      expect(html).toContain('Sent because Cloud sync is on.')
      expect(html).toContain('Manage in <a href="https://joli.to"')
      expect(text).toContain(
        `Sent because Cloud sync is on. Manage in Cloud sync (https://joli.to) or unsubscribe anytime: ${unsubscribeUrl}`,
      )
      expect(text).toContain('• 15 new cards')
      expect(text).toContain('• 120 reviews')
      expect(text).toContain('• 8 mastered')
      expect(text).toContain(
        '8 cards reached long-term memory (3 bubbles) this month.',
      )
      expect(text).toContain('Freshly mastered:')
      expect(text).toContain('desarrollar')
      expect(text).toContain('The spiciest words:')
      expect(text).toContain('A few words made you sweat this month')
      expect(text).toContain('In Jolito, chilies track difficulty')
      expect(text).toContain('acontecer')
      expect(text).toContain('Deck → Backup & Import')
      expect(text).toContain('Your vocabulary belongs to you:')
    })

    it('handles multiple tricky words with single stumble and empty tricky words list', () => {
      const unsubscribeUrl =
        'https://joli.to/api/digest/unsubscribe?u=123&t=abc'
      const statsWithMultiple = {
        cardsAdded: 5,
        cardsGraduated: 0,
        totalReviewsThisPeriod: 30,
        currentLifetimeReviews: 100,
        totalCards: 50,
        wordsToWatchOutFor: [
          {
            prompt: 'acontecer',
            answer: 'to happen',
            lapses: 2,
            difficulty: 3,
          },
          { prompt: 'platicar', answer: 'to chat', lapses: 1, difficulty: 1 },
        ],
        topMasteredWords: [
          {
            prompt: 'platicar',
            answer: 'to chat',
            bubbles: 2,
            isGraduated: false,
          },
          {
            prompt: 'ahorita',
            answer: 'right now',
            bubbles: 1,
            isGraduated: false,
          },
        ],
        isInactive: false,
      }
      const email = formatDigestEmail(
        statsWithMultiple,
        'Aug 29 – Sep 28, 2026',
        unsubscribeUrl,
      )
      expect(email.html).toContain('1 stumble')
      expect(email.html).toContain('2 stumbles')
      // When 0 cards graduated, no awkward zero-count scoreboard sentence is rendered
      expect(email.html).not.toContain('reached long-term memory')
      expect(email.text).not.toContain('reached long-term memory')
      expect(email.html).toContain('Top progress')
      expect(email.html).toContain(
        'Your strongest words gaining momentum this month:',
      )
      expect(email.html).toContain('2 bubbles')
      expect(email.html).toContain('1 bubble')
      expect(email.html).toContain('Difficulty: 3 of 3 chilies')
      expect(email.html).toContain('Difficulty: 1 of 3 chilies')

      const statsEmpty = {
        ...statsWithMultiple,
        wordsToWatchOutFor:
          undefined as unknown as typeof statsWithMultiple.wordsToWatchOutFor,
        topMasteredWords:
          undefined as unknown as typeof statsWithMultiple.topMasteredWords,
      }
      const emptyEmail = formatDigestEmail(
        statsEmpty,
        'Aug 29 – Sep 28, 2026',
        unsubscribeUrl,
      )
      expect(emptyEmail.html).not.toContain('The spiciest words')
      expect(emptyEmail.html).not.toContain('Freshly mastered')
      expect(emptyEmail.html).not.toContain('Top progress')

      // Exactly 1 card graduated tests the singular branch and zero cards added
      const singleGraduated = {
        ...statsWithMultiple,
        cardsAdded: 0,
        cardsGraduated: 1,
        topMasteredWords: [
          {
            prompt: 'desarrollar',
            answer: 'to develop',
            bubbles: 3,
            isGraduated: true,
          },
        ],
      }
      const singleGraduatedEmail = formatDigestEmail(
        singleGraduated,
        'Aug 29 – Sep 28, 2026',
        unsubscribeUrl,
      )
      expect(singleGraduatedEmail.html).toContain(
        '1 card reached long-term memory',
      )
      expect(singleGraduatedEmail.html).toContain(
        'This word crossed into long-term memory this month:',
      )
      expect(singleGraduatedEmail.html).toContain('>0</div>')
      expect(singleGraduatedEmail.text).toContain(
        '1 card reached long-term memory',
      )
      expect(singleGraduatedEmail.text).toContain('• 0 new cards')

      // Mixed cards (one graduated, one in progress) tests milestone phrasing
      const mixedProgress = {
        ...statsWithMultiple,
        topMasteredWords: [
          {
            prompt: 'desarrollar',
            answer: 'to develop',
            bubbles: 3,
            isGraduated: true,
          },
          {
            prompt: 'platicar',
            answer: 'to chat',
            bubbles: 2,
            isGraduated: false,
          },
        ],
      }
      const mixedEmail = formatDigestEmail(
        mixedProgress,
        'Aug 29 – Sep 28, 2026',
        unsubscribeUrl,
      )
      expect(mixedEmail.html).toContain('Top progress')
      expect(mixedEmail.html).toContain(
        'Your strongest words and latest milestones this month:',
      )
    })
  })

  describe('renderChiliIconSvg and renderChiliMeterSvg', () => {
    it('renders filled and empty chili icons with custom and default sizes', () => {
      const filled = renderChiliIconSvg(true)
      const empty = renderChiliIconSvg(false, 20)
      expect(filled).toContain('fill="#d32f2f"')
      expect(filled).toContain('width="15"')
      expect(empty).toContain('fill="none"')
      expect(empty).toContain('width="20"')
    })

    it('renders chili meters across difficulty levels 0 to 3', () => {
      expect(renderChiliMeterSvg(0)).toContain('Difficulty: 0 of 3 chilies')
      expect(renderChiliMeterSvg(1)).toContain('Difficulty: 1 of 3 chilies')
      expect(renderChiliMeterSvg(2)).toContain('Difficulty: 2 of 3 chilies')
      expect(renderChiliMeterSvg(3)).toContain('Difficulty: 3 of 3 chilies')
    })
  })

  describe('renderMasteryBubblesSvg', () => {
    it('renders mastery bubbles across levels 0 to 3 with appropriate fill states', () => {
      const lvl0 = renderMasteryBubblesSvg(0)
      const lvl1 = renderMasteryBubblesSvg(1)
      const lvl2 = renderMasteryBubblesSvg(2)
      const lvl3 = renderMasteryBubblesSvg(3)
      expect(lvl0).toContain('fill="none"')
      expect(lvl1).toContain('fill="#15803d"')
      expect(lvl2).toContain('fill="#15803d"')
      expect(lvl3).toContain('fill="#15803d"')
    })
  })

  describe('formatPausedNoticeEmail', () => {
    it('notifies inactive learner that digest is auto-paused with backup attached', () => {
      const unsubscribeUrl =
        'https://joli.to/api/digest/unsubscribe?u=123&t=abc'
      const { html, text, subject } = formatPausedNoticeEmail(
        150,
        'Aug 29 – Sep 28, 2026',
        unsubscribeUrl,
      )

      expect(subject).toBe(
        '[Jolito] Progress Report (paused) - Aug 29 – Sep 28, 2026',
      )
      expect(html).toContain('Digests paused')
      expect(html).toContain('alt=""')
      expect(html).toContain('role="presentation"')
      expect(html).toContain(
        "Monthly progress emails are paused while you're away",
      )
      expect(html).toContain('>unsubscribe</a>')
      expect(html).toContain('Sent because Cloud sync is on.')
      expect(html).toContain('Manage in <a href="https://joli.to"')
      expect(html).toContain('Your vocabulary is safe (150 cards)')
      expect(text).toContain('Digests paused')
      expect(text).toContain('Your vocabulary is safe (150 cards)')
      expect(text).toContain(
        `Sent because Cloud sync is on. Manage in Cloud sync (https://joli.to) or unsubscribe anytime: ${unsubscribeUrl}`,
      )
    })
  })
})
