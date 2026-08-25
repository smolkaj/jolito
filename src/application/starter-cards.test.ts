import { describe, expect, it } from 'vitest'
import {
  filterOutStarterCards,
  isStarterCard,
  starterCards,
} from './starter-cards'
import { createStudyCards } from '../domain/card'

describe('starterCards', () => {
  it('provides 4 starter cards with starter noteId prefixes', () => {
    expect(starterCards).toHaveLength(4)
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
})
