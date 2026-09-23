import { describe, it, expect } from 'vitest'
import {
  canPromptForReview,
  recordSessionCompletion,
  recordPromptShown,
  parseAppReviewState,
  INITIAL_APP_REVIEW_STATE,
  type AppReviewState,
} from './app-review'

describe('domain/app-review', () => {
  const BASE_TIME = 1_700_000_000_000
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

  it('provides safe initial defaults', () => {
    expect(INITIAL_APP_REVIEW_STATE).toEqual({
      completedSessionsCount: 0,
      totalCardsReviewed: 0,
      lastPromptedAt: null,
    })
  })

  it('records session completion and increments total counts monotonically', () => {
    let state = INITIAL_APP_REVIEW_STATE
    state = recordSessionCompletion(state, 10)
    expect(state.completedSessionsCount).toBe(1)
    expect(state.totalCardsReviewed).toBe(10)

    state = recordSessionCompletion(state, 15)
    expect(state.completedSessionsCount).toBe(2)
    expect(state.totalCardsReviewed).toBe(25)

    // Negative counts clamp to 0
    state = recordSessionCompletion(state, -5)
    expect(state.completedSessionsCount).toBe(3)
    expect(state.totalCardsReviewed).toBe(25)
  })

  it('records prompt shown timestamp', () => {
    const state = recordPromptShown(INITIAL_APP_REVIEW_STATE, BASE_TIME)
    expect(state.lastPromptedAt).toBe(BASE_TIME)
  })

  describe('canPromptForReview policy', () => {
    const readyState: AppReviewState = {
      completedSessionsCount: 3,
      totalCardsReviewed: 30,
      lastPromptedAt: null,
    }

    it('rejects unsupported platforms (e.g. web)', () => {
      expect(
        canPromptForReview(readyState, {
          now: BASE_TIME,
          hasSessionError: false,
          isSupportedPlatform: false,
        }),
      ).toBe(false)
    })

    it('rejects when session encountered an error or storage fault', () => {
      expect(
        canPromptForReview(readyState, {
          now: BASE_TIME,
          hasSessionError: true,
          isSupportedPlatform: true,
        }),
      ).toBe(false)
    })

    it('rejects when completed sessions < 3', () => {
      const underSessionsState: AppReviewState = {
        ...readyState,
        completedSessionsCount: 2,
      }
      expect(
        canPromptForReview(underSessionsState, {
          now: BASE_TIME,
          hasSessionError: false,
          isSupportedPlatform: true,
        }),
      ).toBe(false)
    })

    it('rejects when total cards reviewed < 30', () => {
      const underCardsState: AppReviewState = {
        ...readyState,
        totalCardsReviewed: 29,
      }
      expect(
        canPromptForReview(underCardsState, {
          now: BASE_TIME,
          hasSessionError: false,
          isSupportedPlatform: true,
        }),
      ).toBe(false)
    })

    it('permits review when all criteria are satisfied', () => {
      expect(
        canPromptForReview(readyState, {
          now: BASE_TIME,
          hasSessionError: false,
          isSupportedPlatform: true,
        }),
      ).toBe(true)
    })

    it('enforces 90-day cooldown between prompts', () => {
      const promptedState: AppReviewState = {
        ...readyState,
        lastPromptedAt: BASE_TIME,
      }

      // 89 days later: blocked
      expect(
        canPromptForReview(promptedState, {
          now: BASE_TIME + NINETY_DAYS_MS - 1000,
          hasSessionError: false,
          isSupportedPlatform: true,
        }),
      ).toBe(false)

      // 90 days later: allowed
      expect(
        canPromptForReview(promptedState, {
          now: BASE_TIME + NINETY_DAYS_MS,
          hasSessionError: false,
          isSupportedPlatform: true,
        }),
      ).toBe(true)
    })
  })

  describe('parseAppReviewState', () => {
    it('returns initial state for null or empty input', () => {
      expect(parseAppReviewState(null)).toEqual(INITIAL_APP_REVIEW_STATE)
      expect(parseAppReviewState('')).toEqual(INITIAL_APP_REVIEW_STATE)
    })

    it('parses valid serialized JSON', () => {
      const raw = JSON.stringify({
        completedSessionsCount: 5,
        totalCardsReviewed: 50,
        lastPromptedAt: 123456789,
      })
      expect(parseAppReviewState(raw)).toEqual({
        completedSessionsCount: 5,
        totalCardsReviewed: 50,
        lastPromptedAt: 123456789,
      })
    })

    it('falls back to initial state on invalid schema or corrupted JSON', () => {
      expect(parseAppReviewState('{ not json')).toEqual(
        INITIAL_APP_REVIEW_STATE,
      )
      expect(
        parseAppReviewState(
          JSON.stringify({
            completedSessionsCount: -1,
            totalCardsReviewed: 50,
          }),
        ),
      ).toEqual(INITIAL_APP_REVIEW_STATE)
      expect(
        parseAppReviewState(
          JSON.stringify({
            completedSessionsCount: 'five',
            totalCardsReviewed: 50,
          }),
        ),
      ).toEqual(INITIAL_APP_REVIEW_STATE)
    })
  })
})
