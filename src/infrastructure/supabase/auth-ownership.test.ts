import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SupabaseAuthService } from './auth-service'

const key = 'jolito-auth-session-v1'
const session = (id: string) => ({
  accessToken: `token-${id}`,
  refreshToken: `refresh-${id}`,
  expiresAt: Date.now() + 3600000,
  user: { id, email: `${id}@example.com` },
})
const jwt = (id: string) =>
  `header.${btoa(JSON.stringify({ sub: id, email: `${id}@example.com` }))}.signature`
beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it.each(['signout', 'switch', 'destroy'] as const)(
  'rejects refresh completion after %s without reviving session, listeners or timers',
  async (action) => {
    localStorage.setItem(key, JSON.stringify(session('A')))
    let resolve!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.includes('grant_type')
          ? new Promise<Response>((done) => {
              resolve = done
            })
          : Promise.resolve(new Response(null, { status: 204 })),
      ),
    )
    const auth = new SupabaseAuthService(
      'https://example.supabase.co',
      'key',
      localStorage,
    )
    const listener = vi.fn()
    auth.onAuthStateChange(listener)
    const pending = auth.refreshSession()
    if (action === 'signout') await auth.signOut()
    if (action === 'switch')
      await auth.verifyOtp(
        '',
        `#access_token=${jwt('B')}&refresh_token=refresh-B`,
      )
    if (action === 'destroy') auth.destroy()
    const stored = localStorage.getItem(key)
    const notifications = listener.mock.calls.length
    resolve(
      new Response(
        JSON.stringify({
          access_token: 'late-A',
          refresh_token: 'late-refresh-A',
          user: { id: 'A' },
          expires_in: 3600,
        }),
      ),
    )
    expect(await pending).toBeNull()
    expect(localStorage.getItem(key)).toBe(stored)
    expect(listener).toHaveBeenCalledTimes(notifications)
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(action === 'switch' ? 1 : 0)
    if (action === 'switch') expect(auth.getCurrentUser()?.id).toBe('B')
    else expect(auth.getCurrentUser()).toBeNull()
    auth.destroy()
  },
)

it('captures legacy ownership before an auth redirect replaces the stored session', () => {
  localStorage.setItem(key, JSON.stringify(session('A')))
  window.location.hash = `access_token=${jwt('B')}&refresh_token=refresh-B`
  const auth = new SupabaseAuthService('', '', localStorage)
  expect(auth.storedUserBeforeRedirect?.id).toBe('A')
  expect(auth.getCurrentUser()?.id).toBe('B')
  auth.destroy()
})

it('fences held OTP and logout completions across later logins and responds to storage account changes', async () => {
  localStorage.setItem(key, JSON.stringify(session('A')))
  const requests: Array<(response: Response) => void> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>((resolve) => requests.push(resolve))),
  )
  const auth = new SupabaseAuthService(
    'https://example.supabase.co',
    'key',
    localStorage,
  )
  const otp = auth.verifyOtp('old@example.com', '123456')
  await auth.verifyOtp('', `#access_token=${jwt('B')}&refresh_token=refresh-B`)
  requests.shift()!(
    new Response(
      JSON.stringify({
        access_token: jwt('A'),
        refresh_token: 'refresh-A',
        user: { id: 'A' },
      }),
    ),
  )
  expect((await otp).success).toBe(false)
  expect(auth.getCurrentUser()?.id).toBe('B')
  const logout = auth.signOut()
  await auth.verifyOtp('', `#access_token=${jwt('C')}&refresh_token=refresh-C`)
  requests.shift()!(new Response(null, { status: 204 }))
  await logout
  expect(auth.getCurrentUser()?.id).toBe('C')
  localStorage.setItem(key, JSON.stringify(session('D')))
  window.dispatchEvent(new StorageEvent('storage', { key }))
  expect(auth.getCurrentUser()?.id).toBe('D')
  auth.destroy()
  localStorage.setItem(key, JSON.stringify(session('E')))
  window.dispatchEvent(new StorageEvent('storage', { key }))
  expect(auth.getCurrentUser()).toBeNull()
})

