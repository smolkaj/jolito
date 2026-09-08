import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReviewSchedule } from '../domain/card'
import {
  advanceSessionOnGrade,
  createStudySession,
  filterSessionCards,
  sessionCompletedCount,
  sessionEffectiveTotal,
  sessionProgressPercentage,
  type SessionGradeResult,
  type StudySession,
} from '../domain/study-session'

export interface FilterCardsResult {
  nextSession: StudySession
  removedCount: number
  becameEmpty: boolean
}

export function useStudySession(initialSession: StudySession) {
  const [session, setSession] = useState<StudySession>(initialSession)
  const sessionRef = useRef(initialSession)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)

  const currentCardId = session.queue[0]
  const remainingCount = session.queue.length
  const progressPercentage = useMemo(
    () => sessionProgressPercentage(session),
    [session],
  )
  const completedCount = useMemo(
    () => sessionCompletedCount(session),
    [session],
  )
  const effectiveTotal = useMemo(
    () => sessionEffectiveTotal(session),
    [session],
  )

  const reveal = useCallback(() => {
    setRevealed(true)
  }, [])

  const resetPromptState = useCallback(() => {
    setAnswer('')
    setRevealed(false)
  }, [])

  const startSession = useCallback(
    (
      cardIds: string[],
      initialTotal?: number,
      initialReviewedCount = 0,
      initialPracticedCardIds: string[] = [],
    ) => {
      const nextSession = createStudySession(
        cardIds,
        initialTotal,
        initialReviewedCount,
        initialPracticedCardIds,
      )
      sessionRef.current = nextSession
      setSession(nextSession)
      setAnswer('')
      setRevealed(false)
    },
    [],
  )

  const advanceOnGrade = useCallback(
    (
      cardId: string,
      reviewedSchedule: ReviewSchedule,
      buriedCardIds: string[],
    ): SessionGradeResult => {
      const result = advanceSessionOnGrade(
        sessionRef.current,
        cardId,
        reviewedSchedule,
        buriedCardIds,
      )
      sessionRef.current = result.nextSession
      setSession(result.nextSession)
      setAnswer('')
      setRevealed(false)
      return result
    },
    [],
  )

  const filterCards = useCallback(
    (validCardIds: Set<string>): FilterCardsResult => {
      const current = sessionRef.current
      const { nextSession, removedCount } = filterSessionCards(
        current,
        validCardIds,
      )
      const becameEmpty =
        current.queue.length > 0 && nextSession.queue.length === 0
      if (removedCount > 0) {
        sessionRef.current = nextSession
        setSession(nextSession)
      }
      return { nextSession, removedCount, becameEmpty }
    },
    [],
  )

  return {
    session,
    queue: session.queue,
    sessionTotal: session.sessionTotal,
    reviewedCount: session.reviewedCount,
    practicedCardIds: session.practicedCardIds,
    practicedCount: session.practicedCardIds.length,
    currentCardId,
    remainingCount,
    progressPercentage,
    completedCount,
    effectiveTotal,
    answer,
    setAnswer,
    revealed,
    setRevealed,
    reveal,
    resetPromptState,
    startSession,
    advanceOnGrade,
    filterCards,
  }
}
