import type {
  PrefetchItem,
  Speaker,
  SpeakerOptions,
} from '../../application/ports'
import { getDeterministicVoice, normalizeLocale } from '../tts/voices'
import { EnhancedBrowserSpeaker } from './speech'

export const AUDIO_CACHE_NAME = 'jolito-audio-v1'

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

export function getAudioUrl(
  text: string,
  locale: string,
  options?: { cardSeed?: string | undefined; voice?: string | undefined },
): string {
  const normLocale = normalizeLocale(locale)
  const voice =
    options?.voice ?? getDeterministicVoice(text, normLocale, options?.cardSeed)
  const params = new URLSearchParams({
    text: text.trim(),
    locale: normLocale,
    voice,
  })
  return `/api/tts?${params.toString()}`
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

  private inFlightFetches = new Map<string, Promise<boolean>>()

  private getPrimaryCacheKey(
    text: string,
    locale: string,
    voice?: string,
  ): string {
    const normalizedLocale = locale.toLowerCase().replace(/_/g, '-')
    const clean = text.trim().toLowerCase()
    return voice
      ? `${normalizedLocale}:${clean}:${voice}`
      : `${normalizedLocale}:${clean}`
  }

  private getCacheKeys(text: string, locale: string, voice?: string): string[] {
    const normalizedLocale = locale.toLowerCase().replace(/_/g, '-')
    const raw = text.trim().toLowerCase()
    const clean = raw.replace(/[¿?¡!.,]/g, '').trim()
    const keys: string[] = []

    if (voice) {
      keys.push(`${normalizedLocale}:${raw}:${voice}`)
      if (clean !== raw && clean.length > 0) {
        keys.push(`${normalizedLocale}:${clean}:${voice}`)
      }
    }

    keys.push(`${normalizedLocale}:${raw}`)
    if (clean !== raw && clean.length > 0) {
      keys.push(`${normalizedLocale}:${clean}`)
    }

    return keys
  }

  hasAudio(text: string, locale: string, voice?: string): boolean {
    return this.getCacheKeys(text, locale, voice).some(
      (key) => this.audioCache.has(key) || this.audioBlobs.has(key),
    )
  }

  isAudioInFlight(text: string, locale: string, voice?: string): boolean {
    const primaryKey = this.getPrimaryCacheKey(text, locale, voice)
    return this.inFlightFetches.has(primaryKey)
  }

  registerAudioBuffer(
    text: string,
    locale: string,
    buffer: AudioBuffer,
    voice?: string,
  ): void {
    for (const key of this.getCacheKeys(text, locale, voice)) {
      this.audioCache.set(key, buffer)
    }
  }

  registerAudioDataUrl(
    text: string,
    locale: string,
    dataUrl: string,
    voice?: string,
  ): void {
    for (const key of this.getCacheKeys(text, locale, voice)) {
      this.audioBlobs.set(key, dataUrl)
    }
  }

  playAudio(text: string, locale: string, voice?: string): boolean {
    if (!this.supported()) return false

    for (const key of this.getCacheKeys(text, locale, voice)) {
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

  private async getCache(): Promise<Cache | null> {
    if (typeof window !== 'undefined' && 'caches' in window && window.caches) {
      try {
        return await window.caches.open(AUDIO_CACHE_NAME)
      } catch {
        return null
      }
    }
    return null
  }

  private async decodeAudio(
    arrayBuffer: ArrayBuffer,
  ): Promise<AudioBuffer | null> {
    if (
      !this.audioContext ||
      typeof this.audioContext.decodeAudioData !== 'function'
    ) {
      return null
    }
    try {
      const bufferCopy = arrayBuffer.slice(0)
      return await new Promise<AudioBuffer>((resolve, reject) => {
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
          void (res as Promise<AudioBuffer>).then(resolve).catch(reject)
        }
      })
    } catch {
      return null
    }
  }

  async fetchAndCacheAudio(
    text: string,
    locale: string,
    optionsOrFetchFn?:
      | { cardSeed?: string | undefined; voice?: string | undefined }
      | typeof fetch,
    optionalFetchFn?: typeof fetch,
  ): Promise<boolean> {
    let options:
      { cardSeed?: string | undefined; voice?: string | undefined } | undefined
    let fetchFn: typeof fetch = fetch

    if (typeof optionsOrFetchFn === 'function') {
      fetchFn = optionsOrFetchFn
    } else if (optionsOrFetchFn) {
      options = optionsOrFetchFn
      if (optionalFetchFn) {
        fetchFn = optionalFetchFn
      }
    }

    const cleanText = text.trim()
    if (!cleanText) return false

    const normLocale = normalizeLocale(locale)
    const voice =
      options?.voice ??
      getDeterministicVoice(cleanText, normLocale, options?.cardSeed)

    if (this.hasAudio(cleanText, normLocale, voice)) return true

    const inFlightKey = this.getPrimaryCacheKey(cleanText, normLocale, voice)
    const existing = this.inFlightFetches.get(inFlightKey)
    if (existing) return existing

    const fetchPromise = (async () => {
      const url = getAudioUrl(cleanText, normLocale, { voice })
      const cache = await this.getCache()

      if (cache) {
        try {
          const cachedResp = await cache.match(url)
          if (cachedResp && cachedResp.ok) {
            const arrayBuffer = await cachedResp.arrayBuffer()
            const decoded = await this.decodeAudio(arrayBuffer)
            if (decoded) {
              this.registerAudioBuffer(cleanText, normLocale, decoded, voice)
              return true
            }
            if (
              typeof URL !== 'undefined' &&
              typeof URL.createObjectURL === 'function'
            ) {
              const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
              const objectUrl = URL.createObjectURL(blob)
              this.registerAudioDataUrl(cleanText, normLocale, objectUrl, voice)
              return true
            }
          }
        } catch {
          // Cache match failed, proceed to network
        }
      }

      try {
        const response = await fetchFn(url)
        if (!response.ok) return false

        if (cache) {
          try {
            await cache.put(url, response.clone())
          } catch {
            // Ignore cache write errors
          }
        }

        const arrayBuffer = await response.arrayBuffer()
        const decoded = await this.decodeAudio(arrayBuffer)
        if (decoded) {
          this.registerAudioBuffer(cleanText, normLocale, decoded, voice)
          return true
        }
        if (
          typeof URL !== 'undefined' &&
          typeof URL.createObjectURL === 'function'
        ) {
          const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
          const objectUrl = URL.createObjectURL(blob)
          this.registerAudioDataUrl(cleanText, normLocale, objectUrl, voice)
          return true
        }
        return false
      } catch {
        return false
      }
    })().finally(() => {
      this.inFlightFetches.delete(inFlightKey)
    })

    this.inFlightFetches.set(inFlightKey, fetchPromise)
    return fetchPromise
  }

  async awaitAudio(
    text: string,
    locale: string,
    voice?: string,
    timeoutMs = 200,
  ): Promise<boolean> {
    const cleanText = text.trim()
    const normLocale = normalizeLocale(locale)
    const inFlightKey = this.getPrimaryCacheKey(cleanText, normLocale, voice)
    const inFlight = this.inFlightFetches.get(inFlightKey)
    if (!inFlight) {
      return this.hasAudio(cleanText, normLocale, voice)
    }
    const timeoutPromise = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), timeoutMs),
    )
    return Promise.race([inFlight, timeoutPromise])
  }

  async prefetch(
    items: PrefetchItem[],
    fetchFn: typeof fetch = fetch,
  ): Promise<void> {
    const uncached = items.filter((item) => {
      const clean = item.text.trim()
      if (!clean) return false
      const voice =
        item.voice ??
        (item.cardSeed
          ? getDeterministicVoice(clean, item.locale, item.cardSeed)
          : undefined)
      return !this.hasAudio(clean, item.locale, voice)
    })
    if (uncached.length === 0) return

    const CONCURRENCY = 3
    for (let i = 0; i < uncached.length; i += CONCURRENCY) {
      const batch = uncached.slice(i, i + CONCURRENCY)
      await Promise.allSettled(
        batch.map((item) => {
          const voice =
            item.voice ??
            (item.cardSeed
              ? getDeterministicVoice(item.text, item.locale, item.cardSeed)
              : undefined)
          return this.fetchAndCacheAudio(
            item.text,
            item.locale,
            { voice, cardSeed: item.cardSeed },
            fetchFn,
          )
        }),
      )
    }
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
              const decodedBuffer = await this.decodeAudio(arrayBuffer)
              if (decodedBuffer) {
                for (const key of keys) {
                  this.audioCache.set(key, decodedBuffer)
                }
              } else {
                allSucceeded = false
                return
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

  async prefetch(items: PrefetchItem[], fetchFn?: typeof fetch): Promise<void> {
    await this.neuralEngine.prefetch(items, fetchFn)
  }

  speak(text: string, locale: string, options?: SpeakerOptions): boolean {
    if (!this.supported()) return false

    const cleanText = text.trim()
    if (!cleanText) return false

    const normLocale = normalizeLocale(locale)
    const voice =
      options?.voice ??
      getDeterministicVoice(cleanText, normLocale, options?.cardSeed)

    const now = Date.now()
    if (
      this.lastSpokenText === cleanText &&
      this.lastSpokenLocale === normLocale &&
      now - this.lastSpokenTime < 80
    ) {
      return true
    }

    this.lastSpokenText = cleanText
    this.lastSpokenLocale = normLocale
    this.lastSpokenTime = now

    // 1. If audio is already cached in memory, play immediately
    if (this.neuralEngine.hasAudio(cleanText, normLocale, voice)) {
      try {
        const played = this.neuralEngine.playAudio(cleanText, normLocale, voice)
        if (played) return true
      } catch {
        // Fall back seamlessly to browser speech synthesis
        return this.fallbackSpeaker.speak(cleanText, normLocale)
      }
    }

    // 2. If an audio prefetch is already in flight (e.g. Card 0 entering review),
    // await the in-flight prefetch (up to 200ms) rather than prematurely falling back to robotic speech
    if (this.neuralEngine.isAudioInFlight(cleanText, normLocale, voice)) {
      void this.neuralEngine
        .awaitAudio(cleanText, normLocale, voice, 200)
        .then((ready) => {
          if (ready) {
            const played = this.neuralEngine.playAudio(
              cleanText,
              normLocale,
              voice,
            )
            if (!played) {
              this.fallbackSpeaker.speak(cleanText, normLocale)
            }
          } else {
            this.fallbackSpeaker.speak(cleanText, normLocale)
          }
        })
        .catch(() => {
          this.fallbackSpeaker.speak(cleanText, normLocale)
        })
      return true
    }

    // 3. Uncached and not in-flight: fire background fetch for subsequent plays and speak via fallback
    void this.neuralEngine
      .fetchAndCacheAudio(cleanText, normLocale, {
        voice,
        cardSeed: options?.cardSeed,
      })
      .catch(() => {})

    return this.fallbackSpeaker.speak(cleanText, normLocale)
  }

  hasEnhancedVoice(locale?: string): boolean {
    if (this.neuralEngine.supported()) {
      return true
    }
    return this.fallbackSpeaker.hasEnhancedVoice?.(locale) ?? false
  }

  areVoicesLoaded(): boolean {
    return this.fallbackSpeaker.areVoicesLoaded?.() ?? true
  }

  onVoicesChanged(cb: () => void): () => void {
    return this.fallbackSpeaker.onVoicesChanged?.(cb) ?? (() => {})
  }
}
