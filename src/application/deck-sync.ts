import type { StudyCard } from '../domain/card'
import type { AuthUser, SyncResult, SyncService } from './ports'

export async function syncDeckWithCloud({
  localCards,
  user,
  syncService,
  onCardsUpdated,
}: {
  localCards: StudyCard[]
  user: AuthUser | null
  syncService: SyncService
  onCardsUpdated: (cards: StudyCard[]) => void
}): Promise<SyncResult> {
  if (!user) {
    return {
      success: false,
      error: 'Sign in to sync your deck with the cloud.',
    }
  }

  const result = await syncService.syncDeck(localCards, user)
  if (result.success && result.cards) {
    onCardsUpdated(result.cards)
  }
  return result
}