it('does not claim a new login or lose the previous owner when session persistence fails, then retries durably', async () => {
  localStorage.setItem(key, JSON.stringify(session('A')))
  const auth = new SupabaseAuthService('', '', localStorage)
  const raw = localStorage.getItem(key)
  const write = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementationOnce(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
  const result = await auth.verifyOtp('', `#access_token=${jwt('B')}`)
  expect(result.success).toBe(false)
  expect(result.error).toContain('could not be saved')
  expect(auth.getCurrentUser()?.id).toBe('A')
  expect(localStorage.getItem(key)).toBe(raw)
  write.mockRestore()
  expect(await auth.verifyOtp('', `#access_token=${jwt('B')}`)).toEqual({
    success: true,
  })
  auth.destroy()
  const reloaded = new SupabaseAuthService('', '', localStorage)
  expect(reloaded.getCurrentUser()?.id).toBe('B')
  reloaded.destroy()
})

it.each([
  'same-account-refresh',
  'A-B-A',
  'A-B',
  'A-B-before-storage-event',
  'destroy',
] as const)(
  'finalizes held deletion for the deleted identity after %s without clearing a different identity',
  async (transition) => {
    localStorage.setItem(key, JSON.stringify(session('A')))
    let finish!: (response: Response) => void
    const started = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        started()
        return new Promise<Response>((resolve) => {
          finish = resolve
        })
      }),
    )
    const auth = new SupabaseAuthService(
      'https://example.supabase.co',
      'key',
      localStorage,
    )
    const deletion = auth.deleteAccount()
    await vi.waitFor(() => expect(started).toHaveBeenCalledOnce())
    const change = (owner: string) => {
      localStorage.setItem(key, JSON.stringify(session(owner)))
      window.dispatchEvent(new StorageEvent('storage', { key }))
    }
    if (transition === 'same-account-refresh') change('A')
    if (transition === 'A-B' || transition === 'A-B-A') change('B')
    if (transition === 'A-B-A') change('A')
    if (transition === 'A-B-before-storage-event')
      localStorage.setItem(key, JSON.stringify(session('B')))
    if (transition === 'destroy') auth.destroy()
    const before = localStorage.getItem(key)
    finish(new Response(null, { status: 204 }))
    expect(await deletion).toEqual(
      transition === 'destroy'
        ? {
            success: false,
            error: 'Request was interrupted. Please try again.',
            outcomeUnknown: true,
          }
        : { success: true },
    )
    if (
      transition === 'A-B' ||
      transition === 'A-B-before-storage-event' ||
      transition === 'destroy'
    )
      expect(localStorage.getItem(key)).toBe(before)
    else {
      expect(auth.getCurrentUser()).toBeNull()
      expect(localStorage.getItem(key)).toBeNull()
    }
    auth.destroy()
  },
)

it.each(['get-token', 'refresh', 'delete'] as const)(
  'rejects %s credentials for a newly persisted owner before its storage event, then resumes after delivery',
  async (operation) => {
    localStorage.setItem(key, JSON.stringify(session('A')))
    const request = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', request)
    const auth = new SupabaseAuthService(
      'https://example.supabase.co',
      'key',
      localStorage,
    )
    localStorage.setItem(key, JSON.stringify(session('B')))
    const before = localStorage.getItem(key)
    if (operation === 'get-token')
      expect(await auth.getAccessToken()).toBeNull()
    if (operation === 'refresh') expect(await auth.refreshSession()).toBeNull()
    if (operation === 'delete')
      expect((await auth.deleteAccount()).success).toBe(false)
    expect(request).not.toHaveBeenCalled()
    expect(localStorage.getItem(key)).toBe(before)
    expect(auth.getCurrentUser()?.id).toBe('A')
    window.dispatchEvent(new StorageEvent('storage', { key }))
    expect(await auth.getAccessToken()).toBe('token-B')
    auth.destroy()
  },
)

it.each(['token-refresh', 'deletion-refresh', 'deletion-retry'] as const)(
  'does not return or dispatch another owner’s token after a held %s before storage event delivery',
  async (operation) => {
    localStorage.setItem(key, JSON.stringify(session('A')))
    let finish!: (response: Response) => void
    const request = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    vi.stubGlobal('fetch', request)
    const auth = new SupabaseAuthService(
      'https://example.supabase.co',
      'key',
      localStorage,
    )
    if (operation !== 'deletion-retry')
      localStorage.setItem(
        key,
        JSON.stringify({ ...session('A'), expiresAt: 0 }),
      )
    const pending =
      operation === 'token-refresh'
        ? auth.getAccessToken()
        : auth.deleteAccount()
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    localStorage.setItem(key, JSON.stringify(session('B')))
    const before = localStorage.getItem(key)
    finish(
      new Response(null, {
        status: operation === 'deletion-retry' ? 401 : 503,
      }),
    )
    const result = await pending
    if (operation === 'token-refresh') expect(result).toBeNull()
    else expect(result).toMatchObject({ success: false })
    expect(request).toHaveBeenCalledOnce()
    expect(localStorage.getItem(key)).toBe(before)
    window.dispatchEvent(new StorageEvent('storage', { key }))
    expect(await auth.getAccessToken()).toBe('token-B')
    auth.destroy()
  },
)

