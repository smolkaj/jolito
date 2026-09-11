import { collectionVersion } from '../../domain/card'
import type { CardLoadResult, CardRepository } from '../../application/ports'
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
      createdAt: 0,
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

  // A failed load fences every write, including asynchronous sync callbacks.
  private recovery: Extract<CardLoadResult, { status: 'recovery' }> | null =
    null

  load(fallback: StudyCard[]): CardLoadResult {
    this.recovery = null
    this.deletedCardIds = []
    let raw: string | null = null
    try {
      for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY, LEGACY_KEY]) {
        raw = this.storage.getItem(key)
        if (raw === null) continue
        const parsed = parseJson(raw)
        const current = key === LEGACY_KEY ? null : restoreCurrent(parsed)
        const legacy = key === LEGACY_KEY ? restoreLegacy(parsed) : null
        if (!current && !legacy) {
          const unsupported =
            isRecord(parsed) &&
            typeof parsed.version === 'number' &&
            parsed.version > collectionVersion
          return this.block(
            unsupported ? 'unsupported' : 'corrupt',
            raw,
            unsupported
              ? 'This deck was saved by a newer version of Jolito. Update or reopen Jolito, then try again.'
              : 'Jolito couldn’t read your saved deck. Download a copy to keep it safe before repairing or restoring your data.',
          )
        }
        const cards = current?.cards ?? legacy!
        const deletedCardIds = current?.deletedCardIds ?? []
        const needsMigration =
          key !== STORAGE_KEY ||
          (isRecord(parsed) && parsed.version !== collectionVersion)
        if (needsMigration) {
          try {
            this.save(cards, deletedCardIds)
          } catch {
            return this.block(
              'migration-failed',
              raw,
              'Your deck needs an update, but it couldn’t be saved. Free up device storage, then try again.',
            )
          }
        } else {
          this.deletedCardIds = deletedCardIds
        }
        return { status: needsMigration ? 'migrated' : 'loaded', cards }
      }
      return { status: 'missing', cards: fallback }
    } catch {
      return this.block(
        'unavailable',
        raw,
        'Jolito couldn’t access device storage. Allow storage access in your browser, then try again.',
      )
    }
  }

  private block(
    reason: Extract<CardLoadResult, { status: 'recovery' }>['reason'],
    raw: string | null,
    message: string,
  ): CardLoadResult {
    this.recovery = { status: 'recovery', reason, raw, message, cards: [] }
    return this.recovery
  }

  save(cards: StudyCard[], deletedCardIds = this.deletedCardIds): void {
    if (this.recovery) throw new Error(this.recovery.message)
    // Validate before writing, and publish tombstones only after the write succeeds.
    const collection = studyCardCollectionSchema.parse({
      version: collectionVersion,
      cards,
      deletedCardIds,
    })
    this.storage.setItem(STORAGE_KEY, JSON.stringify(collection))
    this.deletedCardIds = [...deletedCardIds]
  }
}
