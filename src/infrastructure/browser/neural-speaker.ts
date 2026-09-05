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

export class LruAudioCache {
  public readonly maxSize: number
  private readonly cache = new Map<string, AudioBuffer>()
  constructor(maxSize: number = 200) {
    this.maxSize = Math.max(1, maxSize)
  }

  get(key: string): AudioBuffer | undefined {
    const val = this.cache.get(key)
    if (val !== undefined) {
      this.cache.delete(key)
      this.cache.set(key, val)
    }
    return val
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  set(key: string, value: AudioBuffer): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }
    this.cache.set(key, value)
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }

  keys(): IterableIterator<string> {
    return this.cache.keys()
  }

  values(): IterableIterator<AudioBuffer> {
    return this.cache.values()
  }

  entries(): IterableIterator<[string, AudioBuffer]> {
    return this.cache.entries()
  }

  [Symbol.iterator](): IterableIterator<[string, AudioBuffer]> {
    return this.cache[Symbol.iterator]()
  }
}

export class NeuralVoiceEngine {
  private audioContext: AudioContext | null = null
  private audioCache: LruAudioCache
  private audioBlobs = new Map<string, string>()

  constructor(maxMemoryBuffers = 200) {
    this.audioCache = new LruAudioCache(maxMemoryBuffers)
    this.initContext()
    for (const [key, url] of Object.entries(BUNDLED_NEURAL_AUDIO)) {
      this.audioBlobs.set(key, url)
    }
    void this.getCache()
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
      return keys
    }

    const defaultVoice = getDeterministicVoice(text, locale)
    keys.push(`${normalizedLocale}:${raw}:${defaultVoice}`)
    if (clean !== raw && clean.length > 0) {
      keys.push(`${normalizedLocale}:${clean}:${defaultVoice}`)
    }

    keys.push(`${normalizedLocale}:${raw}`)
    if (clean !== raw && clean.length > 0) {
      keys.push(`${normalizedLocale}:${clean}`)
    }

