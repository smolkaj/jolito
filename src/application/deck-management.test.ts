import { describe, expect, it } from 'vitest'
import { createStudyCards } from '../domain/card'
import {
  filterDeckCards,
  getDeckStats,
  sortDeckCards,
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
        duplicatesCount: 0,
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
        duplicatesCount: 0,
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

    it('filters by state: duplicates', () => {
      const duplicateCard = createStudyCards(
        {
          spanish: 'Aguacate!',
          english: 'avocado',
          context: 'Duplicate of card 1',
          bidirectional: false,
        },
        'note-duplicate-1',
        now,
      )[0]!

      const cardsWithDuplicate = [...cards, duplicateCard]
      const stats = getDeckStats(cardsWithDuplicate, now)
      expect(stats.duplicatesCount).toBe(2)

      const duplicateResults = filterDeckCards(cardsWithDuplicate, {
        stateFilter: 'duplicates',
        now,
      })
      expect(duplicateResults).toHaveLength(2)
      expect(duplicateResults.map((c) => c.prompt)).toEqual([
        'aguacate',
        'Aguacate!',
      ])
    })

    it('sorts filtered cards by specified sort order', () => {
      const result = filterDeckCards(cards, {
        sortOrder: 'alpha-asc',
        now,
      })
      expect(result.map((c) => c.prompt)).toEqual([
        'aguacate',
        'ahorita',
        'chido',
        '¿mande?',
        '¡qué padre!',
      ])
    })
  })

  describe('sortDeckCards', () => {
    const timeA = 1000
    const timeB = 2000
    const timeC = 3000

    const testCards = [
      {
        ...cards[0]!,
        prompt: 'zapato',
        createdAt: timeA,
      },
      {
        ...cards[1]!,
        prompt: 'árbol',
        createdAt: timeC,
      },
      {
        ...cards[2]!,
        prompt: 'bueno',
        createdAt: timeB,
      },
    ]

    it('sorts by creation date descending (newest first) by default', () => {
      const sorted = sortDeckCards(testCards, 'created-desc')
      expect(sorted.map((c) => c.prompt)).toEqual(['árbol', 'bueno', 'zapato'])
    })

    it('sorts by creation date ascending (oldest first)', () => {
      const sorted = sortDeckCards(testCards, 'created-asc')
      expect(sorted.map((c) => c.prompt)).toEqual(['zapato', 'bueno', 'árbol'])
    })

    it('sorts alphabetically ascending (A to Z)', () => {
      const sorted = sortDeckCards(testCards, 'alpha-asc')
      expect(sorted.map((c) => c.prompt)).toEqual(['árbol', 'bueno', 'zapato'])
    })

    it('sorts alphabetically descending (Z to A)', () => {
      const sorted = sortDeckCards(testCards, 'alpha-desc')
      expect(sorted.map((c) => c.prompt)).toEqual(['zapato', 'bueno', 'árbol'])
    })

    it('orders bidirectional card pairs es-en before en-es on same creation time or prompt', () => {
      const pair = [
        {
          ...cards[0]!,
          id: 'note-1:en-es',
          noteId: 'note-1',
          prompt: 'avocado',
          direction: 'en-es' as const,
          createdAt: timeA,
        },
        {
          ...cards[0]!,
          id: 'note-1:es-en',
          noteId: 'note-1',
          prompt: 'aguacate',
          direction: 'es-en' as const,
          createdAt: timeA,
        },
      ]

      const sortedDesc = sortDeckCards(pair, 'created-desc')
      expect(sortedDesc.map((c) => c.direction)).toEqual(['es-en', 'en-es'])

      const sortedAsc = sortDeckCards(pair, 'created-asc')
      expect(sortedAsc.map((c) => c.direction)).toEqual(['es-en', 'en-es'])

      // Same creation time and different noteIds
      const diffNotesSameTime = [
        {
          ...cards[0]!,
          id: 'note-1:es-en',
          noteId: 'note-1',
          createdAt: timeA,
        },
        {
          ...cards[1]!,
          id: 'note-2:es-en',
          noteId: 'note-2',
          createdAt: timeA,
        },
      ]
      expect(sortDeckCards(diffNotesSameTime, 'created-asc')).toHaveLength(2)
      expect(sortDeckCards(diffNotesSameTime, 'created-desc')).toHaveLength(2)

      // Pair in reverse order (en-es first, es-en second)
      const reversePair = [
        {
          ...cards[0]!,
          id: 'note-1:en-es',
          noteId: 'note-1',
          direction: 'en-es' as const,
          createdAt: timeA,
        },
        {
          ...cards[0]!,
          id: 'note-1:es-en',
          noteId: 'note-1',
          direction: 'es-en' as const,
          createdAt: timeA,
        },
      ]
      expect(
        sortDeckCards(reversePair, 'created-desc').map((c) => c.direction),
      ).toEqual(['es-en', 'en-es'])
      expect(
        sortDeckCards(reversePair, 'created-asc').map((c) => c.direction),
      ).toEqual(['es-en', 'en-es'])

      // Same prompt with different directions
      const samePromptDiffDir = [
        {
          ...cards[0]!,
          id: 'note-1:en-es',
          prompt: 'test',
          direction: 'en-es' as const,
        },
        {
          ...cards[0]!,
          id: 'note-1:es-en',
          prompt: 'test',
          direction: 'es-en' as const,
        },
      ]
      expect(
        sortDeckCards(samePromptDiffDir, 'alpha-asc').map((c) => c.direction),
      ).toEqual(['es-en', 'en-es'])
      expect(
        sortDeckCards(samePromptDiffDir, 'alpha-desc').map((c) => c.direction),
      ).toEqual(['es-en', 'en-es'])

      // Same prompt with same direction and different IDs
      const samePromptSameDir = [
        {
          ...cards[0]!,
          id: 'b-card',
          prompt: 'test',
          direction: 'es-en' as const,
        },
        {
          ...cards[0]!,
          id: 'a-card',
          prompt: 'test',
          direction: 'es-en' as const,
        },
      ]
      expect(
        sortDeckCards(samePromptSameDir, 'alpha-asc').map((c) => c.id),
      ).toEqual(['a-card', 'b-card'])
      expect(
        sortDeckCards(samePromptSameDir, 'alpha-desc').map((c) => c.id),
      ).toEqual(['a-card', 'b-card'])
    })
  })
})
