import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudyCard } from '../../domain/card'
import type { SupabaseAuthService } from './auth-service'
import { SupabaseSyncService } from './sync-service'

const mockCard: StudyCard = {
  id: 'c1:es-en',
  noteId: 'n1',
  prompt: 'hola',
  answer: 'hello',
  direction: 'es-en',
  context: '',
  scene: 'conversation',
  schedule: {
    state: 'new',
    dueAt: 1000,
    intervalDays: 0,
    easeFactor: 2.5,
    reviews: 0,
    lapses: 0,
  },
  contentRevision: 0,
  resetRevision: { generation: 0, at: 0 },
  createdAt: 1000,
}

describe('SupabaseSyncService', () => {
  const mockAuthService: Partial<SupabaseAuthService> = {
    getCurrentUser: () => ({ id: 'usr-1', email: 'u@example.com' }),
    isCurrentOwner: (ownerId: string | null) => ownerId === 'usr-1',
    getAccessToken: () => Promise.resolve('valid-jwt-token'),
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pulls remote deck successfully when records exist', async () => {
    const service = new SupabaseSyncService(
      mockAuthService as SupabaseAuthService,
      'https://example.supabase.co',
      'anon-key',
      'device-a',
    )

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              user_id: 'usr-1',
              updated_at: '2026-08-23T12:00:00.000Z',
              data: {
                version: 1,
                app: 'jolito',
                updatedAt: '2026-08-23T12:00:00.000Z',
                deviceId: 'dev-remote',
                cards: [mockCard],
              },
            },
          ]),
      }),
    )

    const res = await service.pullDeck({ id: 'usr-1', email: 'u@example.com' })
    expect(res.success).toBe(true)
    expect(res.cards).toHaveLength(1)
    expect(res.cards?.[0]?.prompt).toBe('hola')
  })

  it('pushes deck successfully and saves record to cloud', async () => {
    const service = new SupabaseSyncService(
      mockAuthService as SupabaseAuthService,
      'https://example.supabase.co',
      'anon-key',
      'device-a',
    )

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await service.pushDeck([mockCard], {
      id: 'usr-1',
      email: 'u@example.com',
    })
    expect(res.success).toBe(true)
    expect(fetchMock).toHaveBeenCalled()
  })

  it('synchronizes local and remote cards and updates sync status', async () => {
    const service = new SupabaseSyncService(
      mockAuthService as SupabaseAuthService,
      'https://example.supabase.co',
      'anon-key',
      'device-a',
    )

    const remoteCard: StudyCard = {
      ...mockCard,
      id: 'c2:es-en',
      prompt: 'adiós',
      answer: 'goodbye',
    }

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        // First call: pull
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                user_id: 'usr-1',
                updated_at: '2026-08-23T12:00:00.000Z',
                data: {
                  version: 1,
                  app: 'jolito',
                  updatedAt: '2026-08-23T12:00:00.000Z',
                  deviceId: 'dev-remote',
                  cards: [remoteCard],
                },
              },
            ]),
        })
        // Second call: push merged
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        }),
    )

    const res = await service.syncDeck([mockCard], {
      id: 'usr-1',
      email: 'u@example.com',
    })
    expect(res.success).toBe(true)
    expect(res.cards).toHaveLength(2)
    expect(service.getStatus()).toBe('synced')
  })

  it('excludes locally deleted cards when syncing with remote deck', async () => {
    const service = new SupabaseSyncService(
      mockAuthService as SupabaseAuthService,
      'https://example.supabase.co',
      'anon-key',
      'device-a',
    )

    const remoteCard2: StudyCard = {
      ...mockCard,
      id: 'c2:es-en',
      prompt: 'adiós',
      answer: 'goodbye',
    }

    const pushFetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        // Pull remote cards containing c1 and c2
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                user_id: 'usr-1',
                updated_at: '2026-08-23T12:00:00.000Z',
                data: {
                  version: 1,
                  app: 'jolito',
                  updatedAt: '2026-08-23T12:00:00.000Z',
                  deviceId: 'dev-remote',
                  cards: [mockCard, remoteCard2],
                  deletedCardIds: [],
                },
              },
            ]),
        })
        // Push merged result
        .mockImplementationOnce(pushFetchMock),
    )

    // User deleted mockCard (c1:es-en), only passes remoteCard2 in localCards and ['c1:es-en'] in localDeletedIds
    const res = await service.syncDeck(
      [remoteCard2],
      { id: 'usr-1', email: 'u@example.com' },
      ['c1:es-en'],
    )

    expect(res.success).toBe(true)
    expect(res.cards).toHaveLength(1)
    expect(res.cards?.[0]?.id).toBe('c2:es-en')
    expect(res.deletedCardIds).toContain('c1:es-en')

    expect(pushFetchMock).toHaveBeenCalled()
    const firstCall = pushFetchMock.mock.calls[0] as
      [string, { body?: string }] | undefined
    const bodyStr = firstCall?.[1]?.body ?? '{}'
    const callBody = JSON.parse(bodyStr) as {
      data: { cards: StudyCard[]; deletedCardIds: string[] }
    }
    expect(callBody.data.cards).toHaveLength(1)
    expect(callBody.data.cards[0]?.id).toBe('c2:es-en')
    expect(callBody.data.deletedCardIds).toEqual(['c1:es-en'])
  })

  it('retries pullDeck on 401 when refreshSession provides a fresh token', async () => {
    const refreshSpy = vi.fn().mockResolvedValue('refreshed-jwt-token')
    const authWithRefresh: Partial<SupabaseAuthService> = {
      getCurrentUser: () => ({ id: 'usr-1', email: 'u@example.com' }),
      isCurrentOwner: (ownerId: string | null) => ownerId === 'usr-1',
      getAccessToken: vi.fn().mockResolvedValue('expired-jwt-token'),
      refreshSession: refreshSpy,
    }

    const service = new SupabaseSyncService(
      authWithRefresh as SupabaseAuthService,
      'https://example.supabase.co',
      'anon-key',
      'device-a',
    )

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              user_id: 'usr-1',
              updated_at: '2026-08-23T12:00:00.000Z',
              data: {
                version: 1,
                app: 'jolito',
                updatedAt: '2026-08-23T12:00:00.000Z',
                deviceId: 'dev-remote',
                cards: [mockCard],
              },
            },
          ]),
      })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await service.pullDeck({ id: 'usr-1', email: 'u@example.com' })
    expect(res.success).toBe(true)
    expect(refreshSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(res.cards).toHaveLength(1)
  })

  it('retries pushDeck on 401 when refreshSession provides a fresh token', async () => {
    const refreshSpy = vi.fn().mockResolvedValue('refreshed-jwt-token')
    const authWithRefresh: Partial<SupabaseAuthService> = {
      getCurrentUser: () => ({ id: 'usr-1', email: 'u@example.com' }),
      isCurrentOwner: (ownerId: string | null) => ownerId === 'usr-1',
      getAccessToken: vi.fn().mockResolvedValue('expired-jwt-token'),
      refreshSession: refreshSpy,
    }

    const service = new SupabaseSyncService(
      authWithRefresh as SupabaseAuthService,
      'https://example.supabase.co',
      'anon-key',
      'device-a',
    )

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await service.pushDeck([mockCard], {
      id: 'usr-1',
      email: 'u@example.com',
    })
    expect(res.success).toBe(true)
    expect(refreshSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('parses structured PostgREST error and logs on pullDeck failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const service = new SupabaseSyncService(
      mockAuthService as SupabaseAuthService,
      'https://example.supabase.co/',
      'anon-key',
      'device-a',
    )

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () =>
          Promise.resolve(
            JSON.stringify({
              code: 'PGRST205',
              message: 'relation "public.decks" does not exist',
            }),
          ),
      }),
    )

    const res = await service.pullDeck({ id: 'usr-1', email: 'u@example.com' })
    expect(res.success).toBe(false)
    expect(res.error).toBe('relation "public.decks" does not exist')
    expect(consoleSpy).toHaveBeenCalledWith(
      '[SyncService] Cloud pull failed:',
      expect.objectContaining({
        status: 404,
        code: 'PGRST205',
        message: 'relation "public.decks" does not exist',
      }),
    )
  })

  it('parses structured PostgREST error and logs on pushDeck failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const service = new SupabaseSyncService(
      mockAuthService as SupabaseAuthService,
      'https://example.supabase.co///',
      'anon-key',
      'device-a',
    )

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () =>
          Promise.resolve(
            JSON.stringify({
              code: '42501',
              message:
                'new row violates row-level security policy for table "decks"',
            }),
          ),
      }),
    )

    const res = await service.pushDeck([mockCard], {
      id: 'usr-1',
      email: 'u@example.com',
    })
    expect(res.success).toBe(false)
    expect(res.error).toBe(
      'new row violates row-level security policy for table "decks"',
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      '[SyncService] Cloud push failed:',
      expect.objectContaining({
        status: 403,
        code: '42501',
        message: 'new row violates row-level security policy for table "decks"',
      }),
    )
  })
})

