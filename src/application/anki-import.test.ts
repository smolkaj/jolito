import { describe, it, expect } from 'vitest'
import type { StudyCard } from '../domain/card'
import type { Clock } from './ports'
import { applyAnkiImport } from './anki-import'
import { parseAnkiDeck } from '../domain/anki-import'
import type { RestoreMode } from './deck-backup'

async function importAnkiDeck(
  currentCards: StudyCard[],
  data: string,
  mode: RestoreMode,
  clock: Clock,
  filename: string,
  deletedIds: string[] = [],
) {
  return applyAnkiImport(
    currentCards,
    await parseAnkiDeck(data, filename, clock.now()),
    mode,
    deletedIds,
  )
}

describe('importAnkiDeck application service', () => {
  const mockClock: Clock = {
    now: () => 1700000000000,
  }

  const existingCards: StudyCard[] = [
    {
      id: 'existing-1:es-en',
      noteId: 'existing-1',
      prompt: 'perro',
      answer: 'dog',
      direction: 'es-en',
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'review',
        dueAt: 1700000000000,
        intervalDays: 5,
        easeFactor: 2.5,
        reviews: 3,
        lapses: 0,
      },
      createdAt: 1700000000000,
    },
  ]

  it('imports and replaces cards when mode is replace', async () => {
    const text = 'gato\tcat\ncaballo\thorse'
    const result = await importAnkiDeck(
      existingCards,
      text,
      'replace',
      mockClock,
      'deck.txt',
    )

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.count).toBe(2)
    expect(result.addedCount).toBe(2)
    expect(result.cards.some((c) => c.prompt === 'perro')).toBe(false)
    expect(result.cards[0]?.prompt).toBe('gato')
  })

  it('imports and merges cards when mode is merge', async () => {
    const text = 'gato\tcat'
    const result = await importAnkiDeck(
      existingCards,
      text,
      'merge',
      mockClock,
      'deck.txt',
    )

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.count).toBe(2)
    expect(result.addedCount).toBe(1)
    expect(result.cards.some((c) => c.prompt === 'perro')).toBe(true)
    expect(result.cards.some((c) => c.prompt === 'gato')).toBe(true)
  })

  it('preserves existing card and schedule when importing duplicate prompt on merge', async () => {
    const text = 'perro\tdog' // identical prompt
    const result = await importAnkiDeck(
      existingCards,
      text,
      'merge',
      mockClock,
      'deck.txt',
    )

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.count).toBe(1)
    expect(result.cards[0]?.id).toBe('existing-1:es-en')
    expect(result.cards[0]?.schedule.reviews).toBe(3)
  })

  it('fails gracefully with error when content is invalid', async () => {
    const result = await importAnkiDeck(
      existingCards,
      '   \n\n  ',
      'replace',
      mockClock,
      'empty.txt',
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeDefined()
    }
  })
})

describe('text import identity lifecycle', () => {
  const clock = { now: () => 1000 }

  it('imports unrelated files at the same row without skipping either, then deduplicates renamed and reordered imports', async () => {
    const first = await importAnkiDeck(
      [],
      'hola\thello\nadiós\tgoodbye',
      'merge',
      clock,
      'first.tsv',
    )
    expect(first.success).toBe(true)
    if (!first.success) return
    const second = await importAnkiDeck(
      first.cards,
      'gato\tcat',
      'merge',
      clock,
      'second.tsv',
    )
    expect(second).toMatchObject({
      success: true,
      addedCount: 1,
      skippedCount: 0,
      count: 3,
    })
    if (!second.success) return
    expect(new Set(second.cards.map((card) => card.id)).size).toBe(3)
    const repeated = await importAnkiDeck(
      second.cards,
      'adiós\tgoodbye\nhola\thello',
      'merge',
      clock,
      'renamed.tsv',
    )
    expect(repeated).toMatchObject({
      success: true,
      addedCount: 0,
      skippedCount: 2,
      cards: second.cards,
    })
  })

  it('preserves old row identities and review history while new files use collision-safe identities', async () => {
    const original = await importAnkiDeck(
      [],
      'hola\thello',
      'replace',
      clock,
      'old.tsv',
    )
    if (!original.success) throw new Error(original.error)
    const legacy = {
      ...original.cards[0]!,
      id: 'anki-txt-1:es-en',
      noteId: 'anki-txt-1',
      schedule: { ...original.cards[0]!.schedule, reviews: 8 },
    }
    const imported = await importAnkiDeck(
      [legacy],
      'gato\tcat\nhola\thello',
      'merge',
      clock,
      'new.tsv',
    )
    expect(imported).toMatchObject({
      success: true,
      addedCount: 1,
      skippedCount: 1,
      count: 2,
    })
    if (!imported.success) return
    expect(imported.cards[0]).toEqual(legacy)
    expect(imported.cards[1]!.id).not.toBe(legacy.id)
  })

  it('deduplicates within replacement imports and keeps opposite directions distinct', async () => {
    const result = await importAnkiDeck(
      [],
      'hola\thello\nHOLA\thello\nwhere\tdónde',
      'replace',
      clock,
      'duplicate.tsv',
    )
    expect(result).toMatchObject({
      success: true,
      addedCount: 2,
      skippedCount: 1,
      count: 2,
    })
    if (!result.success) return
    expect(new Set(result.cards.map((card) => card.id)).size).toBe(2)
    expect(result.cards.map((card) => card.direction)).toEqual([
      'es-en',
      'en-es',
    ])
  })
})
