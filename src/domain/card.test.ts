import { describe, expect, it } from 'vitest'
import { cardCollectionSchema } from './card'

describe('cardCollectionSchema', () => {
  it('accepts the current versioned representation', () => {
    expect(
      cardCollectionSchema.safeParse({
        schemaVersion: 1,
        cards: [
          {
            id: 'card-1',
            prompt: 'Hola',
            answer: 'Hello',
            direction: 'es-en',
            createdAt: '2026-08-21T12:00:00.000Z',
          },
        ],
      }).success,
    ).toBe(true)
  })

  it('rejects unknown versions and invalid cards', () => {
    expect(
      cardCollectionSchema.safeParse({ schemaVersion: 2, cards: [] }).success,
    ).toBe(false)
    expect(
      cardCollectionSchema.safeParse({
        schemaVersion: 1,
        cards: [{ id: '', prompt: '', answer: '', direction: 'unknown' }],
      }).success,
    ).toBe(false)
  })
})
