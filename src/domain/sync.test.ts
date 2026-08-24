import { describe, expect, it } from 'vitest'
import type { StudyCard } from './card'
import {
  deckSyncPayloadSchema,
  isDefaultStarterDeck,
  reconcileStudyCards,
} from './sync'

const cardA: StudyCard = {
  id: 'card-a:es-en',
  noteId: 'note-a',
  prompt: 'hola',
  answer: 'hello',
  direction: 'es-en',
  context: 'greeting',
  scene: 'conversation',
  schedule: {
    state: 'new',
    dueAt: 1000,
    intervalDays: 0,
    easeFactor: 2.5,
    reviews: 0,
    lapses: 0,
  },
}

const cardB: StudyCard = {
  id: 'card-b:es-en',
  noteId: 'note-b',
  prompt: 'adiós',
  answer: 'goodbye',
  direction: 'es-en',
  context: 'farewell',
  scene: 'conversation',
  schedule: {
    state: 'review',
    dueAt: 2000,
    intervalDays: 4,
    easeFactor: 2.5,
    reviews: 2,
    lapses: 0,
  },
}

describe('deckSyncPayloadSchema', () => {
  it('validates a valid deck sync payload', () => {
    const payload = {
      version: 1,
      app: 'jolito',
      updatedAt: '2026-08-23T12:00:00.000Z',
      deviceId: 'device-123',
      cards: [cardA, cardB],
    }

    const parsed = deckSyncPayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(true)
  })

  it('rejects invalid payload without proper metadata', () => {
    const invalid = {
      version: 2,
      cards: [],
    }

    const parsed = deckSyncPayloadSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })
})

describe('reconcileStudyCards', () => {
  it('preserves all non-overlapping cards from both local and remote', () => {
    const local = [cardA]
    const remote = [cardB]

    const merged = reconcileStudyCards(local, remote)
    expect(merged).toHaveLength(2)
    expect(merged.some((c) => c.id === 'card-a:es-en')).toBe(true)
    expect(merged.some((c) => c.id === 'card-b:es-en')).toBe(true)
  })

  it('favors card with higher review count when reviewed on one device', () => {
    const localCardA: StudyCard = {
      ...cardA,
      schedule: {
        ...cardA.schedule,
        state: 'review',
        reviews: 3,
        intervalDays: 6,
      },
    }
    const remoteCardA: StudyCard = {
      ...cardA,
      schedule: {
        ...cardA.schedule,
        state: 'learning',
        reviews: 1,
        intervalDays: 1,
      },
    }

    const merged = reconcileStudyCards([localCardA], [remoteCardA])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.schedule.reviews).toBe(3)
    expect(merged[0]?.schedule.state).toBe('review')
  })

  it('favors remote card when remote has higher reviews or progression', () => {
    const localCardA: StudyCard = { ...cardA }
    const remoteCardA: StudyCard = {
      ...cardA,
      schedule: {
        ...cardA.schedule,
        state: 'review',
        reviews: 2,
        dueAt: 5000,
      },
    }

    const merged = reconcileStudyCards([localCardA], [remoteCardA])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.schedule.reviews).toBe(2)
  })

  it('favors card with review state over new state when reviews are tied', () => {
    const localNew = {
      ...cardA,
      schedule: { ...cardA.schedule, state: 'new' as const, reviews: 0 },
    }
    const remoteLearning = {
      ...cardA,
      schedule: { ...cardA.schedule, state: 'learning' as const, reviews: 0 },
    }

    const merged = reconcileStudyCards([localNew], [remoteLearning])
    expect(merged[0]?.schedule.state).toBe('learning')
  })

  it('favors card with more lapses or later due date when reviews are tied', () => {
    const localLapsed = {
      ...cardA,
      schedule: { ...cardA.schedule, reviews: 1, lapses: 1 },
    }
    const remoteNoLapse = {
      ...cardA,
      schedule: { ...cardA.schedule, reviews: 1, lapses: 0 },
    }

    const merged = reconcileStudyCards([localLapsed], [remoteNoLapse])
    expect(merged[0]?.schedule.lapses).toBe(1)
  })
})

describe('isDefaultStarterDeck', () => {
  it('returns true when all cards match starter card prefixes with 0 reviews', () => {
    const pristineStarters: StudyCard[] = [
      {
        ...cardA,
        id: 'starter-aguacate:es-en',
        schedule: { ...cardA.schedule, reviews: 0, state: 'new' },
      },
      {
        ...cardB,
        id: 'starter-que-padre:es-en',
        schedule: { ...cardB.schedule, reviews: 0, state: 'new' },
      },
    ]

    expect(isDefaultStarterDeck(pristineStarters)).toBe(true)
  })

  it('returns false when empty, modified, or contains custom cards', () => {
    expect(isDefaultStarterDeck([])).toBe(false)
    expect(isDefaultStarterDeck([cardA])).toBe(false)

    const studiedStarter: StudyCard = {
      ...cardA,
      id: 'starter-aguacate:es-en',
      schedule: { ...cardA.schedule, reviews: 2, state: 'review' },
    }
    expect(isDefaultStarterDeck([studiedStarter])).toBe(false)
  })
})
