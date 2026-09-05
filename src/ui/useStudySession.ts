import { useCallback, useMemo, useState } from 'react'
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

export function useStudySession(initialSession: StudySession) {
  const [session, setSession] = useState<StudySession>(initialSession)

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
    (cardIds: string[], initialTotal?: number, initialReviewedCount = 0) => {
      setSession(
        createStudySession(cardIds, initialTotal, initialReviewedCount),
      )
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
        session,
        cardId,
        reviewedSchedule,
        buriedCardIds,
      )
      setSession(result.nextSession)
      setAnswer('')
      setRevealed(false)
      return result
    },
    [session],
  )

  const filterCards = useCallback(
    (validCardIds: Set<string>, onSessionEmpty?: () => void) => {
      setSession((current) => {
        const { nextSession } = filterSessionCards(current, validCardIds)
        if (current.queue.length > 0 && nextSession.queue.length === 0) {
          onSessionEmpty?.()
        }
        return nextSession
      })
    },
    [],
  )

  return {
    session,
    queue: session.queue,
    sessionTotal: session.sessionTotal,
    reviewedCount: session.reviewedCount,
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
