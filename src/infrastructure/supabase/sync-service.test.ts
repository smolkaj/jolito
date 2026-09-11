import { z } from 'zod'
import { afterEach, expect, it, vi } from 'vitest'
import { collectionVersion, createStudyCards } from '../../domain/card'
import type { SupabaseAuthService } from './auth-service'
import { SupabaseSyncService } from './sync-service'

const user = { id: 'learner', email: 'learner@example.com' }
const cards = createStudyCards(
  { spanish: 'hola', english: 'hello', context: '', bidirectional: false },
  'card',
  0,
)
const payload = {
  version: collectionVersion,
  app: 'jolito',
  deviceId: 'remote',
  updatedAt: '2026-09-10T00:00:00.000Z',
  cards,
  deletedCardIds: [],
}
const row = {
  user_id: user.id,
  revision: 1,
  updated_at: payload.updatedAt,
  data: payload,
}
function service(auth: Partial<SupabaseAuthService> = {}) {
  return new SupabaseSyncService(
    {
      getAccessToken: () => Promise.resolve('token'),
      ...auth,
    } as SupabaseAuthService,
    'https://example.supabase.co',
    'anon',
    'device',
  )
}
afterEach(() => vi.unstubAllGlobals())

it('loads the validated account snapshot and server revision', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([row])))
  expect(await service().pullDeck(user)).toMatchObject({
    success: true,
    cards,
    revision: 1,
    deletedCardIds: [],
  })
})
it('treats no row as revision zero, not an existing empty snapshot', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([])))
  expect(await service().pullDeck(user)).toEqual({
    success: true,
    cards: [],
    deletedCardIds: [],
    revision: 0,
  })
})
it.each([
  [{ ...row, user_id: 'another-account' }],
  [{ ...row, revision: undefined }],
  [{ ...row, revision: 0 }],
  [{ ...row, updated_at: 'invalid date' }],
  [{ ...row, data: { ...payload, version: 99 } }],
  [row, row],
  { error: 'not rows' },
])(
  'rejects malformed or incorrectly owned remote boundaries without writing',
  async (rows) => {
    const fetchSpy = vi.fn().mockResolvedValue(Response.json(rows))
    vi.stubGlobal('fetch', fetchSpy)
    const sync = service()
    expect(await sync.syncDeck(cards, user)).toMatchObject({ success: false })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  },
)
it('commits only against the revision read and returns server confirmation', async () => {
  const fetchSpy = vi
    .fn()
    .mockResolvedValueOnce(Response.json([row]))
    .mockResolvedValueOnce(Response.json(2))
  vi.stubGlobal('fetch', fetchSpy)
  const sync = service()
  expect(await sync.syncDeck(cards, user)).toMatchObject({
    success: true,
    cards,
    revision: 2,
  })
  const request = fetchSpy.mock.calls[1] as unknown as [string, RequestInit]
  expect(request[0]).toBe(
    'https://example.supabase.co/rest/v1/rpc/compare_and_set_deck',
  )
  expect(JSON.parse(z.string().parse(request[1].body))).toMatchObject({
    p_user_id: user.id,
    p_expected_revision: 1,
    p_data: {
      ...payload,
      deviceId: 'device',
      updatedAt: expect.any(String) as string,
    },
  })
})
it('bounds conflicts without falling back to an unguarded write', async () => {
  const fetchSpy = vi.fn((_url: string, init?: RequestInit) =>
    Promise.resolve(Response.json(init?.method === 'POST' ? null : [row])),
  )
  vi.stubGlobal('fetch', fetchSpy)
  const sync = service()
  expect(await sync.syncDeck(cards, user)).toMatchObject({
    success: false,
    error: expect.stringContaining('changed on another device') as string,
  })
  expect(fetchSpy).toHaveBeenCalledTimes(6)
  expect(cards).toEqual(payload.cards)
})
it.each([{}, '2', 0, 1, 3])(
  'requires a valid next revision in write confirmation',
  async (confirmation) => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(Response.json([row]))
      .mockResolvedValueOnce(Response.json(confirmation))
    vi.stubGlobal('fetch', fetchSpy)
    expect((await service().syncDeck(cards, user)).success).toBe(false)
  },
)
it('refreshes and retries an unauthorized read once', async () => {
  const fetchSpy = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(Response.json([row]))
  vi.stubGlobal('fetch', fetchSpy)
  const refreshSession = vi.fn().mockResolvedValue('fresh')
  expect((await service({ refreshSession }).pullDeck(user)).success).toBe(true)
  expect(refreshSession).toHaveBeenCalledTimes(1)
  expect(fetchSpy).toHaveBeenLastCalledWith(
    expect.any(String),
    expect.objectContaining({
      headers: {
        apikey: 'anon',
        Authorization: 'Bearer fresh',
        'Content-Type': 'application/json',
      },
    }),
  )
})
it('refreshes and retries an unauthorized write without discarding its expected revision', async () => {
  const fetchSpy = vi
    .fn()
    .mockResolvedValueOnce(Response.json([row]))
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(Response.json(2))
  vi.stubGlobal('fetch', fetchSpy)
  const refreshSession = vi.fn().mockResolvedValue('fresh')
  expect(
    (await service({ refreshSession }).syncDeck(cards, user)).success,
  ).toBe(true)
  expect(refreshSession).toHaveBeenCalledTimes(1)
  const before = fetchSpy.mock.calls[1] as unknown as [string, RequestInit]
  const after = fetchSpy.mock.calls[2] as unknown as [string, RequestInit]
  expect(before[1].body).toBe(after[1].body)
})
it.each([403, 404, 429, 500])(
  'surfaces HTTP %i without reporting a successful sync',
  async (status) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ message: 'Backend unavailable' }, { status }),
        ),
    )
    expect(await service().syncDeck(cards, user)).toEqual({
      success: false,
      error: 'Backend unavailable',
    })
  },
)
it('preserves a retryable error when credential access or network fails', async () => {
  const authError = service({
    getAccessToken: () => Promise.reject(new Error('Access unavailable')),
  })
  expect(await authError.syncDeck(cards, user)).toEqual({
    success: false,
    error: 'Access unavailable',
  })
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')))
  expect(await service().syncDeck(cards, user)).toEqual({
    success: false,
    error: 'Offline',
  })
})
it('fails explicitly without backend configuration or credentials', async () => {
  const unconfigured = new SupabaseSyncService(
    {} as SupabaseAuthService,
    '',
    '',
    'device',
  )
  expect((await unconfigured.syncDeck(cards, user)).success).toBe(false)
  expect(
    (
      await service({ getAccessToken: () => Promise.resolve(null) }).syncDeck(
        cards,
        user,
      )
    ).success,
  ).toBe(false)
})

it('does not start a request after disposal while credentials are being refreshed', async () => {
  const controller = new AbortController()
  let release!: (token: string) => void
  const token = new Promise<string>((resolve) => {
    release = resolve
  })
  const fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  const done = service({ getAccessToken: () => token }).syncDeck(
    cards,
    user,
    [],
    controller.signal,
  )
  controller.abort()
  release('late-token')
  expect((await done).success).toBe(false)
  expect(fetchSpy).not.toHaveBeenCalled()
})
