import type { StudyCard } from '../domain/card'

export type Clock = {
  now(): number
}

export type IdGenerator = {
  nextId(prefix?: string): string
}

export type CardRepository = {
  load(fallback: StudyCard[]): StudyCard[]
  save(cards: StudyCard[]): void
}

export type Speaker = {
  speak(text: string, locale: string): boolean
  supported(): boolean
}

export type Earcon = 'reveal' | 'again' | 'hard' | 'good' | 'easy' | 'complete'

export type SoundPlayer = {
  play(earcon: Earcon): void
}

export type AppServices = {
  clock: Clock
  ids: IdGenerator
  cards: CardRepository
  speaker: Speaker
  sounds: SoundPlayer
}
