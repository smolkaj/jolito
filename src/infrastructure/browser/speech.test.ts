import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EnhancedBrowserSpeaker } from './speech'

describe('EnhancedBrowserSpeaker', () => {
  const originalSpeechSynthesis = window.speechSynthesis
  const originalUtterance = window.SpeechSynthesisUtterance

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      value: originalSpeechSynthesis,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: originalUtterance,
      writable: true,
      configurable: true,
    })
  })

  it('reports unsupported when window.speechSynthesis is missing', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const speaker = new EnhancedBrowserSpeaker()
    expect(speaker.supported()).toBe(false)
    expect(speaker.speak('hola', 'es-MX')).toBe(false)
  })

  it('selects preferred Mexican Spanish voice when available', () => {
    const speakMock = vi.fn()
    const cancelMock = vi.fn()

    const mockVoices: SpeechSynthesisVoice[] = [
      {
        lang: 'es-ES',
        name: 'Monica (Spain)',
        default: false,
        localService: true,
        voiceURI: 'es-ES-monica',
      },
      {
        lang: 'es-MX',
        name: 'Paulina (Natural Mexican Spanish)',
        default: false,
        localService: true,
        voiceURI: 'es-MX-paulina',
      },
      {
        lang: 'en-US',
        name: 'Samantha',
        default: true,
        localService: true,
        voiceURI: 'en-US-samantha',
      },
    ]

    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: speakMock,
        cancel: cancelMock,
        getVoices: () => mockVoices,
        onvoiceschanged: null,
      },
      writable: true,
      configurable: true,
    })

    class MockUtterance {
      static instances: MockUtterance[] = []
      text: string
      lang = ''
      voice: SpeechSynthesisVoice | null = null
      rate = 1
      pitch = 1

      constructor(text: string) {
        this.text = text
        MockUtterance.instances.push(this)
      }
    }

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: MockUtterance,
      writable: true,
      configurable: true,
    })

    const speaker = new EnhancedBrowserSpeaker()
    expect(speaker.supported()).toBe(true)

    const played = speaker.speak('aguacate', 'es-MX')
    expect(played).toBe(true)
    expect(cancelMock).toHaveBeenCalled()
    expect(speakMock).toHaveBeenCalled()

    const created = MockUtterance.instances[MockUtterance.instances.length - 1]
    expect(created?.text).toBe('aguacate')
    expect(created?.lang).toBe('es-MX')
    expect(created?.voice?.name).toBe('Paulina (Natural Mexican Spanish)')
    expect(created?.rate).toBeCloseTo(0.88, 2)
  })

  it('selects preferred US English voice when available', () => {
    const speakMock = vi.fn()
    const cancelMock = vi.fn()

    const mockVoices: SpeechSynthesisVoice[] = [
      {
        lang: 'en-GB',
        name: 'Oliver (UK)',
        default: false,
        localService: true,
        voiceURI: 'en-GB-oliver',
      },
      {
        lang: 'en-US',
        name: 'Samantha (Natural)',
        default: true,
        localService: true,
        voiceURI: 'en-US-samantha',
      },
    ]

    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: speakMock,
        cancel: cancelMock,
        getVoices: () => mockVoices,
        onvoiceschanged: null,
      },
      writable: true,
      configurable: true,
    })

    class MockUtterance {
      static instances: MockUtterance[] = []
      text: string
      lang = ''
      voice: SpeechSynthesisVoice | null = null
      rate = 1
      pitch = 1

      constructor(text: string) {
        this.text = text
        MockUtterance.instances.push(this)
      }
    }

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: MockUtterance,
      writable: true,
      configurable: true,
    })

    const speaker = new EnhancedBrowserSpeaker()
    const played = speaker.speak('avocado', 'en-US')
    expect(played).toBe(true)

    const created = MockUtterance.instances[MockUtterance.instances.length - 1]
    expect(created?.voice?.name).toBe('Samantha (Natural)')
    expect(created?.rate).toBeCloseTo(0.92, 2)
  })

  it('alternates between Spanish and English without leaking voice across languages', () => {
    const speakMock = vi.fn()
    const cancelMock = vi.fn()

    const mockVoices: SpeechSynthesisVoice[] = [
      {
        lang: 'es-MX',
        name: 'Paulina (Mexican Spanish)',
        default: false,
        localService: true,
        voiceURI: 'es-MX-paulina',
      },
      {
        lang: 'en-US',
        name: 'Samantha (US English)',
        default: true,
        localService: true,
        voiceURI: 'en-US-samantha',
      },
    ]

    class MockUtterance {
      static instances: MockUtterance[] = []
      text: string
      lang = ''
      voice: SpeechSynthesisVoice | null = null
      rate = 1
      pitch = 1

      constructor(text: string) {
        this.text = text
        MockUtterance.instances.push(this)
      }
    }

    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: speakMock,
        cancel: cancelMock,
        speaking: false,
        pending: false,
        getVoices: () => mockVoices,
        onvoiceschanged: null,
      },
      writable: true,
      configurable: true,
    })

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: MockUtterance,
      writable: true,
      configurable: true,
    })

    const speaker = new EnhancedBrowserSpeaker()

    // 1. First Spanish utterance
    speaker.speak('aguacate', 'es-MX')
    const firstSpanish =
      MockUtterance.instances[MockUtterance.instances.length - 1]
    expect(firstSpanish?.voice?.name).toBe('Paulina (Mexican Spanish)')
    expect(firstSpanish?.lang).toBe('es-MX')

    // 2. English counterpart
    speaker.speak('avocado', 'en-US')
    const english = MockUtterance.instances[MockUtterance.instances.length - 1]
    expect(english?.voice?.name).toBe('Samantha (US English)')
    expect(english?.lang).toBe('en-US')

    // 3. Return to Spanish - MUST NOT retain Samantha
    speaker.speak('aguacate', 'es-MX')
    const secondSpanish =
      MockUtterance.instances[MockUtterance.instances.length - 1]
    expect(secondSpanish?.voice?.name).toBe('Paulina (Mexican Spanish)')
    expect(secondSpanish?.lang).toBe('es-MX')
  })

  it('explicitly sets voice to null when no matching voice is found, avoiding voice bleed', () => {
    const speakMock = vi.fn()
    const cancelMock = vi.fn()

    const englishOnlyVoices: SpeechSynthesisVoice[] = [
      {
        lang: 'en-US',
        name: 'Samantha (US English)',
        default: true,
        localService: true,
        voiceURI: 'en-US-samantha',
      },
    ]

    class MockUtterance {
      static instances: MockUtterance[] = []
      text: string
      lang = ''
      voice: SpeechSynthesisVoice | null = null
      rate = 1
      pitch = 1

      constructor(text: string) {
        this.text = text
        MockUtterance.instances.push(this)
      }
    }

    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: speakMock,
        cancel: cancelMock,
        speaking: false,
        pending: false,
        getVoices: () => englishOnlyVoices,
        onvoiceschanged: null,
      },
      writable: true,
      configurable: true,
    })

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: MockUtterance,
      writable: true,
      configurable: true,
    })

    const speaker = new EnhancedBrowserSpeaker()

    // Speak Spanish when only English voices exist in getVoices
    speaker.speak('aguacate', 'es-MX')
    const utterance =
      MockUtterance.instances[MockUtterance.instances.length - 1]
    expect(utterance?.voice).toBeNull()
    expect(utterance?.lang).toBe('es-MX')
  })

  it('handles error in speak gracefully without throwing', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: () => {
          throw new Error('Audio engine error')
        },
        cancel: () => {},
        speaking: false,
        pending: false,
        getVoices: () => [],
        onvoiceschanged: null,
      },
      writable: true,
      configurable: true,
    })

    const speaker = new EnhancedBrowserSpeaker()
    expect(speaker.speak('test', 'es-MX')).toBe(false)
  })

  it('deduplicates rapid consecutive speak calls for identical text and locale', () => {
    const speakMock = vi.fn()
    const cancelMock = vi.fn()

    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: speakMock,
        cancel: cancelMock,
        speaking: false,
        pending: false,
        getVoices: () => [],
        onvoiceschanged: null,
      },
      writable: true,
      configurable: true,
    })

    class MockUtterance {
      lang = ''
      constructor(public text: string) {}
    }

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: MockUtterance,
      writable: true,
      configurable: true,
    })

    const speaker = new EnhancedBrowserSpeaker()

    // Rapid successive calls with the same text/locale within a few milliseconds
    const first = speaker.speak('aguacate', 'es-MX')
    const second = speaker.speak('aguacate', 'es-MX')

    expect(first).toBe(true)
    expect(second).toBe(true)
    expect(speakMock).toHaveBeenCalledTimes(1)

    // Different text plays immediately
    speaker.speak('avocado', 'en-US')
    expect(speakMock).toHaveBeenCalledTimes(2)
  })

  it('prefers enhanced / premium voice over compact voice when both are available', () => {
    const speakMock = vi.fn()
    const cancelMock = vi.fn()

    const mockVoices: SpeechSynthesisVoice[] = [
      {
        lang: 'es-MX',
        name: 'Paulina',
        default: true,
        localService: true,
        voiceURI: 'es-MX-paulina-compact',
      },
      {
        lang: 'es-MX',
        name: 'Paulina (Enhanced)',
        default: false,
        localService: true,
        voiceURI: 'es-MX-paulina-enhanced',
      },
    ]

    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: speakMock,
        cancel: cancelMock,
        speaking: false,
        pending: false,
        getVoices: () => mockVoices,
        onvoiceschanged: null,
      },
      writable: true,
      configurable: true,
    })

    let selectedVoice: SpeechSynthesisVoice | null = null
    class MockUtterance {
      lang = ''
      set voice(v: SpeechSynthesisVoice | null) {
        selectedVoice = v
      }
      constructor(public text: string) {}
    }

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: MockUtterance,
      writable: true,
      configurable: true,
    })

    const speaker = new EnhancedBrowserSpeaker()
    speaker.speak('hola', 'es-MX')
    expect(selectedVoice).not.toBeNull()
    expect((selectedVoice as unknown as SpeechSynthesisVoice).name).toBe(
      'Paulina (Enhanced)',
    )
  })
})

