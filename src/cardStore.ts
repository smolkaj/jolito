import type { Direction, Scene, StudyCard } from './domain/card'

const STORAGE_KEY = 'ritmo-library-v1'
const LEGACY_KEY = 'ritmo-cards'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const directions: Direction[] = ['es-en', 'en-es']
const scenes: Scene[] = ['conversation', 'metro', 'takeaway']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isStudyCard = (value: unknown): value is StudyCard => {
  if (!isRecord(value) || !isRecord(value.schedule)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.noteId === 'string' &&
    typeof value.prompt === 'string' &&
    typeof value.answer === 'string' &&
    typeof value.context === 'string' &&
    directions.includes(value.direction as Direction) &&
    scenes.includes(value.scene as Scene) &&
    typeof value.schedule.dueAt === 'number' &&
    typeof value.schedule.intervalDays === 'number' &&
    typeof value.schedule.reviews === 'number' &&
    typeof value.schedule.lapses === 'number'
  )
}

const parse = (value: string | null): unknown => {
  if (!value) return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

const restoreCurrent = (value: unknown): StudyCard[] | null => {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.cards))
    return null
  return value.cards.every(isStudyCard) ? value.cards : null
}

const restoreLegacy = (value: unknown): StudyCard[] | null => {
  if (!Array.isArray(value)) return null
  const cards: StudyCard[] = []
  for (const [index, candidate] of value.entries()) {
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
      schedule: { dueAt: 0, intervalDays: 0, reviews: 0, lapses: 0 },
    })
  }
  return cards
}

export function loadCards(
  storage: StorageLike,
  fallback: StudyCard[],
): StudyCard[] {
  return (
    restoreCurrent(parse(storage.getItem(STORAGE_KEY))) ??
    restoreLegacy(parse(storage.getItem(LEGACY_KEY))) ??
    fallback
  )
}

export function saveCards(storage: StorageLike, cards: StudyCard[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, cards }))
}
