import type {
  PrefetchItem,
  Speaker,
  SpeakerOptions,
} from '../../application/ports'
import {
  getAlternateVoice,
  getDeterministicVoice,
  normalizeLocale,
} from '../tts/voices'
import { EnhancedBrowserSpeaker } from './speech'

export const AUDIO_CACHE_NAME = 'jolito-audio-v1'

export const DUAL_VOICE_MAX_DURATION_SECONDS = 1.35
export const DUAL_VOICE_PAUSE_MS = 320

export function isShortPhraseForDualVoice(text: string): boolean {
  const clean = text.trim()
  if (!clean) return false
  const words = clean.split(/\s+/).filter(Boolean)
  return words.length > 0 && words.length <= 3 && clean.length <= 30
}

export const STARTER_PHRASES: Array<{ text: string; locale: string }> = [
  { text: 'aguacate', locale: 'es-MX' },
  { text: 'avocado', locale: 'en-US' },
  { text: 'qué padre', locale: 'es-MX' },
  { text: 'how cool', locale: 'en-US' },
  { text: '¿dónde está el metro?', locale: 'es-MX' },
  { text: 'where is the metro?', locale: 'en-US' },
  { text: 'nos vemos al rato', locale: 'es-MX' },
  { text: 'see you later', locale: 'en-US' },
  { text: 'la cuenta, por favor', locale: 'es-MX' },
  { text: 'the bill, please', locale: 'en-US' },
  { text: 'para llevar', locale: 'es-MX' },
  { text: 'to go', locale: 'en-US' },
]

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
  private dualVoiceTimer: number | null = null

  private getPrimaryCacheKey(
    text: string,
    locale: string,
    voice?: string,
  ): string {
    const normalizedLocale = locale.toLowerCase().replace(/_/g, '-')
    const clean = text.trim().toLowerCase()
    const effectiveVoice = voice ?? getDeterministicVoice(clean, normalizedLocale)
    return `${normalizedLocale}:${clean}:${effectiveVoice}`
  }

  private getCacheKeys(text: string, locale: string, voice?: string): string[] {
    const normalizedLocale = locale.toLowerCase().replace(/_/g, '-')
    const raw = text.trim().toLowerCase()
    const clean = raw.replace(/[¿?¡!.,]/g, '').trim()
    const effectiveVoice = voice ?? getDeterministicVoice(raw, normalizedLocale)
    const keys: string[] = [`${normalizedLocale}:${raw}:${effectiveVoice}`]
    if (clean !== raw && clean.length > 0) {
      keys.push(`${normalizedLocale}:${clean}:${effectiveVoice}`)
    }
    return keys
  }

  private currentSource: AudioBufferSourceNode | null = null
  private currentAudioElement: HTMLAudioElement | null = null

  stopAudio(): void {
    if (this.dualVoiceTimer !== null) {
      if (typeof window !== 'undefined') {
        window.clearTimeout(this.dualVoiceTimer)
      }
      this.dualVoiceTimer = null
    }
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
    if (voice) {
      return this.getCacheKeys(text, locale, voice).some(
        (key) => this.audioCache.has(key) || this.audioBlobs.has(key),
      )
    }
    const normLocale = normalizeLocale(locale)
    const defaultVoice = getDeterministicVoice(text, normLocale)
    if (
      this.getCacheKeys(text, normLocale, defaultVoice).some(
        (key) => this.audioCache.has(key) || this.audioBlobs.has(key),
      )
    ) {
      return true
    }
    const altVoice = getAlternateVoice(defaultVoice)
    return this.getCacheKeys(text, normLocale, altVoice).some(
      (key) => this.audioCache.has(key) || this.audioBlobs.has(key),
    )
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
    return this.inFlightFetches.has(voiceKey)
  }

  private diskCacheKeys = new Set<string>()
  private diskKeysPromise: Promise<void> | null = null

  hasDiskAudio(text: string, locale: string, voice?: string): boolean {
    const cleanText = text.trim()
    if (!cleanText) return false
    const normLocale = normalizeLocale(locale)
    if (voice) {
      return this.getCacheKeys(cleanText, normLocale, voice).some((k) =>
        this.diskCacheKeys.has(k),
      )
    }
    const defaultVoice = getDeterministicVoice(cleanText, normLocale)
    if (
      this.getCacheKeys(cleanText, normLocale, defaultVoice).some((k) =>
        this.diskCacheKeys.has(k),
      )
    ) {
      return true
    }
    const altVoice = getAlternateVoice(defaultVoice)
    return this.getCacheKeys(cleanText, normLocale, altVoice).some((k) =>
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

  playAudio(
    text: string,
    locale: string,
    voice?: string,
    options?: {
      dualVoice?: boolean | undefined
      onEnded?: (() => void) | undefined
    },
  ): boolean {
    if (!this.supported()) return false

    const normLocale = normalizeLocale(locale)
    const effectiveVoice = voice ?? getDeterministicVoice(text, normLocale)
    const cacheKeys = this.getCacheKeys(text, normLocale, effectiveVoice)

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

        const isSpanish = normLocale === 'es-MX'
        const qualifiesForDualVoice =
          isSpanish &&
          options?.dualVoice !== false &&
          isShortPhraseForDualVoice(text) &&
          cachedBuffer.duration <= DUAL_VOICE_MAX_DURATION_SECONDS

        if (qualifiesForDualVoice) {
          const alternateVoice = getAlternateVoice(effectiveVoice)
          return this.playBuffer(cachedBuffer, () => {
            if (this.dualVoiceTimer !== null && typeof window !== 'undefined') {
              window.clearTimeout(this.dualVoiceTimer)
            }
            if (typeof window !== 'undefined') {
              this.dualVoiceTimer = window.setTimeout(() => {
                this.dualVoiceTimer = null
                this.playAudio(text, normLocale, alternateVoice, {
                  dualVoice: false,
                  onEnded: options?.onEnded,
                })
              }, DUAL_VOICE_PAUSE_MS)
            }
          })
        }

        return this.playBuffer(cachedBuffer, options?.onEnded)
      }

      // 2. Audio element playback (data URL)
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
            options?.onEnded?.()
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

    return false
  }

  private async getCache(): Promise<Cache | null> {
    if (typeof window !== 'undefined' && 'caches' in window && window.caches) {
      try {
        const cache = await window.caches.open(AUDIO_CACHE_NAME)
        if (!this.diskKeysPromise) {
          this.diskKeysPromise = this.populateDiskKeys(cache).catch(() => {
            this.diskKeysPromise = null
          })
        }
        return cache
      } catch {
        return null
      }
    }
    return null
  }

  private async populateDiskKeys(cache: Cache): Promise<void> {
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
  }

  async syncDiskCache(): Promise<void> {
    const cache = await this.getCache()
    if (cache) {
      if (!this.diskKeysPromise) {
        this.diskKeysPromise = this.populateDiskKeys(cache).catch(() => {
          this.diskKeysPromise = null
        })
      }
      await this.diskKeysPromise
    }
  }

  async pruneUnusedAudio(
    activeItems: Array<{ text: string; locale: string }>,
  ): Promise<number> {
    const cache = await this.getCache()
    if (!cache) return 0

    if (this.diskKeysPromise) {
      await this.diskKeysPromise
    }

    const activeKeys = new Set<string>()
    for (const item of activeItems) {
      const clean = item.text.trim()
      if (!clean) continue
      const norm = normalizeLocale(item.locale)
      const defVoice = getDeterministicVoice(clean, norm)
      const altVoice = getAlternateVoice(defVoice)
      for (const k of this.getCacheKeys(clean, norm, defVoice)) {
        activeKeys.add(k)
      }
      for (const k of this.getCacheKeys(clean, norm, altVoice)) {
        activeKeys.add(k)
      }
    }

    try {
      if (typeof cache.keys !== 'function') return 0
      const requests = await cache.keys()
      let deletedCount = 0

      for (const req of requests) {
        try {
          const urlStr = typeof req === 'string' ? req : req.url
          const url = new URL(urlStr, 'http://localhost')
          const text = url.searchParams.get('text')
          const locale = url.searchParams.get('locale')
          if (!text || !locale) continue

          const normLocale = normalizeLocale(locale)
          const defVoice = getDeterministicVoice(text, normLocale)
          const altVoice = getAlternateVoice(defVoice)
          const isReferenced =
            this.getCacheKeys(text, normLocale, defVoice).some((k) =>
              activeKeys.has(k),
            ) ||
            this.getCacheKeys(text, normLocale, altVoice).some((k) =>
              activeKeys.has(k),
            )

          if (!isReferenced) {
            await cache.delete(req)
            deletedCount++
            const voice = url.searchParams.get('voice') ?? undefined
            if (voice) {
              for (const k of this.getCacheKeys(text, normLocale, voice)) {
                this.diskCacheKeys.delete(k)
                this.audioCache.delete(k)
              }
            }
            for (const k of this.getCacheKeys(text, normLocale, defVoice)) {
              this.diskCacheKeys.delete(k)
              this.audioCache.delete(k)
            }
            for (const k of this.getCacheKeys(text, normLocale, altVoice)) {
              this.diskCacheKeys.delete(k)
              this.audioCache.delete(k)
            }
          }
        } catch {
          // Skip entry on parse/delete error
        }
      }

      return deletedCount
    } catch {
      return 0
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
    options?: { requireDecode?: boolean },
  ): Promise<boolean> {
    const decoded = await this.decodeAudio(arrayBuffer)
    if (decoded) {
      this.registerAudioBuffer(cleanText, normLocale, decoded, voice)
      return true
    }
    if (options?.requireDecode) {
      return false
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
          requireDecode?: boolean | undefined
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
          requireDecode?: boolean | undefined
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

        const requireDecode =
          Boolean(options?.requireDecode) &&
          Boolean(
            this.audioContext &&
              typeof this.audioContext.decodeAudioData === 'function',
          )
        const arrayBuffer = await response.arrayBuffer()
        return this.registerDecodedBufferOrBlob(
          cleanText,
          normLocale,
          voice,
          arrayBuffer,
          { requireDecode },
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
    options?: { requireDecode?: boolean },
  ): Promise<boolean> {
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
      const primaryVoice =
        item.voice ?? getDeterministicVoice(clean, normLocale, item.cardSeed)
      const voicesToFetch =
        item.bothVoices !== false
          ? [primaryVoice, getAlternateVoice(primaryVoice)]
          : [primaryVoice]

      for (const voice of voicesToFetch) {
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
    }

    if (resolvedItems.length === 0) return true

    let allSucceeded = true
    const CONCURRENCY = 3
    for (let i = 0; i < resolvedItems.length; i += CONCURRENCY) {
      const batch = resolvedItems.slice(i, i + CONCURRENCY)
      const results = await Promise.allSettled(
        batch.map((item) =>
          this.fetchAndCacheAudio(
            item.text,
            item.locale,
            {
              voice: item.voice,
              cardSeed: item.cardSeed,
              skipDecodeIfCacheFull: true,
              requireDecode: options?.requireDecode,
            },
            fetchFn,
          ),
        ),
      )

      for (const res of results) {
        if (res.status === 'rejected' || res.value !== true) {
          allSucceeded = false
        }
      }

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

    return allSucceeded
  }

  private inFlightPrewarm: Promise<boolean> | null = null

  async prewarm(fetchFn: typeof fetch = fetch): Promise<boolean> {
    if (this.inFlightPrewarm) return this.inFlightPrewarm

    this.inFlightPrewarm = (async () => {
      try {
        const success = await this.prefetch(
          STARTER_PHRASES.map((p) => ({
            text: p.text,
            locale: p.locale,
            bothVoices: true,
          })),
          fetchFn,
          { requireDecode: true },
        )
        return success
      } catch {
        return false
      }
    })().finally(() => {
      this.inFlightPrewarm = null
    })

    return this.inFlightPrewarm
  }

  private playBuffer(buffer: AudioBuffer, onEnded?: () => void): boolean {
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
        onEnded?.()
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

  private speakFallback(
    text: string,
    locale: string,
    options?: SpeakerOptions,
  ): boolean {
    this.neuralEngine.stopAudio()
    return this.fallbackSpeaker.speak(text, locale, options)
  }

  stop(): void {
    this.neuralEngine.stopAudio()
    if (
      'stop' in this.fallbackSpeaker &&
      typeof this.fallbackSpeaker.stop === 'function'
    ) {
      this.fallbackSpeaker.stop()
    }
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

  async pruneUnusedAudio(
    activeItems: Array<{ text: string; locale: string }>,
  ): Promise<number> {
    return this.neuralEngine.pruneUnusedAudio(activeItems)
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
    const fallbackOptions: SpeakerOptions = {
      ...options,
      voice,
    }

    // 1. If audio is already cached in memory, play immediately
    if (this.neuralEngine.hasAudio(cleanText, normLocale, voice)) {
      try {
        const played = this.neuralEngine.playAudio(
          cleanText,
          normLocale,
          voice,
          options,
        )
        if (played) return true
      } catch {
        // Fall back seamlessly to browser speech synthesis
        return this.speakFallback(cleanText, normLocale, fallbackOptions)
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
              options,
            )
            if (!played) {
              this.speakFallback(cleanText, normLocale, fallbackOptions)
            }
          } else {
            this.speakFallback(cleanText, normLocale, fallbackOptions)
          }
        })
        .catch(() => {
          if (this.speakGeneration !== currentGen) return
          this.speakFallback(cleanText, normLocale, fallbackOptions)
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

    if (
      normLocale === 'es-MX' &&
      options?.dualVoice !== false &&
      isShortPhraseForDualVoice(cleanText)
    ) {
      const altVoice = getAlternateVoice(voice)
      void this.neuralEngine
        .fetchAndCacheAudio(cleanText, normLocale, {
          voice: altVoice,
          cardSeed: options?.cardSeed,
        })
        .catch(() => {})
    }

    return this.speakFallback(cleanText, normLocale, fallbackOptions)
  }
}
