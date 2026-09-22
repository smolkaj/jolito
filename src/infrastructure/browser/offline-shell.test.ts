import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startOfflineShell } from './offline-shell'

class TestChannel {
  static opened: TestChannel[] = []
  port1 = {
    onmessage: null as ((event: { data: unknown }) => void) | null,
    close: vi.fn(),
  }
  port2 = { close: vi.fn() }
  constructor() {
    TestChannel.opened.push(this)
  }
  reply(data: unknown) {
    this.port1.onmessage?.({ data })
  }
}

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('offline preparation page lifecycle', () => {
  let destroy: (() => void) | undefined
  const postMessage = vi.fn()
  const register = vi.fn()
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    TestChannel.opened = []
    postMessage.mockReset()
    register.mockReset().mockResolvedValue({})
    vi.stubGlobal('MessageChannel', TestChannel)
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register,
        ready: Promise.resolve({ active: { postMessage } }),
      },
    })
    delete document.documentElement.dataset.offlineReady
  })
  afterEach(() => {
    destroy?.()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it.each(['cache-error', { type: 'cached' }, undefined])(
    'rejects a failed or malformed acknowledgement: %j',
    async (reply) => {
      destroy = startOfflineShell()
      await flush()
      TestChannel.opened[0]!.reply(reply)
      expect(document.documentElement.dataset.offlineReady).toBe('false')
      expect(TestChannel.opened[0]!.port1.close).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('closes ports on suspension, ignores delayed replies and re-arms after BFCache resume', async () => {
    destroy = startOfflineShell()
    await flush()
    const first = TestChannel.opened[0]!
    const staleReply = first.port1.onmessage!
    window.dispatchEvent(new PageTransitionEvent('pagehide'))
    expect(first.port1.close).toHaveBeenCalledOnce()
    expect(first.port2.close).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    staleReply({ data: 'cached' })
    expect(document.documentElement.dataset.offlineReady).toBe('false')
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    )
    await flush()
    TestChannel.opened[1]!.reply('cached')
    expect(document.documentElement.dataset.offlineReady).toBe('true')
    expect(vi.getTimerCount()).toBe(0)
    expect(postMessage).toHaveBeenCalledTimes(2)
  })

  it('does not revive after teardown during a pending registration or later page events', async () => {
    let complete!: () => void
    register.mockReturnValue(
      new Promise<void>((resolve) => {
        complete = resolve
      }),
    )
    destroy = startOfflineShell()
    destroy()
    complete()
    await flush()
    window.dispatchEvent(new Event('load'))
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    )
    window.dispatchEvent(new PageTransitionEvent('pagehide'))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(register).toHaveBeenCalledOnce()
    expect(postMessage).not.toHaveBeenCalled()
    expect(TestChannel.opened).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds a silent worker request and keeps late success from marking readiness', async () => {
    destroy = startOfflineShell()
    await flush()
    const lateReply = TestChannel.opened[0]!.port1.onmessage!
    await vi.advanceTimersByTimeAsync(30_000)
    lateReply({ data: 'cached' })
    expect(document.documentElement.dataset.offlineReady).toBe('false')
    expect(TestChannel.opened[0]!.port1.close).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not start from a load event after the page has been suspended', async () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')
    destroy = startOfflineShell()
    window.dispatchEvent(new PageTransitionEvent('pagehide'))
    window.dispatchEvent(new Event('load'))
    await flush()
    expect(register).not.toHaveBeenCalled()
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    )
    await flush()
    TestChannel.opened[0]!.reply('cached')
    expect(document.documentElement.dataset.offlineReady).toBe('true')
  })

  it('activates waiting worker and reloads on controllerchange when safe', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload, hash: '' })
    const waitingWorker = { postMessage: vi.fn() }
    const swListeners = new Map<string, (event?: unknown) => void>()
    const regListeners = new Map<string, (event?: unknown) => void>()
    const registration = {
      waiting: waitingWorker,
      update: vi.fn().mockResolvedValue(undefined),
      addEventListener: (type: string, fn: (event?: unknown) => void) =>
        regListeners.set(type, fn),
    }
    register.mockResolvedValue(registration)
    vi.stubGlobal('navigator', {
      standalone: true,
      serviceWorker: {
        register,
        ready: Promise.resolve({ active: { postMessage } }),
        controller: {},
        addEventListener: (type: string, fn: (event?: unknown) => void) =>
          swListeners.set(type, fn),
      },
    })

    destroy = startOfflineShell()
    await flush()

    // When backgrounded (visibility hidden), waiting worker is notified to SKIP_WAITING
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
    })

    // Controller change fires in background
    swListeners.get('controllerchange')!()
    expect(reload).not.toHaveBeenCalled()

    // When resumed (visibility visible), page reloads into new build
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('defers reload when form fields contain unsaved user input and reloads after safe navigation', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload, hash: '' })
    const swListeners = new Map<string, (event?: unknown) => void>()
    const registration = {
      update: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    }
    register.mockResolvedValue(registration)
    vi.stubGlobal('navigator', {
      standalone: true,
      serviceWorker: {
        register,
        ready: Promise.resolve({ active: { postMessage } }),
        controller: {},
        addEventListener: (type: string, fn: (event?: unknown) => void) =>
          swListeners.set(type, fn),
      },
    })

    // User has typed an unsaved draft
    const input = document.createElement('input')
    input.value = 'draft text'
    document.body.appendChild(input)

    destroy = startOfflineShell()
    await flush()

    // Controller change fires while dirty
    swListeners.get('controllerchange')!()
    expect(reload).not.toHaveBeenCalled()

    // User clears the draft
    input.value = ''
    window.dispatchEvent(new Event('hashchange'))
    // Route/hash changes do not trigger hard reloads
    expect(reload).not.toHaveBeenCalled()

    // Resuming the app when clean safely reloads
    document.dispatchEvent(new Event('visibilitychange'))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('ignores initial controllerchange when launching without an active controller', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload, hash: '' })
    const swListeners = new Map<string, (event?: unknown) => void>()
    const registration = {
      update: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    }
    register.mockResolvedValue(registration)
    vi.stubGlobal('navigator', {
      standalone: true,
      serviceWorker: {
        register,
        ready: Promise.resolve({ active: { postMessage } }),
        controller: null, // Initial launch: no controller yet
        addEventListener: (type: string, fn: (event?: unknown) => void) =>
          swListeners.set(type, fn),
      },
    })

    destroy = startOfflineShell()
    await flush()

    // First controllerchange is the initial worker claiming uncontrolled client
    swListeners.get('controllerchange')!()
    expect(reload).not.toHaveBeenCalled()

    // Subsequent controllerchange represents a real update and reloads
    swListeners.get('controllerchange')!()
    expect(reload).toHaveBeenCalledOnce()
  })
})

