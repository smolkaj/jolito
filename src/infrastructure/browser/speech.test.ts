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

  it('selects male or female Spanish voice based on gender option and voice hint', () => {
    let selectedVoice: SpeechSynthesisVoice | null = null
    class MockUtterance {
      lang = ''
      set voice(v: SpeechSynthesisVoice | null) {
        selectedVoice = v
      }
      constructor(public text: string) {}
    }

    const mockVoices: SpeechSynthesisVoice[] = [
      {
        lang: 'es-MX',
        name: 'Paulina (Mexico)',
        default: false,
        localService: true,
        voiceURI: 'es-mx-paulina',
      },
      {
        lang: 'es-MX',
        name: 'Jorge (Mexico)',
        default: false,
        localService: true,
        voiceURI: 'es-mx-jorge',
      },
      {
        lang: 'en-US',
        name: 'Guy (US)',
        default: false,
        localService: true,
        voiceURI: 'en-us-guy',
      },
      {
        lang: 'en-US',
        name: 'Jenny (US)',
        default: false,
        localService: true,
        voiceURI: 'en-us-jenny',
      },
    ]

    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
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

    // 1. Explicit male gender
    speaker.speak('hola', 'es-MX', { gender: 'male' })
    expect(selectedVoice).not.toBeNull()
    expect((selectedVoice as unknown as SpeechSynthesisVoice).name).toBe(
      'Jorge (Mexico)',
    )

    // 2. Explicit female gender
    speaker.speak('adiós', 'es-MX', { gender: 'female' })
    expect(selectedVoice).not.toBeNull()
    expect((selectedVoice as unknown as SpeechSynthesisVoice).name).toBe(
      'Paulina (Mexico)',
    )

    // 3. Voice hint pointing to Jorge Neural resolves male
    speaker.speak('buenos días', 'es-MX', { voice: 'es-MX-JorgeNeural' })
    expect(selectedVoice).not.toBeNull()
    expect((selectedVoice as unknown as SpeechSynthesisVoice).name).toBe(
      'Jorge (Mexico)',
    )

    // 4. Voice hint pointing to Dalia Neural resolves female
    speaker.speak('buenas noches', 'es-MX', { voice: 'es-MX-DaliaNeural' })
    expect(selectedVoice).not.toBeNull()
    expect((selectedVoice as unknown as SpeechSynthesisVoice).name).toBe(
      'Paulina (Mexico)',
    )

    // 5. English male and female resolution
    speaker.speak('hello', 'en-US', { gender: 'male' })
    expect(selectedVoice).not.toBeNull()
    expect((selectedVoice as unknown as SpeechSynthesisVoice).name).toBe(
      'Guy (US)',
    )

    speaker.speak('goodbye', 'en-US', { gender: 'female' })
    expect(selectedVoice).not.toBeNull()
    expect((selectedVoice as unknown as SpeechSynthesisVoice).name).toBe(
      'Jenny (US)',
    )
  })

  it('prioritizes US English male voices over Australian or British male voices', () => {
    let selectedVoice: SpeechSynthesisVoice | null = null
    class MockUtterance {
      lang = ''
      set voice(v: SpeechSynthesisVoice | null) {
        selectedVoice = v
      }
      constructor(public text: string) {}
    }

    const mockVoices: SpeechSynthesisVoice[] = [
      {
        lang: 'en-AU',
        name: 'Russell (Male)',
        default: false,
        localService: true,
        voiceURI: 'en-au-russell',
      },
      {
        lang: 'en-US',
        name: 'Alex (US Male)',
        default: false,
        localService: true,
        voiceURI: 'en-us-alex',
      },
      {
        lang: 'en-GB',
        name: 'Oliver (Male)',
        default: false,
        localService: true,
        voiceURI: 'en-gb-oliver',
      },
    ]

    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
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
    speaker.speak('hello', 'en-US', { gender: 'male' })
    expect(selectedVoice).not.toBeNull()
    expect((selectedVoice as unknown as SpeechSynthesisVoice).name).toBe(
      'Alex (US Male)',
    )
    expect((selectedVoice as unknown as SpeechSynthesisVoice).lang).toBe(
      'en-US',
    )
  })

  it('cancels speech synthesis when stop() is invoked', () => {
    const cancelMock = vi.fn()
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: vi.fn(),
        cancel: cancelMock,
        getVoices: () => [],
        onvoiceschanged: null,
      },
      writable: true,
      configurable: true,
    })

    const speaker = new EnhancedBrowserSpeaker()
    speaker.stop()
    expect(cancelMock).toHaveBeenCalledTimes(1)
  })

  it('handles stop() gracefully when window.speechSynthesis is unavailable', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const speaker = new EnhancedBrowserSpeaker()
    expect(() => speaker.stop()).not.toThrow()
  })
})

describe('isEnhancedMexicanVoice helper', () => {
  it('evaluates isEnhancedMexicanVoice helper correctly', async () => {
    const { isEnhancedMexicanVoice } = await import('./speech')

    expect(
      isEnhancedMexicanVoice({
        lang: 'es-MX',
        name: 'Paulina (Enhanced)',
        default: false,
        localService: true,
        voiceURI: 'es-MX-paulina-enhanced',
      }),
    ).toBe(true)

    expect(
      isEnhancedMexicanVoice({
        lang: 'es-MX',
        name: 'Siri (Voice 1)',
        default: false,
        localService: true,
        voiceURI: 'es-MX-siri',
      }),
    ).toBe(true)

    expect(
      isEnhancedMexicanVoice({
        lang: 'es-MX',
        name: 'Paulina',
        default: true,
        localService: true,
        voiceURI: 'es-MX-paulina',
      }),
    ).toBe(false)

    expect(
      isEnhancedMexicanVoice({
        lang: 'es-ES',
        name: 'Mónica (Enhanced)',
        default: false,
        localService: true,
        voiceURI: 'es-ES-monica-enhanced',
      }),
    ).toBe(false)
  })
})

