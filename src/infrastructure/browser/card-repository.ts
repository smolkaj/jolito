import { z } from 'zod'
import {
  cardCollectionSchema,
  cardDirectionSchema,
  type Card,
  type CardCollection,
} from '../../domain/card'
import type { CardRepository } from '../../application/ports'

const STORAGE_KEY = 'ritmo-cards'

const legacyCardSchema = z.object({
  id: z.union([z.number(), z.string()]),
  prompt: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  direction: cardDirectionSchema,
})

const legacyCollectionSchema = z.array(legacyCardSchema)

function migrateLegacyCards(value: unknown): Card[] | null {
  const parsed = legacyCollectionSchema.safeParse(value)
  if (!parsed.success) return null

  return parsed.data.map((card) => ({
    ...card,
    id: `legacy-${String(card.id)}`,
    createdAt:
      typeof card.id === 'number' && Number.isFinite(card.id)
        ? new Date(Math.max(0, card.id)).toISOString()
        : '1970-01-01T00:00:00.000Z',
  }))
}

function decodeCollection(serialized: string): Card[] | null {
  try {
    const value: unknown = JSON.parse(serialized)
    const current = cardCollectionSchema.safeParse(value)
    if (current.success) return current.data.cards
    return migrateLegacyCards(value)
  } catch {
    return null
  }
}

export class BrowserCardRepository implements CardRepository {
  constructor(private readonly storage: Storage = window.localStorage) {}

  load(): Card[] | null {
    try {
      const serialized = this.storage.getItem(STORAGE_KEY)
      return serialized === null ? null : decodeCollection(serialized)
    } catch {
      return null
    }
  }

  save(cards: readonly Card[]): void {
    const collection: CardCollection = {
      schemaVersion: 1,
      cards: [...cards],
    }

    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(collection))
    } catch {
      // Storage can be unavailable or full. Review remains usable in memory.
    }
  }
}
