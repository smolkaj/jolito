import { describe, expect, it } from 'vitest'
import { findStarterPack, starterPacks } from './starter-decks'

describe('starterPacks', () => {
  it('defines 5 distinct curated starter packs', () => {
    expect(starterPacks).toHaveLength(5)
    const ids = starterPacks.map((p) => p.id)
    expect(ids).toEqual([
      'mexican-street-phrases',
      'common-verbs-1',
      'common-verbs-2',
      'common-verbs-3',
      'common-verbs-4',
    ])
  })

  it('contains exactly 36 notes for mexican street phrases (72 reciprocal cards)', () => {
    const street = findStarterPack('mexican-street-phrases')
    expect(street).toBeDefined()
    expect(street?.noteCount).toBe(36)
    expect(street?.cardCount).toBe(72)

    const cards = street!.createCards(12345)
    expect(cards).toHaveLength(72)
    // Check that curated cards are permanent user cards, not ephemeral demo cards
    expect(cards.every((c) => !c.noteId.startsWith('starter-'))).toBe(true)
    expect(
      cards.every((c) =>
        c.noteId.startsWith('curated-mexican-street-phrases-'),
      ),
    ).toBe(true)
  })

  it('contains 50 notes (100 reciprocal cards) in each of the 4 verb packs, totaling 200 verbs', () => {
    const verbPacks = [
      findStarterPack('common-verbs-1'),
      findStarterPack('common-verbs-2'),
      findStarterPack('common-verbs-3'),
      findStarterPack('common-verbs-4'),
    ]

    let totalVerbs = 0
    let totalCards = 0

    for (const pack of verbPacks) {
      expect(pack).toBeDefined()
      expect(pack?.noteCount).toBe(50)
      expect(pack?.cardCount).toBe(100)
      totalVerbs += pack!.noteCount
      totalCards += pack!.cardCount

      const cards = pack!.createCards(1000)
      expect(cards).toHaveLength(100)
      expect(cards.every((c) => !c.noteId.startsWith('starter-'))).toBe(true)
    }

    expect(totalVerbs).toBe(200)
    expect(totalCards).toBe(400)

    // Verify all 200 verbs are unique across the 4 packs
    const allVerbs = verbPacks.flatMap((p) =>
      p!
        .createCards(0)
        .filter((c) => c.direction === 'es-en')
        .map((c) => c.prompt.toLowerCase().trim()),
    )
    expect(new Set(allVerbs).size).toBe(200)
  })

  it('creates cards with valid schedules and non-empty contexts', () => {
    const street = findStarterPack('mexican-street-phrases')!
    const cards = street.createCards(5000)

    for (const card of cards) {
      expect(card.prompt.trim()).not.toBe('')
      expect(card.answer.trim()).not.toBe('')
      expect(card.context.trim()).not.toBe('')
      expect(card.schedule.state).toBe('new')
      expect(card.schedule.intervalDays).toBe(0)
    }
  })
})
