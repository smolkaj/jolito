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
}

describe('SupabaseSyncService', () => {
  const mockAuthService: Partial<SupabaseAuthService> = {
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
      | [string, { body?: string }]
      | undefined
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
})