for (const token of ['123456', 'a'.repeat(64)]) {
  for (const boundary of ['response', 'body'] as const) {
    it.each(['switch', 'signout', 'same-owner-refresh', 'destroy'] as const)(
      `rejects held ${token.length === 6 ? 'numeric' : 'hash'} OTP at ${boundary} after %s and permits a fresh login after reload`,
      async (transition) => {
        localStorage.setItem(key, JSON.stringify(session('A')))
        let release!: () => void
        const held = new Promise<void>((resolve) => {
          release = resolve
        })
        const payload = {
          access_token: jwt('A'),
          refresh_token: 'verified-refresh-A',
          expires_in: 3600,
          user: session('A').user,
        }
        const response = new Response(JSON.stringify(payload))
        const bodyStarted = vi.fn()
        if (boundary === 'body')
          vi.spyOn(response, 'json').mockImplementation(async () => {
            bodyStarted()
            await held
            return payload
          })
        const request = vi.fn(async () => {
          if (boundary === 'response') await held
          return response
        })
        vi.stubGlobal('fetch', request)
        const auth = new SupabaseAuthService(
          'https://example.supabase.co',
          'key',
          localStorage,
        )
        const listener = vi.fn()
        auth.onAuthStateChange(listener)
        const pending = auth.verifyOtp('A@example.com', token)
        if (boundary === 'body')
          await vi.waitFor(() => expect(bodyStarted).toHaveBeenCalledOnce())
        if (transition === 'switch')
          localStorage.setItem(key, JSON.stringify(session('B')))
        if (transition === 'signout') localStorage.removeItem(key)
        if (transition === 'same-owner-refresh')
          localStorage.setItem(
            key,
            JSON.stringify({ ...session('A'), refreshToken: 'new-refresh-A' }),
          )
        if (transition === 'destroy') auth.destroy()
        const before = localStorage.getItem(key)
        const notifications = listener.mock.calls.length
        const timers = vi.getTimerCount()
        release()
        expect(await pending).toMatchObject({ success: false })
        expect(request).toHaveBeenCalledOnce()
        expect(localStorage.getItem(key)).toBe(before)
        expect(listener).toHaveBeenCalledTimes(notifications)
        expect(vi.getTimerCount()).toBe(timers)
        auth.destroy()
        const reloaded = new SupabaseAuthService(
          'https://example.supabase.co',
          'key',
          localStorage,
        )
        expect(reloaded.getCurrentUser()?.id ?? null).toBe(
          transition === 'switch' ? 'B' : transition === 'signout' ? null : 'A',
        )
        request.mockResolvedValue(new Response(JSON.stringify(payload)))
        expect(await reloaded.verifyOtp('A@example.com', token)).toEqual({
          success: true,
        })
        expect(reloaded.getCurrentUser()?.id).toBe('A')
        reloaded.destroy()
      },
    )
  }
}

it.each(['switch', 'signout', 'destroy'] as const)(
  'never exports sign-in credentials after %s and resumes only through the active owner lifetime',
  (transition) => {
    localStorage.setItem(key, JSON.stringify(session('A')))
    const auth = new SupabaseAuthService('', '', localStorage)
    expect(auth.getSessionLink()).toContain(
      'access_token=token-A&refresh_token=refresh-A',
    )
    if (transition === 'switch')
      localStorage.setItem(key, JSON.stringify(session('B')))
    if (transition === 'signout') localStorage.removeItem(key)
    if (transition === 'destroy') auth.destroy()
    const before = localStorage.getItem(key)
    expect(auth.getSessionLink()).toBeNull()
    expect(localStorage.getItem(key)).toBe(before)
    window.dispatchEvent(new StorageEvent('storage', { key }))
    if (transition === 'switch')
      expect(auth.getSessionLink()).toContain(
        'access_token=token-B&refresh_token=refresh-B',
      )
    else expect(auth.getSessionLink()).toBeNull()
    auth.destroy()
    expect(auth.getSessionLink()).toBeNull()
  },
)

