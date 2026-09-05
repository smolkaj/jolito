import { describe, expect, it } from 'vitest'
import type { ReviewSchedule } from './card'
import {
  advanceSessionOnGrade,
  createStudySession,
  filterSessionCards,
  sessionCompletedCount,
  sessionEffectiveTotal,
  sessionProgressPercentage,
} from './study-session'

describe('studySession', () => {
  const graduatedSchedule: ReviewSchedule = {
    state: 'review',
    dueAt: Date.now() + 86400000,
    intervalDays: 1,
    easeFactor: 2.5,
    reviews: 1,
    lapses: 0,
  }

  const learningSchedule: ReviewSchedule = {
    state: 'learning',
    dueAt: Date.now() + 600000,
    intervalDays: 0,
    easeFactor: 2.5,
    reviews: 1,
    lapses: 0,
  }

  describe('createStudySession', () => {
    it('initializes session with queue length as sessionTotal by default', () => {
      const session = createStudySession(['c1', 'c2', 'c3'])
      expect(session.queue).toEqual(['c1', 'c2', 'c3'])
      expect(session.sessionTotal).toBe(3)
      expect(session.reviewedCount).toBe(0)
    })

    it('respects explicitly provided initialTotal and initialReviewedCount', () => {
      const session = createStudySession(['c2', 'c3'], 5, 2)
      expect(session.queue).toEqual(['c2', 'c3'])
      expect(session.sessionTotal).toBe(5)
      expect(session.reviewedCount).toBe(2)
    })

    it('ensures sessionTotal is at least queue length', () => {
      const session = createStudySession(['c1', 'c2', 'c3'], 1)
      expect(session.sessionTotal).toBe(3)
    })
  })

  describe('progress calculations', () => {
    it('returns 0 progress for empty session', () => {
      const session = createStudySession([])
      expect(sessionEffectiveTotal(session)).toBe(0)
      expect(sessionCompletedCount(session)).toBe(0)
      expect(sessionProgressPercentage(session)).toBe(0)
    })

    it('calculates correct completed count and percentage', () => {
      const session = createStudySession(['c4', 'c5'], 5, 3)
      expect(sessionEffectiveTotal(session)).toBe(5)
      expect(sessionCompletedCount(session)).toBe(3)
      expect(sessionProgressPercentage(session)).toBe(60)
    })
  })

  describe('advanceSessionOnGrade', () => {
    it('advances progress when rating card whose sibling is outside the queue', () => {
      const initial = createStudySession(['c1', 'c2', 'c3'])
      // Sibling 'c1-sibling' is buried in deck, but was not in the queue
      const result = advanceSessionOnGrade(initial, 'c1', graduatedSchedule, [
        'c1-sibling',
      ])

      expect(result.requeued).toBe(false)
      expect(result.buriedInSessionCount).toBe(0)
      expect(result.isComplete).toBe(false)
      expect(result.nextSession.queue).toEqual(['c2', 'c3'])
      expect(result.nextSession.sessionTotal).toBe(3) // Not decremented!
      expect(result.nextSession.reviewedCount).toBe(1)
      expect(sessionCompletedCount(result.nextSession)).toBe(1)
      expect(sessionProgressPercentage(result.nextSession)).toBe(33)
    })

    it('adjusts sessionTotal when sibling is inside the active queue', () => {
      const initial = createStudySession(['c1', 'c2', 'c1-sibling', 'c3'])
      const result = advanceSessionOnGrade(initial, 'c1', graduatedSchedule, [
        'c1-sibling',
      ])

      expect(result.requeued).toBe(false)
      expect(result.buriedInSessionCount).toBe(1)
      expect(result.isComplete).toBe(false)
      // c1 graduated, c1-sibling removed from queue
      expect(result.nextSession.queue).toEqual(['c2', 'c3'])
      // sessionTotal decremented from 4 to 3
      expect(result.nextSession.sessionTotal).toBe(3)
      expect(result.nextSession.reviewedCount).toBe(1)
      // 1 card completed out of 3 total in session
      expect(sessionCompletedCount(result.nextSession)).toBe(1)
      expect(sessionProgressPercentage(result.nextSession)).toBe(33)
    })

    it('requeues card at end of queue when schedule indicates requeue', () => {
      const initial = createStudySession(['c1', 'c2', 'c3'])
      const result = advanceSessionOnGrade(initial, 'c1', learningSchedule, [])

      expect(result.requeued).toBe(true)
      expect(result.isComplete).toBe(false)
      expect(result.nextSession.queue).toEqual(['c2', 'c3', 'c1'])
      expect(result.nextSession.sessionTotal).toBe(3)
      expect(result.nextSession.reviewedCount).toBe(1)
      expect(sessionCompletedCount(result.nextSession)).toBe(0)
      expect(sessionProgressPercentage(result.nextSession)).toBe(0)
    })

    it('flags isComplete when last card is graduated', () => {
      const initial = createStudySession(['c1'])
      const result = advanceSessionOnGrade(initial, 'c1', graduatedSchedule, [])

      expect(result.requeued).toBe(false)
      expect(result.isComplete).toBe(true)
      expect(result.nextSession.queue).toEqual([])
      expect(result.nextSession.sessionTotal).toBe(1)
      expect(result.nextSession.reviewedCount).toBe(1)
      expect(sessionCompletedCount(result.nextSession)).toBe(1)
      expect(sessionProgressPercentage(result.nextSession)).toBe(100)
    })
  })

  describe('filterSessionCards', () => {
    it('removes deleted cards from queue and adjusts sessionTotal', () => {
      const initial = createStudySession(['c1', 'c2', 'c3'], 5, 2)
      const validIds = new Set(['c1', 'c3'])
      const { nextSession, removedCount } = filterSessionCards(
        initial,
        validIds,
      )

      expect(removedCount).toBe(1)
      expect(nextSession.queue).toEqual(['c1', 'c3'])
      expect(nextSession.sessionTotal).toBe(4) // 5 - 1
      expect(nextSession.reviewedCount).toBe(2)
    })

    it('handles empty queue without modifying session', () => {
      const initial = createStudySession([])
      const { nextSession, removedCount } = filterSessionCards(
        initial,
        new Set(['c1']),
      )
      expect(removedCount).toBe(0)
      expect(nextSession).toBe(initial)
    })
  })
})
