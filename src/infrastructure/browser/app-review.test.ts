import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import {
  DefaultAppReviewService,
  type NativeAppReviewPlugin,
} from './app-review'
import type { Clock } from '../../application/ports'
import { INITIAL_APP_REVIEW_STATE } from '../../domain/app-review'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

describe('DefaultAppReviewService', () => {
  let storage: Storage
  let clock: Clock
  let currentTime: number
  let requestReviewSpy: Mock<NativeAppReviewPlugin['requestReview']>
  let mockPlugin: NativeAppReviewPlugin

  beforeEach(() => {
    storage = new MemoryStorage()
    currentTime = 1_700_000_000_000
    clock = { now: () => currentTime }
    requestReviewSpy = vi
      .fn<NativeAppReviewPlugin['requestReview']>()
      .mockResolvedValue({ requested: true })
    mockPlugin = {
      requestReview: requestReviewSpy,
    }
  })

  it('starts with initial state if storage is empty', () => {
    const service = new DefaultAppReviewService(
      storage,
      clock,
      mockPlugin,
      true,
    )
    expect(service.getState()).toEqual(INITIAL_APP_REVIEW_STATE)
  })

  it('records session completion counts without prompting when under threshold', async () => {
    const service = new DefaultAppReviewService(
      storage,
      clock,
      mockPlugin,
      true,
    )

    // Session 1: 10 cards
    const prompted1 = await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 10,
      hasSessionError: false,
    })
    expect(prompted1).toBe(false)
    expect(requestReviewSpy).not.toHaveBeenCalled()
    expect(service.getState()).toEqual({
      completedSessionsCount: 1,
      totalCardsReviewed: 10,
      lastPromptedAt: null,
    })

    // Session 2: 15 cards (total 25 cards)
    const prompted2 = await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 15,
      hasSessionError: false,
    })
    expect(prompted2).toBe(false)
    expect(requestReviewSpy).not.toHaveBeenCalled()
    expect(service.getState().completedSessionsCount).toBe(2)
    expect(service.getState().totalCardsReviewed).toBe(25)
  })

  it('prompts native review once thresholds are satisfied (>=3 sessions & >=30 cards)', async () => {
    const service = new DefaultAppReviewService(
      storage,
      clock,
      mockPlugin,
      true,
    )

    await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 10,
      hasSessionError: false,
    })
    await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 10,
      hasSessionError: false,
    })

    // Session 3 with 10 cards -> total 3 sessions & 30 cards
    const prompted = await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 10,
      hasSessionError: false,
    })

    expect(prompted).toBe(true)
    expect(requestReviewSpy).toHaveBeenCalledTimes(1)
    expect(service.getState()).toEqual({
      completedSessionsCount: 3,
      totalCardsReviewed: 30,
      lastPromptedAt: currentTime,
    })
  })

  it('does NOT prompt on unsupported platforms (e.g. web browser)', async () => {
    const service = new DefaultAppReviewService(
      storage,
      clock,
      mockPlugin,
      false, // isSupportedPlatform = false
    )

    // Run 3 large sessions
    await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 15,
      hasSessionError: false,
    })
    await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 15,
      hasSessionError: false,
    })
    const prompted = await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 15,
      hasSessionError: false,
    })

    expect(prompted).toBe(false)
    expect(requestReviewSpy).not.toHaveBeenCalled()
    // But counts are still tracked
    expect(service.getState().completedSessionsCount).toBe(3)
    expect(service.getState().totalCardsReviewed).toBe(45)
    expect(service.getState().lastPromptedAt).toBeNull()
  })

  it('does NOT prompt when session encountered an error', async () => {
    const service = new DefaultAppReviewService(
      storage,
      clock,
      mockPlugin,
      true,
    )

    await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 15,
      hasSessionError: false,
    })
    await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 15,
      hasSessionError: false,
    })

    // 3rd session has an error
    const prompted = await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 15,
      hasSessionError: true,
    })

    expect(prompted).toBe(false)
    expect(requestReviewSpy).not.toHaveBeenCalled()
    expect(service.getState().lastPromptedAt).toBeNull()
  })

  it('enforces cooldown and does not prompt repeatedly', async () => {
    const service = new DefaultAppReviewService(
      storage,
      clock,
      mockPlugin,
      true,
    )

    // Reach eligibility and prompt
    await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 15,
      hasSessionError: false,
    })
    await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 15,
      hasSessionError: false,
    })
    const prompted1 = await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 15,
      hasSessionError: false,
    })
    expect(prompted1).toBe(true)
    expect(requestReviewSpy).toHaveBeenCalledTimes(1)

    // Session 4 right after
    const prompted2 = await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 10,
      hasSessionError: false,
    })
    expect(prompted2).toBe(false)
    expect(requestReviewSpy).toHaveBeenCalledTimes(1) // Still 1
  })

  it('gracefully handles native plugin failure or exception', async () => {
    const failingPlugin: NativeAppReviewPlugin = {
      requestReview: vi.fn().mockRejectedValue(new Error('Native error')),
    }
    const service = new DefaultAppReviewService(
      storage,
      clock,
      failingPlugin,
      true,
    )

    await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 15,
      hasSessionError: false,
    })
    await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 15,
      hasSessionError: false,
    })
    const prompted = await service.recordSessionAndPromptIfEligible({
      cardsReviewedInSession: 15,
      hasSessionError: false,
    })

    expect(prompted).toBe(false)
    expect(service.getState().lastPromptedAt).toBeNull()
  })

  it('survives storage setItem throwing an error', async () => {
    const brokenStorage: Storage = {
      ...storage,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    const service = new DefaultAppReviewService(
      brokenStorage,
      clock,
      mockPlugin,
      true,
    )
    await expect(
      service.recordSessionAndPromptIfEligible({
        cardsReviewedInSession: 5,
        hasSessionError: false,
      }),
    ).resolves.toBe(false)
  })
})