describe('Apple voice enhancement helpers', () => {
  it('detects Apple platforms accurately', async () => {
    const { isApplePlatform, isMacOS } = await import('./speech')

    const iPhoneUA =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15'
    const macUA =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    const androidUA =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36'
    const windowsUA =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

    expect(isApplePlatform(iPhoneUA)).toBe(true)
    expect(isApplePlatform(macUA)).toBe(true)
    expect(isApplePlatform(androidUA)).toBe(false)
    expect(isApplePlatform(windowsUA)).toBe(false)

    expect(isMacOS(macUA)).toBe(true)
    expect(isMacOS(iPhoneUA)).toBe(false)
  })

  it('detects presence of enhanced Mexican Spanish voices', async () => {
    const { hasEnhancedMexicanSpanishVoice } = await import('./speech')

    const compactOnly: SpeechSynthesisVoice[] = [
      {
        lang: 'es-MX',
        name: 'Paulina',
        default: true,
        localService: true,
        voiceURI: 'es-MX-paulina',
      },
      {
        lang: 'es-ES',
        name: 'Mónica (Enhanced)',
        default: false,
        localService: true,
        voiceURI: 'es-ES-monica-enhanced',
      },
    ]

    const withEnhancedPaulina: SpeechSynthesisVoice[] = [
      {
        lang: 'es-MX',
        name: 'Paulina (Enhanced)',
        default: false,
        localService: true,
        voiceURI: 'es-MX-paulina-enhanced',
      },
    ]

    const withSiriMexico: SpeechSynthesisVoice[] = [
      {
        lang: 'es-MX',
        name: 'Siri (Voice 1)',
        default: false,
        localService: true,
        voiceURI: 'es-MX-siri',
      },
    ]

    expect(hasEnhancedMexicanSpanishVoice([])).toBe(false)
    expect(hasEnhancedMexicanSpanishVoice(compactOnly)).toBe(false)
    expect(hasEnhancedMexicanSpanishVoice(withEnhancedPaulina)).toBe(true)
    expect(hasEnhancedMexicanSpanishVoice(withSiriMexico)).toBe(true)
  })

  it('determines whether to prompt user for voice upgrade', async () => {
    const { shouldPromptAppleVoiceUpgrade } = await import('./speech')

    const compactVoices: SpeechSynthesisVoice[] = [
      {
        lang: 'es-MX',
        name: 'Paulina',
        default: true,
        localService: true,
        voiceURI: 'es-MX-paulina',
      },
    ]

    const enhancedVoices: SpeechSynthesisVoice[] = [
      {
        lang: 'es-MX',
        name: 'Paulina (Enhanced)',
        default: false,
        localService: true,
        voiceURI: 'es-MX-paulina-enhanced',
      },
    ]

    // Apple user with compact voice and not dismissed -> prompt
    expect(
      shouldPromptAppleVoiceUpgrade({
        isApple: true,
        voices: compactVoices,
        dismissed: false,
      }),
    ).toBe(true)

    // Dismissed by user -> do not prompt
    expect(
      shouldPromptAppleVoiceUpgrade({
        isApple: true,
        voices: compactVoices,
        dismissed: true,
      }),
    ).toBe(false)

    // Non-Apple user -> do not prompt
    expect(
      shouldPromptAppleVoiceUpgrade({
        isApple: false,
        voices: compactVoices,
        dismissed: false,
      }),
    ).toBe(false)

    // Voices not loaded yet -> do not prompt
    expect(
      shouldPromptAppleVoiceUpgrade({
        isApple: true,
        voices: [],
        dismissed: false,
      }),
    ).toBe(false)

    // Enhanced voice already present -> do not prompt
    expect(
      shouldPromptAppleVoiceUpgrade({
        isApple: true,
        voices: enhancedVoices,
        dismissed: false,
      }),
    ).toBe(false)
  })
})
