import { z } from 'zod'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectionVersion, createStudyCards } from '../../domain/card'
import { SupabaseAuthService } from './auth-service'
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
function service(
  auth: Partial<SupabaseAuthService> = {},
  alertEndpoint: string | null = null,
) {
  return new SupabaseSyncService(
    {
      getCurrentUser: () => user,
      isCurrentOwner: (ownerId: string | null) => ownerId === user.id,
      getAccessToken: () => Promise.resolve('token'),
      ...auth,
    } as SupabaseAuthService,
    'https://example.supabase.co',
    'anon',
    'device',
    alertEndpoint,
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
    expect(await sync.syncDeck(cards, user)).toEqual({
      success: false,
      error: 'Update Jolito to sync.',
      syncHelp: true,
    })
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

it.each(['write credentials', 'unauthorized refresh'])(
  'does not submit another account’s credentials during %s, then resumes for the correct owner',
  async (stage) => {
    let active = user
    let release!: (token: string) => void
    let reached!: () => void
    const paused = new Promise<void>((resolve) => {
      reached = resolve
    })
    const held = new Promise<string>((resolve) => {
      release = resolve
    })
    let credentials = 0
    let writes = 0
    const sync = service({
      getCurrentUser: () => active,
      isCurrentOwner: (ownerId: string | null) => ownerId === active.id,
      getAccessToken: () => {
        if (++credentials === 2 && stage === 'write credentials') {
          reached()
          return held
        }
        return Promise.resolve('owner-a-token')
      },
      refreshSession: () => {
        reached()
        return held
      },
    })
    const fetchSpy = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return Promise.resolve(Response.json([row]))
      if (++writes === 1 && stage === 'unauthorized refresh')
        return Promise.resolve(new Response('', { status: 401 }))
      return Promise.resolve(Response.json(2))
    })
    vi.stubGlobal('fetch', fetchSpy)
    const done = sync.syncDeck(cards, user)
    await paused
    active = { id: 'another-owner', email: 'another@example.com' }
    release('owner-b-token')
    expect(await done).toMatchObject({
      success: false,
      error: expect.stringContaining('account changed') as string,
    })
    expect(writes).toBe(stage === 'write credentials' ? 0 : 1)
    active = user
    expect((await sync.syncDeck(cards, user)).success).toBe(true)
    for (const [, init] of fetchSpy.mock.calls) {
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        'Bearer owner-a-token',
      )
    }
  },
)

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
        isCurrentOwner: (ownerId: string | null) => ownerId === owner.id,
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
      const pending = service.syncDeck(cards, owner)
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

