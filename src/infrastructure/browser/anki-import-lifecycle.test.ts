import { describe, it, expect } from 'vitest'
import { zipSync } from 'fflate'
import { getSqlJs } from '../../domain/anki-sql'
import {
  updateStudyCard,
  scheduleReview,
  type StudyCard,
} from '../../domain/card'
import type { Clock } from '../../application/ports'
import { applyAnkiImport } from '../../application/anki-import'
import { parseAnkiDeck } from '../../domain/anki-import'
import type { RestoreMode } from '../../application/deck-backup'
import { reconcileStudyCards } from '../../domain/sync'
import { LocalStorageCardRepository } from './card-repository'

async function importAnkiDeck(
  currentCards: StudyCard[],
  data: string | Uint8Array,
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

it('preserves an edited text card and adds its original prompt on reimport without reusing occupied identities', async () => {
  const clock = { now: () => 1000 }
  const initial = await importAnkiDeck(
    [],
    'hola\thello',
    'merge',
    clock,
    'original.tsv',
  )
  if (!initial.success) throw new Error(initial.error)
  const edited = scheduleReview(
    updateStudyCard(initial.cards[0]!, { prompt: 'gato', answer: 'cat' }, 2000),
    'easy',
    3000,
  )
  const tombstones = [`${edited.id}:reimport:1`, 'unrelated-deleted-id']
  const reimported = await importAnkiDeck(
    [edited],
    'hola\thello',
    'merge',
    clock,
    'again.tsv',
    tombstones,
  )
  expect(reimported).toMatchObject({
    success: true,
    addedCount: 1,
    skippedCount: 0,
    count: 2,
  })
  if (!reimported.success) return
  expect(reimported.cards[0]).toEqual(edited)
  expect(reimported.cards[1]!.id).not.toBe(edited.id)
  expect(tombstones).not.toContain(reimported.cards[1]!.id)
  expect(reimported.cards[1]!.prompt).toBe('hola')
  const synced = reconcileStudyCards(
    reimported.cards,
    initial.cards,
    tombstones,
  )
  expect(synced.cards).toEqual(reimported.cards)
  expect(synced.deletedCardIds).toEqual(tombstones)
  const repeated = await importAnkiDeck(
    synced.cards,
    'hola\thello',
    'merge',
    clock,
    'renamed.tsv',
    tombstones,
  )
  expect(repeated).toMatchObject({
    success: true,
    cards: synced.cards,
    addedCount: 0,
    skippedCount: 1,
  })
})

it('preserves distinct Anki package identities with similar prompts during replacement import', async () => {
  const SQL = await getSqlJs()
  const db = new SQL.Database()
  db.run(`
    CREATE TABLE col (id INTEGER PRIMARY KEY, crt INTEGER, decks TEXT);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, flds TEXT, tags TEXT);
    CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, ord INTEGER, type INTEGER, queue INTEGER, due INTEGER, ivl INTEGER, factor INTEGER, reps INTEGER, lapses INTEGER, did INTEGER);
    INSERT INTO col VALUES (1, 1600000000, '{"1":{"name":"Two meanings"}}');
    INSERT INTO notes VALUES (1, 1, 'banco\x1fbank', '');
    INSERT INTO notes VALUES (2, 1, 'Banco\x1fbench', '');
    INSERT INTO cards VALUES (101, 1, 0, 0, 0, 0, 0, 2500, 0, 0, 1);
    INSERT INTO cards VALUES (102, 2, 0, 2, 2, 10, 5, 2600, 8, 1, 1);
  `)
  const archive = zipSync({ 'collection.anki2': db.export() })
  db.close()
  const parsed = await parseAnkiDeck(archive, 'two-meanings.apkg', 1000)
  if (!parsed.success) throw new Error(parsed.error)
  expect(parsed.source).toBe('package')
  expect(parsed.cards).toHaveLength(2)
  const restored = applyAnkiImport([], parsed, 'replace')
  expect(restored).toMatchObject({
    success: true,
    cards: parsed.cards,
    addedCount: 2,
    skippedCount: 0,
  })
  expect(parsed.cards.map((card) => card.schedule.reviews)).toEqual([0, 8])
})
