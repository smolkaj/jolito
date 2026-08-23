import type { StudyCard } from '../domain/card'
import type { AutocompleteSuggestion, LexiconEntry } from '../domain/lexicon'
import type { SyncStatus } from '../domain/sync'

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

export type AuthUser = {
  id: string
  email: string
}

export type AuthService = {
  getUser(): Promise<AuthUser | null>
  sendMagicLink(
    email: string,
  ): Promise<{ success: boolean; error?: string | undefined }>
  verifyOtp(
    email: string,
    token: string,
  ): Promise<{ success: boolean; error?: string | undefined }>
  signOut(): Promise<void>
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void
}

export type SyncResult = {
  success: boolean
  cards?: StudyCard[] | undefined
  error?: string | undefined
  syncedAt?: number | undefined
}

export type SyncService = {
  getStatus(): SyncStatus
  pushDeck(cards: StudyCard[], user: AuthUser): Promise<SyncResult>
  pullDeck(user: AuthUser): Promise<SyncResult>
  syncDeck(localCards: StudyCard[], user: AuthUser): Promise<SyncResult>
}

export type AppServices = {
  clock: Clock
  ids: IdGenerator
  cards: CardRepository
  speaker: Speaker
  sounds: SoundPlayer
  assistant: CardAssistant
  auth: AuthService
  sync: SyncService
}
