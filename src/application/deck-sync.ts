import type { StudyCard } from '../domain/card'
import type {
  AuthUser,
  SignupNotificationService,
  SyncResult,
  SyncService,
} from './ports'

export async function syncDeckWithCloud({
  localCards,
  localDeletedIds = [],
  user,
  syncService,
  onCardsUpdated,
  signupNotifier,
  clientContext,
}: {
  localCards: StudyCard[]
  localDeletedIds?: string[]
  user: AuthUser | null
  syncService: SyncService
  onCardsUpdated: (cards: StudyCard[], deletedCardIds?: string[]) => void
  signupNotifier?: SignupNotificationService | undefined
  clientContext?: Record<string, unknown> | undefined
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
  if (result.success && result.isInitialSync && signupNotifier && user.email) {
    void signupNotifier.notifySignup({
      email: user.email,
      userId: user.id,
      context: clientContext,
    })
  }
  return result
}
