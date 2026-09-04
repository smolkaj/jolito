import type {
  AppServices,
  AuthService,
  AuthUser,
  CardAssistant,
  CardRepository,
  Clock,
  Earcon,
  FeedbackResult,
  FeedbackService,
  FeedbackSubmission,
  HapticEffect,
  HapticsPlayer,
  IdGenerator,
  SoundPlayer,
  Speaker,
  SyncResult,
  SyncService,
} from '../application/ports'
import { OfflineCardAssistant } from '../application/card-assistant'
import type { StudyCard } from '../domain/card'
import { SEED_LEXICON, type LexiconEntry } from '../domain/lexicon'
import { reconcileStudyCards, type SyncStatus } from '../domain/sync'

export class FixedClock implements Clock {
  constructor(public currentTime = 1771632000000) {}

  now(): number {
    return this.currentTime
  }
}

export class SequentialIds implements IdGenerator {
  private count = 0

  nextId(prefix = 'test-id'): string {
    return `${prefix}-${++this.count}`
  }
}

export class MemoryCardRepository implements CardRepository {
  public saved: StudyCard[] | null = null
  public deletedCardIds: string[] = []

  constructor(
    private cards: StudyCard[] | null = null,
    deletedCardIds: string[] = [],
  ) {
    this.deletedCardIds = [...deletedCardIds]
  }

  getDeletedCardIds(): string[] {
    return [...this.deletedCardIds]
  }

  load(fallback: StudyCard[]): StudyCard[] {
    return this.cards ?? fallback
  }

  save(cards: StudyCard[], deletedCardIds?: string[]): void {
    this.saved = cards
    this.cards = cards
    if (deletedCardIds !== undefined) {
      this.deletedCardIds = [...deletedCardIds]
    }
  }
}

export class MockSpeaker implements Speaker {
  public spoken: Array<{ text: string; locale: string }> = []
  public isSupported = true
  public enhancedVoice = false
  public voicesLoaded = true
  public listeners = new Set<() => void>()

  supported(): boolean {
    return this.isSupported
  }

  speak(text: string, locale: string): boolean {
    if (!this.isSupported) return false
    this.spoken.push({ text, locale })
    return true
  }

  hasEnhancedVoice(): boolean {
    return this.enhancedVoice
  }

  areVoicesLoaded(): boolean {
    return this.voicesLoaded
  }

