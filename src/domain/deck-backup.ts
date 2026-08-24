import { z } from 'zod'
import {
  directions,
  studyCardSchema,
  type Direction,
  type StudyCard,
} from './card'

export const deckBackupEnvelopeSchema = z.object({
  version: z.literal(1),
  app: z.string().optional(),
  exportedAt: z.string().optional(),
  cards: z.array(studyCardSchema),
})

export type DeckBackupEnvelope = z.infer<typeof deckBackupEnvelopeSchema>

export type ParseDeckBackupResult =
  | {
      success: true
      cards: StudyCard[]
      count: number
      exportedAt?: string | undefined
    }
  | {
      success: false
      error: string
      details?: string[] | undefined
    }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

function restoreLegacyCards(raw: unknown): StudyCard[] | null {
  if (!Array.isArray(raw)) return null
  const cards: StudyCard[] = []
  for (const [index, candidate] of raw.entries()) {
    if (
      !isRecord(candidate) ||
      typeof candidate.prompt !== 'string' ||
      typeof candidate.answer !== 'string' ||
      !directions.includes(candidate.direction as Direction)
    ) {
      return null
    }
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
      context: typeof candidate.context === 'string' ? candidate.context : '',
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

export function parseDeckBackup(rawJson: string): ParseDeckBackupResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson) as unknown
  } catch (err) {
    return {
      success: false,
      error: `Invalid JSON format: ${err instanceof Error ? err.message : 'Unable to parse file.'}`,
    }
  }

  // Check 1: Envelope schema (version 1 with cards array)
  const envelopeResult = deckBackupEnvelopeSchema.safeParse(parsed)
  if (envelopeResult.success) {
    return {
      success: true,
      cards: envelopeResult.data.cards,
      count: envelopeResult.data.cards.length,
      exportedAt: envelopeResult.data.exportedAt,
    }
  }

  // Check 2: Raw array of StudyCards
  const rawCardsResult = z.array(studyCardSchema).safeParse(parsed)
  if (rawCardsResult.success) {
    return {
      success: true,
      cards: rawCardsResult.data,
      count: rawCardsResult.data.length,
    }
  }

  // Check 3: Legacy format migration
  const legacyCards = restoreLegacyCards(parsed)
  if (legacyCards && legacyCards.length > 0) {
    return {
      success: true,
      cards: legacyCards,
      count: legacyCards.length,
    }
  }

  // If parsed is an object or array that failed validation, extract specific errors
  const details: string[] = []
  if (isRecord(parsed) && Array.isArray(parsed.cards)) {
    envelopeResult.error.issues.forEach((issue) => {
      details.push(`${issue.path.join('.')}: ${issue.message}`)
    })
  } else if (Array.isArray(parsed)) {
    rawCardsResult.error.issues.forEach((issue) => {
      details.push(`${issue.path.join('.')}: ${issue.message}`)
    })
  }

  return {
    success: false,
    error:
      'Invalid card data in deck backup: content does not match the Jolito card schema.',
    details: details.length > 0 ? details.slice(0, 5) : undefined,
  }
}

export function mergeStudyCards(
  existing: StudyCard[],
  incoming: StudyCard[],
): StudyCard[] {
  const incomingMap = new Map<string, StudyCard>(
    incoming.map((card) => [card.id, card]),
  )
  const merged: StudyCard[] = []

  // Update or keep existing cards
  for (const card of existing) {
    if (incomingMap.has(card.id)) {
      merged.push(incomingMap.get(card.id)!)
      incomingMap.delete(card.id)
    } else {
      merged.push(card)
    }
  }

  // Append new incoming cards
  for (const newCard of incomingMap.values()) {
    merged.push(newCard)
  }

  return merged
}
