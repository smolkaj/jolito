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
})
