import type { Card } from '../domain/card'
import type { Clock, IdGenerator } from './ports'

export type CardDraft = {
  spanish: string
  english: string
  bidirectional: boolean
}

type CreateCardDependencies = {
  clock: Clock
  ids: IdGenerator
}

export function createCards(
  draft: CardDraft,
  { clock, ids }: CreateCardDependencies,
): Card[] {
  const spanish = draft.spanish.trim()
  const english = draft.english.trim()

  if (!spanish || !english) return []

  const createdAt = clock.now().toISOString()
  const cards: Card[] = [
    {
      id: ids.next(),
      prompt: spanish,
      answer: english,
      direction: 'es-en',
      createdAt,
    },
  ]

  if (draft.bidirectional) {
    cards.push({
      id: ids.next(),
      prompt: english,
      answer: spanish,
      direction: 'en-es',
      createdAt,
    })
  }

  return cards
}
