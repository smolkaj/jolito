import type { StudyCard } from '../domain/card'
import { mergeStudyCardsSemantic } from '../domain/card-merge'
import { parseAnkiDeck, type AnkiImportStats } from '../domain/anki-import'
import type { RestoreMode } from './deck-backup'
import type { Clock } from './ports'

export type ImportAnkiResult =
  | {
      success: true
      cards: StudyCard[]
      count: number
      addedCount: number
      skippedCount: number
      deckName?: string | undefined
      stats: AnkiImportStats
    }
  | {
      success: false
      error: string
      details?: string[] | undefined
    }

export async function importAnkiDeck(
  currentCards: StudyCard[],
  fileData: ArrayBuffer | Uint8Array | string,
  mode: RestoreMode,
  clock: Clock,
  filename?: string,
  deletedCardIds: readonly string[] = [],
): Promise<ImportAnkiResult> {
  const parsed = await parseAnkiDeck(fileData, filename, clock.now())
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error,
      details: parsed.details,
    }
  }

  const merged = mergeStudyCardsSemantic(
    mode === 'replace' ? [] : currentCards,
    parsed.cards,
  )
  const addedIds = new Set(merged.addedCards.map((card) => card.id))
  const deletedIds = new Set(deletedCardIds)
  const reservedIds = new Set([
    ...deletedIds,
    ...currentCards.map((card) => card.id),
    ...merged.cards.map((card) => card.id),
  ])
  const finalCards = merged.cards.map((card) => {
    if (
      !addedIds.has(card.id) ||
      !card.id.startsWith('anki-txt-v2:') ||
      !deletedIds.has(card.id)
    )
      return card
    // Explicit reimport creates a new incarnation. Retain the old tombstone so
    // an offline device's copy stays deleted when it eventually reconnects.
    let generation = 1
    while (reservedIds.has(`${card.id}:reimport:${generation}`)) generation++
    const id = `${card.id}:reimport:${generation}`
    reservedIds.add(id)
    return { ...card, id, noteId: `${card.noteId}:reimport:${generation}` }
  })

  return {
    success: true,
    cards: finalCards,
    count: finalCards.length,
    addedCount: merged.addedCount,
    skippedCount: merged.skippedCount,
    deckName: parsed.deckName,
    stats: parsed.stats,
  }
}
