import { z } from 'zod'
import { studyCardSchema, type StudyCard } from './card'

export const deckSyncPayloadSchema = z.object({
  version: z.literal(1),
  app: z.literal('jolito'),
  updatedAt: z.string(),
  deviceId: z.string(),
  cards: z.array(studyCardSchema),
  deletedCardIds: z.array(z.string()).default([]),
})

export type DeckSyncPayload = z.infer<typeof deckSyncPayloadSchema>

export type SyncStatus =
  'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'unauthenticated'

export interface ReconciledDeck {
  cards: StudyCard[]
  deletedCardIds: string[]
}

/**
 * Deterministically reconciles two sets of study cards and deletion tombstones from different devices.
 * - Any card ID present in either local or remote deletedCardIds is excluded.
 * - All remaining unique card IDs from both sets are preserved.
 * - For matching IDs, favors the card with higher study progression (more reviews,
 *   active review state over new, or later due date).
 * - Combined deletedCardIds includes the union of tombstones from both sets.
 */
export function reconcileStudyCards(
  localCards: StudyCard[],
  remoteCards: StudyCard[],
  localDeletedIds: string[] = [],
  remoteDeletedIds: string[] = [],
): ReconciledDeck {
  const allDeletedIds = new Set<string>([
    ...localDeletedIds,
    ...remoteDeletedIds,
  ])

  const activeLocal = localCards.filter((card) => !allDeletedIds.has(card.id))
  const activeRemote = remoteCards.filter((card) => !allDeletedIds.has(card.id))

  const remoteMap = new Map<string, StudyCard>(
    activeRemote.map((card) => [card.id, card]),
  )
  const reconciled: StudyCard[] = []

  for (const local of activeLocal) {
    const remote = remoteMap.get(local.id)
    if (!remote) {
      reconciled.push(local)
    } else {
      reconciled.push(reconcileSingleCard(local, remote))
      remoteMap.delete(local.id)
    }
  }

  // Add remaining cards that only existed on remote
  for (const remainingRemote of remoteMap.values()) {
    reconciled.push(remainingRemote)
  }

  return {
    cards: reconciled,
    deletedCardIds: Array.from(allDeletedIds),
  }
}

function reconcileSingleCard(local: StudyCard, remote: StudyCard): StudyCard {
  const localSched = local.schedule
  const remoteSched = remote.schedule

  // 1. Higher review count wins (learner practiced more on that device)
  if (localSched.reviews > remoteSched.reviews) {
    return local
  }
  if (remoteSched.reviews > localSched.reviews) {
    return remote
  }

  // 2. Lapses count
  if (localSched.lapses > remoteSched.lapses) {
    return local
  }
  if (remoteSched.lapses > localSched.lapses) {
    return remote
  }

  // 3. State progression: review/relearning/learning over new
  const stateWeight: Record<StudyCard['schedule']['state'], number> = {
    new: 0,
    learning: 1,
    relearning: 2,
    review: 3,
  }
  if (stateWeight[localSched.state] > stateWeight[remoteSched.state]) {
    return local
  }
  if (stateWeight[remoteSched.state] > stateWeight[localSched.state]) {
    return remote
  }

  // 4. Later dueAt or interval
  if (localSched.dueAt > remoteSched.dueAt) {
    return local
  }
  if (remoteSched.dueAt > localSched.dueAt) {
    return remote
  }

  // 5. Default to remote if all scheduling metrics are tied
  return remote
}
