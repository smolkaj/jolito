import type { StudyCard } from '../domain/card'
import {
  mergeStudyCards,
  parseDeckBackup,
  type DeckBackupEnvelope,
} from '../domain/deck-backup'
import type { Clock } from './ports'

export type RestoreMode = 'replace' | 'merge'

export type RestoreDeckResult =
  | {
      success: true
      cards: StudyCard[]
      count: number
      importedCount: number
    }
  | {
      success: false
      error: string
      details?: string[] | undefined
    }

export function createDeckBackup(
  cards: StudyCard[],
  clock: Clock,
): { json: string; filename: string } {
  const now = clock.now()
  const isoDate = new Date(now).toISOString()
  const dateString = isoDate.slice(0, 10)

  const payload: DeckBackupEnvelope = {
    version: 1,
    app: 'jolito',
    exportedAt: isoDate,
    cards,
  }

  const json = JSON.stringify(payload, null, 2)
  const filename = `jolito-deck-${dateString}.json`

  return { json, filename }
}

export function restoreDeckFromBackup(
  currentCards: StudyCard[],
  rawJson: string,
  mode: RestoreMode,
): RestoreDeckResult {
  const parsed = parseDeckBackup(rawJson)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error,
      details: parsed.details,
    }
  }

  const importedCards = parsed.cards
  const finalCards =
    mode === 'replace'
      ? importedCards
      : mergeStudyCards(currentCards, importedCards)

  return {
    success: true,
    cards: finalCards,
    count: finalCards.length,
    importedCount: importedCards.length,
  }
}
