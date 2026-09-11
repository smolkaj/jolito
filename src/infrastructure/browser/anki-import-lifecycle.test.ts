import { describe, it, expect } from 'vitest'
import type { StudyCard } from '../../domain/card'
import type { Clock } from '../../application/ports'
import { applyAnkiImport } from '../../application/anki-import'
import { parseAnkiDeck } from '../../domain/anki-import'
import type { RestoreMode } from '../../application/deck-backup'
import { reconcileStudyCards } from '../../domain/sync'
import { LocalStorageCardRepository } from './card-repository'

async function importAnkiDeck(
  currentCards: StudyCard[],
  data: string,
  mode: RestoreMode,
  clock: Clock,
  filename: string,
  deletedIds: string[] = [],
) {
  return applyAnkiImport(
    currentCards,
    await parseAnkiDeck(data, filename, clock.now()),
    mode,
    deletedIds,
  )
}

describe('deleted text card reimport', () => {
  it('survives import, delete, reimport, reload, and stale-device sync while retaining unrelated tombstones', async () => {
    const clock = { now: () => 1000 }
    const initial = await importAnkiDeck(
      [],
      'hola\thello',
      'merge',
      clock,
      'first.tsv',
    )
    if (!initial.success) throw new Error(initial.error)
    const deletedIds = [
      initial.cards[0]!.id,
      'anki-txt-1:es-en',
      'unrelated-deleted-card',
    ]
    const restored = await importAnkiDeck(
      [],
      'hola\thello\ngato\tcat',
      'merge',
      clock,
      'restored.tsv',
      deletedIds,
    )
    expect(restored).toMatchObject({
      success: true,
      addedCount: 2,
      skippedCount: 0,
    })
    if (!restored.success) return
    expect(restored.cards.every((card) => !deletedIds.includes(card.id))).toBe(
      true,
    )
    const storage = new Map<string, string>()
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
    }
    const repo = new LocalStorageCardRepository(adapter)
    repo.save(restored.cards, deletedIds)
    const reloaded = new LocalStorageCardRepository(adapter)
    const synced = reconcileStudyCards(
      reloaded.load([]),
      initial.cards,
      reloaded.getDeletedCardIds(),
      deletedIds,
    )
    expect(synced.cards).toEqual(restored.cards)
    expect(synced.deletedCardIds).toEqual(deletedIds)
    const repeated = await importAnkiDeck(
      synced.cards,
      'gato\tcat\nhola\thello',
      'merge',
      clock,
      'reordered.tsv',
      synced.deletedCardIds,
    )
    expect(repeated).toMatchObject({
      success: true,
      addedCount: 0,
      skippedCount: 2,
      cards: restored.cards,
    })
    const deletedAgain = [...deletedIds, restored.cards[0]!.id]
    const restoredAgain = await importAnkiDeck(
      [],
      'hola\thello',
      'merge',
      clock,
      'again.tsv',
      deletedAgain,
    )
    if (!restoredAgain.success) throw new Error(restoredAgain.error)
    expect(deletedAgain).not.toContain(restoredAgain.cards[0]!.id)
    expect(
      reconcileStudyCards(
        restoredAgain.cards,
        [...initial.cards, restored.cards[0]!],
        deletedAgain,
      ).cards,
    ).toEqual(restoredAgain.cards)
  })

  it('keeps the same prompt in opposite directions distinct even at identical row positions', async () => {
    const clock = { now: () => 1000 }
    const first = await importAnkiDeck(
      [],
      'hola\thello',
      'merge',
      clock,
      'spanish.tsv',
    )
    if (!first.success) throw new Error(first.error)
    const second = await importAnkiDeck(
      first.cards,
      'hola\tdónde',
      'merge',
      clock,
      'reverse.tsv',
    )
    expect(second).toMatchObject({
      success: true,
      count: 2,
      addedCount: 1,
      skippedCount: 0,
    })
    if (!second.success) return
    expect(second.cards.map((card) => card.direction)).toEqual([
      'es-en',
      'en-es',
    ])
    expect(new Set(second.cards.map((card) => card.id)).size).toBe(2)
  })
})
