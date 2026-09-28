import { describe, expect, it } from 'vitest'
import type { StudyCard } from './card'
import {
  computeDeckDigestStats,
  createUnsubscribeToken,
  formatDigestEmail,
  formatPausedNoticeEmail,
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

    it('calculates cards graduated (mature in review state) reviewed this period', () => {
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
          },
        }),
      ]

      const stats = computeDeckDigestStats(cards, now, 0)
      expect(stats.wordsToWatchOutFor).toHaveLength(2)
      expect(stats.wordsToWatchOutFor[0]?.prompt).toBe('desarrollar')
      expect(stats.wordsToWatchOutFor[1]?.prompt).toBe('acontecer')
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
        matureCards: 80,
        wordsToWatchOutFor: [
          { prompt: 'acontecer', answer: 'to happen', lapses: 3 },
        ],
        isInactive: false,
      }
      const unsubscribeUrl =
        'https://joli.to/api/digest/unsubscribe?u=123&t=abc'
      const { html, text, subject } = formatDigestEmail(
        stats,
        'Sep 2026',
        unsubscribeUrl,
      )

      expect(subject).toBe('[Jolito] Progress & Backup - Sep 2026')
      expect(html).toContain(
        'https://joli.to/api/digest/unsubscribe?u=123&amp;t=abc',
      )
      expect(html).toContain('alt=""')
      expect(html).toContain('role="presentation"')
      expect(html).toContain('>Unsubscribe</a>')
      expect(html).toContain(
        'Sep 2026 progress snapshot and attached offline deck backup',
      )
      expect(text).toContain(unsubscribeUrl)
      expect(text).toContain('+15 cards added')
      expect(text).toContain('120 reviews completed')
      expect(text).toContain('acontecer')
    })
  })

  describe('formatPausedNoticeEmail', () => {
    it('notifies inactive learner that digest is auto-paused with backup attached', () => {
      const unsubscribeUrl =
        'https://joli.to/api/digest/unsubscribe?u=123&t=abc'
      const { html, text, subject } = formatPausedNoticeEmail(
        150,
        'Sep 2026',
        unsubscribeUrl,
      )

      expect(subject).toBe('[Jolito] Progress & Backup (paused) - Sep 2026')
      expect(html).toContain('Digests paused')
      expect(html).toContain('alt=""')
      expect(html).toContain('role="presentation"')
      expect(html).toContain(
        "Monthly progress emails are paused while you're away",
      )
      expect(html).toContain('>Unsubscribe</a>')
      expect(html).toContain('150 cards')
      expect(text).toContain('Digests paused')
      expect(text).toContain('150 cards')
      expect(text).toContain(unsubscribeUrl)
    })
  })
})