  onVoicesChanged(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  triggerVoicesChanged(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

export class MockSoundPlayer implements SoundPlayer {
  public played: Earcon[] = []

  play(earcon: Earcon): void {
    this.played.push(earcon)
  }
}

export class MockHapticsPlayer implements HapticsPlayer {
  public triggered: HapticEffect[] = []

  trigger(effect: HapticEffect): void {
    this.triggered.push(effect)
  }
}

export class MockAuthService implements AuthService {
  public user: AuthUser | null = null
  public configured = true
  public redirectAuthOccurred = false
  private listeners = new Set<(user: AuthUser | null) => void>()

  isConfigured(): boolean {
    return this.configured
  }

  consumeRedirectAuth(): boolean {
    const val = this.redirectAuthOccurred
    this.redirectAuthOccurred = false
    return val
  }

  getSessionLink(): string | null {
    if (!this.user) return null
    return `https://joli.to/#access_token=mock-token-${this.user.id}&refresh_token=mock-refresh`
  }

  getUser(): Promise<AuthUser | null> {
    return Promise.resolve(this.user)
  }

  getAccessToken(): Promise<string | null> {
    return Promise.resolve(this.user ? `mock-token-${this.user.id}` : null)
  }

  refreshSession(): Promise<string | null> {
    return Promise.resolve(this.user ? `mock-token-${this.user.id}` : null)
  }

  sendMagicLink(
    email: string,
  ): Promise<{ success: boolean; error?: string | undefined }> {
    if (!this.configured) {
      return Promise.resolve({
        success: false,
        error: 'Cloud sync backend is not configured.',
      })
    }
    void email
    return Promise.resolve({ success: true })
  }

  verifyOtp(
    email: string,
    token: string,
  ): Promise<{ success: boolean; error?: string | undefined }> {
    const clean = token.replace(/\s+|-/g, '').trim()
    if (
      clean === '123456' ||
      clean.includes('access_token=') ||
      clean.includes('token=') ||
      clean.includes('token_hash=') ||
      clean.length > 20
    ) {
      this.user = {
        id: 'mock-user-1',
        email: email.trim() || 'learner@example.com',
      }
      this.listeners.forEach((l) => l(this.user))
      return Promise.resolve({ success: true })
    }
    return Promise.resolve({
      success: false,
      error: 'Invalid verification code.',
    })
  }

  signOut(): Promise<void> {
    this.user = null
    this.listeners.forEach((l) => l(null))
    return Promise.resolve()
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    this.listeners.add(callback)
    callback(this.user)
    return () => {
      this.listeners.delete(callback)
    }
  }
}

export class MockSyncService implements SyncService {
  public status: SyncStatus = 'idle'
  public remoteCards: StudyCard[] = []
  public remoteDeletedCardIds: string[] = []
  public syncedCount = 0

  getStatus(): SyncStatus {
    return this.status
  }

  pushDeck(
    cards: StudyCard[],
    user: AuthUser,
    deletedCardIds: string[] = [],
  ): Promise<SyncResult> {
    void user
    this.remoteCards = cards.map((c) => ({ ...c }))
    this.remoteDeletedCardIds = [...deletedCardIds]
    return Promise.resolve({
      success: true,
      cards: this.remoteCards.map((c) => ({ ...c })),
      deletedCardIds: [...this.remoteDeletedCardIds],
      syncedAt: Date.now(),
    })
  }

  pullDeck(user: AuthUser): Promise<SyncResult> {
    void user
    return Promise.resolve({
      success: true,
      cards: this.remoteCards.map((c) => ({ ...c })),
      deletedCardIds: [...this.remoteDeletedCardIds],
    })
  }

  syncDeck(
    localCards: StudyCard[],
    user: AuthUser,
    localDeletedIds: string[] = [],
  ): Promise<SyncResult> {
    void user
    this.status = 'syncing'
    this.syncedCount++
    const reconciled = reconcileStudyCards(
      localCards,
      this.remoteCards,
      localDeletedIds,
      this.remoteDeletedCardIds,
    )
    this.remoteCards = reconciled.cards.map((c) => ({ ...c }))
    this.remoteDeletedCardIds = [...reconciled.deletedCardIds]
    this.status = 'synced'
    return Promise.resolve({
      success: true,
      cards: this.remoteCards.map((c) => ({ ...c })),
      deletedCardIds: [...this.remoteDeletedCardIds],
      syncedAt: Date.now(),
    })
  }
}

export class MockFeedbackService implements FeedbackService {
  public submissions: Array<{
    submission: FeedbackSubmission
    user: AuthUser | null
  }> = []
  public shouldSucceed = true
  public errorMessage = 'Failed to send feedback.'

  submitFeedback(
    submission: FeedbackSubmission,
    user: AuthUser | null,
  ): Promise<FeedbackResult> {
    if (!this.shouldSucceed) {
      return Promise.resolve({ success: false, error: this.errorMessage })
    }
    this.submissions.push({ submission, user })
    return Promise.resolve({ success: true })
  }
}

export const TEST_LEXICON: LexiconEntry[] = SEED_LEXICON

export function createTestServices(options?: {
  cards?: StudyCard[] | null
  deletedCardIds?: string[]
  remoteCards?: StudyCard[]
  remoteDeletedCardIds?: string[]
  clockTime?: number
  speakerSupported?: boolean
  assistant?: CardAssistant
  user?: AuthUser | null
}): AppServices & {
  memoryCards: MemoryCardRepository
  mockSpeaker: MockSpeaker
  mockSounds: MockSoundPlayer
  mockHaptics: MockHapticsPlayer
  fixedClock: FixedClock
  sequentialIds: SequentialIds
  assistant: CardAssistant
  mockAuth: MockAuthService
  mockSync: MockSyncService
  mockFeedback: MockFeedbackService
} {
  const memoryCards = new MemoryCardRepository(
    options?.cards ?? null,
    options?.deletedCardIds ?? [],
  )
  const mockSpeaker = new MockSpeaker()
  if (options?.speakerSupported !== undefined) {
    mockSpeaker.isSupported = options.speakerSupported
  }
  const mockSounds = new MockSoundPlayer()
  const mockHaptics = new MockHapticsPlayer()
  const fixedClock = new FixedClock(options?.clockTime)
  const sequentialIds = new SequentialIds()
  const assistant = options?.assistant ?? new OfflineCardAssistant(TEST_LEXICON)
  const mockAuth = new MockAuthService()
  if (options?.user) {
    mockAuth.user = options.user
  }
  const mockSync = new MockSyncService()
  if (options?.remoteCards) {
    mockSync.remoteCards = options.remoteCards.map((c) => ({ ...c }))
  }
  if (options?.remoteDeletedCardIds) {
    mockSync.remoteDeletedCardIds = [...options.remoteDeletedCardIds]
  }
  const mockFeedback = new MockFeedbackService()

  return {
    cards: memoryCards,
    speaker: mockSpeaker,
    sounds: mockSounds,
    haptics: mockHaptics,
    clock: fixedClock,
    ids: sequentialIds,
    assistant,
    auth: mockAuth,
    sync: mockSync,
    feedback: mockFeedback,
    memoryCards,
    mockSpeaker,
    mockSounds,
    mockHaptics,
    fixedClock,
    sequentialIds,
    mockAuth,
    mockSync,
    mockFeedback,
  }
}
