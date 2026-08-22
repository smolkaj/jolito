import { beforeEach, describe, expect, it } from 'vitest'
import { createStudyCards } from '../../domain/card'
import { LocalStorageCardRepository } from './card-repository'

const fallback = createStudyCards(
  {
    spanish: 'Hola',
    english: 'Hello',
    context: '',
    bidirectional: false,
  },
  'fallback',
  0,
)

describe('LocalStorageCardRepository', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips the versioned collection with Zod schema validation', () => {
    const repo = new LocalStorageCardRepository(localStorage)
    repo.save(fallback)
    expect(repo.load([])).toEqual(fallback)
  })

  it('migrates cards from the first prototype', () => {
    const repo = new LocalStorageCardRepository(localStorage)
    localStorage.setItem(
      'ritmo-cards',
      JSON.stringify([
        {
          id: 42,
          prompt: '¿Qué onda?',
          answer: "What's up?",
          direction: 'es-en',
        },
      ]),
    )
    expect(repo.load(fallback)[0]).toMatchObject({
      id: 'legacy-42:es-en',
      prompt: '¿Qué onda?',
      context: '',
      schedule: { dueAt: 0 },
    })
  })

  it('falls back safely when stored data is malformed or invalid according to schema', () => {
    const repo = new LocalStorageCardRepository(localStorage)
    localStorage.setItem('ritmo-library-v1', '{nope')
    localStorage.setItem('ritmo-cards', JSON.stringify([{ prompt: 3 }]))
    expect(repo.load(fallback)).toBe(fallback)
  })
})
