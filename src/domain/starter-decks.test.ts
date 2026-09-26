import { describe, expect, it } from 'vitest'
import {
  findStarterPack,
  getStarterNoteCardsInDeck,
  getStarterPackCardsInDeck,
  getStarterPackForCard,
  getStarterPackIdFromNoteId,
  starterPacks,
} from './starter-decks'

describe('starterPacks', () => {
  it('defines 10 distinct curated starter packs', () => {
    expect(starterPacks).toHaveLength(10)
    const ids = starterPacks.map((p) => p.id)
    expect(ids).toEqual([
      'mexican-street-phrases',
      'founder-condesa-notebook',
      'common-verbs-1',
      'common-verbs-2',
      'common-verbs-3',
      'common-verbs-4',
      'common-connectors',
      'common-adjectives',
      'common-idioms',
      'common-adverbs',
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
        /^(Example:|Mnemonic:|Literally:|Literal:|Note:)/.test(
          c.context.trim(),
        ),
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

  it('contains exactly 50 notes (100 reciprocal cards) for top connectors', () => {
    const connectors = findStarterPack('common-connectors')
    expect(connectors).toBeDefined()
    expect(connectors?.title).toBe('Top Connectors: 1–50')
    expect(connectors?.badge).toBe('Connectors')
    expect(connectors?.themeColor).toBe('turquesa')
    expect(connectors?.noteCount).toBe(50)
    expect(connectors?.cardCount).toBe(100)

    const cards = connectors!.createCards(12345)
    expect(cards).toHaveLength(100)
    expect(cards.every((c) => !c.noteId.startsWith('starter-'))).toBe(true)
    expect(
      cards.every((c) => c.noteId.startsWith('curated-common-connectors-')),
    ).toBe(true)
    expect(
      cards.every((c) =>
        /^Example: "[^"]+" \("[^"]+"\)$/.test(c.context.trim()),
      ),
    ).toBe(true)

    // Verify all 50 Spanish prompts are unique
    const spanishPrompts = cards
      .filter((c) => c.direction === 'es-en')
      .map((c) => c.prompt.toLowerCase().trim())
    expect(new Set(spanishPrompts).size).toBe(50)
  })

  it('contains exactly 50 notes (100 reciprocal cards) for top adjectives', () => {
    const adjectives = findStarterPack('common-adjectives')
    expect(adjectives).toBeDefined()
    expect(adjectives?.title).toBe('Top Adjectives: 1–50')
    expect(adjectives?.badge).toBe('Adjectives')
    expect(adjectives?.themeColor).toBe('cempasuchil')
    expect(adjectives?.noteCount).toBe(50)
    expect(adjectives?.cardCount).toBe(100)

    const cards = adjectives!.createCards(12345)
    expect(cards).toHaveLength(100)
    expect(cards.every((c) => !c.noteId.startsWith('starter-'))).toBe(true)
    expect(
      cards.every((c) => c.noteId.startsWith('curated-common-adjectives-')),
    ).toBe(true)
    expect(
      cards.every((c) =>
        /^Example: "[^"]+" \("[^"]+"\)$/.test(c.context.trim()),
      ),
    ).toBe(true)

    // Verify all 50 Spanish prompts are unique
    const spanishPrompts = cards
      .filter((c) => c.direction === 'es-en')
      .map((c) => c.prompt.toLowerCase().trim())
    expect(new Set(spanishPrompts).size).toBe(50)
  })

  it('contains exactly 30 notes (60 reciprocal cards) for top idioms', () => {
    const idioms = findStarterPack('common-idioms')
    expect(idioms).toBeDefined()
    expect(idioms?.title).toBe('Top Idioms: 1–30')
    expect(idioms?.badge).toBe('Idioms')
    expect(idioms?.themeColor).toBe('tezontle')
    expect(idioms?.noteCount).toBe(30)
    expect(idioms?.cardCount).toBe(60)

    const cards = idioms!.createCards(12345)
    expect(cards).toHaveLength(60)
    expect(cards.every((c) => !c.noteId.startsWith('starter-'))).toBe(true)
    expect(
      cards.every((c) => c.noteId.startsWith('curated-common-idioms-')),
    ).toBe(true)
    expect(
      cards.every((c) =>
        /^Example: "[^"]+" \("[^"]+"\)$/.test(c.context.trim()),
      ),
    ).toBe(true)

    // Verify all 30 Spanish prompts are unique
    const spanishPrompts = cards
      .filter((c) => c.direction === 'es-en')
      .map((c) => c.prompt.toLowerCase().trim())
    expect(new Set(spanishPrompts).size).toBe(30)
  })

  it('contains exactly 50 notes (100 reciprocal cards) for top adverbs', () => {
    const adverbs = findStarterPack('common-adverbs')
    expect(adverbs).toBeDefined()
    expect(adverbs?.title).toBe('Top Adverbs: 1–50')
    expect(adverbs?.badge).toBe('Adverbs')
    expect(adverbs?.themeColor).toBe('maya')
    expect(adverbs?.noteCount).toBe(50)
    expect(adverbs?.cardCount).toBe(100)

    const cards = adverbs!.createCards(12345)
    expect(cards).toHaveLength(100)
    expect(cards.every((c) => !c.noteId.startsWith('starter-'))).toBe(true)
    expect(
      cards.every((c) => c.noteId.startsWith('curated-common-adverbs-')),
    ).toBe(true)
    expect(
      cards.every((c) =>
        /^Example: "[^"]+" \("[^"]+"\)$/.test(c.context.trim()),
      ),
    ).toBe(true)

    // Verify all 50 Spanish prompts are unique
    const spanishPrompts = cards
      .filter((c) => c.direction === 'es-en')
      .map((c) => c.prompt.toLowerCase().trim())
    expect(new Set(spanishPrompts).size).toBe(50)
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

  it('ensures founder deck has zero vocabulary overlap with other starter packs', () => {
    const founderPack = findStarterPack('founder-condesa-notebook')!
    const founderSpanish = new Set(
      founderPack
        .createCards(0)
        .map((c) => (c.direction === 'es-en' ? c.prompt : c.answer)),
    )
    for (const pack of starterPacks) {
      if (pack.id === 'founder-condesa-notebook') continue
      const otherSpanish = new Set(
        pack
          .createCards(0)
          .map((c) => (c.direction === 'es-en' ? c.prompt : c.answer)),
      )
      const overlap = [...founderSpanish].filter((w) => otherSpanish.has(w))
      expect(overlap).toEqual([])
    }
  })

  it('extracts pack id from note id and finds starter pack for cards', () => {
    expect(
      getStarterPackIdFromNoteId('curated-mexican-street-phrases-001'),
    ).toBe('mexican-street-phrases')
    expect(getStarterPackIdFromNoteId('curated-common-verbs-1-042')).toBe(
      'common-verbs-1',
    )
    expect(getStarterPackIdFromNoteId('starter-aguacate')).toBeNull()
    expect(getStarterPackIdFromNoteId('custom-note-123')).toBeNull()

    const streetPack = findStarterPack('mexican-street-phrases')!
    const cards = streetPack.createCards(0)
    expect(getStarterPackForCard(cards[0]!)).toBe(streetPack)

    // Non-curated card returns undefined
    const customCard = {
      ...cards[0]!,
      noteId: 'custom-note',
      id: 'custom-card',
    }
    expect(getStarterPackForCard(customCard)).toBeUndefined()
  })

  it('filters pack and note cards from deck collection', () => {
    const streetPack = findStarterPack('mexican-street-phrases')!
    const verbPack = findStarterPack('common-verbs-1')!
    const streetCards = streetPack.createCards(0)
    const verbCards = verbPack.createCards(0)
    const allCards = [...streetCards, ...verbCards]

    const inDeckStreet = getStarterPackCardsInDeck(
      allCards,
      'mexican-street-phrases',
    )
    expect(inDeckStreet).toHaveLength(streetCards.length)
    expect(
      inDeckStreet.every((c) =>
        c.noteId.startsWith('curated-mexican-street-phrases-'),
      ),
    ).toBe(true)

    const noteCards = getStarterNoteCardsInDeck(
      allCards,
      'mexican-street-phrases',
      0,
    )
    expect(noteCards).toHaveLength(2)
    expect(
      noteCards.every((c) => c.noteId === 'curated-mexican-street-phrases-001'),
    ).toBe(true)

    // Non-existent pack returns empty
    expect(getStarterPackCardsInDeck(allCards, 'unknown-pack')).toEqual([])
    expect(
      getStarterNoteCardsInDeck(allCards, 'mexican-street-phrases', 999),
    ).toEqual([])
  })
})
