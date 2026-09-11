import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGrammarCards } from '../../domain/grammar'
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

  it('round-trips the versioned collection with Zod schema validation and deletedCardIds', () => {
    const repo = new LocalStorageCardRepository(localStorage)
    repo.save(fallback, ['deleted-id-1', 'deleted-id-2'])
    expect(repo.load([])).toMatchObject({ cards: fallback })
    expect(repo.getDeletedCardIds()).toEqual(['deleted-id-1', 'deleted-id-2'])
    expect(localStorage.getItem('jolito-library-v1')).toContain('deleted-id-1')
  })

  it.each([1, 2])(
    'migrates version %i and retains both tenses across fresh repository instances',
    (version) => {
      localStorage.setItem(
        'jolito-library-v1',
        JSON.stringify({
          version,
          cards: fallback,
          deletedCardIds: ['removed'],
        }),
      )
      const repo = new LocalStorageCardRepository(localStorage)
      const vocabulary = repo.load([]).cards
      expect(vocabulary).toEqual(fallback)
      const grammar = [
        ...createGrammarCards(123).slice(0, 2),
        ...createGrammarCards(123, 'perfect').slice(0, 2),
      ]
      repo.save([...vocabulary, ...grammar])
      expect(
        JSON.parse(localStorage.getItem('jolito-library-v1')!) as unknown,
      ).toMatchObject({ version: 3, deletedCardIds: ['removed'] })
      expect(
        new LocalStorageCardRepository(localStorage).load([]).cards,
      ).toEqual([...vocabulary, ...grammar])
    },
  )

  it('migrates cards from ritmo-library-v1 seamlessly and initializes empty deletedCardIds', () => {
    const repo = new LocalStorageCardRepository(localStorage)
    localStorage.setItem(
      'ritmo-library-v1',
      JSON.stringify({ version: 1, cards: fallback }),
    )
    expect(repo.load([])).toMatchObject({ cards: fallback })
    expect(repo.getDeletedCardIds()).toEqual([])
    expect(localStorage.getItem('jolito-library-v1')).toContain('Hola')
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
    expect(repo.load(fallback).cards[0]).toMatchObject({
      id: 'legacy-42:es-en',
      prompt: '¿Qué onda?',
      context: '',
      schedule: { dueAt: 0 },
    })
    expect(repo.getDeletedCardIds()).toEqual([])
    expect(localStorage.getItem('jolito-library-v1')).toContain('¿Qué onda?')
  })

  it.each([
    ['malformed JSON', '{nope', 'corrupt'],
    [
      'unsupported version',
      JSON.stringify({ version: 999, cards: fallback }),
      'unsupported',
    ],
    [
      'partially corrupt collection',
      JSON.stringify({ version: 3, cards: [...fallback, { prompt: 3 }] }),
      'corrupt',
    ],
  ])(
    'preserves %s through failed save attempts and reload',
    (_name, raw, reason) => {
      localStorage.setItem('jolito-library-v1', raw!)
      // A valid older key must never hide a damaged, newer collection.
      localStorage.setItem(
        'ritmo-library-v1',
        JSON.stringify({ version: 1, cards: [] }),
      )
      for (let reload = 0; reload < 2; reload++) {
        const repo = new LocalStorageCardRepository(localStorage)
        expect(repo.load(fallback)).toMatchObject({
          status: 'recovery',
          reason,
          raw,
          cards: [],
        })
        expect(() => repo.save(fallback, ['deleted'])).toThrow()
        expect(repo.getDeletedCardIds()).toEqual([])
        expect(localStorage.getItem('jolito-library-v1')).toBe(raw)
      }
    },
  )

  it('distinguishes missing storage without writing a demonstration deck on load', () => {
    const repo = new LocalStorageCardRepository(localStorage)
    expect(repo.load(fallback)).toEqual({ status: 'missing', cards: fallback })
    expect(localStorage.length).toBe(0)
    repo.save(fallback)
    expect(new LocalStorageCardRepository(localStorage).load([])).toEqual({
      status: 'loaded',
      cards: fallback,
    })
  })

  it('keeps the last committed deck and tombstones during quota failure, then resumes and reloads', () => {
    const storage = {
      getItem: localStorage.getItem.bind(localStorage),
      setItem: vi.fn(localStorage.setItem.bind(localStorage)),
    }
    const repo = new LocalStorageCardRepository(storage)
    repo.save(fallback, ['old'])
    const committed = localStorage.getItem('jolito-library-v1')
    storage.setItem.mockImplementationOnce(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    expect(() => repo.save([], ['new'])).toThrow()
    expect(repo.getDeletedCardIds()).toEqual(['old'])
    expect(localStorage.getItem('jolito-library-v1')).toBe(committed)
    expect(new LocalStorageCardRepository(storage).load([]).cards).toEqual(
      fallback,
    )
    repo.save([], ['new'])
    const reloaded = new LocalStorageCardRepository(storage)
    expect(reloaded.load(fallback).cards).toEqual([])
    expect(reloaded.getDeletedCardIds()).toEqual(['new'])
  })

  it('preserves legacy bytes when migration cannot commit and supports an explicit retry', () => {
    const raw = JSON.stringify({
      version: 1,
      cards: fallback,
      deletedCardIds: ['old'],
    })
    localStorage.setItem('ritmo-library-v1', raw)
    const storage = {
      getItem: localStorage.getItem.bind(localStorage),
      setItem: vi.fn<(key: string, value: string) => void>(() => {
        throw new Error('Full')
      }),
    }
    const repo = new LocalStorageCardRepository(storage)
    expect(repo.load([])).toMatchObject({
      status: 'recovery',
      reason: 'migration-failed',
      raw,
    })
    expect(() => repo.save([])).toThrow()
    expect(localStorage.getItem('ritmo-library-v1')).toBe(raw)
    expect(localStorage.getItem('jolito-library-v1')).toBeNull()
    storage.setItem.mockImplementation(localStorage.setItem.bind(localStorage))
    expect(repo.load([])).toMatchObject({ status: 'migrated', cards: fallback })
    expect(new LocalStorageCardRepository(storage).load([])).toMatchObject({
      status: 'loaded',
      cards: fallback,
    })
  })

  it('blocks writes while storage cannot be read and resumes only after a successful load', () => {
    const storage = {
      getItem: vi.fn((): string | null => {
        throw new Error('Denied')
      }),
      setItem: vi.fn(),
    }
    const repo = new LocalStorageCardRepository(storage)
    expect(repo.load(fallback)).toMatchObject({
      status: 'recovery',
      reason: 'unavailable',
      raw: null,
    })
    expect(() => repo.save(fallback)).toThrow()
    expect(storage.setItem).not.toHaveBeenCalled()
    storage.getItem.mockReturnValue(null)
    expect(repo.load(fallback).status).toBe('missing')
    repo.save(fallback)
    expect(storage.setItem).toHaveBeenCalledOnce()
  })
})
