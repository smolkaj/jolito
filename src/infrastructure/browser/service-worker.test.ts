// @vitest-environment node
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const workerSource = readFileSync('public/sw.js', 'utf8')
const origin = 'https://jolito.test'
type FetchRequest = { url: string; method: string; mode: string }
type WorkerEvent = {
  waitUntil: (work: Promise<unknown>) => void
  respondWith: (response: Promise<Response>) => void
  request?: FetchRequest
  data?: unknown
  ports: { postMessage: (message: unknown) => void }[]
}

function browser() {
  const stores = new Map<string, Map<string, Response>>()
  let failure: 'network' | 'http' | 'quota' | null = null
  let revision = 'old'
  const key = (input: string | FetchRequest) =>
    new URL(typeof input === 'string' ? input : input.url, origin).pathname
  const fetch = vi.fn((input: string | FetchRequest) => {
    if (failure === 'network') return Promise.reject(new Error('offline'))
    return Promise.resolve(
      new Response(`${revision}:${key(input)}`, {
        status: failure === 'http' ? 503 : 200,
      }),
    )
  })
  const caches = {
    keys: () => Promise.resolve([...stores.keys()]),
    delete: (name: string) => Promise.resolve(stores.delete(name)),
    open: (name: string) => {
      let entries = stores.get(name)
      if (!entries) stores.set(name, (entries = new Map()))
      const store = entries
      return Promise.resolve({
        match: (input: string | FetchRequest) =>
          Promise.resolve(store.get(key(input))?.clone()),
        addAll: async (urls: string[]) => {
          const responses = await Promise.all(urls.map(fetch))
          if (responses.some((response) => !response.ok))
            throw new Error('HTTP error')
          if (failure === 'quota') throw new Error('quota exceeded')
          urls.forEach((url, index) => store.set(key(url), responses[index]!))
        },
      })
    },
  }
  function worker(build: string) {
    const listeners = new Map<string, (event: WorkerEvent) => void>()
    const skipWaiting = vi.fn()
    const claim = vi.fn()
    runInNewContext(
      workerSource
        .replace('__JOLITO_BUILD_ID__', build)
        .replace(
          '/* __JOLITO_BUILD_ASSETS__ */ []',
          '["assets/app.js", "assets/app.css"]',
        ),
      {
        self: {
          registration: { scope: `${origin}/` },
          location: { origin },
          addEventListener: (
            type: string,
            listener: (event: WorkerEvent) => void,
          ) => listeners.set(type, listener),
          skipWaiting,
          clients: { claim },
        },
        caches,
        fetch,
        URL,
        Response,
      },
    )
    async function dispatch(type: string, details: Partial<WorkerEvent> = {}) {
      const work: Promise<unknown>[] = []
      let response: Promise<Response> | undefined
      const reply = vi.fn()
      listeners.get(type)!({
        waitUntil: (promise) => work.push(promise),
        respondWith: (promise) => {
          response = promise
        },
        ports: [{ postMessage: reply }],
        ...details,
      })
      await Promise.all(work)
      return { response: await response, reply }
    }
    return { dispatch, skipWaiting, claim }
  }
  const navigation = {
    request: { url: `${origin}/?practice=1`, method: 'GET', mode: 'navigate' },
  }
  return {
    worker,
    stores,
    fetch,
    navigation,
    fail: (next: typeof failure) => {
      failure = next
    },
    upgrade: () => {
      revision = 'new'
    },
  }
}

describe('complete offline shell lifecycle', () => {
  it.each(['network', 'http', 'quota'] as const)(
    'keeps the installed shell through a %s update failure, offline reload and online recovery',
    async (failure) => {
      const env = browser()
      const oldWorker = env.worker('old')
      await oldWorker.dispatch('install')
      await oldWorker.dispatch('activate')
      env.upgrade()
      env.fail(failure)
      const failedWorker = env.worker('new')
      await expect(failedWorker.dispatch('install')).rejects.toThrow()
      expect(failedWorker.skipWaiting).not.toHaveBeenCalled()
      expect(failedWorker.claim).not.toHaveBeenCalled()
      expect(env.stores.has('jolito-shell-old')).toBe(true)
      expect(env.stores.has('jolito-shell-new')).toBe(false)

      env.fail('network')
      const offline = await oldWorker.dispatch('fetch', env.navigation)
      expect(await offline.response?.text()).toBe('old:/index.html')
      env.fail(null)
      const recoveredWorker = env.worker('new')
      await recoveredWorker.dispatch('install')
      await recoveredWorker.dispatch('activate')
      const recovered = await recoveredWorker.dispatch('fetch', env.navigation)
      expect(await recovered.response?.text()).toBe('new:/index.html')
      const ready = await recoveredWorker.dispatch('message', {
        data: { type: 'CHECK_OFFLINE_READY' },
      })
      expect(ready.reply).toHaveBeenCalledWith('cached')
    },
  )

  it('never replaces installed HTML with a failed or incomplete deployment on navigation', async () => {
    const env = browser()
    const worker = env.worker('old')
    await worker.dispatch('install')
    await worker.dispatch('activate')
    for (const failure of ['http', null, 'network'] as const) {
      env.fail(failure)
      env.upgrade()
      const result = await worker.dispatch('fetch', env.navigation)
      expect(await result.response?.text()).toBe('old:/index.html')
    }
  })

  it('reports missing required cache entries truthfully without fetching arbitrary client URLs', async () => {
    const env = browser()
    const worker = env.worker('old')
    await worker.dispatch('install')
    const ready = await worker.dispatch('message', {
      data: { type: 'CHECK_OFFLINE_READY' },
    })
    expect(ready.reply).toHaveBeenCalledWith('cached')
    env.stores.get('jolito-shell-old')!.delete('/assets/app.js')
    const missing = await worker.dispatch('message', {
      data: { type: 'CHECK_OFFLINE_READY' },
    })
    expect(missing.reply).toHaveBeenCalledWith('cache-error')
    env.fetch.mockClear()
    await worker.dispatch('message', {
      data: { type: 'CACHE_URLS', urls: ['/api/tts'] },
    })
    expect(env.fetch).not.toHaveBeenCalled()
  })

  it('leaves audio and unrelated caches intact and does not intercept APIs', async () => {
    const env = browser()
    env.stores.set('jolito-audio-v1', new Map())
    env.stores.set('other-app', new Map())
    const worker = env.worker('old')
    await worker.dispatch('install')
    await worker.dispatch('activate')
    expect(env.stores.has('jolito-audio-v1')).toBe(true)
    expect(env.stores.has('other-app')).toBe(true)
    env.fetch.mockClear()
    const result = await worker.dispatch('fetch', {
      request: { url: `${origin}/api/tts`, method: 'GET', mode: 'cors' },
    })
    expect(result.response).toBeUndefined()
    expect(env.fetch).not.toHaveBeenCalled()
  })
})
