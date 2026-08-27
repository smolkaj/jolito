import type { StudyCard } from '../domain/card'
import type { AuthUser, SyncResult, SyncService } from './ports'

export async function syncDeckWithCloud({
  localCards,
  localDeletedIds = [],
  user,
  syncService,
  onCardsUpdated,
}: {
  localCards: StudyCard[]
  localDeletedIds?: string[]
  user: AuthUser | null
  syncService: SyncService
  onCardsUpdated: (cards: StudyCard[], deletedCardIds?: string[]) => void
}): Promise<SyncResult> {
  if (!user) {
    return {
      success: false,
      error: 'Sign in to sync your deck with the cloud.',
    }
  }

  const result = await syncService.syncDeck(localCards, user, localDeletedIds)
  if (result.success && result.cards) {
    onCardsUpdated(result.cards, result.deletedCardIds)
  }
  return result
}
