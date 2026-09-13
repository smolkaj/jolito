import type { AuthUser, SyncResult, SyncService } from './ports'
import {
  reconcileStudyCards,
  type ReconciledDeck,
  type SyncStatus,
} from '../domain/sync'

/** One owner, one in-flight snapshot, and an explicit lifetime. */
export class DeckSyncCoordinator {
  private readonly controller = new AbortController()
  private pending = false
  private flight: Promise<SyncResult> | null = null

  constructor(
    private readonly user: AuthUser,
    private readonly sync: SyncService,
    private readonly read: () => ReconciledDeck,
    private readonly save: (deck: ReconciledDeck) => boolean,
    private readonly status: (status: SyncStatus) => void,
  ) {}

  request(): Promise<SyncResult> {
    if (this.controller.signal.aborted) return Promise.resolve(this.cancelled())
    this.pending = true
    if (!this.flight) {
      this.flight = this.drain().finally(() => {
        this.flight = null
      })
    }
    return this.flight
  }

  dispose(): void {
    this.pending = false
    this.controller.abort()
  }

  private cancelled(): SyncResult {
    return {
      success: false,
      error: 'Sync was cancelled because this account is no longer active.',
    }
  }

  private async drain(): Promise<SyncResult> {
    this.status('syncing')
    try {
      let result: SyncResult = { success: false }
      while (this.pending) {
        this.pending = false
        const sent = this.read()
        result = await this.sync.syncDeck(
          sent.cards,
          this.user,
          sent.deletedCardIds,
          this.controller.signal,
        )
        if (this.controller.signal.aborted) return this.cancelled()
        if (!result.success)
          throw new Error(
            result.error || 'Cloud sync failed. Please try again.',
          )
        if (!result.cards || !result.deletedCardIds)
          throw new Error('Cloud sync returned an incomplete snapshot.')
        const latest = this.read()
        // Changes saved during the request need another confirmed write, even if
        // their debounced trigger has not fired yet.
        this.pending ||= JSON.stringify(latest) !== JSON.stringify(sent)
        const merged = reconcileStudyCards(
          latest.cards,
          result.cards,
          latest.deletedCardIds,
          result.deletedCardIds,
        )
        if (!this.save(merged))
          throw new Error(
            'Cloud changes could not be saved on this device. Please try again.',
          )
        result = { ...result, ...merged }
      }
      this.status('synced')
      return result
    } catch (error) {
      if (this.controller.signal.aborted) return this.cancelled()
      this.pending = false
      this.status('error')
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Cloud sync failed. Please try again.',
      }
    }
  }
}
