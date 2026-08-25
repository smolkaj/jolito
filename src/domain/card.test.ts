import { describe, expect, it } from 'vitest'
import {
  chooseScene,
  createStudyCards,
  intervalLabel,
  isDue,
  nextIntervalDays,
  scheduleReview,
  shouldRequeueInSession,
  reviewScheduleSchema,
  type ReviewSchedule,
} from './card'

const now = Date.UTC(2026, 7, 21)
const DAY = 24 * 60 * 60 * 1000

describe('createStudyCards', () => {
  it('creates linked directions with independently editable reverse text and initial Anki schedule', () => {
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
})
