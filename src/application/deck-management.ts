import {
  cardDifficultyLevel,
  cardMasteryLevel,
  isDue,
  type StudyCard,
} from '../domain/card'
import { getDuplicateGroups } from '../domain/duplicate'
import { getStarterPackForCard } from '../domain/starter-decks'

export type DeckFilterState =
  'all' | 'due' | 'new' | 'learning' | 'review' | 'duplicates'

export type DeckSortOrder =
  | 'created-desc'
  | 'created-asc'
  | 'alpha-asc'
  | 'alpha-desc'
  | 'answer-asc'
  | 'answer-desc'
  | 'direction-asc'
  | 'direction-desc'
  | 'difficulty-desc'
  | 'difficulty-asc'
  | 'mastery-desc'
  | 'mastery-asc'
  | 'status-asc'
  | 'status-desc'

export interface FilterDeckOptions {
  query?: string
  stateFilter?: DeckFilterState
  sortOrder?: DeckSortOrder
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

function normalizeForAlphaSort(text: string): string {
  return text.replace(/^[\p{P}\p{S}\s]+/u, '').trim()
}

function compareAlphabetical(left: string, right: string): number {
  const normLeft = normalizeForAlphaSort(left)
  const normRight = normalizeForAlphaSort(right)
  const cmp = normLeft.localeCompare(normRight, 'es', {
    sensitivity: 'base',
    numeric: true,
  })
  if (cmp !== 0) return cmp
  return left.localeCompare(right, 'es', {
    sensitivity: 'base',
    numeric: true,
  })
}

function cardStatusRank(card: StudyCard, now: number): number {
  if (isDue(card, now)) return 0
  if (
    card.schedule.state === 'learning' ||
    card.schedule.state === 'relearning'
  )
    return 1
  if (card.schedule.state === 'review') return 2
  return 3
}

export function sortDeckCards(
  cards: StudyCard[],
  sortOrder: DeckSortOrder = 'created-desc',
  now: number = Date.now(),
): StudyCard[] {
  const sorted = [...cards]
  return sorted.sort((left, right) => {
    switch (sortOrder) {
      case 'created-desc': {
        const diff = right.createdAt - left.createdAt
        if (diff !== 0) return diff
        if (
          left.noteId === right.noteId &&
          left.direction !== right.direction
        ) {
          return left.direction === 'es-en' ? -1 : 1
        }
        return 0
      }
      case 'created-asc': {
        const diff = left.createdAt - right.createdAt
        if (diff !== 0) return diff
        if (
          left.noteId === right.noteId &&
          left.direction !== right.direction
        ) {
          return left.direction === 'es-en' ? -1 : 1
        }
        return 0
      }
      case 'alpha-asc': {
        const cmp = compareAlphabetical(left.prompt, right.prompt)
        if (cmp !== 0) return cmp
        if (left.direction !== right.direction) {
          return left.direction === 'es-en' ? -1 : 1
        }
        return left.id.localeCompare(right.id)
      }
      case 'alpha-desc': {
        const cmp = compareAlphabetical(right.prompt, left.prompt)
        if (cmp !== 0) return cmp
        if (left.direction !== right.direction) {
          return left.direction === 'es-en' ? -1 : 1
        }
        return left.id.localeCompare(right.id)
      }
      case 'answer-asc': {
        const cmp = compareAlphabetical(left.answer, right.answer)
        if (cmp !== 0) return cmp
        return compareAlphabetical(left.prompt, right.prompt)
      }
      case 'answer-desc': {
        const cmp = compareAlphabetical(right.answer, left.answer)
        if (cmp !== 0) return cmp
        return compareAlphabetical(left.prompt, right.prompt)
      }
      case 'direction-asc': {
        if (left.direction !== right.direction) {
          return left.direction === 'es-en' ? -1 : 1
        }
        return compareAlphabetical(left.prompt, right.prompt)
      }
      case 'direction-desc': {
        if (left.direction !== right.direction) {
          return left.direction === 'es-en' ? 1 : -1
        }
        return compareAlphabetical(left.prompt, right.prompt)
      }
      case 'difficulty-desc': {
        const diff =
          cardDifficultyLevel(right.schedule) -
          cardDifficultyLevel(left.schedule)
        if (diff !== 0) return diff
        const createdDiff = right.createdAt - left.createdAt
        if (createdDiff !== 0) return createdDiff
        return compareAlphabetical(left.prompt, right.prompt)
      }
      case 'difficulty-asc': {
        const diff =
          cardDifficultyLevel(left.schedule) -
          cardDifficultyLevel(right.schedule)
        if (diff !== 0) return diff
        const createdDiff = right.createdAt - left.createdAt
        if (createdDiff !== 0) return createdDiff
        return compareAlphabetical(left.prompt, right.prompt)
      }
      case 'mastery-desc': {
        const diff =
          cardMasteryLevel(right.schedule) - cardMasteryLevel(left.schedule)
        if (diff !== 0) return diff
        const createdDiff = right.createdAt - left.createdAt
        if (createdDiff !== 0) return createdDiff
        return compareAlphabetical(left.prompt, right.prompt)
      }
      case 'mastery-asc': {
        const diff =
          cardMasteryLevel(left.schedule) - cardMasteryLevel(right.schedule)
        if (diff !== 0) return diff
        const createdDiff = right.createdAt - left.createdAt
        if (createdDiff !== 0) return createdDiff
        return compareAlphabetical(left.prompt, right.prompt)
      }
      case 'status-asc': {
        const rankDiff = cardStatusRank(left, now) - cardStatusRank(right, now)
        if (rankDiff !== 0) return rankDiff
        const dueDiff = left.schedule.dueAt - right.schedule.dueAt
        if (dueDiff !== 0) return dueDiff
        return compareAlphabetical(left.prompt, right.prompt)
      }
      case 'status-desc': {
        const rankDiff = cardStatusRank(right, now) - cardStatusRank(left, now)
        if (rankDiff !== 0) return rankDiff
        const dueDiff = right.schedule.dueAt - left.schedule.dueAt
        if (dueDiff !== 0) return dueDiff
        return compareAlphabetical(left.prompt, right.prompt)
      }
    }
  })
}

export function filterDeckCards(
  cards: StudyCard[],
  options: FilterDeckOptions,
): StudyCard[] {
  const {
    query,
    stateFilter = 'all',
    sortOrder = 'created-desc',
    now,
  } = options
  const normalizedQuery = query?.trim().toLowerCase() ?? ''

  const duplicateCardIds =
    stateFilter === 'duplicates'
      ? new Set(
          Array.from(getDuplicateGroups(cards).values()).flatMap((group) =>
            group.map((c) => c.id),
          ),
        )
      : null

  const filtered = cards.filter((card) => {
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
      const pack = getStarterPackForCard(card)
      const matchPack =
        pack !== undefined &&
        (pack.title.toLowerCase().includes(normalizedQuery) ||
          pack.badge.toLowerCase().includes(normalizedQuery) ||
          pack.subtitle.toLowerCase().includes(normalizedQuery))
      if (!matchPrompt && !matchAnswer && !matchContext && !matchPack) {
        return false
      }
    }

    return true
  })

  return sortDeckCards(filtered, sortOrder, now)
}
