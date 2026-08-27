import { describe, expect, it } from 'vitest'
import type { StudyCard } from './card'
import { deckSyncPayloadSchema, reconcileStudyCards } from './sync'

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
  it('validates a valid deck sync payload with deletedCardIds', () => {
    const payload = {
      version: 1,
      app: 'jolito',
      updatedAt: '2026-08-23T12:00:00.000Z',
      deviceId: 'device-123',
      cards: [cardA, cardB],
      deletedCardIds: ['card-c:es-en'],
    }

    const parsed = deckSyncPayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.deletedCardIds).toEqual(['card-c:es-en'])
    }
  })

  it('defaults deletedCardIds to empty array when omitted for backwards compatibility', () => {
    const legacyPayload = {
      version: 1,
      app: 'jolito',
      updatedAt: '2026-08-23T12:00:00.000Z',
      deviceId: 'device-123',
      cards: [cardA, cardB],
    }

    const parsed = deckSyncPayloadSchema.safeParse(legacyPayload)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.deletedCardIds).toEqual([])
    }
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

    const result = reconcileStudyCards(local, remote)
    expect(result.cards).toHaveLength(2)
    expect(result.cards.some((c) => c.id === 'card-a:es-en')).toBe(true)
    expect(result.cards.some((c) => c.id === 'card-b:es-en')).toBe(true)
    expect(result.deletedCardIds).toEqual([])
  })

  it('excludes locally deleted cards and prevents remote copies from reappearing', () => {
    const localCards: StudyCard[] = []
    const remoteCards = [cardA, cardB]
    const localDeletedIds = ['card-a:es-en']

    const result = reconcileStudyCards(
      localCards,
      remoteCards,
      localDeletedIds,
      [],
    )
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]?.id).toBe('card-b:es-en')
    expect(result.deletedCardIds).toContain('card-a:es-en')
  })

  it('excludes remotely deleted cards from local deck on sync', () => {
    const localCards = [cardA, cardB]
    const remoteCards = [cardB]
    const remoteDeletedIds = ['card-a:es-en']

    const result = reconcileStudyCards(
      localCards,
      remoteCards,
      [],
      remoteDeletedIds,
    )
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]?.id).toBe('card-b:es-en')
    expect(result.deletedCardIds).toContain('card-a:es-en')
  })

  it('unions deleted card IDs across local and remote', () => {
    const localCards: StudyCard[] = []
    const remoteCards: StudyCard[] = []
    const localDeletedIds = ['card-a:es-en']
    const remoteDeletedIds = ['card-b:es-en']

    const result = reconcileStudyCards(
      localCards,
      remoteCards,
      localDeletedIds,
      remoteDeletedIds,
    )
    expect(result.cards).toHaveLength(0)
    expect(result.deletedCardIds).toEqual(
      expect.arrayContaining(['card-a:es-en', 'card-b:es-en']),
    )
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

    const result = reconcileStudyCards([localCardA], [remoteCardA])
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]?.schedule.reviews).toBe(3)
    expect(result.cards[0]?.schedule.state).toBe('review')
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

    const result = reconcileStudyCards([localCardA], [remoteCardA])
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]?.schedule.reviews).toBe(2)
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

    const result = reconcileStudyCards([localNew], [remoteLearning])
    expect(result.cards[0]?.schedule.state).toBe('learning')

    const resultReverse = reconcileStudyCards([remoteLearning], [localNew])
    expect(resultReverse.cards[0]?.schedule.state).toBe('learning')
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

    const result = reconcileStudyCards([localLapsed], [remoteNoLapse])
    expect(result.cards[0]?.schedule.lapses).toBe(1)

    const resultRemoteLapse = reconcileStudyCards(
      [remoteNoLapse],
      [localLapsed],
    )
    expect(resultRemoteLapse.cards[0]?.schedule.lapses).toBe(1)

    const localDueLater = {
      ...cardA,
      schedule: { ...cardA.schedule, reviews: 1, lapses: 1, dueAt: 9000 },
    }
    const remoteDueEarlier = {
      ...cardA,
      schedule: { ...cardA.schedule, reviews: 1, lapses: 1, dueAt: 5000 },
    }
    const resultDueLocal = reconcileStudyCards(
      [localDueLater],
      [remoteDueEarlier],
    )
    expect(resultDueLocal.cards[0]?.schedule.dueAt).toBe(9000)

    const resultDueRemote = reconcileStudyCards(
      [remoteDueEarlier],
      [localDueLater],
    )
    expect(resultDueRemote.cards[0]?.schedule.dueAt).toBe(9000)
  })
})
