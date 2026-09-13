import { z } from 'zod'
import { collectionVersionSchema, migrateCardEnvelope } from './card'
import { studyCardSchema, type StudyCard } from './card'

export const deckSyncPayloadSchema = z.preprocess(
  migrateCardEnvelope,
  z.object({
    version: collectionVersionSchema,
    app: z.literal('jolito'),
    updatedAt: z.string(),
    deviceId: z.string(),
    cards: z.array(studyCardSchema),
    deletedCardIds: z.array(z.string()).default([]),
  }),
)

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
 * - Matching IDs merge content revisions independently of scheduling.
 * - Newer reset epochs beat all older practice; progression wins within an epoch.
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

const compare = (a: number | string, b: number | string): number =>
  a < b ? -1 : a > b ? 1 : 0

function contentKey(card: StudyCard): string {
  return JSON.stringify([
    card.noteId,
    card.prompt,
    card.answer,
    card.direction,
    card.context,
    card.scene,
    card.grammar?.topic ?? null,
    card.grammar?.verb ?? null,
    card.grammar?.person ?? null,
  ])
}

function compareSchedules(
  a: StudyCard['schedule'],
  b: StudyCard['schedule'],
): number {
  const stateWeight = { new: 0, learning: 1, relearning: 2, review: 3 }
  return (
    compare(a.reviews, b.reviews) ||
    compare(a.lapses, b.lapses) ||
    compare(stateWeight[a.state], stateWeight[b.state]) ||
    compare(a.dueAt, b.dueAt) ||
    compare(a.intervalDays, b.intervalDays) ||
    compare(a.easeFactor, b.easeFactor)
  )
}

function reconcileSingleCard(local: StudyCard, remote: StudyCard): StudyCard {
  // Logical revisions preserve causal edits even with equal/backward device clocks.
  // Concurrent edits at the same revision choose a stable content tuple, not a
  // claimed wall-clock order. Content never competes with scheduling progress.
  const contentOrder =
    compare(local.contentRevision, remote.contentRevision) ||
    compare(contentKey(local), contentKey(remote))
  const content = contentOrder >= 0 ? local : remote
  const resetOrder =
    compare(local.resetRevision.generation, remote.resetRevision.generation) ||
    compare(local.resetRevision.at, remote.resetRevision.at)
  const progress =
    (resetOrder || compareSchedules(local.schedule, remote.schedule)) >= 0
      ? local
      : remote
  const schedule = { ...progress.schedule }
  // Review timestamps are a separate maximum only within the same reset epoch.
  // Crossing epochs must not resurrect pre-reset practice or daily counts.
  if (resetOrder === 0) {
    const timestamps = [
      local.schedule.lastReviewedAt,
      remote.schedule.lastReviewedAt,
    ].filter((value): value is number => value !== undefined)
    if (timestamps.length) schedule.lastReviewedAt = Math.max(...timestamps)
  }
  const creationTimes = [local.createdAt, remote.createdAt].filter(
    (value) => value !== 0,
  )
  return {
    ...content,
    createdAt: creationTimes.length ? Math.min(...creationTimes) : 0,
    resetRevision: progress.resetRevision,
    schedule,
  }
}