describe('triggerManualUpdate', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('posts SKIP_WAITING to waiting worker if available and reloads', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    const waitingWorker = { postMessage: vi.fn() }
    const getRegistration = vi.fn().mockResolvedValue({
      waiting: waitingWorker,
      update: vi.fn(),
    })
    const addEventListener = vi.fn((event: string, cb: () => void) => {
      if (event === 'controllerchange') cb()
    })
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration, addEventListener },
    })

    const { triggerManualUpdate } = await import('./offline-shell')
    await triggerManualUpdate()
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
    })
    expect(reload).toHaveBeenCalledOnce()
  })

  it('awaits installing worker transitioning to installed, posts SKIP_WAITING and reloads', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    const installingWorker = {
      state: 'installing',
      postMessage: vi.fn(),
      addEventListener: vi.fn((event: string, cb: () => void) => {
        if (event === 'statechange') {
          installingWorker.state = 'installed'
          cb()
        }
      }),
    }
    const update = vi.fn().mockResolvedValue(undefined)
    const getRegistration = vi.fn().mockResolvedValue({
      waiting: null,
      installing: installingWorker,
      update,
    })
    const addEventListener = vi.fn((event: string, cb: () => void) => {
      if (event === 'controllerchange') cb()
    })
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration, addEventListener },
    })

    const { triggerManualUpdate } = await import('./offline-shell')
    await triggerManualUpdate()
    expect(installingWorker.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
    })
    expect(reload).toHaveBeenCalledOnce()
  })

  it('does not register controllerchange listener before waiting worker is acquired', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    let controllerChangeRegistered = false
    let resolveStateChange: (() => void) | undefined
    const installingWorker = {
      state: 'installing',
      postMessage: vi.fn(),
      addEventListener: vi.fn((event: string, cb: () => void) => {
        if (event === 'statechange') {
          resolveStateChange = () => {
            installingWorker.state = 'installed'
            cb()
          }
        }
      }),
    }
    const update = vi.fn().mockResolvedValue(undefined)
    const getRegistration = vi.fn().mockResolvedValue({
      waiting: null,
      installing: installingWorker,
      update,
    })
    const addEventListener = vi.fn((event: string, cb: () => void) => {
      if (event === 'controllerchange') {
        controllerChangeRegistered = true
        cb()
      }
    })
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration, addEventListener },
    })

    const { triggerManualUpdate } = await import('./offline-shell')
    const updatePromise = triggerManualUpdate()
    await Promise.resolve()

    // While installing, controllerchange must NOT be registered yet
    expect(controllerChangeRegistered).toBe(false)
    expect(installingWorker.postMessage).not.toHaveBeenCalled()

    // Transition to installed
    resolveStateChange?.()
    await updatePromise

    expect(controllerChangeRegistered).toBe(true)
    expect(installingWorker.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
    })
    expect(reload).toHaveBeenCalledOnce()
  })

  it('calls update() on registration when waiting is not yet present and reloads', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    const update = vi.fn().mockResolvedValue(undefined)
    const getRegistration = vi.fn().mockResolvedValue({
      waiting: null,
      update,
    })
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration },
    })

    const { triggerManualUpdate } = await import('./offline-shell')
    await triggerManualUpdate()
    expect(update).toHaveBeenCalledOnce()
    expect(reload).toHaveBeenCalledOnce()
  })
})
