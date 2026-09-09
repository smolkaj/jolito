import type { StudyCard } from './card'
import { normalizeCardKey } from './duplicate'

export interface MergeSemanticResult {
  cards: StudyCard[]
  addedCards: StudyCard[]
  addedCount: number
  skippedCount: number
  enrichedCount: number
}

/**
 * Merges incoming cards into an existing card collection using semantic deduplication.
 * - Cards are matched primarily by direction + normalized prompt (`normalizeCardKey`).
 * - Existing review schedules (SRS intervals, lapses, ease, reviews) are strictly protected.
 * - If an existing card has an empty context and the incoming card has a context, it enriches the context.
 * - Within the incoming batch itself, duplicate keys are also collapsed.
 */
export function mergeStudyCardsSemantic(
  existingCards: StudyCard[],
  incomingCards: StudyCard[],
): MergeSemanticResult {
  const existingByKey = new Map<string, { card: StudyCard; index: number }>()
  const existingById = new Map<string, { card: StudyCard; index: number }>()

  // Result array starts as a shallow copy of existing cards so we preserve their exact order
  const merged: StudyCard[] = existingCards.map((card, index) => {
    const key = card.grammar
      ? card.id
      : normalizeCardKey(card.prompt, card.direction)
    const entry = { card: { ...card }, index }
    if (!existingByKey.has(key)) {
      existingByKey.set(key, entry)
    }
    existingById.set(card.id, entry)
    return entry.card
  })

  let addedCount = 0
  let skippedCount = 0
  let enrichedCount = 0
  const addedCards: StudyCard[] = []
  const seenIncomingKeys = new Set<string>()

  for (const incoming of incomingCards) {
    const key = incoming.grammar
      ? incoming.id
      : normalizeCardKey(incoming.prompt, incoming.direction)

    // Check if duplicate within incoming batch itself
    if (seenIncomingKeys.has(key)) {
      skippedCount++
      continue
    }

    // Check if matched by exact ID or semantic key
    const match = existingById.get(incoming.id) || existingByKey.get(key)

    if (match) {
      skippedCount++
      // If existing card has empty context and incoming has rich context, enrich it
      const existingCard = merged[match.index]
      if (
        existingCard &&
        !existingCard.context.trim() &&
        incoming.context.trim()
      ) {
        existingCard.context = incoming.context.trim()
        enrichedCount++
      }
      seenIncomingKeys.add(key)
    } else {
      // New unique card
      seenIncomingKeys.add(key)
      merged.push(incoming)
      addedCards.push(incoming)
      addedCount++
    }
  }

  return {
    cards: merged,
    addedCards,
    addedCount,
    skippedCount,
    enrichedCount,
  }
}
