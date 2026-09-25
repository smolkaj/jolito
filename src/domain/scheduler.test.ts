import { describe, it, expect } from 'vitest'
import { State } from 'ts-fsrs'
import {
  scheduleFsrsReview,
  nextFsrsIntervalDays,
  intervalLabel,
  shouldRequeueInSession,
  estimateFsrsParameters,
  toFsrsCard,
  fromFsrsCard,
  cardProgressLevel,
  cardDifficultyLevel,
  cardMemoryIndicators,
} from './scheduler'
import {
  createStudyCards,
  DAY,
  MINUTE,
  type ReviewSchedule,
  type StudyCard,
} from './card'

describe('scheduler (FSRS domain adapter)', () => {
  const now = 1_700_000_000_000
  const sampleCard = createStudyCards(
    {
      spanish: 'hablar',
      english: 'to speak',
      context: 'verb',
      bidirectional: false,
    },
    'card-1',
    now,
  )[0]!

  describe('estimateFsrsParameters', () => {
    it('initializes zero metrics for unreviewed new cards', () => {
      const sched: ReviewSchedule = {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      }
      expect(estimateFsrsParameters(sched)).toEqual({
        stability: 0,
        difficulty: 0,
      })
    })

    it('estimates stability from intervalDays and difficulty from easeFactor for legacy cards', () => {
      const sched: ReviewSchedule = {
        state: 'review',
        dueAt: now,
        intervalDays: 14,
        easeFactor: 2.5,
        reviews: 5,
        lapses: 0,
      }
      // difficulty: 11 - 2 * 2.5 = 6.0
      expect(estimateFsrsParameters(sched)).toEqual({
        stability: 14,
        difficulty: 6,
      })
    })

    it('preserves existing stability and difficulty when already populated', () => {
      const sched: ReviewSchedule = {
        state: 'review',
        dueAt: now,
        intervalDays: 20,
        easeFactor: 2.5,
        reviews: 6,
        lapses: 1,
        stability: 18.5,
        difficulty: 4.2,
      }
      expect(estimateFsrsParameters(sched)).toEqual({
        stability: 18.5,
        difficulty: 4.2,
      })
    })
  })

  describe('new card transitions', () => {
    it('schedules Again into learning step (1 min) and keeps in session', () => {
      const next = scheduleFsrsReview(sampleCard.schedule, 'again', now)
      expect(next.state).toBe('learning')
      expect(next.dueAt).toBe(now + 1 * MINUTE)
      expect(next.intervalDays).toBe(0)
      expect(next.reviews).toBe(1)
      expect(next.lapses).toBe(0)
      expect(next.stability).toBeGreaterThan(0)
      expect(next.difficulty).toBeGreaterThan(0)
      expect(shouldRequeueInSession(next)).toBe(true)
    })

    it('schedules Hard into learning step (6 min) and keeps in session', () => {
      const next = scheduleFsrsReview(sampleCard.schedule, 'hard', now)
      expect(next.state).toBe('learning')
      expect(next.dueAt).toBe(now + 6 * MINUTE)
      expect(next.intervalDays).toBe(0)
      expect(next.reviews).toBe(1)
      expect(shouldRequeueInSession(next)).toBe(true)
    })

    it('schedules Good into second learning step (10 min) and keeps in session', () => {
      const next = scheduleFsrsReview(sampleCard.schedule, 'good', now)
      expect(next.state).toBe('learning')
      expect(next.dueAt).toBe(now + 10 * MINUTE)
      expect(next.intervalDays).toBe(0)
      expect(next.reviews).toBe(1)
      expect(shouldRequeueInSession(next)).toBe(true)
    })

    it('graduates Easy directly to review state with multi-day interval', () => {
      const next = scheduleFsrsReview(sampleCard.schedule, 'easy', now)
      expect(next.state).toBe('review')
      expect(next.intervalDays).toBeGreaterThanOrEqual(4)
      expect(next.dueAt).toBe(now + next.intervalDays * DAY)
      expect(next.reviews).toBe(1)
      expect(shouldRequeueInSession(next)).toBe(false)
    })
  })

  describe('learning progression and graduation', () => {
    it('graduates to review state when good is answered at the end of learning steps', () => {
      const step1 = scheduleFsrsReview(sampleCard.schedule, 'good', now)
      const step2Time = step1.dueAt // 10m later
      const graduated = scheduleFsrsReview(step1, 'good', step2Time)

      expect(graduated.state).toBe('review')
      expect(graduated.intervalDays).toBeGreaterThanOrEqual(1)
      expect(graduated.reviews).toBe(2)
      expect(shouldRequeueInSession(graduated)).toBe(false)
    })

    it('stays in learning if hard is chosen during learning', () => {
      const step1 = scheduleFsrsReview(sampleCard.schedule, 'good', now)
      const hardReview = scheduleFsrsReview(step1, 'hard', step1.dueAt)

      expect(hardReview.state).toBe('learning')
      expect(hardReview.intervalDays).toBe(0)
      expect(shouldRequeueInSession(hardReview)).toBe(true)
    })
  })

  describe('review state & lapses', () => {
    const reviewSchedule: ReviewSchedule = {
      state: 'review',
      dueAt: now,
      intervalDays: 10,
      easeFactor: 2.5,
      reviews: 5,
      lapses: 0,
      lastReviewedAt: now - 10 * DAY,
      stability: 10,
      difficulty: 5,
    }

    it('advances review intervals proportionally on Good, Hard, Easy', () => {
      const hard = scheduleFsrsReview(reviewSchedule, 'hard', now)
      const good = scheduleFsrsReview(reviewSchedule, 'good', now)
      const easy = scheduleFsrsReview(reviewSchedule, 'easy', now)

      expect(hard.state).toBe('review')
      expect(good.state).toBe('review')
      expect(easy.state).toBe('review')

      // Monotonic progression: hard < good < easy
      expect(hard.intervalDays).toBeLessThan(good.intervalDays)
      expect(good.intervalDays).toBeLessThan(easy.intervalDays)
      expect(good.intervalDays).toBeGreaterThan(reviewSchedule.intervalDays)
    })

    it('transitions to relearning on lapse (Again) and increments lapses count', () => {
      const lapsed = scheduleFsrsReview(reviewSchedule, 'again', now)

      expect(lapsed.state).toBe('relearning')
      expect(lapsed.intervalDays).toBe(0)
      expect(lapsed.lapses).toBe(reviewSchedule.lapses + 1)
      expect(lapsed.reviews).toBe(reviewSchedule.reviews + 1)
      expect(lapsed.dueAt).toBe(now + 10 * MINUTE)
      expect(shouldRequeueInSession(lapsed)).toBe(true)
    })

    it('recovers from relearning back to review state after Good', () => {
      const lapsed = scheduleFsrsReview(reviewSchedule, 'again', now)
      const relearnTime = lapsed.dueAt
      const recovered = scheduleFsrsReview(lapsed, 'good', relearnTime)

      expect(recovered.state).toBe('review')
      expect(recovered.intervalDays).toBeGreaterThanOrEqual(1)
      expect(shouldRequeueInSession(recovered)).toBe(false)
    })
  })

  describe('intervalLabel previews', () => {
    it('produces human readable interval labels for brand new cards', () => {
      expect(intervalLabel(sampleCard, 'again', now)).toBe('< 1 min')
      expect(intervalLabel(sampleCard, 'hard', now)).toBe('< 6 min')
      expect(intervalLabel(sampleCard, 'good', now)).toBe('< 10 min')
      expect(intervalLabel(sampleCard, 'easy', now)).toMatch(/\d+ days/)
    })

    it('produces day intervals for review cards', () => {
      const card: StudyCard = {
        ...sampleCard,
        schedule: {
          state: 'review',
          dueAt: now,
          intervalDays: 10,
          easeFactor: 2.5,
          reviews: 5,
          lapses: 0,
          lastReviewedAt: now - 10 * DAY,
          stability: 10,
          difficulty: 5,
        },
      }

      expect(intervalLabel(card, 'again', now)).toBe('< 10 min')
      expect(intervalLabel(card, 'hard', now)).toMatch(/\d+ days/)
      expect(intervalLabel(card, 'good', now)).toMatch(/\d+ days/)
      expect(intervalLabel(card, 'easy', now)).toMatch(/\d+ days/)
    })
  })

  describe('nextFsrsIntervalDays', () => {
    it('returns 0 days for in-session sub-day steps', () => {
      expect(nextFsrsIntervalDays(sampleCard.schedule, 'again', now)).toBe(0)
      expect(nextFsrsIntervalDays(sampleCard.schedule, 'hard', now)).toBe(0)
      expect(nextFsrsIntervalDays(sampleCard.schedule, 'good', now)).toBe(0)
    })

    it('returns positive integer days for graduated cards', () => {
      const days = nextFsrsIntervalDays(sampleCard.schedule, 'easy', now)
      expect(days).toBeGreaterThanOrEqual(4)
      expect(Number.isInteger(days)).toBe(true)
    })
  })

  describe('card conversion roundtrip', () => {
    it('roundtrips card data between Jolito ReviewSchedule and ts-fsrs Card', () => {
      const inputSched: ReviewSchedule = {
        state: 'review',
        dueAt: now + 5 * DAY,
        intervalDays: 5,
        easeFactor: 2.5,
        reviews: 3,
        lapses: 1,
        lastReviewedAt: now,
        stability: 5.2,
        difficulty: 4.8,
        learningSteps: 0,
      }
      const fsrsCard = toFsrsCard(inputSched, now)
      expect(fsrsCard.scheduled_days).toBe(5)
      expect(fsrsCard.reps).toBe(3)
      expect(fsrsCard.lapses).toBe(1)
      expect(fsrsCard.stability).toBe(5.2)
      expect(fsrsCard.difficulty).toBe(4.8)

      const roundtrip = fromFsrsCard(
        {
          due: fsrsCard.due as Date,
          stability: fsrsCard.stability,
          difficulty: fsrsCard.difficulty,
          elapsed_days: fsrsCard.elapsed_days,
          scheduled_days: fsrsCard.scheduled_days,
          reps: fsrsCard.reps,
          lapses: fsrsCard.lapses,
          learning_steps: fsrsCard.learning_steps,
          state: fsrsCard.state as State,
          last_review: fsrsCard.last_review as Date,
        },
        inputSched.easeFactor,
      )
      expect(roundtrip).toEqual(inputSched)
    })
  })

  describe('cardProgressLevel', () => {
    it('returns 0 for brand new or unreviewed cards', () => {
      const newCard: ReviewSchedule = {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      }
      expect(cardProgressLevel(newCard)).toBe(0)
    })

    it('returns 1 for fragile early learning cards with stability < 7 days', () => {
      const fragileCard: ReviewSchedule = {
        state: 'learning',
        dueAt: now,
        intervalDays: 2,
        easeFactor: 2.5,
        reviews: 1,
        lapses: 0,
        stability: 3.5,
      }
      expect(cardProgressLevel(fragileCard)).toBe(1)
    })

    it('returns 2 for solid cards with 7 <= stability < 30 days', () => {
      const solidCard: ReviewSchedule = {
        state: 'review',
        dueAt: now,
        intervalDays: 14,
        easeFactor: 2.5,
        reviews: 4,
        lapses: 0,
        stability: 14.2,
      }
      expect(cardProgressLevel(solidCard)).toBe(2)
    })

    it('returns 3 for mastered cards with stability >= 30 days', () => {
      const masteredCard: ReviewSchedule = {
        state: 'review',
        dueAt: now,
        intervalDays: 45,
        easeFactor: 2.5,
        reviews: 8,
        lapses: 0,
        stability: 45.0,
      }
      expect(cardProgressLevel(masteredCard)).toBe(3)
    })
  })

  describe('cardDifficultyLevel', () => {
    it('returns 0 for unreviewed cards', () => {
      const newCard: ReviewSchedule = {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      }
      expect(cardDifficultyLevel(newCard)).toBe(0)
    })

    it('returns 0 for effortless cognates with difficulty < 3.0', () => {
      const easyCard: ReviewSchedule = {
        state: 'review',
        dueAt: now,
        intervalDays: 10,
        easeFactor: 2.5,
        reviews: 2,
        lapses: 0,
        difficulty: 2.2,
      }
      expect(cardDifficultyLevel(easyCard)).toBe(0)
    })

    it('returns 1 for mild cards with 3.0 <= difficulty < 5.0', () => {
      const mildCard: ReviewSchedule = {
        state: 'review',
        dueAt: now,
        intervalDays: 10,
        easeFactor: 2.5,
        reviews: 2,
        lapses: 0,
        difficulty: 4.1,
      }
      expect(cardDifficultyLevel(mildCard)).toBe(1)
    })

    it('returns 2 for medium heat cards with 5.0 <= difficulty < 7.5', () => {
      const mediumCard: ReviewSchedule = {
        state: 'review',
        dueAt: now,
        intervalDays: 10,
        easeFactor: 2.5,
        reviews: 2,
        lapses: 0,
        difficulty: 6.2,
      }
      expect(cardDifficultyLevel(mediumCard)).toBe(2)
    })

    it('returns 3 for spicy / hot cards with difficulty >= 7.5', () => {
      const spicyCard: ReviewSchedule = {
        state: 'review',
        dueAt: now,
        intervalDays: 3,
        easeFactor: 1.8,
        reviews: 6,
        lapses: 2,
        difficulty: 8.4,
      }
      expect(cardDifficultyLevel(spicyCard)).toBe(3)
    })
  })

  describe('cardMemoryIndicators', () => {
    it('returns unified indicators and accessible labels', () => {
      const card: ReviewSchedule = {
        state: 'review',
        dueAt: now,
        intervalDays: 14,
        easeFactor: 2.5,
        reviews: 4,
        lapses: 0,
        stability: 18.5,
        difficulty: 8.0,
      }
      const indicators = cardMemoryIndicators(card)
      expect(indicators).toEqual({
        progress: 2,
        difficulty: 3,
        progressLabel: 'Progress: 2 of 3 bubbles',
        difficultyLabel: 'Difficulty: 3 of 3 chilies (hot)',
        progressDescription: 'Solid (reliable recall, 7–30d)',
        difficultyDescription: 'Hot / ¡aguas! (high friction)',
      })
    })

    it('labels unrated cards appropriately', () => {
      const newCard: ReviewSchedule = {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      }
      const indicators = cardMemoryIndicators(newCard)
      expect(indicators).toEqual({
        progress: 0,
        difficulty: 0,
        progressLabel: 'Progress: 0 of 3 bubbles',
        difficultyLabel: 'Difficulty: unrated (0 chilies)',
        progressDescription: 'New (unstudied)',
        difficultyDescription: 'No heat (effortless / unrated)',
      })
    })
  })
})
