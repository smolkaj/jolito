import { z } from 'zod'

export const appReviewStateSchema = z.object({
  completedSessionsCount: z.number().int().nonnegative(),
  totalCardsReviewed: z.number().int().nonnegative(),
  lastPromptedAt: z.number().nullable(),
})

export type AppReviewState = z.infer<typeof appReviewStateSchema>

export const INITIAL_APP_REVIEW_STATE: AppReviewState = {
  completedSessionsCount: 0,
  totalCardsReviewed: 0,
  lastPromptedAt: null,
}

export const APP_REVIEW_STORAGE_KEY = 'jolito-app-review-v1'
export const MIN_SESSIONS_FOR_REVIEW = 3
export const MIN_CARDS_FOR_REVIEW = 30
export const REVIEW_PROMPT_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

export interface ReviewEligibilityOptions {
  now: number
  hasSessionError: boolean
  isSupportedPlatform: boolean
}

/**
 * Pure policy determining whether an in-app review prompt is permitted.
 * Strictly guards against:
 * 1. Unsupported platforms (e.g. standard web browsers)
 * 2. Sessions where an uncaught error or storage failure occurred
 * 3. Users who have not yet reached the engagement milestone (3 sessions & 30 cards)
 * 4. Frequency spam (must respect the 90-day cooldown)
 */
export function canPromptForReview(
  state: AppReviewState,
  options: ReviewEligibilityOptions,
): boolean {
  if (!options.isSupportedPlatform) return false
  if (options.hasSessionError) return false
  if (state.completedSessionsCount < MIN_SESSIONS_FOR_REVIEW) return false
  if (state.totalCardsReviewed < MIN_CARDS_FOR_REVIEW) return false
  if (
    state.lastPromptedAt !== null &&
    options.now - state.lastPromptedAt < REVIEW_PROMPT_COOLDOWN_MS
  ) {
    return false
  }
  return true
}

/**
 * Updates review state following a completed practice session.
 */
export function recordSessionCompletion(
  state: AppReviewState,
  cardsReviewedInSession: number,
): AppReviewState {
  return {
    ...state,
    completedSessionsCount: state.completedSessionsCount + 1,
    totalCardsReviewed:
      state.totalCardsReviewed + Math.max(0, cardsReviewedInSession),
  }
}

/**
 * Records that a native review dialog was presented to the user.
 */
export function recordPromptShown(
  state: AppReviewState,
  now: number,
): AppReviewState {
  return {
    ...state,
    lastPromptedAt: now,
  }
}

/**
 * Safely parses serialized state with Zod, falling back to clean initial state on corruption.
 */
export function parseAppReviewState(raw: string | null): AppReviewState {
  if (!raw) return INITIAL_APP_REVIEW_STATE
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = appReviewStateSchema.safeParse(parsed)
    return result.success ? result.data : INITIAL_APP_REVIEW_STATE
  } catch {
    return INITIAL_APP_REVIEW_STATE
  }
}
