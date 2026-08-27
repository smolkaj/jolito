import type { CardRepository } from '../../application/ports'
import {
  studyCardCollectionSchema,
  type Direction,
  type StudyCard,
} from '../../domain/card'

const STORAGE_KEY = 'jolito-library-v1'
const LEGACY_STORAGE_KEY = 'ritmo-library-v1'
const LEGACY_KEY = 'ritmo-cards'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const directions: Direction[] = ['es-en', 'en-es']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseJson = (value: string | null): unknown => {
  if (!value) return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

const restoreCurrent = (
  raw: unknown,
): { cards: StudyCard[]; deletedCardIds: string[] } | null => {
  const result = studyCardCollectionSchema.safeParse(raw)
  if (!result.success) return null
  return {
    cards: result.data.cards,
    deletedCardIds: result.data.deletedCardIds,
  }
}

const restoreLegacy = (raw: unknown): StudyCard[] | null => {
  if (!Array.isArray(raw)) return null
  const cards: StudyCard[] = []
  for (const [index, candidate] of raw.entries()) {
    if (
      !isRecord(candidate) ||
      typeof candidate.prompt !== 'string' ||
      typeof candidate.answer !== 'string' ||
      !directions.includes(candidate.direction as Direction)
    )
      return null
    const direction = candidate.direction as Direction
    const legacyId =
      typeof candidate.id === 'string' || typeof candidate.id === 'number'
        ? String(candidate.id)
        : String(index)
    const noteId = `legacy-${legacyId}`
    cards.push({
      id: `${noteId}:${direction}`,
      noteId,
      prompt: candidate.prompt,
      answer: candidate.answer,
      direction,
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'new',
        dueAt: 0,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
    })
  }
  return cards
}

export class LocalStorageCardRepository implements CardRepository {
  private deletedCardIds: string[] = []

  constructor(private readonly storage: StorageLike = window.localStorage) {}

  getDeletedCardIds(): string[] {
    return [...this.deletedCardIds]
  }

  load(fallback: StudyCard[]): StudyCard[] {
    const parsedCurrent = parseJson(this.storage.getItem(STORAGE_KEY))
    const current = restoreCurrent(parsedCurrent)
    if (current) {
      this.deletedCardIds = current.deletedCardIds
      return current.cards
    }

    const parsedLegacyStorage = parseJson(
      this.storage.getItem(LEGACY_STORAGE_KEY),
    )
    const legacyCurrent = restoreCurrent(parsedLegacyStorage)
    if (legacyCurrent) {
      this.deletedCardIds = legacyCurrent.deletedCardIds
      this.save(legacyCurrent.cards, legacyCurrent.deletedCardIds)
      return legacyCurrent.cards
    }

    const parsedLegacy = parseJson(this.storage.getItem(LEGACY_KEY))
    const legacy = restoreLegacy(parsedLegacy)
    if (legacy) {
      this.deletedCardIds = []
      this.save(legacy, [])
      return legacy
    }

    this.deletedCardIds = []
    return fallback
  }

  save(cards: StudyCard[], deletedCardIds?: string[]): void {
    if (deletedCardIds !== undefined) {
      this.deletedCardIds = [...deletedCardIds]
    }
    this.storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        cards,
        deletedCardIds: this.deletedCardIds,
      }),
    )
  }
}
