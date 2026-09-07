import { describe, expect, it } from 'vitest'
import {
  burySiblingCards,
  chooseScene,
  createNewReviewSchedule,
  createStudyCards,
  deleteStudyCard,
  intervalLabel,
  isDue,
  localeForAnswer,
  localeForPrompt,
  nextIntervalDays,
  orderCardsForReview,
  resetCardProgress,
  scheduleReview,
  shouldRequeueInSession,
  reviewScheduleSchema,
  updateStudyCard,
  DEFAULT_STUDY_BATCH_SIZE,
  type ReviewSchedule,
  type StudyCard,
} from './card'

const now = Date.UTC(2026, 7, 21)
const DAY = 24 * 60 * 60 * 1000

describe('createStudyCards', () => {
  it('creates linked directions with independently editable reverse text and staggered initial Anki schedule', () => {
    const cards = createStudyCards(
      {
        spanish: '  ¿Me lo pone para llevar? ',
        english: ' Can you make it to go? ',
        context: '  Polite in a restaurant. ',
        bidirectional: true,
        reversePrompt: 'Could I get this to go?',
        reverseAnswer: '¿Me lo puede poner para llevar?',
      },
      'note-1',
      now,
    )

    expect(cards).toHaveLength(2)
    expect(cards[0]).toMatchObject({
      id: 'note-1:es-en',
      prompt: '¿Me lo pone para llevar?',
      answer: 'Can you make it to go?',
      context: 'Polite in a restaurant.',
      direction: 'es-en',
      scene: 'takeaway',
      schedule: {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
    })
    expect(cards[1]).toMatchObject({
      id: 'note-1:en-es',
      prompt: 'Could I get this to go?',
      answer: '¿Me lo puede poner para llevar?',
      direction: 'en-es',
      scene: 'takeaway',
      schedule: {
        state: 'new',
        dueAt: now + DAY,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
    })
  })

  it('mirrors the concise text by default and supports one-way cards', () => {
    const reverse = createStudyCards(
      {
        spanish: 'qué padre',
        english: 'how cool',
        context: '',
        bidirectional: true,
      },
      'note-2',
      now,
    )
    expect(reverse[1]).toMatchObject({
      prompt: 'how cool',
      answer: 'qué padre',
    })

    expect(
      createStudyCards(
        {
          spanish: 'hola',
          english: 'hello',
          context: '',
          bidirectional: false,
        },
        'note-3',
        now,
      ),
    ).toHaveLength(1)
    expect(
      createStudyCards(
        {
          spanish: '   ',
          english: 'hello',
          context: '',
          bidirectional: true,
        },
        'empty',
        now,
      ),
    ).toEqual([])
  })
})

describe('illustration selection', () => {
  it('selects a useful scene from either language', () => {
    expect(chooseScene('¿Dónde está el metro?')).toBe('metro')
    expect(chooseScene('¿Dónde está la estación?')).toBe('metro')
    expect(chooseScene('A coffee, please')).toBe('takeaway')
    expect(chooseScene('Un café con leche, por favor')).toBe('takeaway')
    expect(chooseScene('Mucho gusto')).toBe('conversation')
  })
})

describe('Anki spaced repetition scheduling', () => {
  const newCard = createStudyCards(
    {
      spanish: 'sale',
      english: 'sounds good',
      context: '',
      bidirectional: false,
    },
    'new-card',
    now,
  )[0]!

  describe('new and learning cards', () => {
    it('shows exact Anki initial step interval labels for brand new cards', () => {
      expect(intervalLabel(newCard, 'again')).toBe('< 1 min')
      expect(intervalLabel(newCard, 'hard')).toBe('< 6 min')
      expect(intervalLabel(newCard, 'good')).toBe('< 10 min')
      expect(intervalLabel(newCard, 'easy')).toBe('4 days')
    })

    it('re-queues in session on Again (< 1 min) and stays in learning state', () => {
      expect(nextIntervalDays(newCard.schedule, 'again')).toBe(0)
      const reviewed = scheduleReview(newCard, 'again', now)
      expect(reviewed.schedule).toEqual({
        state: 'learning',
        dueAt: now + 60_000,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 1,
        lapses: 0,
        lastReviewedAt: now,
      })
      expect(shouldRequeueInSession(reviewed.schedule)).toBe(true)
      expect(isDue(reviewed, now)).toBe(false)
      expect(isDue(reviewed, now + 60_000)).toBe(true)
    })

    it('re-queues in session on Hard (< 6 min) and stays in learning state', () => {
      expect(nextIntervalDays(newCard.schedule, 'hard')).toBe(0)
      const reviewed = scheduleReview(newCard, 'hard', now)
      expect(reviewed.schedule).toEqual({
        state: 'learning',
        dueAt: now + 360_000,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 1,
        lapses: 0,
        lastReviewedAt: now,
      })
      expect(shouldRequeueInSession(reviewed.schedule)).toBe(true)
    })

    it('advances to second learning step on Good (< 10 min) and stays in session', () => {
      expect(nextIntervalDays(newCard.schedule, 'good')).toBe(0)
      const reviewed = scheduleReview(newCard, 'good', now)
      expect(reviewed.schedule).toEqual({
        state: 'learning',
        dueAt: now + 600_000,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 1,
        lapses: 0,
        lastReviewedAt: now,
      })
      expect(shouldRequeueInSession(reviewed.schedule)).toBe(true)
    })

    it('graduates immediately on Easy with 4 days interval', () => {
      expect(nextIntervalDays(newCard.schedule, 'easy')).toBe(4)
      const reviewed = scheduleReview(newCard, 'easy', now)
      expect(reviewed.schedule).toEqual({
        state: 'review',
        dueAt: now + 4 * DAY,
        intervalDays: 4,
        easeFactor: 2.5,
        reviews: 1,
        lapses: 0,
        lastReviewedAt: now,
      })
      expect(shouldRequeueInSession(reviewed.schedule)).toBe(false)
    })

    it('shows second step labels and graduates to review state on Good when in learning', () => {
      const learningCard = {
        ...newCard,
        schedule: {
          ...newCard.schedule,
          state: 'learning' as const,
          reviews: 1,
        },
      }
      expect(intervalLabel(learningCard, 'again')).toBe('< 1 min')
      expect(intervalLabel(learningCard, 'hard')).toBe('< 10 min')
      expect(intervalLabel(learningCard, 'good')).toBe('1 day')
      expect(intervalLabel(learningCard, 'easy')).toBe('4 days')

      const graduated = scheduleReview(learningCard, 'good', now)
      expect(graduated.schedule).toEqual({
        state: 'review',
        dueAt: now + 1 * DAY,
        intervalDays: 1,
        easeFactor: 2.5,
        reviews: 2,
        lapses: 0,
        lastReviewedAt: now,
      })
      expect(shouldRequeueInSession(graduated.schedule)).toBe(false)

      expect(nextIntervalDays(learningCard.schedule, 'hard')).toBe(0)
      const hardReviewed = scheduleReview(learningCard, 'hard', now)
      expect(hardReviewed.schedule).toEqual({
        state: 'learning',
        dueAt: now + 10 * 60_000,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 2,
        lapses: 0,
        lastReviewedAt: now,
      })
      expect(shouldRequeueInSession(hardReviewed.schedule)).toBe(true)

      const easyGraduated = scheduleReview(learningCard, 'easy', now)
      expect(easyGraduated.schedule.state).toBe('review')
      expect(easyGraduated.schedule.intervalDays).toBe(4)
    })
  })

  describe('relearning cards after lapse', () => {
    const relearningCard = {
      ...newCard,
      schedule: {
        state: 'relearning' as const,
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.3,
        reviews: 5,
        lapses: 1,
      },
    }

    it('re-queues on Again during relearning', () => {
      const reviewed = scheduleReview(relearningCard, 'again', now)
      expect(reviewed.schedule.state).toBe('relearning')
      expect(reviewed.schedule.intervalDays).toBe(0)
      expect(shouldRequeueInSession(reviewed.schedule)).toBe(true)
      expect(intervalLabel(relearningCard, 'again')).toBe('< 10 min')
    })

    it('graduates to 1 day on Hard and Good during relearning', () => {
      const hard = scheduleReview(relearningCard, 'hard', now)
      expect(hard.schedule.state).toBe('review')
      expect(hard.schedule.intervalDays).toBe(1)
      expect(intervalLabel(relearningCard, 'hard')).toBe('1 day')

      const good = scheduleReview(relearningCard, 'good', now)
      expect(good.schedule.state).toBe('review')
      expect(good.schedule.intervalDays).toBe(1)
      expect(intervalLabel(relearningCard, 'good')).toBe('1 day')
    })

    it('graduates with easy boost on Easy during relearning', () => {
      const easy = scheduleReview(relearningCard, 'easy', now)
      expect(easy.schedule.state).toBe('review')
      expect(easy.schedule.intervalDays).toBe(4)
      expect(intervalLabel(relearningCard, 'easy')).toBe('4 days')

      const relearn1 = {
        ...relearningCard,
        schedule: { ...relearningCard.schedule, intervalDays: 0 },
      }
      expect(intervalLabel(relearn1, 'good')).toBe('1 day')
    })
  })

  describe('graduated review cards (SM-2 / Anki)', () => {
    const reviewSchedule: ReviewSchedule = {
      state: 'review',
      dueAt: now,
      intervalDays: 10,
      easeFactor: 2.5,
      reviews: 5,
      lapses: 0,
    }
    const reviewCard = { ...newCard, schedule: reviewSchedule }

    it('multiplies interval by ease factor on Good and preserves ease', () => {
      const reviewed = scheduleReview(reviewCard, 'good', now)
      expect(reviewed.schedule).toEqual({
        state: 'review',
        dueAt: now + 25 * DAY,
        intervalDays: 25,
        easeFactor: 2.5,
        reviews: 6,
        lapses: 0,
        lastReviewedAt: now,
      })
      expect(intervalLabel(reviewCard, 'good')).toBe('25 days')
    })

    it('increases ease and applies easy bonus on Easy', () => {
      const reviewed = scheduleReview(reviewCard, 'easy', now)
      // 10 * 2.5 * 1.3 = 32.5 -> 33 days, ease = 2.65
      expect(reviewed.schedule).toEqual({
        state: 'review',
        dueAt: now + 33 * DAY,
        intervalDays: 33,
        easeFactor: 2.65,
        reviews: 6,
        lapses: 0,
        lastReviewedAt: now,
      })
      expect(intervalLabel(reviewCard, 'easy')).toBe('33 days')

      const zeroDayReview = {
        ...newCard,
        schedule: {
          ...newCard.schedule,
          state: 'review' as const,
          intervalDays: 0,
          easeFactor: 2.5,
        },
      }
      expect(intervalLabel(zeroDayReview, 'good')).toBe('1 day')
    })

    it('reduces ease and applies hard multiplier on Hard', () => {
      const reviewed = scheduleReview(reviewCard, 'hard', now)
      // 10 * 1.2 = 12 days, ease = 2.35
      expect(reviewed.schedule).toEqual({
        state: 'review',
        dueAt: now + 12 * DAY,
        intervalDays: 12,
        easeFactor: 2.35,
        reviews: 6,
        lapses: 0,
        lastReviewedAt: now,
      })
      expect(intervalLabel(reviewCard, 'hard')).toBe('12 days')
    })

    it('records a lapse, decreases ease by 0.20, and re-queues into relearning on Again', () => {
      const reviewed = scheduleReview(reviewCard, 'again', now)
      expect(reviewed.schedule).toEqual({
        state: 'relearning',
        dueAt: now + 600_000,
        intervalDays: 0,
        easeFactor: 2.3,
        reviews: 6,
        lapses: 1,
        lastReviewedAt: now,
      })
      expect(shouldRequeueInSession(reviewed.schedule)).toBe(true)
      expect(intervalLabel(reviewCard, 'again')).toBe('< 10 min')
    })

    it('enforces minimum ease factor floor of 1.30', () => {
      const lowEaseSchedule: ReviewSchedule = {
        state: 'review',
        dueAt: now,
        intervalDays: 2,
        easeFactor: 1.4,
        reviews: 10,
        lapses: 3,
      }
      const lowEaseCard = { ...newCard, schedule: lowEaseSchedule }

      const lapsed = scheduleReview(lowEaseCard, 'again', now)
      expect(lapsed.schedule.easeFactor).toBe(1.3)

      const hard = scheduleReview(lowEaseCard, 'hard', now)
      expect(hard.schedule.easeFactor).toBe(1.3)
    })
  })

  describe('schema migration & backward compatibility', () => {
    it('seamlessly parses legacy cards missing easeFactor or state', () => {
      const legacyRaw = {
        dueAt: now,
        intervalDays: 5,
        reviews: 3,
        lapses: 1,
      }

      const parsed = reviewScheduleSchema.parse(legacyRaw)
      expect(parsed).toEqual({
        state: 'review',
        dueAt: now,
        intervalDays: 5,
        easeFactor: 2.5,
        reviews: 3,
        lapses: 1,
      })
    })

    it('defaults new unreviewed legacy cards to state: new', () => {
      const legacyNew = {
        dueAt: now,
        intervalDays: 0,
        reviews: 0,
        lapses: 0,
      }

      const parsed = reviewScheduleSchema.parse(legacyNew)
      expect(parsed.state).toBe('new')
      expect(parsed.easeFactor).toBe(2.5)
    })

    it('handles non-object inputs safely through schema validation', () => {
      expect(reviewScheduleSchema.safeParse(null).success).toBe(false)
      expect(reviewScheduleSchema.safeParse('invalid').success).toBe(false)
    })
  })

  describe('updateStudyCard', () => {
    const sampleCard = createStudyCards(
      {
        spanish: 'aguacate',
        english: 'avocado',
        context: 'En el mercado',
        bidirectional: false,
      },
      'note-1',
      now,
    )[0]!

    it('updates prompt, answer, and context while recomputing scene and preserving schedule', () => {
      const updated = updateStudyCard(sampleCard, {
        prompt: 'tomar el metro',
        answer: 'take the subway',
        context: 'Estación Insurgentes',
      })

      expect(updated.id).toBe(sampleCard.id)
      expect(updated.noteId).toBe(sampleCard.noteId)
      expect(updated.prompt).toBe('tomar el metro')
      expect(updated.answer).toBe('take the subway')
      expect(updated.context).toBe('Estación Insurgentes')
      expect(updated.scene).toBe('metro')
      expect(updated.schedule).toEqual(sampleCard.schedule)
    })

    it('allows partial updates to prompt only, answer only, or context only', () => {
      const updatedPrompt = updateStudyCard(sampleCard, {
        prompt: 'el aguacate fresco',
      })
      expect(updatedPrompt.prompt).toBe('el aguacate fresco')
      expect(updatedPrompt.answer).toBe('avocado')
      expect(updatedPrompt.context).toBe('En el mercado')

      const updatedAnswer = updateStudyCard(sampleCard, {
        answer: 'fresh avocado',
      })
      expect(updatedAnswer.prompt).toBe('aguacate')
      expect(updatedAnswer.answer).toBe('fresh avocado')

      const updatedContext = updateStudyCard(sampleCard, {
        context: 'Frutas y verduras',
      })
      expect(updatedContext.context).toBe('Frutas y verduras')
    })

    it('rejects empty strings for prompt or answer with validation error', () => {
      expect(() =>
        updateStudyCard(sampleCard, {
          prompt: '   ',
        }),
      ).toThrow()

      expect(() =>
        updateStudyCard(sampleCard, {
          answer: '',
        }),
      ).toThrow()
    })

    it('resets card learning schedule to brand new state when resetProgress is true', () => {
      const matureCard = {
        ...sampleCard,
        schedule: {
          state: 'review' as const,
          dueAt: now + 30 * DAY,
          intervalDays: 30,
          easeFactor: 2.7,
          reviews: 12,
          lapses: 1,
        },
      }
      const resetTime = now + 10 * DAY
      const updated = updateStudyCard(
        matureCard,
        {
          prompt: 'palta',
          resetProgress: true,
        },
        resetTime,
      )

      expect(updated.prompt).toBe('palta')
      expect(updated.schedule).toEqual({
        state: 'new',
        dueAt: resetTime,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      })
    })

    it('preserves existing learning schedule when resetProgress is false or omitted', () => {
      const matureCard = {
        ...sampleCard,
        schedule: {
          state: 'review' as const,
          dueAt: now + 30 * DAY,
          intervalDays: 30,
          easeFactor: 2.7,
          reviews: 12,
          lapses: 1,
        },
      }
      const updatedWithoutReset = updateStudyCard(matureCard, {
        prompt: 'palta',
      })
      expect(updatedWithoutReset.schedule).toEqual(matureCard.schedule)

      const updatedExplicitFalse = updateStudyCard(matureCard, {
        prompt: 'palta',
        resetProgress: false,
      })
      expect(updatedExplicitFalse.schedule).toEqual(matureCard.schedule)
    })
  })

  describe('resetCardProgress and createNewReviewSchedule', () => {
    it('creates a clean brand new schedule', () => {
      const schedule = createNewReviewSchedule(now)
      expect(schedule).toEqual({
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      })
    })

    it('resets a learned card back to new schedule', () => {
      const card = {
        ...createStudyCards(
          {
            spanish: 'hola',
            english: 'hello',
            context: '',
            bidirectional: false,
          },
          'n1',
          now,
        )[0]!,
        schedule: {
          state: 'review' as const,
          dueAt: now + 1000,
          intervalDays: 14,
          easeFactor: 2.35,
          reviews: 5,
          lapses: 2,
        },
      }
      const reset = resetCardProgress(card, now + 5000)
      expect(reset.schedule).toEqual({
        state: 'new',
        dueAt: now + 5000,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      })
    })
  })

  describe('deleteStudyCard', () => {
    const cards = createStudyCards(
      {
        spanish: 'uno',
        english: 'one',
        context: '',
        bidirectional: true,
      },
      'note-1',
      now,
    )

    it('removes the specified card by id and preserves remaining cards', () => {
      const remaining = deleteStudyCard(cards, 'note-1:es-en')
      expect(remaining).toHaveLength(1)
      expect(remaining[0]?.id).toBe('note-1:en-es')
    })

    it('returns the same array when id does not match any card', () => {
      const remaining = deleteStudyCard(cards, 'non-existent')
      expect(remaining).toHaveLength(2)
      expect(remaining).toEqual(cards)
    })
  })

  describe('orderCardsForReview', () => {
    it('filters out non-due cards and sorts by direction (es-en first) and due date', () => {
      const sampleCards = [
        // es-en card due in the future (not due)
        {
          ...createStudyCards(
            {
              spanish: 'tres',
              english: 'three',
              context: '',
              bidirectional: false,
            },
            'note-3',
            now,
          )[0]!,
          schedule: {
            ...createNewReviewSchedule(now),
            dueAt: now + 1000,
          },
        },
        // en-es card due now
        {
          ...createStudyCards(
            {
              spanish: 'dos',
              english: 'two',
              context: '',
              bidirectional: false,
            },
            'note-2',
            now,
          )[0]!,
          id: 'note-2:en-es',
          direction: 'en-es' as const,
          schedule: {
            ...createNewReviewSchedule(now),
            dueAt: now,
          },
        },
        // es-en card due now
        {
          ...createStudyCards(
            {
              spanish: 'uno',
              english: 'one',
              context: '',
              bidirectional: false,
            },
            'note-1',
            now,
          )[0]!,
          schedule: {
            ...createNewReviewSchedule(now),
            dueAt: now,
          },
        },
        // es-en card overdue
        {
          ...createStudyCards(
            {
              spanish: 'cero',
              english: 'zero',
              context: '',
              bidirectional: false,
            },
            'note-0',
            now,
          )[0]!,
          schedule: {
            ...createNewReviewSchedule(now),
            dueAt: now - 5000,
          },
        },
      ]

      const ordered = orderCardsForReview(sampleCards, now)

      expect(ordered.map((c) => c.id)).toEqual([
        'note-0:es-en', // es-en, overdue (-5000)
        'note-1:es-en', // es-en, due now (0)
        'note-2:en-es', // en-es, due now (0)
      ])
    })

    it('prioritizes active in-progress reviews (including reverse recall) over unstarted backlog cards', () => {
      // Learner has a backlog of 30 notes created 5 days ago (all cards due now).
      // Note 1 was reviewed yesterday in es-en, so note-1:en-es is due today for reverse active recall.
      // Notes 2..30 are unstarted backlog cards.
      const past = now - 5 * DAY
      const cards: StudyCard[] = []

      // Note 1: es-en was studied yesterday, en-es is due today
      const note1Cards = createStudyCards(
        { spanish: 'gato', english: 'cat', context: '', bidirectional: true },
        'note-01',
        past,
      )
      // note-01:es-en reviewed yesterday with Good
      note1Cards[0]!.schedule = {
        state: 'review',
        dueAt: now + 3 * DAY,
        intervalDays: 4,
        easeFactor: 2.5,
        reviews: 1,
        lapses: 0,
        lastReviewedAt: now - DAY,
      }
      // note-01:en-es is due today for reverse recall
      note1Cards[1]!.schedule = {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      }
      cards.push(...note1Cards)

      // Notes 2..20 are unstarted backlog notes (both directions due)
      for (let i = 2; i <= 20; i++) {
        const id = String(i).padStart(2, '0')
        const noteCards = createStudyCards(
          {
            spanish: `palabra-${id}`,
            english: `word-${id}`,
            context: '',
            bidirectional: true,
          },
          `note-${id}`,
          past,
        )
        noteCards[0]!.schedule.dueAt = past
        noteCards[1]!.schedule.dueAt = past + DAY
        cards.push(...noteCards)
      }

      // In a 15-card sprint, note-01:en-es MUST be served first ahead of new backlog cards!
      const sprint = orderCardsForReview(cards, now, DEFAULT_STUDY_BATCH_SIZE)
      expect(sprint[0]!.id).toBe('note-01:en-es')
      expect(sprint[0]!.direction).toBe('en-es')

      // The remaining 14 cards in the sprint are unstarted cards (es-en recognition cohort)
      for (let i = 1; i < 15; i++) {
        expect(sprint[i]!.direction).toBe('es-en')
      }
    })

    it('separates same-note siblings into primary and secondary cohorts so no sprint contains intra-session siblings', () => {
      const cards: StudyCard[] = []
      for (let i = 1; i <= 10; i++) {
        const id = String(i).padStart(2, '0')
        const noteCards = createStudyCards(
          {
            spanish: `palabra-${id}`,
            english: `word-${id}`,
            context: '',
            bidirectional: true,
          },
          `note-${id}`,
          now - 2 * DAY,
        )
        noteCards[0]!.schedule.dueAt = now
        noteCards[1]!.schedule.dueAt = now
        cards.push(...noteCards)
      }

      const allDue = orderCardsForReview(cards, now)
      expect(allDue).toHaveLength(20)

      // First 10 cards are all primary (es-en), one per note
      const firstTen = allDue.slice(0, 10)
      const noteIds = new Set(firstTen.map((c) => c.noteId))
      expect(noteIds.size).toBe(10)
      expect(firstTen.every((c) => c.direction === 'es-en')).toBe(true)

      // Next 10 cards are all secondary (en-es)
      const nextTen = allDue.slice(10, 20)
      expect(nextTen.every((c) => c.direction === 'en-es')).toBe(true)

      // When limited to a sprint batch (e.g. 15), same-note siblings are deduplicated
      // so the sprint only contains 10 cards (one per note) rather than pulling doomed siblings
      const sprint = orderCardsForReview(cards, now, DEFAULT_STUDY_BATCH_SIZE)
      expect(sprint).toHaveLength(10)
      const sprintNoteIds = new Set(sprint.map((c) => c.noteId))
      expect(sprintNoteIds.size).toBe(10)
      expect(sprint.every((c) => c.direction === 'es-en')).toBe(true)
    })

    it('fills a review sprint with new backlog notes rather than secondary siblings of active notes', () => {
      // 14 active notes (both directions due = 28 cards)
      // 5 new backlog notes (both directions due = 10 cards)
      const cards: StudyCard[] = []
      for (let i = 1; i <= 14; i++) {
        const id = String(i).padStart(2, '0')
        const noteCards = createStudyCards(
          {
            spanish: `activa-${id}`,
            english: `active-${id}`,
            context: '',
            bidirectional: true,
          },
          `note-active-${id}`,
          now - 5 * DAY,
        )
        noteCards[0]!.schedule = {
          ...noteCards[0]!.schedule,
          state: 'review',
          reviews: 2,
          dueAt: now - DAY,
        }
        noteCards[1]!.schedule = {
          ...noteCards[1]!.schedule,
          state: 'review',
          reviews: 1,
          dueAt: now - 2 * DAY,
        }
        cards.push(...noteCards)
      }

      for (let i = 1; i <= 5; i++) {
        const id = String(i).padStart(2, '0')
        const noteCards = createStudyCards(
          {
            spanish: `nueva-${id}`,
            english: `new-${id}`,
            context: '',
            bidirectional: true,
          },
          `note-new-${id}`,
          now,
        )
        noteCards[0]!.schedule.dueAt = now
        noteCards[1]!.schedule.dueAt = now
        cards.push(...noteCards)
      }

      const sprint = orderCardsForReview(cards, now, DEFAULT_STUDY_BATCH_SIZE)
      expect(sprint).toHaveLength(DEFAULT_STUDY_BATCH_SIZE) // exactly 15 cards

      // All 15 cards in the sprint must belong to distinct notes (0 intra-sprint siblings)
      const sprintNotes = new Set(sprint.map((c) => c.noteId))
      expect(sprintNotes.size).toBe(15)

      // First 14 are the primary cards of the 14 active notes
      expect(
        sprint.slice(0, 14).every((c) => c.noteId.startsWith('note-active-')),
      ).toBe(true)

      // The 15th card is from the new backlog cohort (note-new-01), NOT a secondary sibling of an active note
      expect(sprint[14]!.noteId).toBe('note-new-01')
    })

    it('does not include doomed secondary siblings when fewer than batch limit notes are due', () => {
      // 14 active notes (28 cards)
      const cards: StudyCard[] = []
      for (let i = 1; i <= 14; i++) {
        const id = String(i).padStart(2, '0')
        const noteCards = createStudyCards(
          {
            spanish: `activa-${id}`,
            english: `active-${id}`,
            context: '',
            bidirectional: true,
          },
          `note-active-${id}`,
          now - 5 * DAY,
        )
        noteCards[0]!.schedule = {
          ...noteCards[0]!.schedule,
          state: 'review',
          reviews: 2,
          dueAt: now,
        }
        noteCards[1]!.schedule = {
          ...noteCards[1]!.schedule,
          state: 'review',
          reviews: 1,
          dueAt: now,
        }
        cards.push(...noteCards)
      }

      const sprint = orderCardsForReview(cards, now, DEFAULT_STUDY_BATCH_SIZE)
      // Exactly 14 cards (not 15), preventing intra-session sibling eviction
      expect(sprint).toHaveLength(14)
      const sprintNotes = new Set(sprint.map((c) => c.noteId))
      expect(sprintNotes.size).toBe(14)
    })

    it('handles active notes with multiple due directions by ordering more overdue direction first', () => {
      const activeCards: StudyCard[] = [
        {
          ...createStudyCards(
            {
              spanish: 'perro',
              english: 'dog',
              context: '',
              bidirectional: false,
            },
            'note-diff',
            now - 10 * DAY,
          )[0]!,
          id: 'note-diff:es-en',
          direction: 'es-en',
          schedule: {
            state: 'review',
            dueAt: now - 5000,
            intervalDays: 5,
            easeFactor: 2.5,
            reviews: 2,
            lapses: 0,
          },
        },
        {
          ...createStudyCards(
            {
              spanish: 'perro',
              english: 'dog',
              context: '',
              bidirectional: false,
            },
            'note-diff',
            now - 10 * DAY,
          )[0]!,
          id: 'note-diff:en-es',
          direction: 'en-es',
          schedule: {
            state: 'review',
            dueAt: now - 10000, // more overdue
            intervalDays: 3,
            easeFactor: 2.5,
            reviews: 2,
            lapses: 0,
          },
        },
        {
          ...createStudyCards(
            {
              spanish: 'gato',
              english: 'cat',
              context: '',
              bidirectional: false,
            },
            'note-tied',
            now - 10 * DAY,
          )[0]!,
          id: 'note-tied:es-en',
          direction: 'es-en',
          schedule: {
            state: 'review',
            dueAt: now,
            intervalDays: 1,
            easeFactor: 2.5,
            reviews: 1,
            lapses: 0,
          },
        },
        {
          ...createStudyCards(
            {
              spanish: 'gato',
              english: 'cat',
              context: '',
              bidirectional: false,
            },
            'note-tied',
            now - 10 * DAY,
          )[0]!,
          id: 'note-tied:en-es',
          direction: 'en-es',
          schedule: {
            state: 'review',
            dueAt: now,
            intervalDays: 1,
            easeFactor: 2.5,
            reviews: 1,
            lapses: 0,
          },
        },
        {
          ...createStudyCards(
            {
              spanish: 'cloze a',
              english: 'cloze a',
              context: '',
              bidirectional: false,
            },
            'note-same-dir',
            now - 10 * DAY,
          )[0]!,
          id: 'note-same-dir:c2',
          direction: 'es-en',
          schedule: {
            state: 'review',
            dueAt: now,
            intervalDays: 1,
            easeFactor: 2.5,
            reviews: 1,
            lapses: 0,
          },
        },
        {
          ...createStudyCards(
            {
              spanish: 'cloze b',
              english: 'cloze b',
              context: '',
              bidirectional: false,
            },
            'note-same-dir',
            now - 10 * DAY,
          )[0]!,
          id: 'note-same-dir:c1',
          direction: 'es-en',
          schedule: {
            state: 'review',
            dueAt: now,
            intervalDays: 1,
            easeFactor: 2.5,
            reviews: 1,
            lapses: 0,
          },
        },
      ]

      const ordered = orderCardsForReview(activeCards, now)
      // note-diff has more overdue en-es (-10000) so note-diff:en-es is primary, note-diff:es-en is secondary
      // note-same-dir has two es-en cards tied at now, ordered by id (c1 before c2)
      // note-tied is due now (tied) so es-en is primary tiebreaker, en-es is secondary
      expect(ordered.map((c) => c.id)).toEqual([
        'note-diff:en-es',
        'note-same-dir:c1',
        'note-tied:es-en',
        'note-diff:es-en',
        'note-same-dir:c2',
        'note-tied:en-es',
      ])
    })

    it('preserves all cards for notes with 3+ cards (e.g. multi-cloze) without dropping cards 3+ from secondary cohort', () => {
      // Create a note with 4 cloze cards (c1, c2, c3, c4) all due at now
      const clozeCards: StudyCard[] = [1, 2, 3, 4].map((num) => ({
        ...createStudyCards(
          {
            spanish: `oracion con cloze ${num}`,
            english: `sentence with cloze ${num}`,
            context: '',
            bidirectional: false,
          },
          'note-cloze',
          now,
        )[0]!,
        id: `note-cloze:c${num}`,
        direction: 'es-en' as const,
        schedule: {
          state: 'new' as const,
          dueAt: now,
          intervalDays: 0,
          easeFactor: 2.5,
          reviews: 0,
          lapses: 0,
        },
      }))

      const ordered = orderCardsForReview(clozeCards, now)
      expect(ordered).toHaveLength(4)
      // First card in primary cohort
      expect(ordered[0]!.id).toBe('note-cloze:c1')
      // Remaining 3 cards preserved in secondary cohort (none dropped)
      expect(ordered.slice(1).map((c) => c.id)).toEqual([
        'note-cloze:c2',
        'note-cloze:c3',
        'note-cloze:c4',
      ])
    })
  })

  describe('burySiblingCards', () => {
    it('buries sibling cards sharing the same noteId when due today to now + DAY', () => {
      const cards = [
        ...createStudyCards(
          { spanish: 'gato', english: 'cat', context: '', bidirectional: true },
          'note-gato',
          now,
        ),
        ...createStudyCards(
          {
            spanish: 'perro',
            english: 'dog',
            context: '',
            bidirectional: true,
          },
          'note-perro',
          now,
        ),
      ]
      // Make reverse cards due at now as well (e.g. legacy or imported deck)
      cards[1]!.schedule.dueAt = now
      cards[3]!.schedule.dueAt = now

      const reviewedCard = cards[0]! // gato:es-en
      const result = burySiblingCards(cards, reviewedCard, now)

      expect(result.buriedCardIds).toEqual(['note-gato:en-es'])
      const buriedSibling = result.updatedCards.find(
        (c) => c.id === 'note-gato:en-es',
      )
      expect(buriedSibling?.schedule.dueAt).toBe(now + DAY)

      // Other notes are unaffected
      const otherNote = result.updatedCards.find(
        (c) => c.id === 'note-perro:en-es',
      )
      expect(otherNote?.schedule.dueAt).toBe(now)
    })

    it('does not bury siblings that are already scheduled in the future', () => {
      const cards = createStudyCards(
        { spanish: 'gato', english: 'cat', context: '', bidirectional: true },
        'note-gato',
        now,
      )
      // cards[1] is already dueAt: now + DAY (from createStudyCards)

      const reviewedCard = cards[0]!
      const result = burySiblingCards(cards, reviewedCard, now)

      expect(result.buriedCardIds).toEqual([])
      expect(result.updatedCards).toEqual(cards)
    })
  })

  describe('orderCardsForReview with batch limit', () => {
    it('limits returned cards to batch limit when requested', () => {
      const cards = Array.from({ length: 25 }, (_, i) => ({
        ...createStudyCards(
          {
            spanish: `p-${i}`,
            english: `e-${i}`,
            context: '',
            bidirectional: false,
          },
          `note-${i}`,
          now,
        )[0]!,
        id: `card-${i}`,
        schedule: { ...createNewReviewSchedule(now), dueAt: now },
      }))

      const allDue = orderCardsForReview(cards, now)
      expect(allDue).toHaveLength(25)

      const batched = orderCardsForReview(cards, now, DEFAULT_STUDY_BATCH_SIZE)
      expect(batched).toHaveLength(DEFAULT_STUDY_BATCH_SIZE)
      expect(batched.map((c) => c.id)).toEqual(
        allDue.slice(0, DEFAULT_STUDY_BATCH_SIZE).map((c) => c.id),
      )
    })
  })

  describe('localeForPrompt and localeForAnswer', () => {
    it('returns es-MX for prompt and en-US for answer when direction is es-en', () => {
      const card = { direction: 'es-en' as const }
      expect(localeForPrompt(card)).toBe('es-MX')
      expect(localeForAnswer(card)).toBe('en-US')
    })

    it('returns en-US for prompt and es-MX for answer when direction is en-es', () => {
      const card = { direction: 'en-es' as const }
      expect(localeForPrompt(card)).toBe('en-US')
      expect(localeForAnswer(card)).toBe('es-MX')
    })
  })
})
