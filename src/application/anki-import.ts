import type { StudyCard } from '../domain/card'
import { mergeStudyCardsSemantic } from '../domain/card-merge'
import type { AnkiImportStats, ParseAnkiResult } from '../domain/anki-import'
import type { RestoreMode } from './deck-backup'
import { normalizeCardKey } from '../domain/duplicate'

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

export function applyAnkiImport(
  currentCards: StudyCard[],
  parsed: ParseAnkiResult,
  mode: RestoreMode,
  deletedCardIds: readonly string[] = [],
): ImportAnkiResult {
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error,
      details: parsed.details,
    }
  }

  const incoming =
    parsed.source === 'text'
      ? assignTextImportIdentities(parsed.cards, currentCards, deletedCardIds)
      : parsed.cards
  // Backup and package cards already have source identities. Restore them exactly,
  // including distinct cards sharing a normalized prompt and direction.
  const merged =
    mode === 'replace' && parsed.source !== 'text'
      ? { cards: incoming, addedCount: incoming.length, skippedCount: 0 }
      : mergeStudyCardsSemantic(
          mode === 'replace' ? [] : currentCards,
          incoming,
        )

  return {
    success: true,
    cards: merged.cards,
    count: merged.cards.length,
    addedCount: merged.addedCount,
    skippedCount: merged.skippedCount,
    deckName: parsed.deckName,
    stats: parsed.stats,
  }
}

function assignTextImportIdentities(
  incoming: StudyCard[],
  currentCards: StudyCard[],
  deletedCardIds: readonly string[],
): StudyCard[] {
  const currentById = new Map(currentCards.map((card) => [card.id, card]))
  const deletedIds = new Set(deletedCardIds)
  const reservedIds = new Set([
    ...deletedIds,
    ...currentById.keys(),
    ...incoming.map((card) => card.id),
  ])
  return incoming.map((card) => {
    const existing = currentById.get(card.id)
    const occupiedByDifferentContent =
      existing &&
      normalizeCardKey(existing.prompt, existing.direction) !==
        normalizeCardKey(card.prompt, card.direction)
    if (!deletedIds.has(card.id) && !occupiedByDifferentContent) return card
    // An explicit reimport cannot reuse a tombstoned ID or an ID retained by an
    // edited card. Allocate before ID-first matching; keep all prior tombstones.
    let generation = 1
    while (reservedIds.has(`${card.id}:reimport:${generation}`)) generation++
    const id = `${card.id}:reimport:${generation}`
    reservedIds.add(id)
    return { ...card, id, noteId: `${card.noteId}:reimport:${generation}` }
  })
}
