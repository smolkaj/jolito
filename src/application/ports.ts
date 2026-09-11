import type { StudyCard } from '../domain/card'
import type { FeedbackSubmission } from '../domain/feedback'
import type { AutocompleteSuggestion, LexiconEntry } from '../domain/lexicon'

export type { FeedbackSubmission }

export type Clock = {
  now(): number
}

export type IdGenerator = {
  nextId(prefix?: string): string
}

export type CardLoadResult =
  | { status: 'missing' | 'loaded' | 'migrated'; cards: StudyCard[] }
  | {
      status: 'recovery'
      reason: 'corrupt' | 'unsupported' | 'unavailable' | 'migration-failed'
      cards: []
      raw: string | null
      message: string
    }

export type AccountDeletion = {
  ownerId: string
  phase: 'requested' | 'confirmed'
}

export type CardRepository = {
  getPendingDeletion(): AccountDeletion | null
  setPendingDeletion(phase: AccountDeletion['phase'] | null): void
  forOwner(ownerId: string | null): CardRepository
  forget(): void
  load(fallback: StudyCard[]): CardLoadResult
  getDeletedCardIds(): string[]
  /** Commits atomically or throws; callers must save before publishing state. */
  save(cards: StudyCard[], deletedCardIds?: string[]): void
}

export type SpeakerOptions = {
  cardSeed?: string | undefined
  voice?: string | undefined
  gender?: 'female' | 'male' | undefined
  dualVoice?: boolean | undefined
  explicit?: boolean | undefined
  onEnded?: (() => void) | undefined
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
  getCurrentUser(): AuthUser | null
  /** Commit fence: active and persisted ownership must both match, including guest. */
  isCurrentOwner(ownerId: string | null): boolean
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
  deleteAccount?(): Promise<{
    success: boolean
    error?: string | undefined
    outcomeUnknown?: boolean
  }>
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void
  destroy?(): void
}

export type SyncResult = {
  success: boolean
  cards?: StudyCard[] | undefined
  deletedCardIds?: string[] | undefined
  error?: string | undefined
  syncedAt?: number | undefined
  revision?: number | undefined
}

export type SyncService = {
  syncDeck(
    localCards: StudyCard[],
    user: AuthUser,
    localDeletedIds?: string[],
    signal?: AbortSignal,
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

export type DeletionLock = {
  /** Excludes deletion, recovery and cancellation for this storage lifetime. */
  run<T>(operation: () => T | Promise<T>): Promise<T>
}

export type AppServices = {
  deletionLock: DeletionLock
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
