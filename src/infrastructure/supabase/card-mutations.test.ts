import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeckBackup } from '../../application/deck-backup'
import {
  createStudyCards,
  resetCardProgress,
  scheduleReview,
  updateStudyCard,
} from '../../domain/card'
import { parseDeckBackup } from '../../domain/deck-backup'
import { deckSyncPayloadSchema } from '../../domain/sync'
import { LocalStorageCardRepository } from '../browser/card-repository'
import type { SupabaseAuthService } from './auth-service'
import { SupabaseSyncService } from './sync-service'

const user = { id: 'learner', email: 'learner@example.com' }
const initial = createStudyCards(
  { spanish: 'hola', english: 'hello', context: '', bidirectional: false },
  'note',
  1000,
)[0]!

function connectCloud(cards: unknown[], version: number) {
  let row = {
    updated_at: '2026-09-10T00:00:00.000Z',
    data: {
      version,
      app: 'jolito',
      deviceId: 'cloud',
      updatedAt: '2026-09-10T00:00:00.000Z',
      cards,
    },
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        if (typeof init.body !== 'string')
          throw new Error('Expected serialized snapshot')
        row = JSON.parse(init.body) as typeof row
        return Promise.resolve(new Response(null, { status: 201 }))
      }
      return Promise.resolve(Response.json([row]))
    }),
  )
  const auth = {
    getAccessToken: () => Promise.resolve('token'),
  } as SupabaseAuthService
  return new SupabaseSyncService(
    auth,
    'https://example.supabase.co',
    'anon',
    'local',
  )
}

function legacyCard() {
  return JSON.parse(
    JSON.stringify(initial, (key, value: unknown) =>
      key === 'contentRevision' || key === 'resetRevision' ? undefined : value,
    ),
  ) as unknown
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('card mutation persistence contracts', () => {
  it.each([1, 2, 3])(
    'migrates v%i through storage, cloud, and backup without losing IDs or progress',
    async (version) => {
      const legacy = legacyCard()
      localStorage.setItem(
        'jolito-library-v1',
        JSON.stringify({ version, cards: [legacy] }),
      )
      const repo = new LocalStorageCardRepository(localStorage)
      expect(repo.load([])).toEqual([initial])
      expect(
        parseDeckBackup(JSON.stringify({ version, cards: [legacy] })),
      ).toMatchObject({ success: true, cards: [initial] })
      const service = connectCloud([legacy], version)
      expect((await service.pullDeck(user)).cards).toEqual([initial])
      const edited = updateStudyCard(repo.load([])[0]!, { answer: 'hi' }, 1000)
      const synced = await service.syncDeck([edited], user)
      expect(synced).toMatchObject({ success: true, cards: [edited] })
      repo.save(synced.cards!)
      const reloaded = new LocalStorageCardRepository(localStorage).load([])
      const backup = createDeckBackup(reloaded, { now: () => 1000 })
      expect(JSON.parse(backup.json)).toMatchObject({ version: 4 })
      expect(parseDeckBackup(backup.json)).toMatchObject({
        success: true,
        cards: [edited],
      })
      expect((await service.syncDeck(reloaded, user)).cards).toEqual([edited])
    },
  )

  it('round-trips an edit and reset through sync, reload, backup, further practice, and sync again', async () => {
    const reviewed = scheduleReview(initial, 'easy', 5000)
    const service = connectCloud([reviewed], 4)
    const edited = updateStudyCard(
      reviewed,
      { answer: 'hi', resetProgress: true },
      1000,
    )
    const synced = await service.syncDeck([edited], user)
    expect(synced).toMatchObject({ success: true, cards: [edited] })
    new LocalStorageCardRepository(localStorage).save(synced.cards!)
    const reloaded = new LocalStorageCardRepository(localStorage).load([])
    const backup = createDeckBackup(reloaded, { now: () => 1000 })
    const restored = parseDeckBackup(backup.json)
    expect(restored).toMatchObject({ success: true, cards: [edited] })
    const practiced = scheduleReview(reloaded[0]!, 'good', 1000)
    expect((await service.syncDeck([practiced], user)).cards).toEqual([
      practiced,
    ])
    expect((await service.syncDeck([reviewed], user)).cards).toEqual([
      practiced,
    ])
    const resetAgain = resetCardProgress(practiced, 500)
    expect((await service.syncDeck([resetAgain], user)).cards).toEqual([
      resetAgain,
    ])
  })

  it('rejects missing current metadata and invalid or future versions without downgrading present intent', () => {
    for (const version of [4, 5]) {
      expect(
        deckSyncPayloadSchema.safeParse({
          version,
          app: 'jolito',
          updatedAt: '',
          deviceId: '',
          cards: [legacyCard()],
        }).success,
      ).toBe(false)
      expect(
        parseDeckBackup(JSON.stringify({ version, cards: [legacyCard()] }))
          .success,
      ).toBe(false)
    }
    const edited = updateStudyCard(
      initial,
      { answer: 'hi', resetProgress: true },
      1000,
    )
    for (const version of [1, 2, 3, 4]) {
      expect(
        parseDeckBackup(JSON.stringify({ version, cards: [edited] })),
      ).toMatchObject({ success: true, cards: [edited] })
      expect(
        parseDeckBackup(
          JSON.stringify({
            version,
            cards: [{ ...edited, contentRevision: -1 }],
          }),
        ).success,
      ).toBe(false)
    }
  })
})
