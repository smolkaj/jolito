import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Capacitor } from '@capacitor/core'
import type { Speaker } from '../../application/ports'
import { hashString } from '../tts/voices'
import {
  NativeSpeaker,
  type NativeSpeechPluginInterface,
} from './native-speech'

describe('NativeSpeaker', () => {
  let mockFallback: {
    speak: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    supported: ReturnType<typeof vi.fn>
  }
  let mockPlugin: {
    isAvailable: ReturnType<typeof vi.fn>
    speak: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    getVoices: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockFallback = {
      speak: vi.fn().mockReturnValue(true),
      stop: vi.fn(),
      supported: vi.fn().mockReturnValue(true),
    }
    mockPlugin = {
      isAvailable: vi.fn().mockResolvedValue({ available: true }),
      speak: vi.fn().mockResolvedValue({ completed: true, interrupted: false }),
      stop: vi.fn().mockResolvedValue({ stopped: true }),
      getVoices: vi.fn().mockResolvedValue({ voices: [] }),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('delegates to fallback when not running on native platform', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
    const speaker = new NativeSpeaker(
      mockFallback as unknown as Speaker,
      mockPlugin as unknown as NativeSpeechPluginInterface,
    )

    expect(speaker.supported()).toBe(true)
    expect(mockFallback.supported).toHaveBeenCalled()

    const onEnded = vi.fn()
    const result = speaker.speak('hola', 'es-MX', { onEnded })
    expect(result).toBe(true)
    expect(mockFallback.speak).toHaveBeenCalledWith('hola', 'es-MX', {
      onEnded,
    })

    speaker.stop()
    expect(mockFallback.stop).toHaveBeenCalled()
  })

  it('calls NativeSpeech plugin when running on native platform', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)

    const speaker = new NativeSpeaker(
      mockFallback as unknown as Speaker,
      mockPlugin as unknown as NativeSpeechPluginInterface,
    )
    expect(speaker.supported()).toBe(true)

    const onEnded = vi.fn()
    const result = speaker.speak('hola', 'es-MX', {
      voice: 'Paulina',
      onEnded,
    })

    expect(result).toBe(true)
    expect(mockPlugin.speak).toHaveBeenCalledWith({
      text: 'hola',
      locale: 'es-MX',
      gender: 'female',
      voice: 'Paulina',
    })

    // Wait for promise resolution
    await Promise.resolve()
    expect(onEnded).toHaveBeenCalledTimes(1)

    speaker.stop()
    expect(mockPlugin.stop).toHaveBeenCalledTimes(1)
  })

  it('infers male gender for Jorge or Guy voice hints', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)

    const speaker = new NativeSpeaker(
      mockFallback as unknown as Speaker,
      mockPlugin as unknown as NativeSpeechPluginInterface,
    )
    speaker.speak('adiós', 'es-MX', { voice: 'Jorge' })

    expect(mockPlugin.speak).toHaveBeenCalledWith({
      text: 'adiós',
      locale: 'es-MX',
      gender: 'male',
      voice: 'Jorge',
    })
  })

  it('falls back to fallback speaker if native speech throws', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)

    mockPlugin.speak.mockRejectedValue(new Error('Audio engine error'))

    const speaker = new NativeSpeaker(
      mockFallback as unknown as Speaker,
      mockPlugin as unknown as NativeSpeechPluginInterface,
    )
    speaker.speak('error test', 'es-MX')

    // Wait for the rejection handling
    await new Promise((r) => setTimeout(r, 10))
    expect(mockFallback.speak).toHaveBeenCalledWith(
      'error test',
      'es-MX',
      undefined,
    )
  })

  it('returns voice list from NativeSpeech.getVoices when available', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)

    const mockVoices = [
      {
        identifier: 'com.apple.speech.synthesis.voice.paulina',
        name: 'Paulina',
        language: 'es-MX',
        quality: 'enhanced',
        gender: 'female',
      },
    ]
    mockPlugin.getVoices.mockResolvedValue({ voices: mockVoices })

    const speaker = new NativeSpeaker(
      mockFallback as unknown as Speaker,
      mockPlugin as unknown as NativeSpeechPluginInterface,
    )
    const voices = await speaker.getVoices()
    expect(voices).toEqual(mockVoices)
  })

  it('returns empty array if getVoices throws or is unavailable', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
    const speaker = new NativeSpeaker(
      mockFallback as unknown as Speaker,
      mockPlugin as unknown as NativeSpeechPluginInterface,
    )
    const voices = await speaker.getVoices()
    expect(voices).toEqual([])
  })

  it('becomes inert after destroy and does not invoke onEnded when in-flight promise settles', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)

    let resolvePromise: (val: {
      completed: boolean
      interrupted: boolean
    }) => void
    const pendingPromise = new Promise<{
      completed: boolean
      interrupted: boolean
    }>((resolve) => {
      resolvePromise = resolve
    })
    mockPlugin.speak.mockReturnValue(pendingPromise)

    const speaker = new NativeSpeaker(
      mockFallback as unknown as Speaker,
      mockPlugin as unknown as NativeSpeechPluginInterface,
    )

    const onEnded = vi.fn()
    speaker.speak('test', 'es-MX', { onEnded })

    speaker.destroy()
    expect(speaker.supported()).toBe(false)
    expect(speaker.speak('test', 'es-MX')).toBe(false)

    // Resolve the in-flight native speech promise after destroy
    resolvePromise!({ completed: true, interrupted: false })
    await pendingPromise
    await Promise.resolve()

    expect(onEnded).not.toHaveBeenCalled()
  })

  it('handles rapid sequential speak calls: call 2 interrupts call 1 without firing call 1 onEnded', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)

    const speaker = new NativeSpeaker(
      mockFallback as unknown as Speaker,
      mockPlugin as unknown as NativeSpeechPluginInterface,
    )

    const onEnded1 = vi.fn()
    const onEnded2 = vi.fn()

    // Call 1 resolves as interrupted
    mockPlugin.speak.mockResolvedValueOnce({
      completed: false,
      interrupted: true,
    })
    speaker.speak('first utterance', 'es-MX', { onEnded: onEnded1 })

    // Call 2 resolves as completed
    mockPlugin.speak.mockResolvedValueOnce({
      completed: true,
      interrupted: false,
    })
    speaker.speak('second utterance', 'es-MX', { onEnded: onEnded2 })

    await Promise.resolve()
    await Promise.resolve()

    expect(onEnded1).not.toHaveBeenCalled()
    expect(onEnded2).toHaveBeenCalledTimes(1)
  })

  it('throttles duplicate rapid speak calls for identical text', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)

    const speaker = new NativeSpeaker(
      mockFallback as unknown as Speaker,
      mockPlugin as unknown as NativeSpeechPluginInterface,
    )

    speaker.speak('perro', 'es-MX')
    speaker.speak('perro', 'es-MX')

    expect(mockPlugin.speak).toHaveBeenCalledTimes(1)
  })

  it('resets duplicate speak throttle when stop() is called', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)

    const speaker = new NativeSpeaker(
      mockFallback as unknown as Speaker,
      mockPlugin as unknown as NativeSpeechPluginInterface,
    )

    speaker.speak('perro', 'es-MX')
    expect(mockPlugin.speak).toHaveBeenCalledTimes(1)

    // Explicit stop resets lastSpeakText
    speaker.stop()

    // Immediate replay of identical text is permitted
    speaker.speak('perro', 'es-MX')
    expect(mockPlugin.speak).toHaveBeenCalledTimes(2)
  })

  it('derives deterministic persona gender matching canonical hashString from cardSeed', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)

    const speaker = new NativeSpeaker(
      mockFallback as unknown as Speaker,
      mockPlugin as unknown as NativeSpeechPluginInterface,
    )

    const testSeeds = ['card-123', 'card-456', 'seed-alpha', 'seed-beta']
    for (const seed of testSeeds) {
      mockPlugin.speak.mockClear()
      speaker.stop()
      speaker.speak('hola', 'es-MX', { cardSeed: seed })
      const expectedGender = hashString(seed) % 2 === 0 ? 'female' : 'male'
      expect(mockPlugin.speak).toHaveBeenCalledWith(
        expect.objectContaining({
          gender: expectedGender,
          voice: undefined,
        }),
      )
    }
  })

  it('maps neural voice hints to persona gender and passes voice hint', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)

    const speaker = new NativeSpeaker(
      mockFallback as unknown as Speaker,
      mockPlugin as unknown as NativeSpeechPluginInterface,
    )

    speaker.speak('hola', 'es-MX', { voice: 'es-MX-JorgeNeural' })
    expect(mockPlugin.speak).toHaveBeenCalledWith({
      text: 'hola',
      locale: 'es-MX',
      gender: 'male',
      voice: 'es-MX-JorgeNeural',
    })

    speaker.stop()
    speaker.speak('hola', 'es-MX', { voice: 'es-MX-DaliaNeural' })
    expect(mockPlugin.speak).toHaveBeenCalledWith({
      text: 'hola',
      locale: 'es-MX',
      gender: 'female',
      voice: 'es-MX-DaliaNeural',
    })
  })

  it('stops playback when document visibility changes to hidden', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)

    const speaker = new NativeSpeaker(
      mockFallback as unknown as Speaker,
      mockPlugin as unknown as NativeSpeechPluginInterface,
    )

    Object.defineProperty(document, 'hidden', {
      value: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(mockPlugin.stop).toHaveBeenCalled()
    speaker.destroy()
  })
})
