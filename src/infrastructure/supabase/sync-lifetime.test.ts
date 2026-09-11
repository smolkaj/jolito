import { afterEach, expect, it, vi } from 'vitest'
import { createStudyCards } from '../../domain/card'
import type { SupabaseAuthService } from './auth-service'
import { SupabaseSyncService } from './sync-service'

const ownerA = { id: 'A', email: 'a@example.com' }
const ownerB = { id: 'B', email: 'b@example.com' }
const oldCards = createStudyCards(
  { spanish: 'old A', english: 'old', context: '', bidirectional: false },
  'old',
  0,
)
const freshCards = [
  ...oldCards,
  ...createStudyCards(
    { spanish: 'new A', english: 'new', context: '', bidirectional: false },
    'new',
    1,
  ),
]
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it.each(
  ['syncDeck', 'pushDeck'].flatMap((operation) =>
    ['token', 'response', 'body', 'refresh'].flatMap((heldAt) =>
      ['account round trip', 'deadline'].map((interruption) => ({
        operation,
        heldAt,
        interruption,
      })),
    ),
  ),
)(
  'stops disposed $operation at $heldAt across $interruption and permits a fresh A lifetime',
  async ({ operation, heldAt, interruption }) => {
    vi.useFakeTimers()
    // The iOS 15 path must not depend on static AbortSignal helpers.
    vi.stubGlobal('AbortSignal', {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let owner = ownerA
    const heldToken = deferred<string>()
    const heldResponse = deferred<Response>()
    const heldBody = deferred<never>()
    let holding = true
    let reached = false
    const auth = {
      isCurrentOwner: (id: string | null) => id === owner.id,
      getAccessToken: () => {
        if (holding && heldAt === 'token') {
          reached = true
          return heldToken.promise
        }
        return Promise.resolve(`token-${owner.id}`)
      },
      refreshSession: () => {
        reached = true
        return heldToken.promise
      },
    } as SupabaseAuthService
    const pushes: unknown[] = []
    const signals: AbortSignal[] = []
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      if (init.signal) signals.push(init.signal)
      if (init.method === 'POST') {
        pushes.push(JSON.parse(init.body as string))
      }
      if (holding) {
        if (heldAt === 'response') {
          reached = true
          return heldResponse.promise
        }
        if (heldAt === 'refresh')
          return Promise.resolve(new Response(null, { status: 401 }))
        if (heldAt === 'body') {
          const read = () => {
            reached = true
            return heldBody.promise
          }
          return Promise.resolve({
            ok: operation === 'syncDeck',
            status: 403,
            json: read,
            text: read,
          })
        }
      }
      return Promise.resolve(
        init.method === 'POST'
          ? new Response(null, { status: 204 })
          : new Response('[]'),
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const service = new SupabaseSyncService(
      auth,
      'https://example.supabase.co',
      'key',
      'device',
    )
    const lifetime = new AbortController()
    const run =
      operation === 'syncDeck'
        ? service.syncDeck.bind(service)
        : service.pushDeck.bind(service)
    const oldSync = run(oldCards, ownerA, [], lifetime.signal)
    await vi.waitFor(() => expect(reached).toBe(true))
    if (interruption === 'account round trip') {
      owner = ownerB
      lifetime.abort()
      owner = ownerA
    } else {
      await vi.advanceTimersByTimeAsync(10_000)
    }
    // Settle even if a host fetch/credential promise ignores cancellation.
    await expect(oldSync).resolves.toMatchObject({ success: false })
    expect(signals.every((signal) => signal.aborted)).toBe(true)
    const previousPushes = pushes.length
    holding = false
    const freshLifetime = new AbortController()
    expect(
      (await run(freshCards, ownerA, [], freshLifetime.signal)).success,
    ).toBe(true)
    expect(pushes).toHaveLength(previousPushes + 1)
    expect(pushes[pushes.length - 1]).toMatchObject({
      user_id: 'A',
      data: { cards: freshCards },
    })
    const dispatchCount = fetchMock.mock.calls.length
    heldToken.resolve('token-A')
    heldResponse.resolve(new Response('[]'))
    heldBody.resolve((operation === 'syncDeck' ? [] : 'denied') as never)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(dispatchCount)
    expect(pushes).toHaveLength(previousPushes + 1)
    expect(vi.getTimerCount()).toBe(0)
    freshLifetime.abort()
  },
)
