import type { Speaker } from '../../application/ports'
import { EnhancedBrowserSpeaker } from './speech'

export const BUNDLED_NEURAL_AUDIO: Record<string, string> = {
  'es-mx:aguacate': '/audio/aguacate-es.mp3',
  'en-us:avocado': '/audio/avocado-en.mp3',
  'es-mx:qué padre': '/audio/que-padre-es.mp3',
  'es-mx:que padre': '/audio/que-padre-es.mp3',
  'en-us:how cool': '/audio/how-cool-en.mp3',
  'es-mx:¿dónde está el metro?': '/audio/donde-esta-el-metro-es.mp3',
  'es-mx:donde esta el metro': '/audio/donde-esta-el-metro-es.mp3',
  'en-us:where is the metro?': '/audio/where-is-the-metro-en.mp3',
  'en-us:where is the metro': '/audio/where-is-the-metro-en.mp3',
  'es-mx:nos vemos al rato': '/audio/nos-vemos-al-rato-es.mp3',
  'en-us:see you later': '/audio/see-you-later-en.mp3',
  'es-mx:la cuenta, por favor': '/audio/la-cuenta-por-favor-es.mp3',
  'es-mx:la cuenta por favor': '/audio/la-cuenta-por-favor-es.mp3',
  'en-us:the bill, please': '/audio/the-bill-please-en.mp3',
  'en-us:the bill please': '/audio/the-bill-please-en.mp3',
  'es-mx:para llevar': '/audio/para-llevar-es.mp3',
  'en-us:to go': '/audio/to-go-en.mp3',
}

export class NeuralVoiceEngine {
  private audioContext: AudioContext | null = null
  private audioCache = new Map<string, AudioBuffer>()
  private audioBlobs = new Map<string, string>()

  constructor() {
    this.initContext()
    for (const [key, url] of Object.entries(BUNDLED_NEURAL_AUDIO)) {
      this.audioBlobs.set(key, url)
    }
  }

  private initContext(): void {
    if (typeof window === 'undefined') return
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    if (AudioCtx) {
      try {
        this.audioContext = new AudioCtx()
      } catch {
        this.audioContext = null
      }
    }
  }

  supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      (typeof window.AudioContext !== 'undefined' ||
        'webkitAudioContext' in window ||
        typeof window.Audio !== 'undefined')
    )
  }

  private getPrimaryCacheKey(text: string, locale: string): string {
    const normalizedLocale = locale.toLowerCase().replace(/_/g, '-')
    return `${normalizedLocale}:${text.trim().toLowerCase()}`
  }

  private getCacheKeys(text: string, locale: string): string[] {
    const primary = this.getPrimaryCacheKey(text, locale)
    const normalizedLocale = locale.toLowerCase().replace(/_/g, '-')
    const raw = text.trim().toLowerCase()
    const clean = raw.replace(/[¿?¡!.,]/g, '').trim()
    return clean !== raw && clean.length > 0
      ? [primary, `${normalizedLocale}:${clean}`]
      : [primary]
  }

  hasAudio(text: string, locale: string): boolean {
    return this.getCacheKeys(text, locale).some(
      (key) => this.audioCache.has(key) || this.audioBlobs.has(key),
    )
  }

  registerAudioBuffer(text: string, locale: string, buffer: AudioBuffer): void {
    const key = this.getPrimaryCacheKey(text, locale)
    this.audioCache.set(key, buffer)
  }

  registerAudioDataUrl(text: string, locale: string, dataUrl: string): void {
    const key = this.getPrimaryCacheKey(text, locale)
    this.audioBlobs.set(key, dataUrl)
  }

  playAudio(text: string, locale: string): boolean {
    if (!this.supported()) return false

    for (const key of this.getCacheKeys(text, locale)) {
      // 1. Cached AudioBuffer playback via Web Audio API
      const cachedBuffer = this.audioCache.get(key)
      if (cachedBuffer) {
        return this.playBuffer(cachedBuffer)
      }

      // 2. Audio element playback (bundled MP3 / data URL)
      const cachedUrl = this.audioBlobs.get(key)
      if (
        cachedUrl &&
        typeof window !== 'undefined' &&
        typeof window.Audio !== 'undefined'
      ) {
        try {
          const audio = new window.Audio(cachedUrl)
          if (typeof audio.play === 'function') {
            void audio.play().catch(() => {})
          }
          return true
        } catch {
          return false
        }
      }
    }

    return false
  }

  private prewarmedUrls = new Set<string>()
  private inFlightPrewarm: Promise<boolean> | null = null

  async prewarm(fetchFn: typeof fetch = fetch): Promise<boolean> {
    if (this.inFlightPrewarm) return this.inFlightPrewarm

    const urlToKeys = new Map<string, string[]>()
    for (const [key, url] of Object.entries(BUNDLED_NEURAL_AUDIO)) {
      if (this.prewarmedUrls.has(url)) continue
      const keys = urlToKeys.get(url) ?? []
      keys.push(key)
      urlToKeys.set(url, keys)
    }

    if (urlToKeys.size === 0) return true

    this.inFlightPrewarm = (async () => {
      let allSucceeded = true

      await Promise.all(
        Array.from(urlToKeys.entries()).map(async ([url, keys]) => {
          try {
            const response = await fetchFn(url)
            if (!response.ok) {
              allSucceeded = false
              return
            }
            const arrayBuffer = await response.arrayBuffer()

            if (
              this.audioContext &&
              typeof this.audioContext.decodeAudioData === 'function'
            ) {
              const bufferCopy = arrayBuffer.slice(0)
              const decodedBuffer = await new Promise<AudioBuffer>(
                (resolve, reject) => {
                  const res: unknown = this.audioContext!.decodeAudioData(
                    bufferCopy,
                    (buf) => resolve(buf),
                    (err) => reject(err),
                  )
                  if (
                    res !== null &&
                    typeof res === 'object' &&
                    'then' in res &&
                    typeof (res as Promise<AudioBuffer>).then === 'function'
                  ) {
                    void (res as Promise<AudioBuffer>)
                      .then(resolve)
                      .catch(reject)
                  }
                },
              )
              for (const key of keys) {
                this.audioCache.set(key, decodedBuffer)
              }
            }
            this.prewarmedUrls.add(url)
          } catch {
            allSucceeded = false
          }
        }),
      )

      return allSucceeded
    })().finally(() => {
      this.inFlightPrewarm = null
    })

    return this.inFlightPrewarm
  }

  private playBuffer(buffer: AudioBuffer): boolean {
    try {
      if (!this.audioContext) {
        this.initContext()
      }
      if (!this.audioContext) return false

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {})
      }

      const source = this.audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(this.audioContext.destination)
      source.start(0)
      return true
    } catch {
      return false
    }
  }
}

export class LayeredNeuralSpeaker implements Speaker {
  private neuralEngine: NeuralVoiceEngine
  private fallbackSpeaker: Speaker
  private lastSpokenText: string | null = null
  private lastSpokenLocale: string | null = null
  private lastSpokenTime = 0

  constructor(options?: {
    neuralEngine?: NeuralVoiceEngine
    fallbackSpeaker?: Speaker
  }) {
    this.neuralEngine = options?.neuralEngine ?? new NeuralVoiceEngine()
    this.fallbackSpeaker =
      options?.fallbackSpeaker ?? new EnhancedBrowserSpeaker()
  }

  supported(): boolean {
    return this.neuralEngine.supported() || this.fallbackSpeaker.supported()
  }

  async prewarm(fetchFn?: typeof fetch): Promise<boolean> {
    return this.neuralEngine.prewarm(fetchFn)
  }

  speak(text: string, locale: string): boolean {
    if (!this.supported()) return false

    const now = Date.now()
    if (
      this.lastSpokenText === text &&
      this.lastSpokenLocale === locale &&
      now - this.lastSpokenTime < 80
    ) {
      return true
    }

    this.lastSpokenText = text
    this.lastSpokenLocale = locale
    this.lastSpokenTime = now

    if (this.neuralEngine.hasAudio(text, locale)) {
      try {
        const played = this.neuralEngine.playAudio(text, locale)
        if (played) return true
      } catch {
        // Fall back seamlessly to browser speech synthesis
      }
    }

    return this.fallbackSpeaker.speak(text, locale)
  }

  hasEnhancedVoice(locale?: string): boolean {
    return this.fallbackSpeaker.hasEnhancedVoice?.(locale) ?? false
  }

  areVoicesLoaded(): boolean {
    return this.fallbackSpeaker.areVoicesLoaded?.() ?? true
  }

  onVoicesChanged(cb: () => void): () => void {
    return this.fallbackSpeaker.onVoicesChanged?.(cb) ?? (() => {})
  }
}
