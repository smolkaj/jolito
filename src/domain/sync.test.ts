import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  resetCardProgress,
  scheduleReview,
  updateStudyCard,
  type StudyCard,
} from './card'
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
  contentRevision: 0,
  resetRevision: { generation: 0, at: 0 },
  createdAt: 1000,
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
  contentRevision: 0,
  resetRevision: { generation: 0, at: 0 },
  createdAt: 2000,
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

  it('preserves the latest lastReviewedAt timestamp across devices', () => {
    const localWithReview = {
      ...cardA,
      schedule: {
        ...cardA.schedule,
        reviews: 2,
        lastReviewedAt: 12345678,
      },
    }
    const remoteOlder = {
      ...cardA,
      schedule: {
        ...cardA.schedule,
        reviews: 1,
        lastReviewedAt: 10000000,
      },
    }

    const result = reconcileStudyCards([localWithReview], [remoteOlder])
    expect(result.cards[0]?.schedule.lastReviewedAt).toBe(12345678)
  })

  it('preserves newer lastReviewedAt timestamp even when the winning card had an older timestamp', () => {
    const localWinningCard = {
      ...cardA,
      schedule: {
        ...cardA.schedule,
        reviews: 5,
        lastReviewedAt: 1000,
      },
    }
    const remoteNonWinningCard = {
      ...cardA,
      schedule: {
        ...cardA.schedule,
        reviews: 3,
        lastReviewedAt: 2000,
      },
    }

    const result = reconcileStudyCards(
      [localWinningCard],
      [remoteNonWinningCard],
    )
    expect(result.cards[0]?.schedule.reviews).toBe(5)
    expect(result.cards[0]?.schedule.lastReviewedAt).toBe(2000)
  })
})

describe('authorship and reset convergence', () => {
  it('preserves an edit while an interrupted sync returns a concurrent review, in either device order', () => {
    const edited = updateStudyCard(
      cardA,
      { answer: 'hi', context: 'informal' },
      1000,
    )
    const reviewed = scheduleReview(cardA, 'easy', 1000)
    const expected = { ...edited, schedule: reviewed.schedule }
    expect(reconcileStudyCards([edited], [reviewed]).cards).toEqual([expected])
    expect(reconcileStudyCards([reviewed], [edited]).cards).toEqual([expected])
  })

  it('keeps explicit reset intent through old reviews and subsequent practice, including equal and backward clocks', () => {
    const reviewed = scheduleReview(cardA, 'easy', 5000)
    const reset = resetCardProgress(reviewed, 1000)
    for (const [first, second] of [
      [reset, reviewed],
      [reviewed, reset],
    ]) {
      expect(reconcileStudyCards([first!], [second!]).cards).toEqual([reset])
    }
    const practiced = scheduleReview(reset, 'good', 1000)
    expect(reconcileStudyCards([reviewed], [practiced]).cards).toEqual([
      practiced,
    ])
    const resetAgain = updateStudyCard(practiced, { resetProgress: true }, 500)
    expect(reconcileStudyCards([practiced], [resetAgain]).cards).toEqual([
      resetAgain,
    ])
  })

  it('totally orders concurrent equal-time edits and permits another edit after convergence', () => {
    const a = updateStudyCard(cardA, { answer: 'hi' }, 1000)
    const b = updateStudyCard(cardA, { answer: 'hey' }, 1000)
    const ab = reconcileStudyCards([a], [b]).cards
    expect(reconcileStudyCards([b], [a]).cards).toEqual(ab)
    const editedAgain = updateStudyCard(ab[0]!, { answer: 'hello again' }, 500)
    expect(reconcileStudyCards([b], [editedAgain]).cards).toEqual([editedAgain])
    expect(reconcileStudyCards([editedAgain], [a]).cards).toEqual([editedAgain])
  })

  it('converges across three replicas and equal schedule precedence without depending on merge grouping', () => {
    const a = updateStudyCard(cardA, { answer: 'hi' }, 1000)
    const b = scheduleReview(cardA, 'easy', 1000)
    const c = {
      ...b,
      schedule: { ...b.schedule, easeFactor: 3, lastReviewedAt: 2000 },
    }
    const merge = (x: StudyCard, y: StudyCard) =>
      reconcileStudyCards([x], [y]).cards[0]!
    expect(merge(merge(a, b), c)).toEqual(merge(a, merge(b, c)))
    expect(merge(b, c)).toEqual(merge(c, b))
    expect(merge(a, a)).toEqual(a)
  })
})

describe('mutation ordering laws', () => {
  it('is commutative, associative, and idempotent across edits, reviews, and reset epochs', () => {
    const replica = fc
      .record({
        answer: fc.string({ minLength: 1 }),
        contentRevision: fc.integer({ min: 0, max: 10 }),
        resetRevision: fc.record({
          generation: fc.integer({ min: 0, max: 3 }),
          at: fc.integer({ min: -1000, max: 1000 }),
        }),
        schedule: fc.record({
          state: fc.constantFrom(
            'new' as const,
            'learning' as const,
            'relearning' as const,
            'review' as const,
          ),
          dueAt: fc.integer({ min: -1000, max: 1000 }),
          intervalDays: fc.integer({ min: 0, max: 10 }),
          reviews: fc.integer({ min: 0, max: 10 }),
          lapses: fc.integer({ min: 0, max: 10 }),
          easeFactor: fc.integer({ min: 1, max: 4 }),
          lastReviewedAt: fc.option(fc.integer({ min: -1000, max: 1000 }), {
            nil: undefined,
          }),
        }),
      })
      .map((value): StudyCard => ({ ...cardA, ...value }))
    const merge = (a: StudyCard, b: StudyCard) =>
      reconcileStudyCards([a], [b]).cards[0]!
    fc.assert(
      fc.property(replica, replica, replica, (a, b, c) => {
        expect(merge(a, b)).toEqual(merge(b, a))
        expect(merge(a, a)).toEqual(a)
        expect(merge(merge(a, b), c)).toEqual(merge(a, merge(b, c)))
      }),
      { numRuns: 200 },
    )
  })

  it('keeps repeated edits causal, does not stamp no-op saves, and rejects revision overflow', () => {
    const edited = updateStudyCard(cardA, { answer: 'hi' }, 1000)
    const editedAgain = updateStudyCard(edited, { answer: 'hey' }, 1000)
    expect(editedAgain.contentRevision).toBe(2)
    expect(
      updateStudyCard(editedAgain, { answer: ' hey ', resetProgress: false }),
    ).toEqual(editedAgain)
    expect(() =>
      updateStudyCard(
        { ...cardA, contentRevision: Number.MAX_SAFE_INTEGER },
        { answer: 'hi' },
      ),
    ).toThrow('revision limit')
    expect(() =>
      resetCardProgress(
        {
          ...cardA,
          resetRevision: { generation: Number.MAX_SAFE_INTEGER, at: 0 },
        },
        0,
      ),
    ).toThrow('revision limit')
  })

  it('discards practice from a losing concurrent reset epoch while equal-time resets converge', () => {
    const oldReview = scheduleReview(cardA, 'easy', 1000)
    const a = resetCardProgress(oldReview, 500)
    const b = resetCardProgress(oldReview, 600)
    const practicedA = scheduleReview(a, 'easy', 700)
    expect(reconcileStudyCards([practicedA], [b]).cards).toEqual([b])
    expect(reconcileStudyCards([b], [practicedA]).cards).toEqual([b])
    const sameTimeReset = resetCardProgress(oldReview, 500)
    expect(reconcileStudyCards([sameTimeReset], [practicedA]).cards).toEqual([
      practicedA,
    ])
  })
})
