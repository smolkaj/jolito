import type { Card } from '../domain/card'
import type { AppServices, CardRepository } from '../application/ports'

export class MemoryCardRepository implements CardRepository {
  saved: Card[] | null

  constructor(initial: Card[] | null = null) {
    this.saved = initial
  }

  load(): Card[] | null {
    return this.saved
  }

  save(cards: readonly Card[]): void {
    this.saved = [...cards]
  }
}

export function createTestServices(
  cards = new MemoryCardRepository(),
): AppServices {
  let id = 0
  return {
    cards,
    clock: { now: () => new Date('2026-08-21T12:00:00.000Z') },
    ids: { next: () => `test-card-${++id}` },
    speaker: { speak: () => undefined },
  }
}
