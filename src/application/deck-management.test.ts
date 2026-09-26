import { describe, expect, it } from 'vitest'
import { createStudyCards, type StudyCard } from '../domain/card'
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

    it('filters by starter pack title, badge, or subtitle', () => {
      const streetCard = {
        ...cards[0]!,
        id: 'curated-mexican-street-phrases-001:es-en',
        noteId: 'curated-mexican-street-phrases-001',
        prompt: 'test phrase',
        answer: 'test answer',
        context: 'simple context',
      }
      const testCards = [...cards, streetCard]

      // Search by pack title
      const byTitle = filterDeckCards(testCards, {
        query: 'Mexican Street Phrases',
        now,
      })
      expect(byTitle.map((c) => c.id)).toEqual([streetCard.id])

      // Search by badge
      const byBadge = filterDeckCards(testCards, { query: 'CDMX', now })
      expect(byBadge.map((c) => c.id)).toEqual([streetCard.id])

      // Search by subtitle
      const bySubtitle = filterDeckCards(testCards, {
        query: 'Spoken CDMX',
        now,
      })
      expect(bySubtitle.map((c) => c.id)).toEqual([streetCard.id])
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

    it('sorts by difficulty descending (spiciest first) and ascending (mildest first)', () => {
      const mildCard: StudyCard = {
        ...testCards[0]!,
        id: 'c-mild',
        prompt: 'árbol',
        schedule: {
          ...testCards[0]!.schedule,
          reviews: 2,
          difficulty: 2.0,
        },
      }
      const mediumCard: StudyCard = {
        ...testCards[1]!,
        id: 'c-med',
        prompt: 'bueno',
        schedule: {
          ...testCards[1]!.schedule,
          reviews: 2,
          difficulty: 5.5,
        },
      }
      const hotCard: StudyCard = {
        ...testCards[2]!,
        id: 'c-hot',
        prompt: 'zapato',
        schedule: {
          ...testCards[2]!.schedule,
          reviews: 2,
          difficulty: 8.5,
        },
      }

      const cardsToSort = [mildCard, hotCard, mediumCard]

      const spiciestFirst = sortDeckCards(cardsToSort, 'difficulty-desc')
      expect(spiciestFirst.map((c) => c.prompt)).toEqual([
        'zapato',
        'bueno',
        'árbol',
      ])

      const mildestFirst = sortDeckCards(cardsToSort, 'difficulty-asc')
      expect(mildestFirst.map((c) => c.prompt)).toEqual([
        'árbol',
        'bueno',
        'zapato',
      ])
    })

    it('sorts by mastery descending (highest first) and ascending (lowest first)', () => {
      const newCard: StudyCard = {
        ...testCards[0]!,
        id: 'c-new',
        prompt: 'árbol',
        schedule: {
          ...testCards[0]!.schedule,
          state: 'new',
          reviews: 0,
          stability: 0,
        },
      }
      const learningCard: StudyCard = {
        ...testCards[1]!,
        id: 'c-learn',
        prompt: 'bueno',
        schedule: {
          ...testCards[1]!.schedule,
          state: 'learning',
          reviews: 2,
          stability: 5.0,
        },
      }
      const masteredCard: StudyCard = {
        ...testCards[2]!,
        id: 'c-master',
        prompt: 'zapato',
        schedule: {
          ...testCards[2]!.schedule,
          state: 'review',
          reviews: 8,
          stability: 45.0,
        },
      }

      const cardsToSort = [learningCard, newCard, masteredCard]

      const highestFirst = sortDeckCards(cardsToSort, 'mastery-desc')
      expect(highestFirst.map((c) => c.prompt)).toEqual([
        'zapato',
        'bueno',
        'árbol',
      ])

      const lowestFirst = sortDeckCards(cardsToSort, 'mastery-asc')
      expect(lowestFirst.map((c) => c.prompt)).toEqual([
        'árbol',
        'bueno',
        'zapato',
      ])
    })

    it('breaks ties on difficulty and mastery sorting by createdAt then prompt', () => {
      const cardA: StudyCard = {
        ...testCards[0]!,
        id: 'c-a',
        prompt: 'árbol',
        createdAt: 200,
        schedule: {
          ...testCards[0]!.schedule,
          state: 'review',
          reviews: 2,
          difficulty: 5.0,
          stability: 10.0,
        },
      }
      const cardB: StudyCard = {
        ...testCards[1]!,
        id: 'c-b',
        prompt: 'bueno',
        createdAt: 100,
        schedule: {
          ...testCards[1]!.schedule,
          state: 'review',
          reviews: 2,
          difficulty: 5.0,
          stability: 10.0,
        },
      }
      const cardC: StudyCard = {
        ...testCards[2]!,
        id: 'c-c',
        prompt: 'zapato',
        createdAt: 100,
        schedule: {
          ...testCards[2]!.schedule,
          state: 'review',
          reviews: 2,
          difficulty: 5.0,
          stability: 10.0,
        },
      }

      const sameMetrics = [cardC, cardB, cardA]

      expect(
        sortDeckCards(sameMetrics, 'difficulty-desc').map((c) => c.prompt),
      ).toEqual(['árbol', 'bueno', 'zapato'])
      expect(
        sortDeckCards(sameMetrics, 'difficulty-asc').map((c) => c.prompt),
      ).toEqual(['árbol', 'bueno', 'zapato'])
      expect(
        sortDeckCards(sameMetrics, 'mastery-desc').map((c) => c.prompt),
      ).toEqual(['árbol', 'bueno', 'zapato'])
      expect(
        sortDeckCards(sameMetrics, 'mastery-asc').map((c) => c.prompt),
      ).toEqual(['árbol', 'bueno', 'zapato'])
    })

    it('sorts alphabetically by answer ascending (A to Z) and descending (Z to A)', () => {
      const cardsWithAnswers = [
        { ...testCards[0]!, answer: 'zebra' },
        { ...testCards[1]!, answer: 'apple' },
        { ...testCards[2]!, answer: 'banana' },
      ]

      const asc = sortDeckCards(cardsWithAnswers, 'answer-asc')
      expect(asc.map((c) => c.answer)).toEqual(['apple', 'banana', 'zebra'])

      const desc = sortDeckCards(cardsWithAnswers, 'answer-desc')
      expect(desc.map((c) => c.answer)).toEqual(['zebra', 'banana', 'apple'])
    })

    it('sorts by direction (ES → EN first vs EN → ES first)', () => {
      const mixedDirections = [
        {
          ...testCards[0]!,
          prompt: 'cat',
          direction: 'en-es' as const,
        },
        {
          ...testCards[1]!,
          prompt: 'gato',
          direction: 'es-en' as const,
        },
        {
          ...testCards[2]!,
          prompt: 'perro',
          direction: 'es-en' as const,
        },
      ]

      const esFirst = sortDeckCards(mixedDirections, 'direction-asc')
      expect(esFirst.map((c) => c.direction)).toEqual([
        'es-en',
        'es-en',
        'en-es',
      ])

      const enFirst = sortDeckCards(mixedDirections, 'direction-desc')
      expect(enFirst.map((c) => c.direction)).toEqual([
        'en-es',
        'es-en',
        'es-en',
      ])
    })

    it('sorts by status ascending (due first) and descending (due last)', () => {
      const refNow = 1000000
      const dueCard: StudyCard = {
        ...testCards[0]!,
        prompt: 'due-card',
        schedule: {
          ...testCards[0]!.schedule,
          state: 'review',
          dueAt: refNow - 1000, // overdue
        },
      }
      const learningCard: StudyCard = {
        ...testCards[1]!,
        prompt: 'learning-card',
        schedule: {
          ...testCards[1]!.schedule,
          state: 'learning',
          dueAt: refNow + 5000,
        },
      }
      const reviewCard: StudyCard = {
        ...testCards[2]!,
        prompt: 'review-card',
        schedule: {
          ...testCards[2]!.schedule,
          state: 'review',
          dueAt: refNow + 86400000,
        },
      }
      const newCard: StudyCard = {
        ...testCards[0]!,
        prompt: 'new-card',
        schedule: {
          ...testCards[0]!.schedule,
          state: 'new',
          dueAt: refNow + 100000,
        },
      }

      const cardsToSort = [newCard, reviewCard, learningCard, dueCard]

      const dueFirst = sortDeckCards(cardsToSort, 'status-asc', refNow)
      expect(dueFirst.map((c) => c.prompt)).toEqual([
        'due-card',
        'learning-card',
        'review-card',
        'new-card',
      ])

      const dueLast = sortDeckCards(cardsToSort, 'status-desc', refNow)
      expect(dueLast.map((c) => c.prompt)).toEqual([
        'new-card',
        'review-card',
        'learning-card',
        'due-card',
      ])
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
