import type { Card } from '../domain/card'

export interface CardRepository {
  load(): Card[] | null
  save(cards: readonly Card[]): void
}

export interface Clock {
  now(): Date
}

export interface IdGenerator {
  next(): string
}

export interface Speaker {
  speak(text: string, locale: 'en-US' | 'es-MX'): void
}

export type AppServices = {
  cards: CardRepository
  clock: Clock
  ids: IdGenerator
  speaker: Speaker
}
