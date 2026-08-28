import { isDue, type StudyCard } from '../domain/card'
import { getDuplicateGroups } from '../domain/duplicate'

export type DeckFilterState =
  'all' | 'due' | 'new' | 'learning' | 'review' | 'duplicates'

export interface FilterDeckOptions {
  query?: string
  stateFilter?: DeckFilterState
  now: number
}

export interface DeckStats {
  total: number
  due: number
  newCount: number
  learningCount: number
  reviewCount: number
  duplicatesCount?: number
}

export function getDeckStats(cards: StudyCard[], now: number): DeckStats {
  let due = 0
  let newCount = 0
  let learningCount = 0
  let reviewCount = 0

  for (const card of cards) {
    if (isDue(card, now)) {
      due++
    }
    const state = card.schedule.state
    if (state === 'new') {
      newCount++
    } else if (state === 'learning' || state === 'relearning') {
      learningCount++
    } else if (state === 'review') {
      reviewCount++
    }
  }

  const duplicateGroups = getDuplicateGroups(cards)
  let duplicatesCount = 0
  for (const group of duplicateGroups.values()) {
    duplicatesCount += group.length
  }

  return {
    total: cards.length,
    due,
    newCount,
    learningCount,
    reviewCount,
    duplicatesCount,
  }
}

export function filterDeckCards(
  cards: StudyCard[],
  options: FilterDeckOptions,
): StudyCard[] {
  const { query, stateFilter = 'all', now } = options
  const normalizedQuery = query?.trim().toLowerCase() ?? ''

  const duplicateCardIds =
    stateFilter === 'duplicates'
      ? new Set(
          Array.from(getDuplicateGroups(cards).values()).flatMap((group) =>
            group.map((c) => c.id),
          ),
        )
      : null

  return cards.filter((card) => {
    // 1. State filter check
    if (stateFilter === 'due' && !isDue(card, now)) {
      return false
    }
    if (stateFilter === 'new' && card.schedule.state !== 'new') {
      return false
    }
    if (
      stateFilter === 'learning' &&
      card.schedule.state !== 'learning' &&
      card.schedule.state !== 'relearning'
    ) {
      return false
    }
    if (stateFilter === 'review' && card.schedule.state !== 'review') {
      return false
    }
    if (stateFilter === 'duplicates' && !duplicateCardIds?.has(card.id)) {
      return false
    }

    // 2. Query text match check
    if (normalizedQuery) {
      const matchPrompt = card.prompt.toLowerCase().includes(normalizedQuery)
      const matchAnswer = card.answer.toLowerCase().includes(normalizedQuery)
      const matchContext = card.context.toLowerCase().includes(normalizedQuery)
      if (!matchPrompt && !matchAnswer && !matchContext) {
        return false
      }
    }

    return true
  })
}