    return keys
  }

  private currentSource: AudioBufferSourceNode | null = null
  private currentAudioElement: HTMLAudioElement | null = null

  stopAudio(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop()
        this.currentSource.disconnect()
      } catch {
        // Already stopped
      }
      this.currentSource = null
    }
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause()
        this.currentAudioElement.currentTime = 0
      } catch {
        // Ignore pause errors
      }
      this.currentAudioElement = null
    }
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.speechSynthesis.cancel === 'function'
    ) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        // Ignore cancel errors
      }
    }
  }

  hasAudio(text: string, locale: string, voice?: string): boolean {
    const hasVoiceMatch = this.getCacheKeys(text, locale, voice).some(
      (key) => this.audioCache.has(key) || this.audioBlobs.has(key),
    )
    if (hasVoiceMatch) return true

    // If a specific voice was requested but not found, check if unvoiced (bundled audio) exists
    if (voice) {
      return this.getCacheKeys(text, locale).some(
        (key) => this.audioCache.has(key) || this.audioBlobs.has(key),
      )
    }

    return false
  }

  isAudioInFlight(text: string, locale: string, voice?: string): boolean {
    const cleanText = text.trim()
    const normLocale = normalizeLocale(locale)
    const effectiveVoice = voice ?? getDeterministicVoice(cleanText, normLocale)
    const voiceKey = this.getPrimaryCacheKey(
      cleanText,
      normLocale,
      effectiveVoice,
    )
    const unvoicedKey = this.getPrimaryCacheKey(cleanText, normLocale)
    return (
      this.inFlightFetches.has(voiceKey) ||
      this.inFlightFetches.has(unvoicedKey)
    )
  }

  private diskCacheKeys = new Set<string>()
  private diskKeysLoaded = false

  hasDiskAudio(text: string, locale: string, voice?: string): boolean {
    const cleanText = text.trim()
    if (!cleanText) return false
    const normLocale = normalizeLocale(locale)
    const effectiveVoice = voice ?? getDeterministicVoice(cleanText, normLocale)
    const hasVoiceMatch = this.getCacheKeys(
      cleanText,
      normLocale,
      effectiveVoice,
    ).some((k) => this.diskCacheKeys.has(k))
    if (hasVoiceMatch) return true

    return this.getCacheKeys(cleanText, normLocale).some((k) =>
      this.diskCacheKeys.has(k),
    )
  }

  private recordDiskKey(
    cleanText: string,
    normLocale: string,
    voice?: string,
  ): void {
    const effectiveVoice = voice ?? getDeterministicVoice(cleanText, normLocale)
    for (const key of this.getCacheKeys(
      cleanText,
      normLocale,
      effectiveVoice,
    )) {
      this.diskCacheKeys.add(key)
    }
    for (const key of this.getCacheKeys(cleanText, normLocale)) {
      this.diskCacheKeys.add(key)
    }
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

    const cacheKeys = this.getCacheKeys(text, locale, voice)
    for (const key of cacheKeys) {
      // 1. Cached AudioBuffer playback via Web Audio API
      const cachedBuffer = this.audioCache.get(key)
      if (cachedBuffer) {
        // Also refresh variant keys so the phrase stays together as a unit in the LRU cache
        for (const otherKey of cacheKeys) {
          if (otherKey !== key) {
            this.audioCache.get(otherKey)
          }
        }
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
          this.stopAudio()
          const audio = new window.Audio(cachedUrl)
          this.currentAudioElement = audio
          audio.onended = () => {
            if (this.currentAudioElement === audio) {
              this.currentAudioElement = null
            }
          }
          if (typeof audio.play === 'function') {
            void audio.play().catch(() => {})
          }
          return true
        } catch {
          return false
        }
      }
    }

    // If voice-specific audio was not found, fallback to unvoiced keys (bundled static audio)
    if (voice) {
      for (const fallbackKey of this.getCacheKeys(text, locale)) {
        const cachedBuffer = this.audioCache.get(fallbackKey)
        if (cachedBuffer) {
          return this.playBuffer(cachedBuffer)
        }

        const bundledUrl = this.audioBlobs.get(fallbackKey)
        if (
          bundledUrl &&
          typeof window !== 'undefined' &&
          typeof window.Audio !== 'undefined'
        ) {
          try {
            this.stopAudio()
            const audio = new window.Audio(bundledUrl)
            this.currentAudioElement = audio
            audio.onended = () => {
              if (this.currentAudioElement === audio) {
                this.currentAudioElement = null
              }
            }
            if (typeof audio.play === 'function') {
              void audio.play().catch(() => {})
            }
            return true
          } catch {
            return false
          }
        }
      }
    }

    return false
  }

  private async getCache(): Promise<Cache | null> {
    if (typeof window !== 'undefined' && 'caches' in window && window.caches) {
      try {
        const cache = await window.caches.open(AUDIO_CACHE_NAME)
        if (!this.diskKeysLoaded) {
          this.diskKeysLoaded = true
          void this.populateDiskKeys(cache)
        }
        return cache
      } catch {
        return null
      }
    }
    return null
  }

  private async populateDiskKeys(cache: Cache): Promise<void> {
    try {
      if (typeof cache.keys !== 'function') return
      const requests = await cache.keys()
      for (const req of requests) {
        try {
          const urlStr = typeof req === 'string' ? req : req.url
          const url = new URL(urlStr, 'http://localhost')
          const text = url.searchParams.get('text')
          const locale = url.searchParams.get('locale')
          const voice = url.searchParams.get('voice') ?? undefined
          if (text && locale) {
            this.recordDiskKey(text, locale, voice)
          }
        } catch {
          // Skip malformed URL
        }
      }
    } catch {
      // Ignore cache keys read failure
    }
  }

  async syncDiskCache(): Promise<void> {
    const cache = await this.getCache()
    if (cache) {
      await this.populateDiskKeys(cache)
    }
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

  private async registerDecodedBufferOrBlob(
    cleanText: string,
    normLocale: string,
    voice: string | undefined,
    arrayBuffer: ArrayBuffer,
  ): Promise<boolean> {
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
  }

  async fetchAndCacheAudio(
    text: string,
    locale: string,
    optionsOrFetchFn?:
      | {
          cardSeed?: string | undefined
          voice?: string | undefined
          fetchFn?: typeof fetch
          skipDecodeIfCacheFull?: boolean | undefined
        }
      | typeof fetch,
    optionalFetchFn?: typeof fetch,
  ): Promise<boolean> {
    let options:
      | {
          cardSeed?: string | undefined
          voice?: string | undefined
          fetchFn?: typeof fetch
          skipDecodeIfCacheFull?: boolean | undefined
        }
      | undefined
    let fetchFn: typeof fetch = fetch

    if (typeof optionsOrFetchFn === 'function') {
      fetchFn = optionsOrFetchFn
    } else if (optionsOrFetchFn) {
      options = optionsOrFetchFn
      if (options.fetchFn) {
        fetchFn = options.fetchFn
      } else if (optionalFetchFn) {
        fetchFn = optionalFetchFn
      }
    }

    const cleanText = text.trim()
    if (!cleanText) return false

    const normLocale = normalizeLocale(locale)
    const voice =
      options?.voice ??
      getDeterministicVoice(cleanText, normLocale, options?.cardSeed)

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
            this.recordDiskKey(cleanText, normLocale, voice)
            if (
              options?.skipDecodeIfCacheFull &&
              this.audioCache.size >= this.audioCache.maxSize
            ) {
              return true
            }
            const arrayBuffer = await cachedResp.arrayBuffer()
            const registered = await this.registerDecodedBufferOrBlob(
              cleanText,
              normLocale,
              voice,
              arrayBuffer,
            )
            if (registered) return true
          }
        } catch {
          // Cache match failed, proceed to network
        }
      }

      if (
        typeof navigator !== 'undefined' &&
        'onLine' in navigator &&
        !navigator.onLine
      ) {
        return false
      }

      try {
        const response = await fetchFn(url)
        if (!response.ok) return false

        if (cache) {
          try {
            await cache.put(url, response.clone())
            this.recordDiskKey(cleanText, normLocale, voice)
          } catch {
            // Ignore cache write errors
          }
        }

        if (
          options?.skipDecodeIfCacheFull &&
          this.audioCache.size >= this.audioCache.maxSize
        ) {
          return true
        }

        const arrayBuffer = await response.arrayBuffer()
        return this.registerDecodedBufferOrBlob(
          cleanText,
          normLocale,
          voice,
          arrayBuffer,
        )
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
    const seenKeys = new Set<string>()
    const resolvedItems: Array<{
      text: string
      locale: string
      voice: string
      cardSeed?: string | undefined
      key: string
    }> = []

    for (const item of items) {
      const clean = item.text.trim()
      if (!clean) continue
      const normLocale = normalizeLocale(item.locale)
      const voice =
        item.voice ?? getDeterministicVoice(clean, normLocale, item.cardSeed)
      const key = this.getPrimaryCacheKey(clean, normLocale, voice)
      if (seenKeys.has(key)) continue
      seenKeys.add(key)

      if (
        !this.hasAudio(clean, normLocale, voice) &&
        !this.isAudioInFlight(clean, normLocale, voice)
      ) {
        resolvedItems.push({
          text: clean,
          locale: normLocale,
          voice,
          cardSeed: item.cardSeed,
          key,
        })
      }
    }

    if (resolvedItems.length === 0) return

    const CONCURRENCY = 3
    for (let i = 0; i < resolvedItems.length; i += CONCURRENCY) {
      const batch = resolvedItems.slice(i, i + CONCURRENCY)
      await Promise.allSettled(
        batch.map((item) =>
          this.fetchAndCacheAudio(
            item.text,
            item.locale,
            {
              voice: item.voice,
              cardSeed: item.cardSeed,
              skipDecodeIfCacheFull: true,
            },
            fetchFn,
          ),
        ),
      )

      if (i + CONCURRENCY < resolvedItems.length) {
        await new Promise<void>((resolve) => {
          if (
            typeof window !== 'undefined' &&
            typeof window.requestIdleCallback === 'function'
          ) {
            window.requestIdleCallback(() => resolve(), { timeout: 150 })
          } else {
            setTimeout(resolve, 0)
          }
        })
      }
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

      this.stopAudio()

      const source = this.audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(this.audioContext.destination)
      source.onended = () => {
        if (this.currentSource === source) {
          this.currentSource = null
        }
      }
      this.currentSource = source
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
  private speakGeneration = 0

  constructor(options?: {
    neuralEngine?: NeuralVoiceEngine
    fallbackSpeaker?: Speaker
    maxMemoryBuffers?: number
  }) {
    this.neuralEngine =
      options?.neuralEngine ??
      new NeuralVoiceEngine(options?.maxMemoryBuffers ?? 200)
    this.fallbackSpeaker =
      options?.fallbackSpeaker ?? new EnhancedBrowserSpeaker()
  }

  private speakFallback(text: string, locale: string): boolean {
    this.neuralEngine.stopAudio()
    return this.fallbackSpeaker.speak(text, locale)
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

  hasAudio(text: string, locale: string, voice?: string): boolean {
    return this.neuralEngine.hasAudio(text, locale, voice)
  }

  hasDiskAudio(text: string, locale: string, voice?: string): boolean {
    return this.neuralEngine.hasDiskAudio(text, locale, voice)
  }

  isAudioInFlight(text: string, locale: string, voice?: string): boolean {
    return this.neuralEngine.isAudioInFlight(text, locale, voice)
  }

  async syncDiskCache(): Promise<void> {
    await this.neuralEngine.syncDiskCache()
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
    const currentGen = ++this.speakGeneration

    // 1. If audio is already cached in memory, play immediately
    if (this.neuralEngine.hasAudio(cleanText, normLocale, voice)) {
      try {
        const played = this.neuralEngine.playAudio(cleanText, normLocale, voice)
        if (played) return true
      } catch {
        // Fall back seamlessly to browser speech synthesis
        return this.speakFallback(cleanText, normLocale)
      }
    }

    // 2. If an audio prefetch is in flight, or if it is already cached on disk (CacheStorage),
    // allow a brief grace window to play neural voice rather than prematurely falling back to robotic speech
    const isDiskCached = this.neuralEngine.hasDiskAudio(
      cleanText,
      normLocale,
      voice,
    )
    const isInFlight = this.neuralEngine.isAudioInFlight(
      cleanText,
      normLocale,
      voice,
    )

    if (isInFlight || isDiskCached) {
      if (!isInFlight) {
        // Trigger hydration from disk/network into memory
        void this.neuralEngine
          .fetchAndCacheAudio(cleanText, normLocale, {
            voice,
            cardSeed: options?.cardSeed,
          })
          .catch(() => {})
      }

      const graceTimeout = isDiskCached ? 150 : 200
      void this.neuralEngine
        .awaitAudio(cleanText, normLocale, voice, graceTimeout)
        .then((ready) => {
          if (this.speakGeneration !== currentGen) return
          if (ready) {
            const played = this.neuralEngine.playAudio(
              cleanText,
              normLocale,
              voice,
            )
            if (!played) {
              this.speakFallback(cleanText, normLocale)
            }
          } else {
            this.speakFallback(cleanText, normLocale)
          }
        })
        .catch(() => {
          if (this.speakGeneration !== currentGen) return
          this.speakFallback(cleanText, normLocale)
        })
      return true
    }

    // 3. Uncached and not in-flight: fire background fetch for subsequent plays and speak via fallback synchronously
    void this.neuralEngine
      .fetchAndCacheAudio(cleanText, normLocale, {
        voice,
        cardSeed: options?.cardSeed,
      })
      .catch(() => {})

    return this.speakFallback(cleanText, normLocale)
  }
}
