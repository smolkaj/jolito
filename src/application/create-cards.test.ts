import { describe, expect, it } from 'vitest'
import { createCards } from './create-cards'

describe('createCards use case', () => {
  it('creates cards with injected clock and id services', () => {
    const fixedNow = 1771632000000
    let idCount = 0
    const clock = { now: () => fixedNow }
    const ids = { nextId: (prefix = 'id') => `${prefix}-${++idCount}` }

    const cards = createCards(
      {
        spanish: '¿Cuánto cuesta?',
        english: 'How much does it cost?',
        context: 'Useful for shopping',
        bidirectional: true,
      },
      { clock, ids },
    )

    expect(cards).toHaveLength(2)
    expect(cards[0]).toMatchObject({
      id: 'note-1:es-en',
      noteId: 'note-1',
      prompt: '¿Cuánto cuesta?',
      answer: 'How much does it cost?',
      direction: 'es-en',
      schedule: {
        dueAt: fixedNow,
        intervalDays: 0,
        reviews: 0,
        lapses: 0,
      },
    })
    expect(cards[1]).toMatchObject({
      id: 'note-1:en-es',
      noteId: 'note-1',
      prompt: 'How much does it cost?',
      answer: '¿Cuánto cuesta?',
      direction: 'en-es',
    })
  })
})
