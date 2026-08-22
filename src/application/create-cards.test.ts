import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createCards } from './create-cards'

const dependencies = () => {
  let id = 0
  return {
    clock: { now: () => new Date('2026-08-21T12:00:00.000Z') },
    ids: { next: () => `card-${++id}` },
  }
}

describe('createCards', () => {
  it('creates linked cards with deterministic metadata', () => {
    const cards = createCards(
      {
        spanish: ' ¿Dónde está el metro? ',
        english: ' Where is the metro? ',
        bidirectional: true,
      },
      dependencies(),
    )

    expect(cards).toEqual([
      {
        id: 'card-1',
        prompt: '¿Dónde está el metro?',
        answer: 'Where is the metro?',
        direction: 'es-en',
        createdAt: '2026-08-21T12:00:00.000Z',
      },
      {
        id: 'card-2',
        prompt: 'Where is the metro?',
        answer: '¿Dónde está el metro?',
        direction: 'en-es',
        createdAt: '2026-08-21T12:00:00.000Z',
      },
    ])
  })

  it('rejects drafts with a blank side', () => {
    expect(
      createCards(
        { spanish: '   ', english: 'Where?', bidirectional: false },
        dependencies(),
      ),
    ).toEqual([])
  })

  it('always produces one or two non-empty cards with unique IDs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((value) => value.trim().length > 0),
        fc.string({ minLength: 1 }).filter((value) => value.trim().length > 0),
        fc.boolean(),
        (spanish, english, bidirectional) => {
          const cards = createCards(
            { spanish, english, bidirectional },
            dependencies(),
          )

          expect(cards).toHaveLength(bidirectional ? 2 : 1)
          expect(new Set(cards.map(({ id }) => id)).size).toBe(cards.length)
          expect(
            cards.every(
              ({ prompt, answer }) =>
                prompt.trim().length > 0 && answer.trim().length > 0,
            ),
          ).toBe(true)
        },
      ),
    )
  })
})
