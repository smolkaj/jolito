import { describe, it, expect } from 'vitest'
import type { StudyCard } from '../domain/card'
import type { Clock } from './ports'
import { importAnkiDeck } from './anki-import'

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
    expect(result.importedCount).toBe(2)
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
    expect(result.importedCount).toBe(1)
    expect(result.cards.some((c) => c.prompt === 'perro')).toBe(true)
    expect(result.cards.some((c) => c.prompt === 'gato')).toBe(true)
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
