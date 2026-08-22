import { beforeEach, describe, expect, it } from 'vitest'
import { createStudyCards } from './domain/card'
import { loadCards, saveCards } from './cardStore'

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

describe('card storage', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips the versioned collection', () => {
    saveCards(localStorage, fallback)
    expect(loadCards(localStorage, [])).toEqual(fallback)
  })

  it('migrates cards from the first prototype', () => {
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
    expect(loadCards(localStorage, fallback)[0]).toMatchObject({
      id: 'legacy-42:es-en',
      prompt: '¿Qué onda?',
      context: '',
      schedule: { dueAt: 0 },
    })
  })

  it('falls back safely when stored data is malformed', () => {
    localStorage.setItem('ritmo-library-v1', '{nope')
    localStorage.setItem('ritmo-cards', JSON.stringify([{ prompt: 3 }]))
    expect(loadCards(localStorage, fallback)).toBe(fallback)
  })
})
