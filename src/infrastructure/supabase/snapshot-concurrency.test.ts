import { afterEach, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { collectionVersion, createStudyCards } from '../../domain/card'
import type { StudyCard } from '../../domain/card'
import { deckSyncPayloadSchema, type DeckSyncPayload } from '../../domain/sync'
import type { SupabaseAuthService } from './auth-service'
import { SupabaseSyncService } from './sync-service'

const user = { id: 'learner', email: 'learner@example.com' }
const card = (id: string) =>
  createStudyCards(
    { spanish: id, english: id, context: '', bidirectional: false },
    id,
    0,
  )[0]!
function cloud(initial: StudyCard[] = []) {
  let data: DeckSyncPayload = {
    version: collectionVersion,
    app: 'jolito',
    updatedAt: '2026-09-10T00:00:00.000Z',
    deviceId: 'cloud',
    cards: initial,
    deletedCardIds: [],
  }
  let revision = initial.length ? 1 : 0
  let reads = 0
  let release!: () => void
  const barrier = new Promise<void>((resolve) => {
    release = resolve
  })
  const requests: string[] = []
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    requests.push(`${init?.method || 'GET'} ${url}`)
    if (init?.method === 'POST') {
      expect(url).toContain('/rpc/compare_and_set_deck')
      const write = z
        .object({
          p_user_id: z.literal(user.id),
          p_expected_revision: z.number(),
          p_data: deckSyncPayloadSchema,
        })
        .parse(JSON.parse(z.string().parse(init.body)))
      if (write.p_expected_revision !== revision) return Response.json(null)
      data = write.p_data
      return Response.json(++revision)
    }
    const snapshot = revision
      ? [{ user_id: user.id, revision, updated_at: data.updatedAt, data }]
      : []
    if (++reads === 2) release()
    await barrier
    return Response.json(snapshot)
  })
  vi.stubGlobal('fetch', fetchFn)
  const auth = {
    getCurrentUser: () => user,
    getAccessToken: () => Promise.resolve('token'),
  } as SupabaseAuthService
  const device = (id: string) =>
    new SupabaseSyncService(auth, 'https://example.supabase.co', 'anon', id)
  return { device, snapshot: () => data, requests }
}
afterEach(() => vi.unstubAllGlobals())

it('converges two initial inserts whose reads finish before either write', async () => {
  const server = cloud()
  const [a, b] = await Promise.all([
    server.device('a').syncDeck([card('a')], user),
    server.device('b').syncDeck([card('b')], user),
  ])
  expect([a.success, b.success]).toEqual([true, true])
  expect(
    server
      .snapshot()
      .cards.map((c) => c.id)
      .sort(),
  ).toEqual(['a:es-en', 'b:es-en'])
  expect(server.requests.filter((r) => r.startsWith('POST'))).toHaveLength(3)
})

it('preserves deletion tombstones and concurrent additions across a stale write retry', async () => {
  const a = card('a')
  const b = card('b')
  const c = card('c')
  const server = cloud([a, b])
  const results = await Promise.all([
    server.device('a').syncDeck([a], user, [b.id]),
    server.device('b').syncDeck([a, b, c], user),
  ])
  expect(results.every((r) => r.success)).toBe(true)
  expect(
    server
      .snapshot()
      .cards.map((c) => c.id)
      .sort(),
  ).toEqual([a.id, c.id])
  expect(server.snapshot().deletedCardIds).toEqual([b.id])
})
