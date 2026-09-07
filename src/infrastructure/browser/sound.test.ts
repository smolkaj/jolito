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
    createOscillator: ReturnType<typeof vi.fn>
    createGain: ReturnType<typeof vi.fn>
    resume: ReturnType<typeof vi.fn>
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
      resume: vi.fn().mockResolvedValue(undefined),
    }

    class MockAudioContextClass {
      get state() {
        return mockAudioContext.state
      }
      get currentTime() {
        return mockAudioContext.currentTime
      }
      destination = mockAudioContext.destination
      createOscillator = mockAudioContext.createOscillator
      createGain = mockAudioContext.createGain
      resume = mockAudioContext.resume
    }

    window.AudioContext =
      MockAudioContextClass as unknown as typeof AudioContext
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('plays all earcons cleanly when context is running', () => {
    const player = new WebAudioSoundPlayer()

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
    const player = new WebAudioSoundPlayer()

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

    new WebAudioSoundPlayer()

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
    const player = new WebAudioSoundPlayer()
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
    const player = new WebAudioSoundPlayer()
    expect(() => player.play('reveal')).not.toThrow()
  })
})
