import {
  fsrs,
  Rating,
  State,
  type Card,
  type CardInput,
  type FSRS,
  type Grade as FsrsGrade,
} from 'ts-fsrs'
import type { Grade, ReviewSchedule, StudyCard } from './card'

export const DAY = 24 * 60 * 60 * 1000
export const MINUTE = 60 * 1000

export const defaultFsrs: FSRS = fsrs()

export const gradeToFsrs: Readonly<Record<Grade, FsrsGrade>> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

export const fsrsToState: Readonly<Record<number, ReviewSchedule['state']>> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
}

export const stateToFsrs: Readonly<Record<ReviewSchedule['state'], State>> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
}

/**
 * Estimates baseline FSRS stability and difficulty parameters for cards
 * that originated from legacy SM-2 or lack explicit DSR metrics.
 */
export function estimateFsrsParameters(schedule: ReviewSchedule): {
  stability: number
  difficulty: number
} {
  const isReviewed = schedule.reviews > 0 || schedule.state !== 'new'
  const stability =
    schedule.stability ??
    (isReviewed ? Math.max(0.1, schedule.intervalDays) : 0)
  const difficulty =
    schedule.difficulty ??
    (isReviewed ? Math.max(1, Math.min(10, 11 - 2 * schedule.easeFactor)) : 0)
  return { stability, difficulty }
}

/**
 * Converts a Jolito domain ReviewSchedule into a ts-fsrs CardInput.
 */
export function toFsrsCard(schedule: ReviewSchedule, now: number): CardInput {
  const state = stateToFsrs[schedule.state]
  const { stability, difficulty } = estimateFsrsParameters(schedule)

  const elapsedDays = schedule.lastReviewedAt
    ? Math.max(0, Math.floor((now - schedule.lastReviewedAt) / DAY))
    : 0

  const learningSteps = schedule.learningSteps ?? 0

  const card: CardInput = {
    due: new Date(schedule.dueAt),
    stability,
    difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: schedule.intervalDays,
    reps: schedule.reviews,
    lapses: schedule.lapses,
    learning_steps: learningSteps,
    state,
    ...(schedule.lastReviewedAt
      ? { last_review: new Date(schedule.lastReviewedAt) }
      : {}),
  }

  return card
}

/**
 * Converts a scheduled ts-fsrs Card back to a Jolito domain ReviewSchedule.
 */
export function fromFsrsCard(
  card: Card,
  originalEaseFactor: number = 2.5,
): ReviewSchedule {
  return {
    state: fsrsToState[card.state] ?? 'new',
    dueAt: card.due.getTime(),
    intervalDays: card.scheduled_days,
    easeFactor: originalEaseFactor,
    reviews: card.reps,
    lapses: card.lapses,
    lastReviewedAt: card.last_review ? card.last_review.getTime() : undefined,
    stability: card.stability,
    difficulty: card.difficulty,
    learningSteps: card.learning_steps,
  }
}

/**
 * Evaluates the next review schedule using the FSRS DSR memory model.
 */
export function scheduleFsrsReview(
  current: ReviewSchedule,
  grade: Grade,
  now: number,
  scheduler: FSRS = defaultFsrs,
): ReviewSchedule {
  const fsrsCard = toFsrsCard(current, now)
  const rating = gradeToFsrs[grade]
  const result = scheduler.next(fsrsCard, new Date(now), rating)
  return fromFsrsCard(result.card, current.easeFactor)
}

/**
 * Computes the next interval in full days for a given grade preview.
 */
export function nextFsrsIntervalDays(
  schedule: ReviewSchedule,
  grade: Grade,
  now?: number,
  scheduler: FSRS = defaultFsrs,
): number {
  const effectiveNow = now ?? Date.now()
  const fsrsCard = toFsrsCard(schedule, effectiveNow)
  const rating = gradeToFsrs[grade]
  const preview = scheduler.repeat(fsrsCard, new Date(effectiveNow))[rating]
  return preview ? preview.card.scheduled_days : 0
}

/**
 * Generates human-friendly interval strings for review buttons (e.g. '< 1 min', '< 10 min', '1 day', '12 days').
 */
export function intervalLabel(
  card: StudyCard,
  grade: Grade,
  now?: number,
  scheduler: FSRS = defaultFsrs,
): string {
  const schedule = card.schedule
  const effectiveNow = now ?? Date.now()
  const fsrsCard = toFsrsCard(schedule, effectiveNow)
  const rating = gradeToFsrs[grade]
  const preview = scheduler.repeat(fsrsCard, new Date(effectiveNow))[rating]
  if (!preview) return ''

  const scheduledDays = preview.card.scheduled_days
  if (scheduledDays === 0) {
    const diffMs = preview.card.due.getTime() - effectiveNow
    const diffMin = Math.round(diffMs / MINUTE)
    if (diffMin <= 1) return '< 1 min'
    return `< ${diffMin} min`
  }

  return scheduledDays === 1 ? '1 day' : `${scheduledDays} days`
}

/**
 * Determines whether a card should be requeued in the active study session.
 */
export function shouldRequeueInSession(schedule: ReviewSchedule): boolean {
  return schedule.state === 'learning' || schedule.state === 'relearning'
}
