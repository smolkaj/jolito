import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserCardRepository } from './card-repository'

describe('BrowserCardRepository', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a versioned card collection', () => {
    const repository = new BrowserCardRepository()
    const cards = [
      {
        id: 'card-1',
        prompt: 'Hola',
        answer: 'Hello',
        direction: 'es-en' as const,
        createdAt: '2026-08-21T12:00:00.000Z',
      },
    ]

    repository.save(cards)

    expect(repository.load()).toEqual(cards)
    expect(JSON.parse(localStorage.getItem('ritmo-cards') ?? '')).toMatchObject(
      {
        schemaVersion: 1,
      },
    )
  })

  it('migrates the unversioned prototype representation', () => {
    localStorage.setItem(
      'ritmo-cards',
      JSON.stringify([
        {
          id: 1724241600000,
          prompt: 'Hola',
          answer: 'Hello',
          direction: 'es-en',
        },
      ]),
    )

    expect(new BrowserCardRepository().load()).toEqual([
      {
        id: 'legacy-1724241600000',
        prompt: 'Hola',
        answer: 'Hello',
        direction: 'es-en',
        createdAt: '2024-08-21T12:00:00.000Z',
      },
    ])
  })

  it('fails safely when stored data or storage is unavailable', () => {
    localStorage.setItem('ritmo-cards', '{broken')
    expect(new BrowserCardRepository().load()).toBeNull()

    const unavailable = {
      getItem: vi.fn(() => {
        throw new Error('unavailable')
      }),
      setItem: vi.fn(() => {
        throw new Error('full')
      }),
    } as unknown as Storage
    const repository = new BrowserCardRepository(unavailable)
    expect(repository.load()).toBeNull()
    expect(() => repository.save([])).not.toThrow()
  })
})
