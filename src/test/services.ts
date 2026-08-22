import type {
  AppServices,
  CardRepository,
  Clock,
  IdGenerator,
  Speaker,
} from '../application/ports'
import type { StudyCard } from '../domain/card'

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

export function createTestServices(options?: {
  cards?: StudyCard[] | null
  clockTime?: number
  speakerSupported?: boolean
}): AppServices & {
  memoryCards: MemoryCardRepository
  mockSpeaker: MockSpeaker
  fixedClock: FixedClock
  sequentialIds: SequentialIds
} {
  const memoryCards = new MemoryCardRepository(options?.cards ?? null)
  const mockSpeaker = new MockSpeaker()
  if (options?.speakerSupported !== undefined) {
    mockSpeaker.isSupported = options.speakerSupported
  }
  const fixedClock = new FixedClock(options?.clockTime)
  const sequentialIds = new SequentialIds()

  return {
    cards: memoryCards,
    speaker: mockSpeaker,
    clock: fixedClock,
    ids: sequentialIds,
    memoryCards,
    mockSpeaker,
    fixedClock,
    sequentialIds,
  }
}