describe('sync account boundaries', () => {
  afterEach(() => vi.unstubAllGlobals())
  it.each(['token', 'refresh', 'pull'] as const)(
    'does not send the previous deck with a new account token after an interrupted %s',
    async (interruption) => {
      let owner = { id: 'A', email: 'a@example.com' }
      let resolve!: (value: string) => void
      const held = new Promise<string>((done) => {
        resolve = done
      })
      const auth = {
        getCurrentUser: () => owner,
        isCurrentOwner: (ownerId: string | null) => ownerId === owner?.id,
        getAccessToken: () =>
          interruption === 'token'
            ? held
            : Promise.resolve(`token-${owner.id}`),
        refreshSession: () => held,
      } as SupabaseAuthService
      let resolvePull!: (value: Response) => void
      const pendingPull = new Promise<Response>((done) => {
        resolvePull = done
      })
      const fetchSpy = vi
        .fn()
        .mockImplementation(() =>
          interruption === 'refresh'
            ? Promise.resolve(new Response(null, { status: 401 }))
            : pendingPull,
        )
      vi.stubGlobal('fetch', fetchSpy)
      const service = new SupabaseSyncService(
        auth,
        'https://example.supabase.co',
        'key',
        'device',
      )
      const pending = service.syncDeck([mockCard], owner)
      // Reach the awaited token, refresh, or pull boundary before switching identity.
      await vi.waitFor(() =>
        expect(interruption === 'token' || fetchSpy.mock.calls.length > 0).toBe(
          true,
        ),
      )
      owner = { id: 'B', email: 'b@example.com' }
      resolve('token-B')
      resolvePull(new Response(JSON.stringify([])))
      expect((await pending).success).toBe(false)
      expect(fetchSpy.mock.calls).toHaveLength(interruption === 'token' ? 0 : 1)
    },
  )
})