it.each(['123456', 'a'.repeat(64)])(
  'refuses a new OTP operation from an identity whose persisted session changed before event delivery (%s)',
  async (token) => {
    localStorage.setItem(key, JSON.stringify(session('A')))
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: jwt('A'),
          refresh_token: 'fresh-A',
          user: session('A').user,
        }),
      ),
    )
    vi.stubGlobal('fetch', request)
    const auth = new SupabaseAuthService(
      'https://example.supabase.co',
      'key',
      localStorage,
    )
    localStorage.setItem(key, JSON.stringify(session('B')))
    const before = localStorage.getItem(key)
    expect(await auth.verifyOtp('A@example.com', token)).toMatchObject({
      success: false,
    })
    expect(request).not.toHaveBeenCalled()
    expect(localStorage.getItem(key)).toBe(before)
    auth.destroy()
  },
)
it.each(['success', 'network-rejection', 'deadline', 'destroy'] as const)(
  'signs out without modern AbortSignal helpers across %s and leaves no active work',
  async (outcome) => {
    vi.stubGlobal('AbortSignal', {})
    localStorage.setItem(key, JSON.stringify(session('A')))
    let finish!: (response: Response) => void
    let fail!: (reason: Error) => void
    let signal!: AbortSignal
    const request = vi.fn((_url: string, init: RequestInit) => {
      signal = init.signal!
      return new Promise<Response>((resolve, reject) => {
        finish = resolve
        fail = reject
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
      })
    })
    vi.stubGlobal('fetch', request)
    const auth = new SupabaseAuthService(
      'https://example.supabase.co',
      'key',
      localStorage,
    )
    const listener = vi.fn()
    auth.onAuthStateChange(listener)
    const settled = auth.signOut().then(
      () => null,
      (cause: unknown) => cause,
    )
    expect(request).toHaveBeenCalledOnce()
    expect(localStorage.getItem(key)).toBeNull()
    const notifications = listener.mock.calls.length
    if (outcome === 'success') finish(new Response(null, { status: 204 }))
    if (outcome === 'network-rejection') fail(new Error('Offline'))
    if (outcome === 'deadline') await vi.advanceTimersByTimeAsync(10_000)
    if (outcome === 'destroy') auth.destroy()
    expect(await settled).toBeNull()
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(listener).toHaveBeenCalledTimes(notifications)
    if (outcome === 'deadline' || outcome === 'destroy')
      expect(signal.aborted).toBe(true)
    if (outcome !== 'destroy') {
      await auth.verifyOtp(
        '',
        `#access_token=${jwt('B')}&refresh_token=refresh-B`,
      )
      expect(auth.getCurrentUser()?.id).toBe('B')
      const retry = auth.signOut()
      finish(new Response(null, { status: 204 }))
      await retry
      await vi.advanceTimersByTimeAsync(0)
      expect(request).toHaveBeenCalledTimes(2)
      expect(localStorage.getItem(key)).toBeNull()
      expect(vi.getTimerCount()).toBe(0)
    }
    auth.destroy()
    const ended = listener.mock.calls.length
    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))
    await auth.signOut()
    expect(vi.getTimerCount()).toBe(0)
    expect(listener).toHaveBeenCalledTimes(ended)
  },
)

