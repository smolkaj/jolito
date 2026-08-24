import { z } from 'zod'
import { studyCardSchema, type StudyCard } from './card'

export const deckSyncPayloadSchema = z.object({
  version: z.literal(1),
  app: z.literal('jolito'),
  updatedAt: z.string(),
  deviceId: z.string(),
  cards: z.array(studyCardSchema),
})

export type DeckSyncPayload = z.infer<typeof deckSyncPayloadSchema>

export type SyncStatus =
  'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'unauthenticated'

/**
 * Deterministically reconciles two sets of study cards from different devices.
 * - All unique card IDs from both sets are preserved.
 * - For matching IDs, favors the card with higher study progression (more reviews,
 *   active review state over new, or later due date).
 */
export function reconcileStudyCards(
  localCards: StudyCard[],
  remoteCards: StudyCard[],
): StudyCard[] {
  const remoteMap = new Map<string, StudyCard>(
    remoteCards.map((card) => [card.id, card]),
  )
  const reconciled: StudyCard[] = []

  for (const local of localCards) {
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

  return reconciled
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

const STARTER_CARD_PREFIXES = [
  'starter-aguacate',
  'starter-que-padre',
  'starter-la-cuenta',
  'starter-nos-vemos-al-rato',
]

/**
 * Returns true if the collection consists entirely of untouched placeholder starter cards
 * (all matching starter IDs, 0 reviews, and 'new' state).
 */
export function isDefaultStarterDeck(cards: StudyCard[]): boolean {
  if (cards.length === 0) return false
  return cards.every(
    (c) =>
      STARTER_CARD_PREFIXES.some((p) => c.id.startsWith(p)) &&
      c.schedule.reviews === 0 &&
      c.schedule.state === 'new',
  )
}
