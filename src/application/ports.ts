import type { StudyCard } from '../domain/card'
import type { AutocompleteSuggestion, LexiconEntry } from '../domain/lexicon'

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

export type CardAssistant = {
  suggest(
    query: string,
    lang?: 'es' | 'en',
    limit?: number,
  ): AutocompleteSuggestion[]
  didYouMean(query: string, lang?: 'es' | 'en'): LexiconEntry | null
  translate(text: string, from?: 'es' | 'en'): LexiconEntry | null
}

export type AppServices = {
  clock: Clock
  ids: IdGenerator
  cards: CardRepository
  speaker: Speaker
  sounds: SoundPlayer
  assistant: CardAssistant
}