describe('AudioSession category lifecycle in EnhancedBrowserSpeaker', () => {
  const originalSpeechSynthesis = window.speechSynthesis
  const originalUtterance = window.SpeechSynthesisUtterance
  const originalNavigator = globalThis.navigator

  let speakMock: ReturnType<typeof vi.fn>
  let cancelMock: ReturnType<typeof vi.fn>
  let mockAudioSession: { type: string }
  class MockUtterance {
    static instances: MockUtterance[] = []
    text: string
    lang = ''
    voice: SpeechSynthesisVoice | null = null
    rate = 1
    pitch = 1
    onend: (() => void) | null = null
    onerror: (() => void) | null = null

    constructor(text: string) {
      this.text = text
      MockUtterance.instances.push(this)
    }
  }

  beforeEach(() => {
    MockUtterance.instances = []
    speakMock = vi.fn()
    cancelMock = vi.fn()
    mockAudioSession = { type: 'auto' }

    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, audioSession: mockAudioSession },
      configurable: true,
      writable: true,
    })

    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: speakMock,
        cancel: cancelMock,
        getVoices: () => [],
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
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    })
  })

  it('elevates audioSession category to playback on explicit speak and resets to ambient on onend', () => {
    const speaker = new EnhancedBrowserSpeaker()
    const onEndedSpy = vi.fn()

    const played = speaker.speak('hello', 'en-US', {
      explicit: true,
      onEnded: onEndedSpy,
    })
    expect(played).toBe(true)
    expect(mockAudioSession.type).toBe('playback')

    const lastUtterance =
      MockUtterance.instances[MockUtterance.instances.length - 1]
    lastUtterance?.onend?.()
    expect(mockAudioSession.type).toBe('ambient')
    expect(onEndedSpy).toHaveBeenCalledTimes(1)
  })

  it('sets audioSession category to ambient when speak is not explicit', () => {
    const speaker = new EnhancedBrowserSpeaker()
    const played = speaker.speak('hello', 'en-US', { explicit: false })
    expect(played).toBe(true)
    expect(mockAudioSession.type).toBe('ambient')
  })

  it('resets audioSession category to ambient on onerror and invokes onEnded', () => {
    const speaker = new EnhancedBrowserSpeaker()
    const onEndedSpy = vi.fn()

    speaker.speak('hello', 'en-US', {
      explicit: true,
      onEnded: onEndedSpy,
    })
    expect(mockAudioSession.type).toBe('playback')

    const lastUtterance =
      MockUtterance.instances[MockUtterance.instances.length - 1]
    lastUtterance?.onerror?.()
    expect(mockAudioSession.type).toBe('ambient')
    expect(onEndedSpy).toHaveBeenCalledTimes(1)
  })

  it('resets audioSession category to ambient on stop and prevents subsequent utterance events from firing', () => {
    const speaker = new EnhancedBrowserSpeaker()
    const onEndedSpy = vi.fn()

    speaker.speak('hello', 'en-US', {
      explicit: true,
      onEnded: onEndedSpy,
    })
    expect(mockAudioSession.type).toBe('playback')
    const activeUtterance =
      MockUtterance.instances[MockUtterance.instances.length - 1]

    speaker.stop()
    expect(mockAudioSession.type).toBe('ambient')
    expect(cancelMock).toHaveBeenCalled()

    // Simulate delayed onerror/onend from WebKit cancel
    activeUtterance?.onerror?.()
    activeUtterance?.onend?.()
    expect(onEndedSpy).not.toHaveBeenCalled()
  })

  it('does not demote audio session or fire duplicate callbacks when cancelling earlier utterance on rapid speak', () => {
    const speaker = new EnhancedBrowserSpeaker()
    const onEnded1 = vi.fn()
    const onEnded2 = vi.fn()

    speaker.speak('phrase 1', 'en-US', {
      explicit: true,
      onEnded: onEnded1,
    })
    expect(mockAudioSession.type).toBe('playback')
    const utterance1 = MockUtterance.instances[0]

    speaker.speak('phrase 2', 'en-US', {
      explicit: true,
      onEnded: onEnded2,
    })
    expect(mockAudioSession.type).toBe('playback')
    const utterance2 = MockUtterance.instances[1]

    // WebKit fires onerror asynchronously on cancelled utterance1
    utterance1?.onerror?.()
    // Audio session should still be playback for utterance 2, and utterance 1 onEnded should not fire
    expect(mockAudioSession.type).toBe('playback')
    expect(onEnded1).not.toHaveBeenCalled()

    // When utterance 2 finishes, category resets and onEnded2 fires
    utterance2?.onend?.()
    expect(mockAudioSession.type).toBe('ambient')
    expect(onEnded2).toHaveBeenCalledTimes(1)
  })

  it('resets audioSession category to ambient if speak throws', () => {
    speakMock.mockImplementation(() => {
      throw new Error('Synthesis engine crashed')
    })
    const speaker = new EnhancedBrowserSpeaker()

    const played = speaker.speak('hello', 'en-US', { explicit: true })
    expect(played).toBe(false)
    expect(mockAudioSession.type).toBe('ambient')
  })
})
