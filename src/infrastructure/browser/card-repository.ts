import type { CardRepository } from '../../application/ports'
import {
  studyCardCollectionSchema,
  type Direction,
  type StudyCard,
} from '../../domain/card'

const STORAGE_KEY = 'ritmo-library-v1'
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

const restoreCurrent = (raw: unknown): StudyCard[] | null => {
  const result = studyCardCollectionSchema.safeParse(raw)
  return result.success ? result.data.cards : null
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
  constructor(private readonly storage: StorageLike = window.localStorage) {}

  load(fallback: StudyCard[]): StudyCard[] {
    const parsedCurrent = parseJson(this.storage.getItem(STORAGE_KEY))
    const current = restoreCurrent(parsedCurrent)
    if (current) return current

    const parsedLegacy = parseJson(this.storage.getItem(LEGACY_KEY))
    const legacy = restoreLegacy(parsedLegacy)
    if (legacy) return legacy

    return fallback
  }

  save(cards: StudyCard[]): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, cards }))
  }
}
