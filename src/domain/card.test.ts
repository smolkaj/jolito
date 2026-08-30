import { describe, expect, it } from 'vitest'
import {
  burySiblingCards,
  chooseScene,
  createNewReviewSchedule,
  createStudyCards,
  deleteStudyCard,
  getCardsStudiedToday,
  getStudyDayStart,
  intervalLabel,
  isDue,
  isReviewedToday,
  nextIntervalDays,
  orderCardsForReview,
  resetCardProgress,
  scheduleReview,
  shouldRequeueInSession,
  reviewScheduleSchema,
  updateStudyCard,
  DEFAULT_ROLLOVER_HOUR,
  DEFAULT_STUDY_BATCH_SIZE,
  type ReviewSchedule,
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

  describe('daily study tracking and rollover', () => {
    it('calculates study day start accurately before and after 4 AM rollover', () => {
      // 2026-08-30 02:30 UTC -> local time calculation
      const nightTime = new Date(2026, 7, 30, 2, 30).getTime()
      const startForNight = getStudyDayStart(nightTime, 4)
      const startForNightDate = new Date(startForNight)
      expect(startForNightDate.getDate()).toBe(29)
      expect(startForNightDate.getHours()).toBe(4)
      expect(startForNightDate.getMinutes()).toBe(0)

      // 2026-08-30 10:15
      const morningTime = new Date(2026, 7, 30, 10, 15).getTime()
      const startForMorning = getStudyDayStart(morningTime, 4)
      const startForMorningDate = new Date(startForMorning)
      expect(startForMorningDate.getDate()).toBe(30)
      expect(startForMorningDate.getHours()).toBe(4)
      expect(startForMorningDate.getMinutes()).toBe(0)
    })

    it('identifies whether a card was reviewed during today study window', () => {
      const todayMorning = new Date(2026, 7, 30, 9, 0).getTime()
      const reviewedEarlierToday = new Date(2026, 7, 30, 8, 0).getTime()
      const reviewedYesterday = new Date(2026, 7, 29, 14, 0).getTime()

      const baseCard = createStudyCards(
        {
          spanish: 'hola',
          english: 'hello',
          context: '',
          bidirectional: false,
        },
        'note-1',
        now,
      )[0]!

      const cardToday = {
        ...baseCard,
        schedule: {
          ...baseCard.schedule,
          lastReviewedAt: reviewedEarlierToday,
        },
      }
      const cardYesterday = {
        ...baseCard,
        schedule: {
          ...baseCard.schedule,
          lastReviewedAt: reviewedYesterday,
        },
      }
      const cardNever = { ...baseCard }

      expect(
        isReviewedToday(cardToday, todayMorning, DEFAULT_ROLLOVER_HOUR),
      ).toBe(true)
      expect(
        isReviewedToday(cardYesterday, todayMorning, DEFAULT_ROLLOVER_HOUR),
      ).toBe(false)
      expect(
        isReviewedToday(cardNever, todayMorning, DEFAULT_ROLLOVER_HOUR),
      ).toBe(false)
    })

    it('counts total cards studied today across the deck', () => {
      const todayTime = new Date(2026, 7, 30, 11, 0).getTime()
      const reviewed1 = new Date(2026, 7, 30, 9, 30).getTime()
      const reviewed2 = new Date(2026, 7, 30, 10, 0).getTime()
      const reviewedOld = new Date(2026, 7, 28, 10, 0).getTime()

      const base = createStudyCards(
        { spanish: 'a', english: 'a', context: '', bidirectional: false },
        'note-a',
        now,
      )[0]!

      const cards = [
        {
          ...base,
          id: 'card-1',
          schedule: { ...base.schedule, lastReviewedAt: reviewed1 },
        },
        {
          ...base,
          id: 'card-2',
          schedule: { ...base.schedule, lastReviewedAt: reviewed2 },
        },
        {
          ...base,
          id: 'card-3',
          schedule: { ...base.schedule, lastReviewedAt: reviewedOld },
        },
        {
          ...base,
          id: 'card-4',
          schedule: { ...base.schedule },
        },
      ]

      expect(
        getCardsStudiedToday(cards, todayTime, DEFAULT_ROLLOVER_HOUR),
      ).toBe(2)
    })

    it('sets lastReviewedAt on every review rating in scheduleReview', () => {
      const card = createStudyCards(
        { spanish: 'taco', english: 'taco', context: '', bidirectional: false },
        'note-taco',
        now,
      )[0]!

      const reviewTime = now + 5000
      const againCard = scheduleReview(card, 'again', reviewTime)
      expect(againCard.schedule.lastReviewedAt).toBe(reviewTime)

      const hardCard = scheduleReview(card, 'hard', reviewTime)
      expect(hardCard.schedule.lastReviewedAt).toBe(reviewTime)

      const goodCard = scheduleReview(card, 'good', reviewTime)
      expect(goodCard.schedule.lastReviewedAt).toBe(reviewTime)

      const easyCard = scheduleReview(card, 'easy', reviewTime)
      expect(easyCard.schedule.lastReviewedAt).toBe(reviewTime)
    })
  })

  describe('orderCardsForReview with batch limit', () => {
    it('limits returned cards to batch limit when requested', () => {
      const cards = Array.from({ length: 15 }, (_, i) => ({
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
      expect(allDue).toHaveLength(15)

      const batched = orderCardsForReview(cards, now, DEFAULT_STUDY_BATCH_SIZE)
      expect(batched).toHaveLength(DEFAULT_STUDY_BATCH_SIZE)
      expect(batched.map((c) => c.id)).toEqual(
        allDue.slice(0, DEFAULT_STUDY_BATCH_SIZE).map((c) => c.id),
      )
    })
  })
})
