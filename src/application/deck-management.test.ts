import { describe, expect, it } from 'vitest'
import { createStudyCards } from '../domain/card'
import {
  filterDeckCards,
  getDeckStats,
  type DeckStats,
} from './deck-management'

const now = Date.UTC(2026, 7, 21, 12, 0, 0)
const DAY = 24 * 60 * 60 * 1000

describe('deck-management', () => {
  const cards = [
    // Card 1: New card (due now)
    createStudyCards(
      {
        spanish: 'aguacate',
        english: 'avocado',
        context: 'En el mercado de San Juan',
        bidirectional: false,
      },
      'note-1',
      now,
    )[0]!,
    // Card 2: Learning card (due in 5 mins)
    {
      ...createStudyCards(
        {
          spanish: '¿mande?',
          english: 'what did you say?',
          context: 'Polite Mexican way to ask someone to repeat',
          bidirectional: false,
        },
        'note-2',
        now,
      )[0]!,
      schedule: {
        state: 'learning' as const,
        dueAt: now + 5 * 60 * 1000,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 1,
        lapses: 0,
      },
    },
    // Card 3: Relearning card (overdue)
    {
      ...createStudyCards(
        {
          spanish: 'chido',
          english: 'cool',
          context: 'Chilango slang',
          bidirectional: false,
        },
        'note-3',
        now,
      )[0]!,
      schedule: {
        state: 'relearning' as const,
        dueAt: now - 10 * 60 * 1000,
        intervalDays: 0,
        easeFactor: 2.3,
        reviews: 4,
        lapses: 1,
      },
    },
    // Card 4: Graduated review card (due in 3 days)
    {
      ...createStudyCards(
        {
          spanish: '¡qué padre!',
          english: 'how cool!',
          context: 'Expressing enthusiasm',
          bidirectional: false,
        },
        'note-4',
        now,
      )[0]!,
      schedule: {
        state: 'review' as const,
        dueAt: now + 3 * DAY,
        intervalDays: 3,
        easeFactor: 2.6,
        reviews: 5,
        lapses: 0,
      },
    },
    // Card 5: Graduated review card (overdue review)
    {
      ...createStudyCards(
        {
          spanish: 'ahorita',
          english: 'right now / in a bit',
          context: 'Mexican concept of time',
          bidirectional: false,
        },
        'note-5',
        now,
      )[0]!,
      schedule: {
        state: 'review' as const,
        dueAt: now - 1 * DAY,
        intervalDays: 2,
        easeFactor: 2.5,
        reviews: 3,
        lapses: 0,
      },
    },
  ]

  describe('getDeckStats', () => {
    it('computes counts for total, due, new, learning/relearning, and review cards', () => {
      const stats: DeckStats = getDeckStats(cards, now)
      expect(stats).toEqual({
        total: 5,
        due: 3, // aguacate (new, due now), chido (relearning overdue), ahorita (review overdue)
        newCount: 1, // aguacate
        learningCount: 2, // ¿mande? (learning) + chido (relearning)
        reviewCount: 2, // ¡qué padre! + ahorita
      })
    })

    it('handles empty cards array gracefully', () => {
      const stats = getDeckStats([], now)
      expect(stats).toEqual({
        total: 0,
        due: 0,
        newCount: 0,
        learningCount: 0,
        reviewCount: 0,
      })
    })
  })

  describe('filterDeckCards', () => {
    it('returns all cards when no query or stateFilter is provided', () => {
      const result = filterDeckCards(cards, { now })
      expect(result).toHaveLength(5)
    })

    it('filters by state: due', () => {
      const dueCards = filterDeckCards(cards, { stateFilter: 'due', now })
      expect(dueCards.map((c) => c.prompt)).toEqual([
        'aguacate',
        'chido',
        'ahorita',
      ])
    })

    it('filters by state: new', () => {
      const newCards = filterDeckCards(cards, { stateFilter: 'new', now })
      expect(newCards.map((c) => c.prompt)).toEqual(['aguacate'])
    })

    it('filters by state: learning (including relearning)', () => {
      const learningCards = filterDeckCards(cards, {
        stateFilter: 'learning',
        now,
      })
      expect(learningCards.map((c) => c.prompt)).toEqual(['¿mande?', 'chido'])
    })

    it('filters by state: review', () => {
      const reviewCards = filterDeckCards(cards, { stateFilter: 'review', now })
      expect(reviewCards.map((c) => c.prompt)).toEqual([
        '¡qué padre!',
        'ahorita',
      ])
    })

    it('filters by text query in prompt', () => {
      const result = filterDeckCards(cards, { query: 'AGUA', now })
      expect(result.map((c) => c.prompt)).toEqual(['aguacate'])
    })

    it('filters by text query in answer', () => {
      const result = filterDeckCards(cards, { query: 'repeat', now })
      expect(result.map((c) => c.prompt)).toEqual(['¿mande?'])
    })

    it('filters by text query in context', () => {
      const result = filterDeckCards(cards, { query: 'Chilango', now })
      expect(result.map((c) => c.prompt)).toEqual(['chido'])
    })

    it('combines text search with state filter', () => {
      const result = filterDeckCards(cards, {
        query: 'cool',
        stateFilter: 'review',
        now,
      })
      expect(result.map((c) => c.prompt)).toEqual(['¡qué padre!'])
    })

    it('returns empty array when search query matches nothing', () => {
      const result = filterDeckCards(cards, {
        query: 'nonexistent match xyz',
        now,
      })
      expect(result).toHaveLength(0)
    })
  })
})
