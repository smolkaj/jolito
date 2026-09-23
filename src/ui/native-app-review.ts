import { registerPlugin } from '@capacitor/core'
import type {
  AppReviewOptions,
  AppReviewService,
  Clock,
} from '../application/ports'
import {
  APP_REVIEW_STORAGE_KEY,
  canPromptForReview,
  parseAppReviewState,
  recordPromptShown,
  recordSessionCompletion,
  type AppReviewState,
} from '../domain/app-review'

export interface NativeAppReviewPlugin {
  requestReview(): Promise<{ requested: boolean }>
}

const noopPlugin: NativeAppReviewPlugin = {
  requestReview: () => Promise.resolve({ requested: false }),
}

export const NativeAppReview = registerPlugin<NativeAppReviewPlugin>(
  'AppReview',
  {
    web: () => noopPlugin,
  },
)

export class DefaultAppReviewService implements AppReviewService {
  constructor(
    private storage: Storage,
    private clock: Clock,
    private nativePlugin: NativeAppReviewPlugin = NativeAppReview,
    private isSupportedPlatform: boolean = false,
  ) {}

  public getState(): AppReviewState {
    try {
      return parseAppReviewState(this.storage.getItem(APP_REVIEW_STORAGE_KEY))
    } catch {
      return parseAppReviewState(null)
    }
  }

  private saveState(state: AppReviewState): void {
    try {
      this.storage.setItem(APP_REVIEW_STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage errors are non-fatal for telemetry/review prompts
    }
  }

  public async recordSessionAndPromptIfEligible(
    options: AppReviewOptions,
  ): Promise<boolean> {
    const currentState = this.getState()
    const updatedState = recordSessionCompletion(
      currentState,
      options.cardsReviewedInSession,
    )
    this.saveState(updatedState)

    const now = this.clock.now()
    const eligible = canPromptForReview(updatedState, {
      now,
      hasSessionError: options.hasSessionError,
      isSupportedPlatform: this.isSupportedPlatform,
    })

    if (!eligible) {
      return false
    }

    try {
      const res = await this.nativePlugin.requestReview()
      if (res.requested) {
        const promptedState = recordPromptShown(updatedState, now)
        this.saveState(promptedState)
        return true
      }
      return false
    } catch {
      return false
    }
  }
}
