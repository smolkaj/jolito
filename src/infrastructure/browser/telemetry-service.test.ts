import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientTelemetryService } from './telemetry-service'

class MockStorage implements Storage {
  private store: Record<string, string> = {}
  get length() {
    return Object.keys(this.store).length
  }
  clear(): void {
    this.store = {}
  }
  getItem(key: string): string | null {
    return this.store[key] ?? null
  }
  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null
  }
  removeItem(key: string): void {
    delete this.store[key]
  }
  setItem(key: string, value: string): void {
    this.store[key] = value
  }
}

describe('ClientTelemetryService', () => {
  let storage: MockStorage
  let capturedRequests: Array<{ url: string; body: Record<string, unknown> }>
  let mockFetch: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>
  let mockDate: Date

  beforeEach(() => {
    storage = new MockStorage()
    capturedRequests = []
    mockDate = new Date('2026-09-22T12:00:00Z')
    mockFetch = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        capturedRequests.push({
          url,
          body: JSON.parse((init?.body as string) || '{}') as Record<
            string,
            unknown
          >,
        })
        return Promise.resolve(new Response(null, { status: 200 }))
      })
  })

  it('skips completely if doNotTrack is active', () => {
    const service = new ClientTelemetryService({
      storage,
      fetchFn: mockFetch,
      doNotTrack: true,
      nowFn: () => mockDate,
    })

    service.recordUserInteraction()
    service.recordReview()

    expect(capturedRequests).toHaveLength(0)
    expect(storage.getItem('jolito:telemetry:v1')).toBeNull()
  })

  it('does not send a ping when the document is hidden/backgrounded', () => {
    const service = new ClientTelemetryService({
      storage,
      fetchFn: mockFetch,
      doNotTrack: false,
      nowFn: () => mockDate,
      visibilityFn: () => 'hidden',
    })

    service.recordUserInteraction()
    expect(capturedRequests).toHaveLength(0)
  })

  it('sends casual ping on first user interaction in foreground', () => {
    const service = new ClientTelemetryService({
      storage,
      fetchFn: mockFetch,
      doNotTrack: false,
      nowFn: () => mockDate,
      visibilityFn: () => 'visible',
    })

    service.recordUserInteraction()

    expect(capturedRequests).toHaveLength(1)
    expect(capturedRequests[0]?.body.engagementTier).toBe('casual')
    expect(capturedRequests[0]?.body.deviceId).toBeDefined()

    // Second interaction on same day does not duplicate
    service.recordUserInteraction()
    expect(capturedRequests).toHaveLength(1)
  })

  it('upgrades engagement to active at 5 reviews, and deep at 20 reviews', () => {
    const service = new ClientTelemetryService({
      storage,
      fetchFn: mockFetch,
      doNotTrack: false,
      nowFn: () => mockDate,
      visibilityFn: () => 'visible',
    })

    // User opens and interacts -> casual ping
    service.recordUserInteraction()
    expect(capturedRequests).toHaveLength(1)
    expect(capturedRequests[0]?.body.engagementTier).toBe('casual')

    // Reviews 1 to 4 -> no upgrade yet
    for (let i = 1; i <= 4; i++) {
      service.recordReview()
    }
    expect(capturedRequests).toHaveLength(1)

    // 5th review -> upgrades to active
    service.recordReview()
    expect(capturedRequests).toHaveLength(2)
    expect(capturedRequests[1]?.body.engagementTier).toBe('active')

    // Reviews 6 to 19 -> no new ping
    for (let i = 6; i <= 19; i++) {
      service.recordReview()
    }
    expect(capturedRequests).toHaveLength(2)

    // 20th review -> upgrades to deep
    service.recordReview()
    expect(capturedRequests).toHaveLength(3)
    expect(capturedRequests[2]?.body.engagementTier).toBe('deep')

    // 21st review onwards -> no new ping
    service.recordReview()
    expect(capturedRequests).toHaveLength(3)
  })

  it('cleans up event listeners on teardown', () => {
    const listeners: Record<string, EventListener> = {}
    const addListenerSpy = vi.fn((event: string, fn: EventListener) => {
      listeners[event] = fn
    })
    const removeListenerSpy = vi.fn((event: string) => {
      delete listeners[event]
    })
    const mockWindow = {
      addEventListener: addListenerSpy,
      removeEventListener: removeListenerSpy,
    } as unknown as Window

    const service = new ClientTelemetryService({
      storage,
      fetchFn: mockFetch,
      windowObj: mockWindow,
      doNotTrack: false,
    })

    service.init()
    expect(addListenerSpy).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function),
      { passive: true },
    )
    expect(addListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function),
      {
        passive: true,
      },
    )

    service.teardown()
    expect(removeListenerSpy).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function),
    )
    expect(removeListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function),
    )
  })

  it('dispatches casual ping when study review begins directly without prior interaction', () => {
    const service = new ClientTelemetryService({
      storage,
      fetchFn: mockFetch,
      doNotTrack: false,
      nowFn: () => mockDate,
      visibilityFn: () => 'visible',
    })

    // First review of day directly without prior click/keydown
    service.recordReview()
    expect(capturedRequests).toHaveLength(1)
    expect(capturedRequests[0]?.body.engagementTier).toBe('casual')
  })

  it('automatically unregisters window interaction listeners once first interaction occurs', () => {
    const removeListenerSpy = vi.fn()
    const mockWindow = {
      addEventListener: vi.fn(),
      removeEventListener: removeListenerSpy,
    } as unknown as Window

    const service = new ClientTelemetryService({
      storage,
      fetchFn: mockFetch,
      windowObj: mockWindow,
      doNotTrack: false,
      nowFn: () => mockDate,
      visibilityFn: () => 'visible',
    })

    service.init()
    service.recordUserInteraction()

    expect(removeListenerSpy).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function),
    )
    expect(removeListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function),
    )
  })

  it('does not register window interaction listeners if today is already recorded', () => {
    const addListenerSpy = vi.fn()
    const mockWindow = {
      addEventListener: addListenerSpy,
      removeEventListener: vi.fn(),
    } as unknown as Window

    storage.setItem(
      'jolito:telemetry:v1',
      JSON.stringify({ date: '2026-09-22', tier: 'casual', reviews: 2 }),
    )

    const service = new ClientTelemetryService({
      storage,
      fetchFn: mockFetch,
      windowObj: mockWindow,
      doNotTrack: false,
      nowFn: () => mockDate,
      visibilityFn: () => 'visible',
    })

    service.init()
    expect(addListenerSpy).not.toHaveBeenCalled()
  })
})
