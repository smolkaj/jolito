import { chooseScene, type Direction, type StudyCard } from './card'
import { normalizeForSearch } from './lexicon'

/**
 * Generates a normalized prompt key for duplicate detection.
 * Combines direction and normalized text (stripping diacritics, punctuation, slash, case, whitespace).
 */
export function normalizeCardKey(prompt: string, direction: Direction): string {
  const normalized = normalizeForSearch(prompt)
    .replace(/[/\\#*~_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return `${direction}:${normalized}`
}

export interface FindDuplicateCardsOptions {
  prompt: string
  direction: Direction
  excludeCardId?: string | undefined
  excludeNoteId?: string | undefined
}

/**
 * Finds all cards in the collection that match the given prompt and direction.
 */
export function findDuplicateCards(
  cards: StudyCard[],
  options: FindDuplicateCardsOptions,
): StudyCard[] {
  const trimmed = options.prompt.trim()
  if (!trimmed) return []

  const targetKey = normalizeCardKey(trimmed, options.direction)
  const normalizedTarget = normalizeForSearch(trimmed)
  if (!normalizedTarget) return []

  return cards.filter((card) => {
    if (options.excludeCardId && card.id === options.excludeCardId) {
      return false
    }
    if (options.excludeNoteId && card.noteId === options.excludeNoteId) {
      return false
    }
    return normalizeCardKey(card.prompt, card.direction) === targetKey
  })
}

export interface FindDuplicateNoteCardsOptions {
  spanish: string
  english: string
  bidirectional?: boolean | undefined
  excludeNoteId?: string | undefined
}

export interface DuplicateNoteCardsResult {
  spanishDuplicates: StudyCard[]
  englishDuplicates: StudyCard[]
}

/**
 * Checks a candidate note against the card collection for duplicate Spanish and/or English cards.
 */
export function findDuplicateNoteCards(
  cards: StudyCard[],
  options: FindDuplicateNoteCardsOptions,
): DuplicateNoteCardsResult {
  const spanishDuplicates = findDuplicateCards(cards, {
    prompt: options.spanish,
    direction: 'es-en',
    excludeNoteId: options.excludeNoteId,
  })

  let englishDuplicates: StudyCard[] = []
  if (options.bidirectional || options.english.trim()) {
    englishDuplicates = findDuplicateCards(cards, {
      prompt: options.english,
      direction: 'en-es',
      excludeNoteId: options.excludeNoteId,
    })
  }

  return {
    spanishDuplicates,
    englishDuplicates,
  }
}

/**
 * Groups cards in the collection that share the same normalized prompt key.
 * Only returns groups that contain 2 or more cards (actual duplicates).
 */
export function getDuplicateGroups(
  cards: StudyCard[],
): Map<string, StudyCard[]> {
  const allGroups = new Map<string, StudyCard[]>()

  for (const card of cards) {
    const key = normalizeCardKey(card.prompt, card.direction)
    const existing = allGroups.get(key)
    if (existing) {
      existing.push(card)
    } else {
      allGroups.set(key, [card])
    }
  }

  const duplicatesOnly = new Map<string, StudyCard[]>()
  for (const [key, group] of allGroups.entries()) {
    if (group.length > 1) {
      duplicatesOnly.set(key, group)
    }
  }

  return duplicatesOnly
}

export interface MergeCardsResult {
  cards: StudyCard[]
  updatedCount: number
  newCount: number
}

/**
 * Merges incoming cards into existing cards.
 * If an incoming card matches an existing card's ID or its normalized prompt key,
 * it updates the card's content (prompt, answer, context, scene) while preserving
 * the user's earned review schedule (state, interval, ease factor, reviews, lapses, due date).
 */
export function mergeCardsPreservingProgress(
  existing: StudyCard[],
  incoming: StudyCard[],
): MergeCardsResult {
  const merged: StudyCard[] = []
  const consumedIncomingIndexes = new Set<number>()
  let updatedCount = 0

  // First, map existing cards and check if any incoming card matches by ID or prompt key
  for (const existingCard of existing) {
    const existingKey = normalizeCardKey(
      existingCard.prompt,
      existingCard.direction,
    )

    let matchedIncomingIndex = -1
    // Prioritize exact ID match first
    for (let i = 0; i < incoming.length; i++) {
      if (consumedIncomingIndexes.has(i)) continue
      const inc = incoming[i]!
      if (inc.id === existingCard.id) {
        matchedIncomingIndex = i
        break
      }
    }

    // If not matched by ID, try prompt key match
    if (matchedIncomingIndex === -1) {
      for (let i = 0; i < incoming.length; i++) {
        if (consumedIncomingIndexes.has(i)) continue
        const inc = incoming[i]!
        if (
          normalizeCardKey(inc.prompt, inc.direction) === existingKey &&
          inc.direction === existingCard.direction
        ) {
          matchedIncomingIndex = i
          break
        }
      }
    }

    if (matchedIncomingIndex !== -1) {
      consumedIncomingIndexes.add(matchedIncomingIndex)
      const inc = incoming[matchedIncomingIndex]!
      const scene = chooseScene(inc.prompt, inc.answer, inc.context)
      merged.push({
        ...existingCard,
        prompt: inc.prompt,
        answer: inc.answer,
        context: inc.context,
        scene,
        // preserve existingCard.schedule
      })
      updatedCount++
    } else {
      merged.push(existingCard)
    }
  }

  // Next, append all remaining incoming cards that were not matched
  let newCount = 0
  for (let i = 0; i < incoming.length; i++) {
    if (!consumedIncomingIndexes.has(i)) {
      merged.push(incoming[i]!)
      newCount++
    }
  }

  return {
    cards: merged,
    updatedCount,
    newCount,
  }
}
