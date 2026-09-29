import { describe, expect, it } from 'vitest'
import {
  filterOutStarterCards,
  isStarterCard,
  starterCards,
  starterHeroPrefetchItems,
  starterHeroSampleCards,
} from './starter-cards'
import { createStudyCards, orderCardsForReview } from '../domain/card'

describe('starterCards', () => {
  it('provides hero sample card definitions and prefetch items for the starter screen', () => {
    expect(starterHeroSampleCards).toEqual({
      spanish: {
        text: 'aguacate',
        locale: 'es-MX',
        cardSeed: 'sample-aguacate',
      },
      english: {
        text: 'avocado',
        locale: 'en-US',
        cardSeed: 'sample-aguacate',
      },
    })
    expect(starterHeroPrefetchItems).toEqual([
      starterHeroSampleCards.spanish,
      starterHeroSampleCards.english,
    ])
  })
  it('provides 6 starter cards with starter noteId prefixes', () => {
    expect(starterCards).toHaveLength(6)
    expect(starterCards.every(isStarterCard)).toBe(true)
  })

  it('correctly identifies starter cards vs user created cards', () => {
    const userCards = createStudyCards(
      {
        spanish: 'chido',
        english: 'cool',
        context: 'slang',
        bidirectional: true,
      },
      'note-123',
      0,
    )

    expect(isStarterCard(starterCards[0]!)).toBe(true)
    expect(isStarterCard(userCards[0]!)).toBe(false)
  })

  it('filters out starter cards from a mixed collection', () => {
    const userCards = createStudyCards(
      {
        spanish: 'popote',
        english: 'straw',
        context: '',
        bidirectional: false,
      },
      'note-456',
      0,
    )

    const mixed = [...starterCards, ...userCards]
    const filtered = filterOutStarterCards(mixed)

    expect(filtered).toEqual(userCards)
    expect(filtered).toHaveLength(1)
    expect(filtered.some(isStarterCard)).toBe(false)
  })

  it('keeps starter aguacate clean without filler context while retaining context on qué padre and ajolote', () => {
    const aguacateCards = starterCards.filter(
      (c) => c.noteId === 'starter-aguacate',
    )
    const quePadreCards = starterCards.filter(
      (c) => c.noteId === 'starter-que-padre',
    )
    const ajoloteCards = starterCards.filter(
      (c) => c.noteId === 'starter-x-ajolote',
    )

    expect(aguacateCards).toHaveLength(2)
    expect(aguacateCards.every((c) => c.context === '')).toBe(true)

    expect(quePadreCards).toHaveLength(2)
    expect(quePadreCards.every((c) => c.context.trim().length > 0)).toBe(true)

    expect(ajoloteCards).toHaveLength(2)
    expect(
      ajoloteCards.every(
        (c) =>
          c.context.includes('namesake of Jolito') &&
          c.context.includes('salamander'),
      ),
    ).toBe(true)
  })

  it('orders starter cards in the curated sequence: avocado EN->MEX, qué padre MEX->EN, and axolotl EN->MEX', () => {
    const now = 1000 * 60 * 60 * 24 * 365 // 1 year after epoch
    const ordered = orderCardsForReview(starterCards, now)

    expect(ordered).toHaveLength(6)

    // Primary cohort (first 3 demo cards)
    expect(
      ordered.slice(0, 3).map((c) => ({
        id: c.id,
        prompt: c.prompt,
        answer: c.answer,
        direction: c.direction,
      })),
    ).toEqual([
      {
        id: 'starter-aguacate:en-es',
        prompt: 'avocado',
        answer: 'aguacate',
        direction: 'en-es',
      },
      {
        id: 'starter-que-padre:es-en',
        prompt: 'qué padre',
        answer: 'how cool',
        direction: 'es-en',
      },
      {
        id: 'starter-x-ajolote:en-es',
        prompt: 'axolotl',
        answer: 'ajolote',
        direction: 'en-es',
      },
    ])

    // Secondary cohort (staggered siblings)
    expect(
      ordered.slice(3, 6).map((c) => ({
        id: c.id,
        prompt: c.prompt,
        answer: c.answer,
        direction: c.direction,
      })),
    ).toEqual([
      {
        id: 'starter-aguacate:es-en',
        prompt: 'aguacate',
        answer: 'avocado',
        direction: 'es-en',
      },
      {
        id: 'starter-que-padre:en-es',
        prompt: 'how cool',
        answer: 'qué padre',
        direction: 'en-es',
      },
      {
        id: 'starter-x-ajolote:es-en',
        prompt: 'ajolote',
        answer: 'axolotl',
        direction: 'es-en',
      },
    ])
  })
})
