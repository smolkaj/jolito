import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ReviewSchedule } from '../domain/card'
import { createStudySession } from '../domain/study-session'
import { useStudySession } from './useStudySession'

describe('useStudySession', () => {
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

  it('initializes with given session state', () => {
    const initial = createStudySession(['c1', 'c2', 'c3'])
    const { result } = renderHook(() => useStudySession(initial))

    expect(result.current.queue).toEqual(['c1', 'c2', 'c3'])
    expect(result.current.sessionTotal).toBe(3)
    expect(result.current.reviewedCount).toBe(0)
    expect(result.current.currentCardId).toBe('c1')
    expect(result.current.progressPercentage).toBe(0)
    expect(result.current.remainingCount).toBe(3)
    expect(result.current.answer).toBe('')
    expect(result.current.revealed).toBe(false)
  })

  it('updates answer and revealed state', () => {
    const { result } = renderHook(() =>
      useStudySession(createStudySession(['c1'])),
    )

    act(() => {
      result.current.setAnswer('hola')
    })
    expect(result.current.answer).toBe('hola')

    act(() => {
      result.current.reveal()
    })
    expect(result.current.revealed).toBe(true)
  })

  it('starts a new session with specified cards and resets transient state', () => {
    const { result } = renderHook(() =>
      useStudySession(createStudySession(['c1'])),
    )

    act(() => {
      result.current.setAnswer('in-progress answer')
      result.current.reveal()
    })

    act(() => {
      result.current.startSession(['new-1', 'new-2'])
    })

    expect(result.current.queue).toEqual(['new-1', 'new-2'])
    expect(result.current.sessionTotal).toBe(2)
    expect(result.current.reviewedCount).toBe(0)
    expect(result.current.currentCardId).toBe('new-1')
    expect(result.current.answer).toBe('')
    expect(result.current.revealed).toBe(false)
  })

  it('advances on grade, resets answer/revealed, and calculates progress correctly', () => {
    const { result } = renderHook(() =>
      useStudySession(createStudySession(['c1', 'c2', 'c3'])),
    )

    act(() => {
      result.current.setAnswer('my answer')
      result.current.reveal()
    })

    let gradeResult: ReturnType<typeof result.current.advanceOnGrade>
    act(() => {
      gradeResult = result.current.advanceOnGrade('c1', graduatedSchedule, [
        'outside-sibling',
      ])
    })

    expect(gradeResult!.isComplete).toBe(false)
    expect(gradeResult!.requeued).toBe(false)
    expect(result.current.queue).toEqual(['c2', 'c3'])
    expect(result.current.sessionTotal).toBe(3)
    expect(result.current.reviewedCount).toBe(1)
    expect(result.current.progressPercentage).toBe(33)
    expect(result.current.answer).toBe('')
    expect(result.current.revealed).toBe(false)
  })

  it('requeues card when schedule indicates requeue', () => {
    const { result } = renderHook(() =>
      useStudySession(createStudySession(['c1', 'c2'])),
    )

    let gradeResult: ReturnType<typeof result.current.advanceOnGrade>
    act(() => {
      gradeResult = result.current.advanceOnGrade('c1', learningSchedule, [])
    })

    expect(gradeResult!.requeued).toBe(true)
    expect(gradeResult!.isComplete).toBe(false)
    expect(result.current.queue).toEqual(['c2', 'c1'])
    expect(result.current.sessionTotal).toBe(2)
    expect(result.current.reviewedCount).toBe(1)
    expect(result.current.progressPercentage).toBe(0)
  })

  it('filters cards when deck is modified and adjusts sessionTotal', () => {
    const { result } = renderHook(() =>
      useStudySession(createStudySession(['c1', 'c2', 'c3'])),
    )

    act(() => {
      result.current.filterCards(new Set(['c1', 'c3']))
    })

    expect(result.current.queue).toEqual(['c1', 'c3'])
    expect(result.current.sessionTotal).toBe(2)
  })

  it('triggers onSessionEmpty callback when all remaining cards in queue are filtered out', () => {
    const { result } = renderHook(() =>
      useStudySession(createStudySession(['c1', 'c2'])),
    )

    let emptyCalled = false
    act(() => {
      result.current.filterCards(new Set(), () => {
        emptyCalled = true
      })
    })

    expect(result.current.queue).toEqual([])
    expect(emptyCalled).toBe(true)
  })
})
