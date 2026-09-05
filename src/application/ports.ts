import type { StudyCard } from '../domain/card'
import type { FeedbackSubmission } from '../domain/feedback'
import type { AutocompleteSuggestion, LexiconEntry } from '../domain/lexicon'
import type { SyncStatus } from '../domain/sync'

export type { FeedbackSubmission }

export type Clock = {
  now(): number
}

export type IdGenerator = {
  nextId(prefix?: string): string
}

export type CardRepository = {
  load(fallback: StudyCard[]): StudyCard[]
  getDeletedCardIds(): string[]
  save(cards: StudyCard[], deletedCardIds?: string[]): void
}

export type SpeakerOptions = {
  cardSeed?: string | undefined
  voice?: string | undefined
  gender?: 'female' | 'male' | undefined
  dualVoice?: boolean | undefined
}

export type PrefetchItem = {
  text: string
  locale: string
  cardSeed?: string | undefined
  voice?: string | undefined
  bothVoices?: boolean | undefined
}

export type Speaker = {
  speak(text: string, locale: string, options?: SpeakerOptions): boolean
  supported(): boolean
  prewarm?(): Promise<boolean> | boolean | Promise<void> | void
  prefetch?(items: PrefetchItem[]): Promise<void> | void
  pruneUnusedAudio?(
    activeItems: Array<{ text: string; locale: string }>,
  ): Promise<number> | number | void
  stop?(): void
}

export type Earcon = 'reveal' | 'again' | 'hard' | 'good' | 'easy' | 'complete'

export type SoundPlayer = {
  play(earcon: Earcon): void
}

export type HapticEffect =
  'selection' | 'again' | 'hard' | 'good' | 'easy' | 'complete'

export type HapticsPlayer = {
  trigger(effect: HapticEffect): void
}

export type CardAssistant = {
  suggest(
    query: string,
    lang?: 'es' | 'en',
    limit?: number,
  ): AutocompleteSuggestion[]
  translate(text: string, from?: 'es' | 'en'): LexiconEntry | null
  loadDictionary?(): Promise<boolean> | boolean | Promise<void> | void
}

export type AuthUser = {
  id: string
  email: string
}

export type AuthService = {
  getUser(): Promise<AuthUser | null>
  isConfigured?(): boolean
  consumeRedirectAuth?(): boolean
  getSessionLink?(): string | null
  getAccessToken?(): Promise<string | null> | string | null
  refreshSession?(): Promise<string | null>
  sendMagicLink(
    email: string,
  ): Promise<{ success: boolean; error?: string | undefined }>
  verifyOtp(
    email: string,
    token: string,
  ): Promise<{ success: boolean; error?: string | undefined }>
  signOut(): Promise<void>
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void
  destroy?(): void
}

export type SyncResult = {
  success: boolean
  cards?: StudyCard[] | undefined
  deletedCardIds?: string[] | undefined
  error?: string | undefined
  syncedAt?: number | undefined
}

export type SyncService = {
  getStatus(): SyncStatus
  pushDeck(
    cards: StudyCard[],
    user: AuthUser,
    deletedCardIds?: string[],
  ): Promise<SyncResult>
  pullDeck(user: AuthUser): Promise<SyncResult>
  syncDeck(
    localCards: StudyCard[],
    user: AuthUser,
    localDeletedIds?: string[],
  ): Promise<SyncResult>
}

export type FeedbackResult = {
  success: boolean
  error?: string | undefined
}

export type FeedbackService = {
  submitFeedback(
    submission: FeedbackSubmission,
    user: AuthUser | null,
  ): Promise<FeedbackResult>
}

export type AppServices = {
  clock: Clock
  ids: IdGenerator
  cards: CardRepository
  speaker: Speaker
  sounds: SoundPlayer
  haptics: HapticsPlayer
  assistant: CardAssistant
  auth: AuthService
  sync: SyncService
  feedback: FeedbackService
}
