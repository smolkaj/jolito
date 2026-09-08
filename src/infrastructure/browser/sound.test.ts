import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureAudioSessionCategory, WebAudioSoundPlayer } from './sound'

describe('configureAudioSessionCategory', () => {
  it('sets navigator.audioSession.type when audioSession API is supported', () => {
    const originalNavigator = globalThis.navigator
    const mockAudioSession = { type: 'auto' }
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, audioSession: mockAudioSession },
      configurable: true,
      writable: true,
    })

    configureAudioSessionCategory('ambient')
    expect(mockAudioSession.type).toBe('ambient')

    configureAudioSessionCategory('playback')
    expect(mockAudioSession.type).toBe('playback')

    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    })
  })

  it('silently ignores environments without navigator.audioSession', () => {
    expect(() => configureAudioSessionCategory('ambient')).not.toThrow()
  })
})

describe('WebAudioSoundPlayer', () => {
  let mockOscillator: {
    type: OscillatorType
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> }
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    connect: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    onended: (() => void) | null
  }
  let mockGain: {
    gain: {
      setValueAtTime: ReturnType<typeof vi.fn>
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
    }
    connect: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
  }
  let mockAudioContext: {
    state: AudioContextState
    currentTime: number
    destination: Record<string, unknown>
    createOscillator: ReturnType<typeof vi.fn<() => OscillatorNode>>
    createGain: ReturnType<typeof vi.fn<() => GainNode>>
    resume: ReturnType<typeof vi.fn<() => Promise<void>>>
    suspend: ReturnType<typeof vi.fn<() => Promise<void>>>
  }

  beforeEach(() => {
    mockOscillator = {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      start: vi.fn(),
      stop: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
    }

    mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }

    mockAudioContext = {
      state: 'running',
      currentTime: 1.0,
      destination: {},
      createOscillator: vi.fn(
        () => mockOscillator as unknown as OscillatorNode,
      ),
      createGain: vi.fn(() => mockGain as unknown as GainNode),
      resume: vi.fn().mockImplementation(() => {
        mockAudioContext.state = 'running'
        return Promise.resolve()
      }),
      suspend: vi.fn().mockImplementation(() => {
        mockAudioContext.state = 'suspended'
        return Promise.resolve()
      }),
    }

    class MockAudioContextClass {
      get state() {
        return mockAudioContext.state
      }
      get currentTime() {
        return mockAudioContext.currentTime
      }
      destination = mockAudioContext.destination
      createOscillator = () => mockAudioContext.createOscillator()
      createGain = () => mockAudioContext.createGain()
      resume = () => mockAudioContext.resume()
      suspend = () => mockAudioContext.suspend()
    }

    window.AudioContext =
      MockAudioContextClass as unknown as typeof AudioContext
  })

  let activePlayers: WebAudioSoundPlayer[] = []

  function createPlayer(
    options?: ConstructorParameters<typeof WebAudioSoundPlayer>[0],
  ) {
    const player = new WebAudioSoundPlayer(options)
    activePlayers.push(player)
    return player
  }

  afterEach(() => {
    for (const player of activePlayers) {
      player.destroy()
    }
    activePlayers = []
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('plays all earcons cleanly when context is running', () => {
    const player = createPlayer()

    player.play('reveal')
    expect(mockAudioContext.createOscillator).toHaveBeenCalled()
    expect(mockOscillator.start).toHaveBeenCalled()

    vi.clearAllMocks()
    player.play('again')
    expect(mockOscillator.type).toBe('triangle')

    vi.clearAllMocks()
    player.play('hard')
    expect(mockOscillator.type).toBe('triangle')

    vi.clearAllMocks()
    player.play('good')
    expect(mockOscillator.type).toBe('sine')

    vi.clearAllMocks()
    player.play('easy')
    expect(mockOscillator.type).toBe('sine')

    vi.clearAllMocks()
    player.play('complete')
    expect(mockOscillator.type).toBe('sine')
  })

  it('resumes and delays dispatch if context is suspended', async () => {
    mockAudioContext.state = 'suspended'
    const player = createPlayer()

    player.play('good')

    expect(mockAudioContext.resume).toHaveBeenCalled()
    // Oscillators not created synchronously while suspended
    expect(mockAudioContext.createOscillator).not.toHaveBeenCalled()

    mockAudioContext.state = 'running'
    // Await promise microtasks
    await Promise.resolve()

    expect(mockAudioContext.createOscillator).toHaveBeenCalled()
    expect(mockOscillator.start).toHaveBeenCalled()
  })

  it('unhooks gesture listeners on first interaction', () => {
    const addListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener')

    createPlayer()

    expect(addListenerSpy).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function),
      { passive: true, once: true },
    )

    // Simulate pointerdown
    window.dispatchEvent(new Event('pointerdown'))

    expect(removeListenerSpy).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function),
    )
    expect(removeListenerSpy).toHaveBeenCalledWith(
      'touchstart',
      expect.any(Function),
    )
    expect(removeListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function),
    )
  })

  it('disconnects oscillator and gain nodes on ended', () => {
    const player = createPlayer()
    player.play('reveal')

    expect(mockOscillator.onended).toBeDefined()
    mockOscillator.onended!()

    expect(mockOscillator.disconnect).toHaveBeenCalled()
    expect(mockGain.disconnect).toHaveBeenCalled()
  })

  it('fails silently when audio subsystem throws', () => {
    mockAudioContext.createOscillator.mockImplementation(() => {
      throw new Error('AudioHardwareException')
    })
    const player = createPlayer()
    expect(() => player.play('reveal')).not.toThrow()
  })

  it('suspends audio context after idle delay when tone ends', () => {
    vi.useFakeTimers()
    const player = createPlayer({ idleDelayMs: 2000 })
    player.play('reveal')

    expect(mockOscillator.onended).toBeDefined()
    // Tone 1 ends
    mockOscillator.onended!()
    // Tone 2 ends
    mockOscillator.onended!()

    expect(mockAudioContext.suspend).not.toHaveBeenCalled()

    // Advance halfway through idle delay
    vi.advanceTimersByTime(1000)
    expect(mockAudioContext.suspend).not.toHaveBeenCalled()

    // Advance past idle delay
    vi.advanceTimersByTime(1000)
    expect(mockAudioContext.suspend).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('resets idle timer if another earcon is played before idle delay', () => {
    vi.useFakeTimers()
    const player = createPlayer({ idleDelayMs: 2000 })
    player.play('again')
    mockOscillator.onended!()

    vi.advanceTimersByTime(1500)
    expect(mockAudioContext.suspend).not.toHaveBeenCalled()

    // Play another earcon
    player.play('good')
    // Reset timer
    mockOscillator.onended!()
    mockOscillator.onended!()

    vi.advanceTimersByTime(1500)
    expect(mockAudioContext.suspend).not.toHaveBeenCalled()

    vi.advanceTimersByTime(500)
    expect(mockAudioContext.suspend).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('immediately suspends audio context on visibilitychange when hidden', () => {
    const player = createPlayer()
    player.play('reveal')

    expect(mockAudioContext.suspend).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(mockAudioContext.suspend).toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
  })

  it('immediately suspends audio context on pagehide event', () => {
    const player = createPlayer()
    player.play('reveal')

    expect(mockAudioContext.suspend).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('pagehide'))

    expect(mockAudioContext.suspend).toHaveBeenCalled()
  })

  it('schedules idle suspend after initial gesture unlock', async () => {
    vi.useFakeTimers()
    mockAudioContext.state = 'suspended'
    createPlayer({ idleDelayMs: 1500 })

    window.dispatchEvent(new Event('pointerdown'))
    expect(mockAudioContext.resume).toHaveBeenCalled()

    // Flush resume promise microtasks so scheduleIdleSuspend is called
    await Promise.resolve()

    vi.advanceTimersByTime(1500)
    expect(mockAudioContext.suspend).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('cleans up lifecycle listeners, pending timer, and suspends on destroy', () => {
    vi.useFakeTimers()
    const player = createPlayer({ idleDelayMs: 2000 })
    player.play('again')
    mockOscillator.onended!()

    player.destroy()
    expect(mockAudioContext.suspend).toHaveBeenCalled()

    // Advance timers to verify no duplicate suspend
    vi.advanceTimersByTime(3000)
    expect(mockAudioContext.suspend).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('re-arms unlock listeners after suspension so subsequent gestures wake the audio context', async () => {
    const player = createPlayer()

    // 1. Initial gesture unlocks and removes initial listeners
    window.dispatchEvent(new Event('pointerdown'))

    // 2. Suspend player (e.g. from idle timeout or background)
    await player.suspend()
    expect(mockAudioContext.state).toBe('suspended')

    // 3. Next gesture should wake context back up
    mockAudioContext.resume.mockClear()
    window.dispatchEvent(new Event('pointerdown'))
    expect(mockAudioContext.resume).toHaveBeenCalledTimes(1)
  })

  it('re-arms unlock listeners and cancels idle suspend on orientationchange and visibility visible', () => {
    vi.useFakeTimers()
    const player = createPlayer({ idleDelayMs: 2000 })
    player.play('reveal')
    mockOscillator.onended!()

    // Simulate screen rotation: orientationchange occurs
    window.dispatchEvent(new Event('orientationchange'))

    // Advance halfway through idle delay
    vi.advanceTimersByTime(1000)
    expect(mockAudioContext.suspend).not.toHaveBeenCalled()

    // Simulate visibility change to visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    player.destroy()
    vi.useRealTimers()
  })
})