it.each([
  { heldAt: 'response', interruption: 'destroy' },
  { heldAt: 'body', interruption: 'destroy' },
  { heldAt: 'response', interruption: 'deadline' },
  { heldAt: 'body', interruption: 'deadline' },
] as const)(
  'bounds a held refresh $heldAt across $interruption and reload without modern AbortSignal helpers',
  async ({ heldAt, interruption }) => {
    vi.stubGlobal('AbortSignal', {})
    localStorage.setItem(key, JSON.stringify(session('A')))
    let signal!: AbortSignal
    let finish!: (value: never) => void
    const payload = {
      access_token: 'renewed-A',
      refresh_token: 'renewed-refresh-A',
      expires_in: 3600,
      user: { id: 'A', email: 'A@example.com' },
    }
    const request = vi.fn((_url: string, init: RequestInit) => {
      signal = init.signal!
      const held = new Promise<never>((resolve) => {
        finish = resolve
      })
      return heldAt === 'response'
        ? held
        : Promise.resolve({ ok: true, json: () => held })
    })
    vi.stubGlobal('fetch', request)
    const auth = new SupabaseAuthService(
      'https://example.supabase.co',
      'key',
      localStorage,
    )
    const listener = vi.fn()
    auth.onAuthStateChange(listener)
    const pending = auth.refreshSession()
    await vi.advanceTimersByTimeAsync(0)
    const before = localStorage.getItem(key)
    if (interruption === 'destroy') auth.destroy()
    else await vi.advanceTimersByTimeAsync(10_000)
    expect(signal?.aborted).toBe(true)
    expect(await pending).toBe(interruption === 'destroy' ? null : 'token-A')
    auth.destroy()
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(0)
    const notifications = listener.mock.calls.length
    finish(
      (heldAt === 'response'
        ? new Response(JSON.stringify(payload))
        : payload) as never,
    )
    await vi.advanceTimersByTimeAsync(60_000)
    expect(localStorage.getItem(key)).toBe(before)
    expect(listener).toHaveBeenCalledTimes(notifications)
    expect(vi.getTimerCount()).toBe(0)
    request.mockImplementation((_url: string, init: RequestInit) => {
      signal = init.signal!
      return Promise.resolve(new Response(JSON.stringify(payload))) as never
    })
    const reloaded = new SupabaseAuthService(
      'https://example.supabase.co',
      'key',
      localStorage,
    )
    expect(await reloaded.refreshSession()).toBe('renewed-A')
    expect(signal.aborted).toBe(true)
    reloaded.destroy()
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(0)
  },
)

it.each([
  { initial: 'A', next: null },
  { initial: 'A', next: 'B' },
  { initial: null, next: 'B' },
  { initial: 'A', next: 'A' },
] as const)(
  'validates local commit ownership through $initial → persisted $next → event → reload and teardown',
  ({ initial, next }) => {
    if (initial) localStorage.setItem(key, JSON.stringify(session(initial)))
    const auth = new SupabaseAuthService('', '', localStorage)
    expect(auth.isCurrentOwner(initial)).toBe(true)
    if (next)
      localStorage.setItem(
        key,
        JSON.stringify({
          ...session(next),
          accessToken: `renewed-${next}`,
          refreshToken: `renewed-refresh-${next}`,
        }),
      )
    else localStorage.removeItem(key)
    expect(auth.isCurrentOwner(initial)).toBe(initial === next)
    expect(auth.isCurrentOwner(next)).toBe(initial === next)
    window.dispatchEvent(new StorageEvent('storage', { key }))
    expect(auth.isCurrentOwner(next)).toBe(true)
    auth.destroy()
    expect(auth.isCurrentOwner(next)).toBe(false)
    const reloaded = new SupabaseAuthService('', '', localStorage)
    expect(reloaded.isCurrentOwner(next)).toBe(true)
    reloaded.destroy()
    expect(reloaded.isCurrentOwner(next)).toBe(false)
  },
)

it.each(['A', null] as const)(
  'rejects local commits for %s while auth storage is unavailable, then resumes after recovery',
  (owner) => {
    if (owner) localStorage.setItem(key, JSON.stringify(session(owner)))
    const auth = new SupabaseAuthService('', '', localStorage)
    const read = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new DOMException('Storage blocked', 'SecurityError')
      })
    expect(auth.isCurrentOwner(owner)).toBe(false)
    read.mockRestore()
    expect(auth.isCurrentOwner(owner)).toBe(true)
    auth.destroy()
  },
)

it('uses the verified startup snapshot for both legacy ownership and active identity when later reads fail', () => {
  localStorage.setItem(key, JSON.stringify(session('A')))
  const original = Object.getOwnPropertyDescriptor(
    Storage.prototype,
    'getItem',
  )!.value as (this: Storage, key: string) => string | null
  let reads = 0
  const read = vi
    .spyOn(Storage.prototype, 'getItem')
    .mockImplementation(function (this: Storage, name: string) {
      if (name === key && ++reads > 1)
        throw new DOMException('Read unavailable', 'SecurityError')
      return original.call(this, name)
    })
  const beforeRedirect = vi.fn()
  const auth = new SupabaseAuthService('', '', localStorage, beforeRedirect)
  expect(beforeRedirect).toHaveBeenCalledExactlyOnceWith(session('A').user)
  expect(auth.storedUserBeforeRedirect).toEqual(session('A').user)
  expect(auth.getCurrentUser()).toEqual(session('A').user)
  expect(auth.isCurrentOwner('A')).toBe(false)
  read.mockRestore()
  expect(auth.isCurrentOwner('A')).toBe(true)
  auth.destroy()
})