it('uses portable cancellation APIs through rejection and retry', async () => {
  vi.stubGlobal(
    'AbortSignal',
    new Proxy(AbortSignal, {
      get(target, key, receiver) {
        const value: unknown = Reflect.get(target, key, receiver)
        return key === 'timeout' || key === 'any' ? undefined : value
      },
    }),
  )
  const modernMethod = vi
    .spyOn(AbortSignal.prototype, 'throwIfAborted')
    .mockImplementation(() => {
      throw new Error('Modern cancellation methods are unavailable')
    })
  try {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(Response.json([row]))
      .mockResolvedValueOnce(Response.json(2))
    vi.stubGlobal('fetch', fetchSpy)
    const sync = service()
    const lifetime = new AbortController()
    expect(
      (await sync.syncDeck(cards, user, [], lifetime.signal)).success,
    ).toBe(false)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(
      (await sync.syncDeck(cards, user, [], lifetime.signal)).success,
    ).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(modernMethod).not.toHaveBeenCalled()
  } finally {
    modernMethod.mockRestore()
  }
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

for (const stage of ['credentials', 'response', 'body'] as const) {
  it.each(['deadline', 'disposal'] as const)(
    `keeps ${stage} waits bounded during %s and supports a fresh retry`,
    async (interruption) => {
      vi.useFakeTimers()
      const credentials = deferred<string>()
      const response = deferred<Response>()
      const body = deferred<unknown>()
      let hold = true
      const sync = service({
        getAccessToken: () =>
          hold && stage === 'credentials'
            ? credentials.promise
            : Promise.resolve('token'),
      })
      const fetchSpy = vi.fn(() => {
        if (!hold) return Promise.resolve(Response.json([row]))
        if (stage === 'response') return response.promise
        const result = Response.json([row])
        if (stage === 'body')
          vi.spyOn(result, 'json').mockImplementation(() => body.promise)
        return Promise.resolve(result)
      })
      vi.stubGlobal('fetch', fetchSpy)
      const lifetime = new AbortController()
      const pending = sync.pullDeck(user, lifetime.signal)
      const release = () => {
        credentials.resolve('token')
        response.resolve(Response.json([row]))
        body.resolve([row])
      }
      try {
        await vi.advanceTimersByTimeAsync(0)
        const callsBefore = fetchSpy.mock.calls.length
        if (interruption === 'deadline')
          await vi.advanceTimersByTimeAsync(10_000)
        else {
          lifetime.abort()
          await vi.advanceTimersByTimeAsync(0)
        }
        expect(
          await Promise.race([pending, Promise.resolve('still waiting')]),
        ).toMatchObject({ success: false })
        release()
        await pending
        await vi.advanceTimersByTimeAsync(10_000)
        expect(fetchSpy).toHaveBeenCalledTimes(callsBefore)
        expect(vi.getTimerCount()).toBe(0)
        hold = false
        expect(
          (await sync.pullDeck(user, new AbortController().signal)).success,
        ).toBe(true)
        expect(vi.getTimerCount()).toBe(0)
      } finally {
        release()
        await pending
        vi.useRealTimers()
      }
    },
  )
}

for (const stage of ['read body', 'write body'] as const) {
  it.each(['signout', 'switch', 'renewal'] as const)(
    `checks persisted ownership after a held ${stage} during %s before storage delivery, then resumes in a fresh lifetime`,
    async (transition) => {
      const key = 'jolito-auth-session-v1'
      const storedSession = (id: string) => ({
        accessToken: `token-${id}`,
        refreshToken: `refresh-${id}`,
        expiresAt: Date.now() + 3_600_000,
        user: { id, email: `${id}@example.com` },
      })
      localStorage.setItem(key, JSON.stringify(storedSession(user.id)))
      const auth = new SupabaseAuthService(
        'https://example.supabase.co',
        'anon',
        localStorage,
      )
      const sync = new SupabaseSyncService(
        auth,
        'https://example.supabase.co',
        'anon',
        'device',
      )
      const reached = deferred<void>()
      const release = deferred<void>()
      let hold = true
      const fetchSpy = vi.fn((_url: string, init?: RequestInit) => {
        const write = init?.method === 'POST'
        const data = write ? 2 : [row]
        const response = Response.json(data)
        if (hold && write === (stage === 'write body')) {
          vi.spyOn(response, 'json').mockImplementation(async () => {
            reached.resolve()
            await release.promise
            return data
          })
        }
        return Promise.resolve(response)
      })
      vi.stubGlobal('fetch', fetchSpy)
      try {
        const pending = sync.syncDeck(cards, user)
        await reached.promise
        if (transition === 'signout') localStorage.removeItem(key)
        else
          localStorage.setItem(
            key,
            JSON.stringify(
              storedSession(transition === 'switch' ? 'other' : user.id),
            ),
          )
        expect(auth.getCurrentUser()?.id).toBe(user.id)
        const persisted = localStorage.getItem(key)
        release.resolve()
        expect((await pending).success).toBe(transition === 'renewal')
        expect(fetchSpy).toHaveBeenCalledTimes(
          stage === 'read body' && transition !== 'renewal' ? 1 : 2,
        )
        expect(localStorage.getItem(key)).toBe(persisted)
        auth.destroy()
        hold = false
        localStorage.setItem(key, JSON.stringify(storedSession(user.id)))
        const resumedAuth = new SupabaseAuthService(
          'https://example.supabase.co',
          'anon',
          localStorage,
        )
        try {
          const resumed = new SupabaseSyncService(
            resumedAuth,
            'https://example.supabase.co',
            'anon',
            'device',
          )
          expect((await resumed.syncDeck(cards, user)).success).toBe(true)
          const requests = fetchSpy.mock.calls.length
          expect((await sync.syncDeck(cards, user)).success).toBe(false)
          expect(fetchSpy).toHaveBeenCalledTimes(requests)
        } finally {
          resumedAuth.destroy()
        }
      } finally {
        release.resolve()
        auth.destroy()
        localStorage.removeItem(key)
      }
    },
  )
}

it.each(['read', 'write'] as const)(
  'keeps local cards and retries after a missing %s RPC deployment',
  async (phase) => {
    const fetchSpy = vi.fn()
    if (phase === 'write') fetchSpy.mockResolvedValueOnce(Response.json([row]))
    fetchSpy.mockResolvedValueOnce(
      Response.json(
        { code: 'PGRST202', message: 'Could not find the function' },
        { status: 404 },
      ),
    )
    vi.stubGlobal('fetch', fetchSpy)
    const client = service()
    const unchanged = structuredClone(cards)
    expect(await client.syncDeck(cards, user)).toMatchObject({
      success: false,
      error: expect.stringContaining('Cloud sync is being updated') as string,
    })
    expect(cards).toEqual(unchanged)
    expect(
      fetchSpy.mock.calls.every(([url]) => String(url).includes('/rpc/')),
    ).toBe(true)
    fetchSpy
      .mockResolvedValueOnce(Response.json([row]))
      .mockResolvedValueOnce(Response.json(2))
    expect(await client.syncDeck(cards, user)).toMatchObject({
      success: true,
      cards,
      revision: 2,
    })
  },
)

it('rejects malformed local cards at client egress without calling write RPC', async () => {
  const fetchSpy = vi.fn().mockResolvedValueOnce(Response.json([row]))
  vi.stubGlobal('fetch', fetchSpy)
  const client = service()
  const malformedCards = [{ ...cards[0]!, id: '' }] as unknown as typeof cards
  const result = await client.syncDeck(malformedCards, user)
  expect(result.success).toBe(false)
  // Only the pullDeck read RPC occurred; compare_and_set_deck was never called
  expect(fetchSpy).toHaveBeenCalledTimes(1)
  expect(fetchSpy.mock.calls[0]?.[0]).toContain('/rpc/read_deck_snapshot')
})

describe('sync anomaly alert reporting', () => {
  it('reports sync anomaly to alert endpoint when remote snapshot schema validation fails', async () => {
    const corruptedRow = {
      ...row,
      data: {
        ...payload,
        updatedAt: 1789844855022, // Numeric timestamp that broke Steffen's account
      },
    }

    const fetchSpy = vi.fn().mockImplementation((input: unknown) => {
      const url = String(input)
      if (url.includes('/rpc/read_deck_snapshot')) {
        return Promise.resolve(Response.json([corruptedRow]))
      }
      if (url.includes('/api/alerts/sync-anomaly')) {
        return Promise.resolve(Response.json({ success: true }))
      }
      return Promise.reject(new Error(`Unexpected fetch to ${url}`))
    })
    vi.stubGlobal('fetch', fetchSpy)

    const client = service({}, '/api/alerts/sync-anomaly')
    const result = await client.pullDeck(user)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Update Jolito to sync.')
    expect(result.syncHelp).toBe(true)

    const alertCall = fetchSpy.mock.calls.find((call) =>
      String(call[0]).includes('/api/alerts/sync-anomaly'),
    ) as [string, RequestInit] | undefined

    expect(alertCall).toBeDefined()
    expect(alertCall?.[0]).toContain('/api/alerts/sync-anomaly')
    expect(alertCall?.[1].method).toBe('POST')
    expect(alertCall?.[1].headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
    })

    const alertBody = JSON.parse(
      (alertCall?.[1].body as string) ?? '{}',
    ) as Record<string, unknown>
    expect(alertBody).toMatchObject({
      userId: user.id,
      revision: 1,
      clientVersion: 4,
      deviceId: 'device',
    })
    expect(alertBody['issues']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [0, 'data', 'updatedAt'],
          code: 'invalid_type',
        }),
      ]),
    )
    // Invariant: alert payload must never leak cards array or flashcard content
    expect(JSON.stringify(alertBody)).not.toContain('cards')
  })

  it('deduplicates alert dispatches within the same session for the same user and revision', async () => {
    const corruptedRow = {
      ...row,
      data: {
        ...payload,
        updatedAt: 1789844855022,
      },
    }

    let alertCount = 0
    const fetchSpy = vi.fn().mockImplementation((input: unknown) => {
      const url = String(input)
      if (url.includes('/rpc/read_deck_snapshot')) {
        return Promise.resolve(Response.json([corruptedRow]))
      }
      if (url.includes('/api/alerts/sync-anomaly')) {
        alertCount++
        return Promise.resolve(Response.json({ success: true }))
      }
      return Promise.reject(new Error(`Unexpected fetch to ${url}`))
    })
    vi.stubGlobal('fetch', fetchSpy)

    const client = service({}, '/api/alerts/sync-anomaly')
    // First pullDeck triggers alert
    await client.pullDeck(user)
    expect(alertCount).toBe(1)

    // Second pullDeck in same session suppresses duplicate alert
    await client.pullDeck(user)
    expect(alertCount).toBe(1)
  })

  it('handles non-fatal network failure on alert endpoint gracefully', async () => {
    const corruptedRow = { ...row, data: { ...payload, version: 99 } }
    const fetchSpy = vi.fn().mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/rpc/read_deck_snapshot')) {
        return Promise.resolve(Response.json([corruptedRow]))
      }
      if (url.includes('/api/alerts/sync-anomaly')) {
        return Promise.reject(new Error('Network offline'))
      }
      return Promise.reject(new Error(`Unexpected fetch to ${url}`))
    })
    vi.stubGlobal('fetch', fetchSpy)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = service({}, '/api/alerts/sync-anomaly')
    const result = await client.pullDeck(user)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Update Jolito to sync.')
    expect(result.syncHelp).toBe(true)
    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[SyncService] Non-fatal sync anomaly alert dispatch error:',
        ),
        expect.any(Error),
      )
    })
  })

  it('resolves relative alert endpoint to capacitor base origin in native environment', async () => {
    const corruptedRow = { ...row, data: { ...payload, version: 99 } }
    let dispatchedUrl: string | null = null
    const fetchSpy = vi.fn().mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/rpc/read_deck_snapshot')) {
        return Promise.resolve(Response.json([corruptedRow]))
      }
      if (url.includes('api/alerts/sync-anomaly')) {
        dispatchedUrl = url
        return Promise.resolve(Response.json({ success: true }))
      }
      return Promise.reject(new Error(`Unexpected fetch to ${url}`))
    })
    vi.stubGlobal('fetch', fetchSpy)
    const originalLocation = window.location
    try {
      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'capacitor:',
          origin: 'capacitor://localhost',
        },
        writable: true,
      })

      const client = service({}, '/api/alerts/sync-anomaly')
      await client.pullDeck(user)

      expect(dispatchedUrl).toBe('https://joli.to/api/alerts/sync-anomaly')
    } finally {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
      })
    }
  })
})
