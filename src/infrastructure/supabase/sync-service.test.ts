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
  createdAt: 1000,
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

  describe('deleteRemoteDeck', () => {
    it('returns error if backend is not configured', async () => {
      const service = new SupabaseSyncService(
        mockAuthService as SupabaseAuthService,
        '',
        '',
      )
      const res = await service.deleteRemoteDeck({
        id: 'usr-1',
        email: 'u@example.com',
      })
      expect(res.success).toBe(false)
      expect(res.error).toMatch(/not configured/i)
    })

    it('returns error if auth headers cannot be retrieved', async () => {
      const authNoToken: Partial<SupabaseAuthService> = {
        getAccessToken: () => Promise.resolve(null),
      }
      const service = new SupabaseSyncService(
        authNoToken as SupabaseAuthService,
        'https://example.supabase.co',
        'anon-key',
      )
      const res = await service.deleteRemoteDeck({
        id: 'usr-1',
        email: 'u@example.com',
      })
      expect(res.success).toBe(false)
      expect(res.error).toMatch(/Sign in/i)
    })

    it('successfully sends DELETE request to Supabase rest endpoint', async () => {
      const service = new SupabaseSyncService(
        mockAuthService as SupabaseAuthService,
        'https://example.supabase.co',
        'anon-key',
      )
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
      })
      vi.stubGlobal('fetch', fetchSpy)

      const res = await service.deleteRemoteDeck({
        id: 'usr-1',
        email: 'u@example.com',
      })

      expect(res.success).toBe(true)
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://example.supabase.co/rest/v1/decks?user_id=eq.usr-1',
        expect.objectContaining({
          method: 'DELETE',
        }),
      )
      const call = fetchSpy.mock.calls[0] as [
        string,
        { headers: Record<string, string> },
      ]
      expect(call[1].headers).toMatchObject({
        Authorization: 'Bearer valid-jwt-token',
        apikey: 'anon-key',
      })
    })

    it('refreshes token on 401 response and retries DELETE', async () => {
      const refreshSpy = vi.fn().mockResolvedValue('refreshed-token')
      const authWithRefresh: Partial<SupabaseAuthService> = {
        getAccessToken: () => Promise.resolve('initial-token'),
        refreshSession: refreshSpy,
      }
      const service = new SupabaseSyncService(
        authWithRefresh as SupabaseAuthService,
        'https://example.supabase.co',
        'anon-key',
      )
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({ ok: true })
      vi.stubGlobal('fetch', fetchSpy)

      const res = await service.deleteRemoteDeck({
        id: 'usr-1',
        email: 'u@example.com',
      })

      expect(res.success).toBe(true)
      expect(refreshSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('handles server failure responses and exceptions gracefully', async () => {
      const service = new SupabaseSyncService(
        mockAuthService as SupabaseAuthService,
        'https://example.supabase.co',
        'anon-key',
      )
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 500 }),
      )

      const failRes = await service.deleteRemoteDeck({
        id: 'usr-1',
        email: 'u@example.com',
      })
      expect(failRes.success).toBe(false)
      expect(failRes.error).toMatch(/HTTP 500/i)

      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network offline')),
      )
      const networkRes = await service.deleteRemoteDeck({
        id: 'usr-1',
        email: 'u@example.com',
      })
      expect(networkRes.success).toBe(false)
      expect(networkRes.error).toBe('Network offline')
    })
  })
})
