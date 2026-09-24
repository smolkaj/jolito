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
      const expectedVoiceHint = expectedGender === 'male' ? 'Jorge' : 'Paulina'
      expect(mockPlugin.speak).toHaveBeenCalledWith(
        expect.objectContaining({
          gender: expectedGender,
          voice: expectedVoiceHint,
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

  it('assigns English natural voice hints for English speech when seeded', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)

    const speaker = new NativeSpeaker(
      mockFallback as unknown as Speaker,
      mockPlugin as unknown as NativeSpeechPluginInterface,
    )

    // Find seeds that yield male and female
    let maleSeed = ''
    let femaleSeed = ''
    for (let i = 0; i < 20; i++) {
      const s = `seed-${i}`
      if (hashString(s) % 2 === 0 && !femaleSeed) femaleSeed = s
      if (hashString(s) % 2 !== 0 && !maleSeed) maleSeed = s
      if (maleSeed && femaleSeed) break
    }

    speaker.speak('hello', 'en-US', { cardSeed: maleSeed })
    expect(mockPlugin.speak).toHaveBeenCalledWith(
      expect.objectContaining({
        gender: 'male',
        voice: 'Alex',
      }),
    )

    speaker.stop()
    speaker.speak('hello', 'en-US', { cardSeed: femaleSeed })
    expect(mockPlugin.speak).toHaveBeenCalledWith(
      expect.objectContaining({
        gender: 'female',
        voice: 'Samantha',
      }),
    )
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

  describe('iOS native voice resolution invariants', () => {
    // Exact simulation of NativeSpeechPlugin.swift selectVoice algorithm
    interface MockAVVoice {
      identifier: string
      name: string
      language: string
      quality: 'default' | 'enhanced' | 'premium'
      gender: 'male' | 'female' | 'unspecified'
    }

    const mockIosVoices: MockAVVoice[] = [
      // Mexican Spanish default voices
      {
        identifier: 'com.apple.voice.compact.es-MX.Paulina',
        name: 'Paulina',
        language: 'es-MX',
        quality: 'default',
        gender: 'female',
      },
      // iOS 16+ Eloquence screen-reader synthesizers registered under es-MX
      {
        identifier: 'com.apple.eloquence.es-MX.Eddy',
        name: 'Eddy',
        language: 'es-MX',
        quality: 'default',
        gender: 'male',
      },
      {
        identifier: 'com.apple.eloquence.es-MX.Floyd',
        name: 'Floyd',
        language: 'es-MX',
        quality: 'default',
        gender: 'male',
      },
      {
        identifier: 'com.apple.eloquence.es-MX.Grandpa',
        name: 'Grandpa',
        language: 'es-MX',
        quality: 'default',
        gender: 'male',
      },
      {
        identifier: 'com.apple.eloquence.es-MX.Reed',
        name: 'Reed',
        language: 'es-MX',
        quality: 'default',
        gender: 'male',
      },
      {
        identifier: 'com.apple.eloquence.es-MX.Rocko',
        name: 'Rocko',
        language: 'es-MX',
        quality: 'default',
        gender: 'male',
      },
      {
        identifier: 'com.apple.eloquence.es-MX.Grandma',
        name: 'Grandma',
        language: 'es-MX',
        quality: 'default',
        gender: 'female',
      },
      {
        identifier: 'com.apple.eloquence.es-MX.Sandy',
        name: 'Sandy',
        language: 'es-MX',
        quality: 'default',
        gender: 'female',
      },
      {
        identifier: 'com.apple.eloquence.es-MX.Shelley',
        name: 'Shelley',
        language: 'es-MX',
        quality: 'default',
        gender: 'female',
      },
      // Spanish regional natural voices
      {
        identifier: 'com.apple.voice.compact.es-ES.Jorge',
        name: 'Jorge',
        language: 'es-ES',
        quality: 'default',
        gender: 'male',
      },
      {
        identifier: 'com.apple.voice.compact.es-ES.Monica',
        name: 'Mónica',
        language: 'es-ES',
        quality: 'default',
        gender: 'female',
      },
      {
        identifier: 'com.apple.voice.compact.es-CO.Carlos',
        name: 'Carlos',
        language: 'es-CO',
        quality: 'default',
        gender: 'male',
      },
      {
        identifier: 'com.apple.voice.compact.es-CO.Soledad',
        name: 'Soledad',
        language: 'es-CO',
        quality: 'default',
        gender: 'female',
      },
      {
        identifier: 'com.apple.voice.compact.es-AR.Diego',
        name: 'Diego',
        language: 'es-AR',
        quality: 'default',
        gender: 'male',
      },
      // English voices & novelty synthesizers
      {
        identifier: 'com.apple.voice.compact.en-US.Samantha',
        name: 'Samantha',
        language: 'en-US',
        quality: 'default',
        gender: 'female',
      },
      {
        identifier: 'com.apple.voice.compact.en-US.Alex',
        name: 'Alex',
        language: 'en-US',
        quality: 'default',
        gender: 'male',
      },
      {
        identifier: 'com.apple.speech.synthesis.voice.Fred',
        name: 'Fred',
        language: 'en-US',
        quality: 'default',
        gender: 'male',
      },
      {
        identifier: 'com.apple.speech.synthesis.voice.Zarvox',
        name: 'Zarvox',
        language: 'en-US',
        quality: 'default',
        gender: 'male',
      },
    ]

    function isRobotic(voice: MockAVVoice): boolean {
      const id = voice.identifier.toLowerCase()
      if (id.includes('eloquence') || id.includes('speech.synthesis.voice'))
        return true
      const name = voice.name.toLowerCase()
      const roboticNames = new Set([
        'eddy',
        'floyd',
        'grandpa',
        'grandma',
        'reed',
        'rocko',
        'sandy',
        'shelley',
        'fred',
        'zarvox',
      ])
      return roboticNames.has(name)
    }

    function selectVoice(
      allVoices: MockAVVoice[],
      locale: string,
      preferredGender?: 'male' | 'female',
      preferredVoice?: string,
    ): MockAVVoice | undefined {
      const natural = allVoices.filter((v) => !isRobotic(v))
      const candidates = natural.length > 0 ? natural : allVoices

      if (preferredVoice) {
        const exactId = candidates.find((v) => v.identifier === preferredVoice)
        if (exactId) return exactId
        const exactName = candidates.find(
          (v) => v.name.toLowerCase() === preferredVoice.toLowerCase(),
        )
        if (exactName) return exactName

        const lower = preferredVoice.toLowerCase()
        if (lower.includes('jorge')) {
          const match = candidates.find(
            (v) =>
              v.name.toLowerCase().includes('jorge') &&
              v.language.toLowerCase().startsWith('es'),
          )
          if (match) return match
        } else if (lower.includes('dalia') || lower.includes('paulina')) {
          const match = candidates.find(
            (v) =>
              v.name.toLowerCase().includes('paulina') &&
              v.language.toLowerCase().startsWith('es'),
          )
          if (match) return match
        } else if (lower.includes('jenny') || lower.includes('samantha')) {
          const match = candidates.find(
            (v) =>
              v.name.toLowerCase().includes('samantha') &&
              v.language.toLowerCase().startsWith('en'),
          )
          if (match) return match
        } else if (lower.includes('guy') || lower.includes('alex')) {
          const match = candidates.find(
            (v) =>
              v.name.toLowerCase().includes('alex') &&
              v.language.toLowerCase().startsWith('en'),
          )
          if (match) return match
        }
      }

      const norm = locale.replace(/_/g, '-').toLowerCase()
      const langPrefix = norm.slice(0, 2)
      const localeMatches = candidates.filter(
        (v) => v.language.replace(/_/g, '-').toLowerCase() === norm,
      )
      const langMatches = candidates.filter((v) =>
        v.language.replace(/_/g, '-').toLowerCase().startsWith(langPrefix),
      )

      let pool: MockAVVoice[]
      if (preferredGender) {
        const localGender = localeMatches.filter(
          (v) => v.gender === preferredGender,
        )
        if (localGender.length > 0) {
          pool = localGender
        } else {
          const broadGender = langMatches.filter(
            (v) => v.gender === preferredGender,
          )
          pool =
            broadGender.length > 0
              ? broadGender
              : localeMatches.length > 0
                ? localeMatches
                : langMatches
        }
      } else {
        pool = localeMatches.length > 0 ? localeMatches : langMatches
      }

      const premium = pool.find((v) => v.quality === 'premium')
      if (premium) return premium
      const enhanced = pool.find((v) => v.quality === 'enhanced')
      if (enhanced) return enhanced

      if (langPrefix === 'es') {
        const preferred =
          preferredGender === 'male'
            ? ['jorge', 'carlos', 'diego']
            : ['paulina', 'mónica', 'soledad']
        for (const name of preferred) {
          const match = pool.find((v) => v.name.toLowerCase().includes(name))
          if (match) return match
        }
      } else if (langPrefix === 'en') {
        const preferred = preferredGender === 'male' ? ['alex'] : ['samantha']
        for (const name of preferred) {
          const match = pool.find((v) => v.name.toLowerCase().includes(name))
          if (match) return match
        }
      }

      return pool[0]
    }

    it('resolves Jorge (es-ES) for Mexican Spanish male speech and NEVER Eddy/Eloquence', () => {
      const selected = selectVoice(mockIosVoices, 'es-MX', 'male')
      expect(selected?.name).toBe('Jorge')
      expect(selected?.language).toBe('es-ES')
      expect(isRobotic(selected!)).toBe(false)
    })

    it('resolves Paulina for Mexican Spanish female speech and NEVER Grandma/Sandy/Eloquence', () => {
      const selected = selectVoice(mockIosVoices, 'es-MX', 'female')
      expect(selected?.name).toBe('Paulina')
      expect(selected?.language).toBe('es-MX')
      expect(isRobotic(selected!)).toBe(false)
    })

    it('resolves Jorge when given neural persona es-MX-JorgeNeural', () => {
      const selected = selectVoice(
        mockIosVoices,
        'es-MX',
        'male',
        'es-MX-JorgeNeural',
      )
      expect(selected?.name).toBe('Jorge')
      expect(isRobotic(selected!)).toBe(false)
    })

    it('resolves Paulina when given neural persona es-MX-DaliaNeural', () => {
      const selected = selectVoice(
        mockIosVoices,
        'es-MX',
        'female',
        'es-MX-DaliaNeural',
      )
      expect(selected?.name).toBe('Paulina')
      expect(isRobotic(selected!)).toBe(false)
    })

    it('resolves Alex for English male speech and NEVER Fred or Zarvox', () => {
      const selected = selectVoice(mockIosVoices, 'en-US', 'male')
      expect(selected?.name).toBe('Alex')
      expect(isRobotic(selected!)).toBe(false)
    })

    it('resolves Samantha for English female speech', () => {
      const selected = selectVoice(mockIosVoices, 'en-US', 'female')
      expect(selected?.name).toBe('Samantha')
      expect(isRobotic(selected!)).toBe(false)
    })

    it('prioritizes enhanced voice when available in user iOS voice inventory', () => {
      const voicesWithEnhanced: MockAVVoice[] = [
        ...mockIosVoices,
        {
          identifier: 'com.apple.voice.enhanced.es-MX.Paulina',
          name: 'Paulina',
          language: 'es-MX',
          quality: 'enhanced',
          gender: 'female',
        },
      ]
      const selected = selectVoice(voicesWithEnhanced, 'es-MX', 'female')
      expect(selected?.quality).toBe('enhanced')
      expect(selected?.name).toBe('Paulina')
    })
  })
})
