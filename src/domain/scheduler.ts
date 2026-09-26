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

export type MemoryMasteryLevel = 0 | 1 | 2 | 3
export type MemoryProgressLevel = MemoryMasteryLevel
export type MemoryDifficultyLevel = 0 | 1 | 2 | 3

export interface CardMemoryIndicators {
  mastery: MemoryMasteryLevel
  progress: MemoryProgressLevel
  difficulty: MemoryDifficultyLevel
  masteryLabel: string
  progressLabel: string
  difficultyLabel: string
}

/**
 * Maps FSRS stability (memory half-life in days) to a 0–3 bubble mastery level.
 * 0: Unstudied / new (0 bubbles)
 * 1: Learning (1 bubble)
 * 2: Solid recall (2 bubbles)
 * 3: Mastered (3 bubbles)
 */
export function cardMasteryLevel(
  schedule: ReviewSchedule,
): MemoryMasteryLevel {
  if (schedule.state === 'new' || schedule.reviews === 0) return 0
  const { stability } = estimateFsrsParameters(schedule)
  if (stability <= 0) return 0
  if (stability < 7) return 1
  if (stability < 30) return 2
  return 3
}

export const cardProgressLevel = cardMasteryLevel

/**
 * Maps FSRS difficulty (inherent friction 1.0–10.0) to a 0–3 chili spice level.
 * 0: Unstudied or effortless cognates (0 chilies / no heat, D < 3.0)
 * 1: Mild heat (1 chili, 3.0 <= D < 5.0)
 * 2: Medium heat (2 chilies, 5.0 <= D < 7.5)
 * 3: Hot / ¡aguas! (3 chilies, D >= 7.5)
 */
export function cardDifficultyLevel(
  schedule: ReviewSchedule,
): MemoryDifficultyLevel {
  if (schedule.state === 'new' || schedule.reviews === 0) return 0
  const { difficulty } = estimateFsrsParameters(schedule)
  if (difficulty < 3.0) return 0
  if (difficulty < 5.0) return 1
  if (difficulty < 7.5) return 2
  return 3
}

/**
 * Computes the unified memory indicators and accessible labels for a card.
 */
export function cardMemoryIndicators(
  schedule: ReviewSchedule,
): CardMemoryIndicators {
  const mastery = cardMasteryLevel(schedule)
  const difficulty = cardDifficultyLevel(schedule)

  const masteryLabel = `Mastery: ${mastery} of 3 bubbles`
  const progressLabel = masteryLabel

  let difficultyLabel: string
  if (schedule.state === 'new' || schedule.reviews === 0) {
    difficultyLabel = 'Difficulty: 0 of 3 chilies (no heat)'
  } else if (difficulty === 0) {
    difficultyLabel = 'Difficulty: 0 of 3 chilies (no heat)'
  } else if (difficulty === 1) {
    difficultyLabel = 'Difficulty: 1 of 3 chilies (mild heat)'
  } else if (difficulty === 2) {
    difficultyLabel = 'Difficulty: 2 of 3 chilies (medium heat)'
  } else {
    difficultyLabel = 'Difficulty: 3 of 3 chilies (hot)'
  }

  return {
    mastery,
    progress: mastery,
    difficulty,
    masteryLabel,
    progressLabel,
    difficultyLabel,
  }
}
