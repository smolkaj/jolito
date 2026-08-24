import type { StudyCard } from '../domain/card'
import { mergeStudyCards } from '../domain/deck-backup'
import { parseAnkiDeck, type AnkiImportStats } from '../domain/anki-import'
import type { RestoreMode } from './deck-backup'
import type { Clock } from './ports'

export type ImportAnkiResult =
  | {
      success: true
      cards: StudyCard[]
      count: number
      importedCount: number
      deckName?: string | undefined
      stats: AnkiImportStats
    }
  | {
      success: false
      error: string
      details?: string[] | undefined
    }

export async function importAnkiDeck(
  currentCards: StudyCard[],
  fileData: ArrayBuffer | Uint8Array | string,
  mode: RestoreMode,
  clock: Clock,
  filename?: string,
): Promise<ImportAnkiResult> {
  const parsed = await parseAnkiDeck(fileData, filename, clock.now())
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
    deckName: parsed.deckName,
    stats: parsed.stats,
  }
}
