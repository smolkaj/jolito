import type {
  AppServices,
  AuthService,
  AuthUser,
  CardAssistant,
  CardRepository,
  Clock,
  Earcon,
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

  constructor(private cards: StudyCard[] | null = null) {}

  load(fallback: StudyCard[]): StudyCard[] {
    return this.cards ?? fallback
  }

  save(cards: StudyCard[]): void {
    this.saved = cards
    this.cards = cards
  }
}

export class MockSpeaker implements Speaker {
  public spoken: Array<{ text: string; locale: string }> = []
  public isSupported = true

  supported(): boolean {
    return this.isSupported
  }

  speak(text: string, locale: string): boolean {
    if (!this.isSupported) return false
    this.spoken.push({ text, locale })
    return true
  }
}

export class MockSoundPlayer implements SoundPlayer {
  public played: Earcon[] = []

  play(earcon: Earcon): void {
    this.played.push(earcon)
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

  wasRedirectAuth(): boolean {
    return this.redirectAuthOccurred
  }

  consumeRedirectAuth(): boolean {
    const val = this.redirectAuthOccurred
    this.redirectAuthOccurred = false
    return val
  }

  getUser(): Promise<AuthUser | null> {
    return Promise.resolve(this.user)
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
    if (token === '123456') {
      this.user = { id: 'mock-user-1', email }
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
  public syncedCount = 0

  getStatus(): SyncStatus {
    return this.status
  }

  pushDeck(cards: StudyCard[], user: AuthUser): Promise<SyncResult> {
    void user
    this.remoteCards = cards.map((c) => ({ ...c }))
    return Promise.resolve({
      success: true,
      cards: this.remoteCards.map((c) => ({ ...c })),
      syncedAt: Date.now(),
    })
  }

  pullDeck(user: AuthUser): Promise<SyncResult> {
    void user
    return Promise.resolve({
      success: true,
      cards: this.remoteCards.map((c) => ({ ...c })),
    })
  }

  syncDeck(localCards: StudyCard[], user: AuthUser): Promise<SyncResult> {
    void user
    this.status = 'syncing'
    this.syncedCount++
    this.remoteCards = reconcileStudyCards(localCards, this.remoteCards)
    this.status = 'synced'
    return Promise.resolve({
      success: true,
      cards: this.remoteCards.map((c) => ({ ...c })),
      syncedAt: Date.now(),
    })
  }
}

export const TEST_LEXICON: LexiconEntry[] = SEED_LEXICON

export function createTestServices(options?: {
  cards?: StudyCard[] | null
  clockTime?: number
  speakerSupported?: boolean
  assistant?: CardAssistant
  user?: AuthUser | null
}): AppServices & {
  memoryCards: MemoryCardRepository
  mockSpeaker: MockSpeaker
  mockSounds: MockSoundPlayer
  fixedClock: FixedClock
  sequentialIds: SequentialIds
  assistant: CardAssistant
  mockAuth: MockAuthService
  mockSync: MockSyncService
} {
  const memoryCards = new MemoryCardRepository(options?.cards ?? null)
  const mockSpeaker = new MockSpeaker()
  if (options?.speakerSupported !== undefined) {
    mockSpeaker.isSupported = options.speakerSupported
  }
  const mockSounds = new MockSoundPlayer()
  const fixedClock = new FixedClock(options?.clockTime)
  const sequentialIds = new SequentialIds()
  const assistant = options?.assistant ?? new OfflineCardAssistant(TEST_LEXICON)
  const mockAuth = new MockAuthService()
  if (options?.user) {
    mockAuth.user = options.user
  }
  const mockSync = new MockSyncService()

  return {
    cards: memoryCards,
    speaker: mockSpeaker,
    sounds: mockSounds,
    clock: fixedClock,
    ids: sequentialIds,
    assistant,
    auth: mockAuth,
    sync: mockSync,
    memoryCards,
    mockSpeaker,
    mockSounds,
    fixedClock,
    sequentialIds,
    mockAuth,
    mockSync,
  }
}
