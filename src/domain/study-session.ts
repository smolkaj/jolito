import { z } from 'zod'
import { shouldRequeueInSession, type ReviewSchedule } from './card'

export const studySessionSchema = z.object({
  queue: z.array(z.string()),
  sessionTotal: z.number().int().nonnegative(),
  reviewedCount: z.number().int().nonnegative(),
})

export type StudySession = z.infer<typeof studySessionSchema>

export function createStudySession(
  cardIds: string[],
  initialTotal?: number,
  initialReviewedCount = 0,
): StudySession {
  const queue = [...cardIds]
  const sessionTotal =
    initialTotal !== undefined
      ? Math.max(queue.length, initialTotal)
      : queue.length

  return {
    queue,
    sessionTotal,
    reviewedCount: Math.max(0, initialReviewedCount),
  }
}

export function sessionEffectiveTotal(session: StudySession): number {
  return Math.max(session.sessionTotal, session.queue.length)
}

export function sessionCompletedCount(session: StudySession): number {
  const effectiveTotal = sessionEffectiveTotal(session)
  return Math.max(0, effectiveTotal - session.queue.length)
}

export function sessionProgressPercentage(session: StudySession): number {
  const effectiveTotal = sessionEffectiveTotal(session)
  if (effectiveTotal <= 0) return 0
  const completed = sessionCompletedCount(session)
  return Math.min(100, Math.round((completed / effectiveTotal) * 100))
}

export interface SessionGradeResult {
  nextSession: StudySession
  requeued: boolean
  buriedInSessionCount: number
  isComplete: boolean
}

export function advanceSessionOnGrade(
  session: StudySession,
  currentCardId: string,
  reviewedSchedule: ReviewSchedule,
  buriedCardIds: string[],
): SessionGradeResult {
  const requeued = shouldRequeueInSession(reviewedSchedule)
  const buriedSet = new Set(buriedCardIds)
  const remainingQueue = session.queue
    .slice(1)
    .filter((id) => !buriedSet.has(id))

  const nextQueue = requeued
    ? [...remainingQueue, currentCardId]
    : remainingQueue

  const buriedInSessionCount = session.queue
    .slice(1)
    .filter((id) => buriedSet.has(id)).length

  const nextTotal =
    buriedInSessionCount > 0
      ? Math.max(nextQueue.length, session.sessionTotal - buriedInSessionCount)
      : session.sessionTotal

  const nextSession: StudySession = {
    queue: nextQueue,
    sessionTotal: nextTotal,
    reviewedCount: session.reviewedCount + 1,
  }

  return {
    nextSession,
    requeued,
    buriedInSessionCount,
    isComplete: nextQueue.length === 0,
  }
}

export function filterSessionCards(
  session: StudySession,
  validCardIds: Set<string>,
): { nextSession: StudySession; removedCount: number } {
  if (session.queue.length === 0) {
    return { nextSession: session, removedCount: 0 }
  }
  const nextQueue = session.queue.filter((id) => validCardIds.has(id))
  const removedCount = session.queue.length - nextQueue.length
  if (removedCount === 0) {
    return { nextSession: session, removedCount: 0 }
  }
  const nextTotal = Math.max(
    nextQueue.length,
    session.sessionTotal - removedCount,
  )

  return {
    nextSession: {
      ...session,
      queue: nextQueue,
      sessionTotal: nextTotal,
    },
    removedCount,
  }
}
