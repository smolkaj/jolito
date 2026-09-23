import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Capacitor } from '@capacitor/core'
import {
  DefaultSpeechRecognizer,
  normalizeSpokenAnswer,
  type SpeechRecognitionPluginInterface,
} from './speech-recognition'

describe('normalizeSpokenAnswer', () => {
  it('strips leading inverted and trailing sentence punctuation', () => {
    expect(normalizeSpokenAnswer('¿hablas español?')).toBe('hablas español')
    expect(normalizeSpokenAnswer('¡buenos días!')).toBe('buenos días')
    expect(normalizeSpokenAnswer('gracias.')).toBe('gracias')
    expect(normalizeSpokenAnswer('  por favor...  ')).toBe('por favor')
  })

  it('aligns casing with target answer when characters match', () => {
    expect(normalizeSpokenAnswer('Hablé.', 'hablé')).toBe('hablé')
    expect(normalizeSpokenAnswer('EL GATO', 'el gato')).toBe('el gato')
    expect(normalizeSpokenAnswer('adiós', 'Adiós')).toBe('Adiós')
  })

  it('preserves accents and handles empty input gracefully', () => {
    expect(normalizeSpokenAnswer('')).toBe('')
    expect(normalizeSpokenAnswer('árbol')).toBe('árbol')
  })
})

describe('DefaultSpeechRecognizer', () => {
  let mockPlugin: {
    isAvailable: ReturnType<typeof vi.fn>
    requestPermissions: ReturnType<typeof vi.fn>
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    addListener: ReturnType<
      typeof vi.fn<
        (event: string, cb: unknown) => Promise<{ remove: () => Promise<void> }>
      >
    >
  }

  beforeEach(() => {
    mockPlugin = {
      isAvailable: vi.fn().mockResolvedValue({
        available: true,
        supportsOnDevice: true,
      }),
      requestPermissions: vi.fn().mockResolvedValue({ granted: true }),
      start: vi.fn().mockResolvedValue({ started: true }),
      stop: vi.fn().mockResolvedValue({ stopped: true }),
      addListener: vi
        .fn<
          (
            event: string,
            cb: unknown,
          ) => Promise<{ remove: () => Promise<void> }>
        >()
        .mockResolvedValue({ remove: () => Promise.resolve() }),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('checks support via native plugin on native platform with on-device capability', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)

    const recognizer = new DefaultSpeechRecognizer(
      mockPlugin as unknown as SpeechRecognitionPluginInterface,
    )
    const supported = await recognizer.isSupported('es-MX')

    expect(supported).toBe(true)
    expect(mockPlugin.isAvailable).toHaveBeenCalledWith({ locale: 'es-MX' })
  })

  it('reports false when on-device recognition is not supported (offline / $0.00 invariant)', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)
    mockPlugin.isAvailable.mockResolvedValue({
      available: true,
      supportsOnDevice: false,
    })

    const recognizer = new DefaultSpeechRecognizer(
      mockPlugin as unknown as SpeechRecognitionPluginInterface,
    )
    const supported = await recognizer.isSupported('es-MX')

    expect(supported).toBe(false)
  })

  it('reports false on web (strictly offline & $0.00 invariant)', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)

    const recognizer = new DefaultSpeechRecognizer(
      mockPlugin as unknown as SpeechRecognitionPluginInterface,
    )
    const supported = await recognizer.isSupported('es-MX')

    expect(supported).toBe(false)
  })

  it('reports false when native plugin is unavailable or throws', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)
    mockPlugin.isAvailable.mockRejectedValue(new Error('Device unavailable'))

    const recognizer = new DefaultSpeechRecognizer(
      mockPlugin as unknown as SpeechRecognitionPluginInterface,
    )
    const supported = await recognizer.isSupported('es-MX')

    expect(supported).toBe(false)
  })

  it('starts recognition on native platform with permissions and event listeners', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)

    const callbacks: {
      transcription: ((data: { text: string; isFinal: boolean }) => void) | null
      speechEnd: (() => void) | null
    } = {
      transcription: null,
      speechEnd: null,
    }

    mockPlugin.addListener.mockImplementation((event: string, cb: unknown) => {
      if (event === 'transcription') {
        callbacks.transcription = cb as (data: {
          text: string
          isFinal: boolean
        }) => void
      } else if (event === 'speechEnd') {
        callbacks.speechEnd = cb as () => void
      }
      return Promise.resolve({ remove: () => Promise.resolve() })
    })

    const recognizer = new DefaultSpeechRecognizer(
      mockPlugin as unknown as SpeechRecognitionPluginInterface,
    )

    const onTranscript = vi.fn()
    const onEnd = vi.fn()

    const started = await recognizer.start({
      locale: 'es-MX',
      onTranscript,
      onEnd,
    })

    expect(started).toBe(true)
    expect(mockPlugin.requestPermissions).toHaveBeenCalledTimes(1)
    expect(mockPlugin.start).toHaveBeenCalledWith({ locale: 'es-MX' })

    // Simulate speech transcription event
    callbacks.transcription?.({ text: 'gracias', isFinal: true })
    expect(onTranscript).toHaveBeenCalledWith('gracias', true)

    // Simulate speech end event
    callbacks.speechEnd?.()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('rejects start when microphone permission is denied', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)
    mockPlugin.requestPermissions.mockResolvedValue({ granted: false })

    const recognizer = new DefaultSpeechRecognizer(
      mockPlugin as unknown as SpeechRecognitionPluginInterface,
    )

    const onError = vi.fn()
    const started = await recognizer.start({
      locale: 'es-MX',
      onTranscript: vi.fn(),
      onError,
    })

    expect(started).toBe(false)
    expect(onError).toHaveBeenCalledWith('Permission denied')
    expect(mockPlugin.start).not.toHaveBeenCalled()
  })

  it('stops ongoing recognition', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)

    const removeSpy = vi.fn()
    mockPlugin.addListener.mockResolvedValue({ remove: removeSpy })

    const recognizer = new DefaultSpeechRecognizer(
      mockPlugin as unknown as SpeechRecognitionPluginInterface,
    )

    await recognizer.start({
      locale: 'es-MX',
      onTranscript: vi.fn(),
    })

    await recognizer.stop()
    expect(mockPlugin.stop).toHaveBeenCalledTimes(1)
    expect(removeSpy).toHaveBeenCalled()
  })
})
