import { NativeDeletionLock } from '../infrastructure/browser/deletion-lock'
import type {
  AccountDeletion,
  AppServices,
  AuthService,
  AuthUser,
  CardAssistant,
  CardRepository,
  CardLoadResult,
  Clock,
  Earcon,
  FeedbackResult,
  FeedbackService,
  FeedbackSubmission,
  HapticEffect,
  HapticsPlayer,
  IdGenerator,
  PrefetchItem,
  SoundPlayer,
  Speaker,
  SpeakerOptions,
  SyncResult,
  SyncService,
} from '../application/ports'
import { OfflineCardAssistant } from '../application/card-assistant'
import type { StudyCard } from '../domain/card'
import { SEED_LEXICON, type LexiconEntry } from '../domain/lexicon'
import { reconcileStudyCards, type SyncStatus } from '../domain/sync'
import { unwrapDomainBoundOtp } from '../domain/auth'

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
  public deletedCardIds: string[] = []
  private scopes: Map<string | null, MemoryCardRepository>
  private writes: { saved: StudyCard[] | null; deletion?: AccountDeletion }
  constructor(
    private cards: StudyCard[] | null = null,
    deletedCardIds: string[] = [],
    private readonly ownerId: string | null = null,
    scopes?: Map<string | null, MemoryCardRepository>,
    writes?: { saved: StudyCard[] | null; deletion?: AccountDeletion },
  ) {
    this.deletedCardIds = [...deletedCardIds]
    this.scopes = scopes ?? new Map<string | null, MemoryCardRepository>()
    this.writes = writes ?? { saved: null }
    this.scopes.set(ownerId, this)
  }
  get saved() {
    return this.writes.saved
  }
  forOwner(ownerId: string | null): CardRepository {
    return (
      this.scopes.get(ownerId) ??
      new MemoryCardRepository(null, [], ownerId, this.scopes, this.writes)
    )
  }
  getDeletedCardIds(): string[] {
    return [...this.deletedCardIds]
  }
  load(fallback: StudyCard[]): CardLoadResult {
    return {
      status: this.cards === null ? 'missing' : 'loaded',
      cards: this.cards ?? fallback,
    }
  }
  getPendingDeletion(): AccountDeletion | null {
    return this.writes.deletion ?? null
  }
  setPendingDeletion(phase: AccountDeletion['phase'] | null): void {
    if (this.ownerId === null) throw new Error('No account')
    if (phase === null) delete this.writes.deletion
    else this.writes.deletion = { ownerId: this.ownerId, phase }
  }
  forget(): void {
    if (
      this.writes.deletion?.ownerId !== this.ownerId ||
      this.writes.deletion.phase !== 'confirmed'
    )
      throw new Error('Deletion is not confirmed')
    delete this.writes.deletion
    this.cards = null
    this.deletedCardIds = []
    this.writes.saved = []
  }
  save(cards: StudyCard[], deletedCardIds?: string[]): void {
    this.writes.saved = cards
    this.cards = cards
    if (deletedCardIds !== undefined) this.deletedCardIds = [...deletedCardIds]
  }
}

export class MockSpeaker implements Speaker {
  public spoken: Array<{ text: string; locale: string }> = []
  public spokenCalls: Array<{
    text: string
    locale: string
    options?: SpeakerOptions | undefined
  }> = []
  public prefetched: PrefetchItem[] = []
  public prunedCalls: Array<Array<{ text: string; locale: string }>> = []
  public isSupported = true

  supported(): boolean {
    return this.isSupported
  }

  prefetch(items: PrefetchItem[]): void {
    this.prefetched.push(...items)
  }

  pruneUnusedAudio(
    activeItems: Array<{ text: string; locale: string }>,
  ): number {
    this.prunedCalls.push(activeItems)
    return 0
  }

  public stopCount = 0

  stop(): void {
    this.stopCount++
  }

  speak(text: string, locale: string, options?: SpeakerOptions): boolean {
    if (!this.isSupported) return false
    this.spoken.push({ text, locale })
    this.spokenCalls.push({ text, locale, options })
    return true
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

  getCurrentUser(): AuthUser | null {
    return this.user
  }

  setUser(user: AuthUser | null): void {
    this.user = user
    this.listeners.forEach((listener) => listener(user))
  }

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
    const unwrapped = unwrapDomainBoundOtp(token)
    const clean = unwrapped.replace(/\s+|-/g, '').trim()
    if (
      /^\d{6}$/.test(clean) ||
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

  deleteAccount(): Promise<{ success: boolean; error?: string | undefined }> {
    this.user = null
    this.listeners.forEach((l) => l(null))
    return Promise.resolve({ success: true })
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
  public syncedCount = 0
  public decks = new Map<
    string,
    { cards: StudyCard[]; deletedCardIds: string[] }
  >()
  constructor(private fixtureOwner = 'mock-user-1') {}
  private deck(owner: string) {
    return this.decks.get(owner) ?? { cards: [], deletedCardIds: [] }
  }
  get remoteCards(): StudyCard[] {
    return this.deck(this.fixtureOwner).cards
  }
  set remoteCards(cards: StudyCard[]) {
    this.decks.set(this.fixtureOwner, {
      ...this.deck(this.fixtureOwner),
      cards,
    })
  }
  get remoteDeletedCardIds(): string[] {
    return this.deck(this.fixtureOwner).deletedCardIds
  }
  set remoteDeletedCardIds(deletedCardIds: string[]) {
    this.decks.set(this.fixtureOwner, {
      ...this.deck(this.fixtureOwner),
      deletedCardIds,
    })
  }
  getStatus(): SyncStatus {
    return this.status
  }
  pushDeck(
    cards: StudyCard[],
    user: AuthUser,
    deletedCardIds: string[] = [],
  ): Promise<SyncResult> {
    const deck = {
      cards: cards.map((card) => ({ ...card })),
      deletedCardIds: [...deletedCardIds],
    }
    this.decks.set(user.id, deck)
    return Promise.resolve({ success: true, ...deck, syncedAt: Date.now() })
  }
  pullDeck(user: AuthUser): Promise<SyncResult> {
    return Promise.resolve({ success: true, ...this.deck(user.id) })
  }
  syncDeck(
    localCards: StudyCard[],
    user: AuthUser,
    localDeletedIds: string[] = [],
  ): Promise<SyncResult> {
    this.syncedCount++
    const remote = this.deck(user.id)
    const reconciled = reconcileStudyCards(
      localCards,
      remote.cards,
      localDeletedIds,
      remote.deletedCardIds,
    )
    this.decks.set(user.id, reconciled)
    this.status = 'synced'
    return Promise.resolve({
      success: true,
      ...reconciled,
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
    options?.user?.id ?? null,
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
  const mockSync = new MockSyncService(options?.user?.id ?? 'mock-user-1')
  if (options?.remoteCards) {
    mockSync.remoteCards = options.remoteCards.map((c) => ({ ...c }))
  }
  if (options?.remoteDeletedCardIds) {
    mockSync.remoteDeletedCardIds = [...options.remoteDeletedCardIds]
  }
  const mockFeedback = new MockFeedbackService()

  return {
    deletionLock: new NativeDeletionLock(),
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
