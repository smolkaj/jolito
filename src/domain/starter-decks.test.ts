import { describe, expect, it } from 'vitest'
import { findStarterPack, starterPacks } from './starter-decks'

describe('starterPacks', () => {
  it('defines 6 distinct curated starter packs', () => {
    expect(starterPacks).toHaveLength(6)
    const ids = starterPacks.map((p) => p.id)
    expect(ids).toEqual([
      'mexican-street-phrases',
      'founder-condesa-notebook',
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

  it("contains exactly 35 notes for founder's condesa notebook (70 reciprocal cards)", () => {
    const founder = findStarterPack('founder-condesa-notebook')
    expect(founder).toBeDefined()
    expect(founder?.noteCount).toBe(35)
    expect(founder?.cardCount).toBe(70)
    expect(founder?.badge).toBe('🥑 Founder')
    expect(founder?.themeColor).toBe('cempasuchil')

    const cards = founder!.createCards(12345)
    expect(cards).toHaveLength(70)
    expect(cards.every((c) => !c.noteId.startsWith('starter-'))).toBe(true)
    expect(
      cards.every((c) =>
        c.noteId.startsWith('curated-founder-condesa-notebook-'),
      ),
    ).toBe(true)
    // Verify authentic context qualification: all non-empty contexts start with 'Example:', 'Mnemonic:', or 'Note:'
    const cardsWithContext = cards.filter((c) => c.context.trim().length > 0)
    expect(cardsWithContext.length).toBeGreaterThan(0)
    expect(
      cardsWithContext.every((c) =>
        /^(Example:|Mnemonic:|Note:)/.test(c.context.trim()),
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

  it('retains slang and spoken etiquette contexts in street phrases while omitting boilerplate context from common verb packs', () => {
    const street = findStarterPack('mexican-street-phrases')!
    const streetCards = street.createCards(5000)

    for (const card of streetCards) {
      expect(card.prompt.trim()).not.toBe('')
      expect(card.answer.trim()).not.toBe('')
      expect(card.context.trim()).not.toBe('')
      expect(card.schedule.state).toBe('new')
      expect(card.schedule.intervalDays).toBe(0)
    }

    const verbPacks = [
      findStarterPack('common-verbs-1')!,
      findStarterPack('common-verbs-2')!,
      findStarterPack('common-verbs-3')!,
      findStarterPack('common-verbs-4')!,
    ]

    for (const pack of verbPacks) {
      const cards = pack.createCards(0)
      expect(cards.every((c) => c.context === '')).toBe(true)
    }
  })

  it('creates individual note cards by index and handles out-of-bounds', () => {
    const street = findStarterPack('mexican-street-phrases')!
    // Default now = 0
    const firstNoteCards = street.createNoteCards(0)
    expect(firstNoteCards).toHaveLength(2)
    expect(firstNoteCards[0]?.noteId).toBe('curated-mexican-street-phrases-001')
    expect(firstNoteCards[0]?.schedule.dueAt).toBe(0)

    // Explicit now parameter
    const noteCardsWithTimestamp = street.createNoteCards(1, 99999)
    expect(noteCardsWithTimestamp).toHaveLength(2)
    expect(noteCardsWithTimestamp[0]?.noteId).toBe(
      'curated-mexican-street-phrases-002',
    )
    expect(noteCardsWithTimestamp[0]?.schedule.dueAt).toBe(99999)

    // Out of bounds returns empty array
    expect(street.createNoteCards(-1)).toEqual([])
    expect(street.createNoteCards(999)).toEqual([])
  })

  it('returns undefined for non-existent pack id', () => {
    expect(findStarterPack('non-existent-pack')).toBeUndefined()
  })
})
