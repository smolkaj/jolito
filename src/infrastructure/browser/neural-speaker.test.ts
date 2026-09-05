import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Speaker } from '../../application/ports'
import {
  isShortPhraseForDualVoice,
  LayeredNeuralSpeaker,
  LruAudioCache,
  NeuralVoiceEngine,
  STARTER_PHRASES,
} from './neural-speaker'

describe('LayeredNeuralSpeaker', () => {
  let fallbackSpeaker: Speaker
  let neuralEngine: NeuralVoiceEngine
  let fallbackSpeakSpy: ReturnType<
    typeof vi.fn<(text: string, locale: string) => boolean>
  >

  beforeEach(() => {
    fallbackSpeakSpy = vi
      .fn<(text: string, locale: string) => boolean>()
      .mockReturnValue(true)
    fallbackSpeaker = {
      supported: vi.fn().mockReturnValue(true),
      speak: fallbackSpeakSpy,
    }
    neuralEngine = new NeuralVoiceEngine()
  })

  it('delegates to fallback speaker when neural cache does not have phrase', () => {
    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    const played = speaker.speak('frase no empaquetada', 'es-MX')
    expect(played).toBe(true)
    expect(fallbackSpeakSpy).toHaveBeenCalledWith(
      'frase no empaquetada',
      'es-MX',
    )
  })

  it('plays cached neural audio when phrase is available in neural engine', () => {
    const mockPlayBuffer = vi.fn().mockReturnValue(true)
    vi.spyOn(neuralEngine, 'hasAudio').mockReturnValue(true)
    vi.spyOn(neuralEngine, 'playAudio').mockImplementation(mockPlayBuffer)

    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    const played = speaker.speak('aguacate', 'es-MX')
    expect(played).toBe(true)
    expect(mockPlayBuffer).toHaveBeenCalledWith(
      'aguacate',
      'es-MX',
      expect.any(String),
      undefined,
    )
    expect(fallbackSpeakSpy).not.toHaveBeenCalled()
  })

  it('falls back seamlessly if neural audio playback encounters an error', () => {
    vi.spyOn(neuralEngine, 'hasAudio').mockReturnValue(true)
    vi.spyOn(neuralEngine, 'playAudio').mockImplementation(() => {
      throw new Error('WebAudio decode error')
    })

    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    const played = speaker.speak('aguacate', 'es-MX')
    expect(played).toBe(true)
    expect(fallbackSpeakSpy).toHaveBeenCalledWith('aguacate', 'es-MX')
  })

  it('reports supported when either neural engine or fallback is supported', () => {
    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })
    expect(speaker.supported()).toBe(true)

    const unsupportedFallback: Speaker = {
      supported: () => false,
      speak: () => false,
    }
    vi.spyOn(neuralEngine, 'supported').mockReturnValue(true)
    const neuralOnlySpeaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker: unsupportedFallback,
    })
    expect(neuralOnlySpeaker.supported()).toBe(true)
  })

  it('delegates prewarm to neural engine', async () => {
    const prewarmSpy = vi.spyOn(neuralEngine, 'prewarm').mockResolvedValue(true)
    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    const result = await speaker.prewarm()
    expect(result).toBe(true)
    expect(prewarmSpy).toHaveBeenCalled()
  })

  it('deduplicates rapid consecutive speak calls for identical phrase and locale', () => {
    const mockPlayBuffer = vi.fn().mockReturnValue(true)
    vi.spyOn(neuralEngine, 'hasAudio').mockReturnValue(true)
    vi.spyOn(neuralEngine, 'playAudio').mockImplementation(mockPlayBuffer)

    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    const first = speaker.speak('aguacate', 'es-MX')
    const second = speaker.speak('aguacate', 'es-MX')

    expect(first).toBe(true)
    expect(second).toBe(true)
    expect(mockPlayBuffer).toHaveBeenCalledTimes(1)

    // Different phrase speaks immediately
    speaker.speak('Qué padre', 'es-MX')
    expect(mockPlayBuffer).toHaveBeenCalledTimes(2)
  })
  it('delegates prefetch to neural engine', async () => {
    const prefetchSpy =
      vi.spyOn(neuralEngine, 'prefetch').mockResolvedValue(true)
    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    const items = [{ text: 'hola', locale: 'es-MX' }]
    await speaker.prefetch(items)
    expect(prefetchSpy).toHaveBeenCalledWith(items, undefined)
  })

  it('triggers background fetchAndCacheAudio when speaking uncached phrase', () => {
    const fetchSpy = vi
      .spyOn(neuralEngine, 'fetchAndCacheAudio')
      .mockResolvedValue(true)

    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    const played = speaker.speak('palabra nueva', 'es-MX')
    expect(played).toBe(true)
    expect(fallbackSpeakSpy).toHaveBeenCalledWith('palabra nueva', 'es-MX')
    // Short Spanish phrases trigger background fetch for both voices
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    const call0 = fetchSpy.mock.calls[0]
    expect(call0?.[0]).toBe('palabra nueva')
    expect(call0?.[1]).toBe('es-MX')
    expect(typeof call0?.[2]).toBe('object')
    if (call0?.[2] && typeof call0[2] === 'object') {
      expect(call0[2].voice).toBeDefined()
    }
    const call1 = fetchSpy.mock.calls[1]
    expect(call1?.[0]).toBe('palabra nueva')
    expect(call1?.[1]).toBe('es-MX')
  })

  it('awaits in-flight prefetch for Card 0 and plays neural audio instead of falling back to robotic speech', async () => {
    let resolveInFlight: (value: boolean) => void = () => {}
    const inFlightPromise = new Promise<boolean>((resolve) => {
      resolveInFlight = resolve
    })

    vi.spyOn(neuralEngine, 'hasAudio').mockReturnValue(false)
    vi.spyOn(neuralEngine, 'isAudioInFlight').mockReturnValue(true)
    vi.spyOn(neuralEngine, 'awaitAudio').mockImplementation(
      () => inFlightPromise,
    )
    const playSpy = vi.spyOn(neuralEngine, 'playAudio').mockReturnValue(true)

    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    // Auto-play for Card 0 starts while prefetch is in flight
    const played = speaker.speak('primer tarjeta', 'es-MX', {
      cardSeed: 'card-1',
    })
    expect(played).toBe(true)
    // Fallback speaker must NOT be called immediately
    expect(fallbackSpeakSpy).not.toHaveBeenCalled()

    // Now in-flight prefetch completes
    resolveInFlight(true)
    await inFlightPromise

    // Neural audio plays smoothly
    expect(playSpy).toHaveBeenCalledWith(
      'primer tarjeta',
      'es-MX',
      expect.any(String),
      expect.anything(),
    )
    expect(fallbackSpeakSpy).not.toHaveBeenCalled()
  })

  it('plays neural audio for starter words like aguacate when in memory cache', () => {
    vi.spyOn(neuralEngine, 'hasAudio').mockReturnValue(true)
    const playAudioSpy = vi
      .spyOn(neuralEngine, 'playAudio')
      .mockReturnValue(true)

    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    const played = speaker.speak('aguacate', 'es-MX', { cardSeed: 'card-1' })
    expect(played).toBe(true)
    expect(playAudioSpy).toHaveBeenCalledWith(
      'aguacate',
      'es-MX',
      expect.any(String),
      expect.anything(),
    )
    expect(fallbackSpeakSpy).not.toHaveBeenCalled()
  })

  it('falls back to speech synthesis if in-flight prefetch times out after 200ms', async () => {
    vi.spyOn(neuralEngine, 'hasAudio').mockReturnValue(false)
    vi.spyOn(neuralEngine, 'isAudioInFlight').mockReturnValue(true)
    vi.spyOn(neuralEngine, 'awaitAudio').mockResolvedValue(false)

    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    const played = speaker.speak('palabra lenta', 'es-MX', {
      cardSeed: 'card-1',
    })
    expect(played).toBe(true)

    // Flush microtasks
    await Promise.resolve()
    expect(fallbackSpeakSpy).toHaveBeenCalledWith('palabra lenta', 'es-MX', {
      cardSeed: 'card-1',
    })
  })

  it('discards delayed awaitAudio playback and fallback when superseded by another speech action', async () => {
    let resolveAwaitAudio!: (ready: boolean) => void
    const awaitPromise = new Promise<boolean>((resolve) => {
      resolveAwaitAudio = resolve
    })

    vi.spyOn(neuralEngine, 'hasAudio').mockReturnValue(false)
    vi.spyOn(neuralEngine, 'isAudioInFlight').mockReturnValue(true)
    vi.spyOn(neuralEngine, 'awaitAudio').mockReturnValue(awaitPromise)
    const playAudioSpy = vi
      .spyOn(neuralEngine, 'playAudio')
      .mockReturnValue(true)

    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    // 1. First speak starts awaiting in-flight audio for card-1
    speaker.speak('prompt 1', 'es-MX', { cardSeed: 'card-1' })

    // 2. User rapidly navigates or speaks prompt 2 (superseding action)
    vi.spyOn(neuralEngine, 'hasAudio').mockReturnValue(true)
    vi.spyOn(neuralEngine, 'isAudioInFlight').mockReturnValue(false)
    speaker.speak('prompt 2', 'es-MX', { cardSeed: 'card-2' })

    // 3. Earlier awaitAudio completes with ready = true
    resolveAwaitAudio(true)
    await Promise.resolve()

    // It should play prompt 2, but NOT delayed prompt 1
    expect(playAudioSpy).toHaveBeenCalledWith(
      'prompt 2',
      'es-MX',
      expect.any(String),
      expect.anything(),
    )
    expect(playAudioSpy).not.toHaveBeenCalledWith(
      'prompt 1',
      'es-MX',
      expect.any(String),
      expect.anything(),
    )
    expect(fallbackSpeakSpy).not.toHaveBeenCalled()
  })

  it('stops active neural audio before delegating to fallback speaker', () => {
    const stopAudioSpy = vi.spyOn(neuralEngine, 'stopAudio')
    vi.spyOn(neuralEngine, 'hasAudio').mockReturnValue(false)
    vi.spyOn(neuralEngine, 'isAudioInFlight').mockReturnValue(false)

    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    speaker.speak('fallback phrase', 'es-MX')

    expect(stopAudioSpy).toHaveBeenCalled()
    expect(fallbackSpeakSpy).toHaveBeenCalledWith('fallback phrase', 'es-MX')
  })

  it('exposes cache and in-flight inspection helpers', () => {
    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })
    expect(typeof speaker.hasAudio).toBe('function')
    expect(typeof speaker.hasDiskAudio).toBe('function')
    expect(typeof speaker.isAudioInFlight).toBe('function')
    expect(typeof speaker.syncDiskCache).toBe('function')
  })

  it('awaits disk-cached audio and plays neural voice rather than falling back to robotic speech', async () => {
    const mockAudioContext = {
      state: 'running',
      decodeAudioData: (
        _data: ArrayBuffer,
        success: (buf: AudioBuffer) => void,
      ) => {
        success({ duration: 1.0 } as unknown as AudioBuffer)
      },
    } as unknown as AudioContext
    ;(neuralEngine as unknown as { audioContext: AudioContext }).audioContext =
      mockAudioContext

    const cachedMp3Buffer = new Uint8Array([1, 2, 3]).buffer
    const mockCache = {
      keys: vi
        .fn()
        .mockResolvedValue([
          new Request(
            'http://localhost/api/tts?text=en_disco&locale=es-mx&voice=es-MX-DaliaNeural',
          ),
        ]),
      match: vi.fn().mockResolvedValue(
        new Response(cachedMp3Buffer, {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' },
        }),
      ),
      put: vi.fn().mockResolvedValue(undefined),
    }
    Object.defineProperty(window, 'caches', {
      value: {
        open: vi.fn().mockResolvedValue(mockCache),
      },
      configurable: true,
      writable: true,
    })

    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    await speaker.syncDiskCache()
    expect(speaker.hasDiskAudio('en_disco', 'es-MX')).toBe(true)
    expect(speaker.hasAudio('en_disco', 'es-MX')).toBe(false)

    const playSpy = vi.spyOn(neuralEngine, 'playAudio').mockReturnValue(true)

    const played = speaker.speak('en_disco', 'es-MX', {
      voice: 'es-MX-DaliaNeural',
    })
    expect(played).toBe(true)

    // Fallback should NOT be invoked immediately
    expect(fallbackSpeakSpy).not.toHaveBeenCalled()

    // Allow microtasks and promise resolution for disk hydration
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Neural audio was played from disk cache
    expect(playSpy).toHaveBeenCalledWith(
      'en_disco',
      'es-MX',
      'es-MX-DaliaNeural',
      expect.anything(),
    )
    expect(fallbackSpeakSpy).not.toHaveBeenCalled()
  })

  it('falls back to speech synthesis if disk cache hydration times out', async () => {
    vi.spyOn(neuralEngine, 'hasDiskAudio').mockReturnValue(true)
    vi.spyOn(neuralEngine, 'awaitAudio').mockResolvedValue(false)

    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    const played = speaker.speak('timeout_disk', 'es-MX')
    expect(played).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(fallbackSpeakSpy).toHaveBeenCalledWith('timeout_disk', 'es-MX')
  })

  it('delegates pruneUnusedAudio to neural engine', async () => {
    const pruneSpy = vi
      .spyOn(neuralEngine, 'pruneUnusedAudio')
      .mockResolvedValue(3)
    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    const items = [{ text: 'hola', locale: 'es-MX' }]
    const count = await speaker.pruneUnusedAudio(items)
    expect(count).toBe(3)
    expect(pruneSpy).toHaveBeenCalledWith(items)
  })
})

describe('NeuralVoiceEngine', () => {
  it('defines starter phrases for prewarming', () => {
    expect(STARTER_PHRASES.length).toBeGreaterThan(0)
    expect(
      STARTER_PHRASES.some(
        (p) => p.text === 'aguacate' && p.locale === 'es-MX',
      ),
    ).toBe(true)
    expect(
      STARTER_PHRASES.some(
        (p) => p.text === 'avocado' && p.locale === 'en-US',
      ),
    ).toBe(true)
  })

  it('correctly registers and queries custom audio buffers with locale normalization', () => {
    const engine = new NeuralVoiceEngine()
    expect(engine.hasAudio('custom unbundled phrase', 'es_MX')).toBe(false)

    const mockBuffer = {} as AudioBuffer
    engine.registerAudioBuffer('custom unbundled phrase', 'es_MX', mockBuffer)

    // Should match both es_MX and es-MX case-insensitively
    expect(engine.hasAudio('custom unbundled phrase', 'es-MX')).toBe(true)
    expect(engine.hasAudio('  CUSTOM UNBUNDLED PHRASE  ', 'es_mx')).toBe(true)
  })

  it('correctly registers and queries audio data URLs', () => {
    const engine = new NeuralVoiceEngine()
    engine.registerAudioDataUrl(
      'custom english phrase',
      'en-US',
      'data:audio/wav;base64,...',
    )
    expect(engine.hasAudio('custom english phrase', 'en-US')).toBe(true)
    expect(engine.hasAudio('custom english phrase', 'en_US')).toBe(true)
  })

  it('returns false on playAudio when phrase is not in cache', () => {
    const engine = new NeuralVoiceEngine()
    expect(engine.playAudio('unregistered-phrase-xyz', 'es-MX')).toBe(false)
  })

  it('prewarms bundled audio by fetching and decoding audio into memory', async () => {
    const engine = new NeuralVoiceEngine()
    const mockAudioBuffer = { duration: 1.5 } as AudioBuffer
    const mockArrayBuffer = new ArrayBuffer(8)

    const mockDecode = vi.fn().mockResolvedValue(mockAudioBuffer)
    const mockAudioContext = {
      decodeAudioData: mockDecode,
      createBufferSource: vi.fn(),
      destination: {},
      state: 'running',
    } as unknown as AudioContext
    ;(engine as unknown as { audioContext: AudioContext }).audioContext =
      mockAudioContext

    const mockFetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      } as Response)
    })

    const result = await engine.prewarm(mockFetch)
    expect(result).toBe(true)

    expect(mockFetch).toHaveBeenCalled()
    // Should have decoded and registered in audioCache
    expect(engine.hasAudio('aguacate', 'es-MX')).toBe(true)
    expect(engine.hasAudio('avocado', 'en-US')).toBe(true)

    // Calling prewarm again should be idempotent and not re-fetch
    const callCount = mockFetch.mock.calls.length
    const secondResult = await engine.prewarm(mockFetch)
    expect(secondResult).toBe(true)
    expect(mockFetch.mock.calls.length).toBe(callCount)
  })

  it('handles network errors gracefully during prewarm and allows retry', async () => {
    const engine = new NeuralVoiceEngine()
    const failingFetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await engine.prewarm(failingFetch)
    expect(result).toBe(false)

    // Successful retry should re-attempt fetching
    const mockArrayBuffer = new ArrayBuffer(8)
    const recoveredFetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      } as Response)
    })
    const retryResult = await engine.prewarm(recoveredFetch)
    expect(retryResult).toBe(true)
    expect(recoveredFetch).toHaveBeenCalled()
  })

  it('handles non-ok HTTP responses gracefully during prewarm', async () => {
    const engine = new NeuralVoiceEngine()
    const notFoundFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })

    const result = await engine.prewarm(notFoundFetch)
    expect(result).toBe(false)
  })

  it('handles decode failures gracefully and allows retry without falsely caching', async () => {
    const engine = new NeuralVoiceEngine()
    const mockAudioContext = {
      decodeAudioData: vi.fn().mockRejectedValue(new Error('Corrupted audio')),
    } as unknown as AudioContext
    ;(engine as unknown as { audioContext: AudioContext }).audioContext =
      mockAudioContext

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })

    const result = await engine.prewarm(mockFetch)
    expect(result).toBe(false)

    // Should not have registered in audioCache
    const internalCache = (
      engine as unknown as { audioCache: Map<string, AudioBuffer> }
    ).audioCache
    expect(internalCache.size).toBe(0)
  })

  it('fetches uncached audio from /api/tts with deterministic voice and caches it in CacheStorage', async () => {
    const engine = new NeuralVoiceEngine()
    const mockBuffer = { duration: 1 } as AudioBuffer
    const mockAudioContext = {
      decodeAudioData: vi.fn().mockResolvedValue(mockBuffer),
      createBufferSource: vi.fn(),
      destination: {},
      state: 'running',
    } as unknown as AudioContext
    ;(engine as unknown as { audioContext: AudioContext }).audioContext =
      mockAudioContext

    const mockCacheStorage = new Map<string, Response>()
    const mockCache = {
      match: vi.fn((url: string) =>
        Promise.resolve(mockCacheStorage.get(url) ?? null),
      ),
      put: vi.fn((url: string, resp: Response) => {
        mockCacheStorage.set(url, resp)
        return Promise.resolve()
      }),
    }
    vi.stubGlobal('caches', {
      open: vi.fn(() => Promise.resolve(mockCache)),
    })

    const mockFetch = vi.fn().mockImplementation(() => {
      return Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]).buffer, {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' },
        }),
      )
    })

    const phrase = 'buenos días amigos'
    expect(engine.hasAudio(phrase, 'es-MX')).toBe(false)

    const success = await engine.fetchAndCacheAudio(phrase, 'es-MX', mockFetch)
    expect(success).toBe(true)

    // Now hasAudio should be true
    expect(engine.hasAudio(phrase, 'es-MX')).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const calledUrl = mockFetch.mock.calls[0]![0] as string
    expect(calledUrl).toContain('/api/tts?text=buenos+d%C3%ADas+amigos')
    expect(calledUrl).toMatch(/voice=es-MX-(Dalia|Jorge)Neural/)
    expect(mockCache.put).toHaveBeenCalledTimes(1)

    // Second call should retrieve from CacheStorage without calling fetch
    const secondFetch = vi.fn()
    const secondSuccess = await engine.fetchAndCacheAudio(
      phrase,
      'es-MX',
      secondFetch,
    )
    expect(secondSuccess).toBe(true)
    expect(secondFetch).not.toHaveBeenCalled()
  })

  it('prefetches multiple items, skipping already cached phrases', async () => {
    const engine = new NeuralVoiceEngine()
    const mockBuffer = { duration: 1 } as AudioBuffer
    const mockAudioContext = {
      decodeAudioData: vi.fn().mockResolvedValue(mockBuffer),
      createBufferSource: vi.fn(),
      destination: {},
      state: 'running',
    } as unknown as AudioContext
    ;(engine as unknown as { audioContext: AudioContext }).audioContext =
      mockAudioContext

    const mockFetch = vi.fn().mockImplementation(() => {
      return Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]).buffer, {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' },
        }),
      )
    })

    // 'aguacate' is bundled, 'palabra 1' and 'palabra 2' are new
    await engine.prefetch(
      [
        { text: 'aguacate', locale: 'es-MX' },
        { text: 'palabra uno', locale: 'es-MX' },
        { text: 'palabra dos', locale: 'es-MX' },
      ],
      mockFetch,
    )

    // mockFetch should only be called for the 2 unbundled phrases
    expect(engine.hasAudio('palabra uno', 'es-MX')).toBe(true)
    expect(engine.hasAudio('palabra dos', 'es-MX')).toBe(true)
  })

  it('deduplicates identical prefetch items and skips in-flight items', async () => {
    const engine = new NeuralVoiceEngine()
    const mockAudioContext = {
      state: 'running',
      decodeAudioData: (
        _data: ArrayBuffer,
        success: (buf: AudioBuffer) => void,
      ) => {
        success({ duration: 1 } as unknown as AudioBuffer)
      },
    } as unknown as AudioContext
    ;(engine as unknown as { audioContext: AudioContext }).audioContext =
      mockAudioContext

    const mockFetch = vi.fn().mockImplementation(() => {
      return Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]).buffer, {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' },
        }),
      )
    })

    // Pass duplicate items for 'palabra repetida'
    await engine.prefetch(
      [
        {
          text: 'palabra repetida',
          locale: 'es-MX',
          cardSeed: 'seed-1',
          bothVoices: false,
        },
        {
          text: 'palabra repetida',
          locale: 'es-MX',
          cardSeed: 'seed-1',
          bothVoices: false,
        },
      ],
      mockFetch,
    )

    // Should only fetch once despite duplicate items in the array
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(engine.hasAudio('palabra repetida', 'es-MX')).toBe(true)

    // Test skipping in-flight items
    let resolveInFlight!: (res: Response) => void
    const inFlightPromise = new Promise<Response>((resolve) => {
      resolveInFlight = resolve
    })

    // Start an in-flight fetch for 'en vuelo'
    const pendingFetch = engine.fetchAndCacheAudio(
      'en vuelo',
      'es-MX',
      () => inFlightPromise,
    )
    expect(engine.isAudioInFlight('en vuelo', 'es-MX')).toBe(true)

    const mockPrefetchFetch = vi.fn()
    // Attempt to prefetch 'en vuelo' while it is in-flight (single voice)
    await engine.prefetch(
      [{ text: 'en vuelo', locale: 'es-MX', bothVoices: false }],
      mockPrefetchFetch,
    )

    // Prefetch must skip the in-flight item, so mockPrefetchFetch is not called
    expect(mockPrefetchFetch).not.toHaveBeenCalled()

    // Clean up in-flight fetch
    resolveInFlight(
      new Response(new Uint8Array([1, 2, 3]).buffer, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      }),
    )
    await pendingFetch
  })

  it('keeps audio isolated by voice so identical phrases across different personas do not collide', () => {
    const engine = new NeuralVoiceEngine()
    const daliaBuffer = { duration: 1 } as unknown as AudioBuffer
    const jorgeBuffer = { duration: 2 } as unknown as AudioBuffer

    engine.registerAudioBuffer(
      'hola',
      'es-MX',
      daliaBuffer,
      'es-MX-DaliaNeural',
    )

    // Dalia voice is present
    expect(engine.hasAudio('hola', 'es-MX', 'es-MX-DaliaNeural')).toBe(true)

    // Jorge voice must NOT be present and must not be hijacked by Dalia
    expect(engine.hasAudio('hola', 'es-MX', 'es-MX-JorgeNeural')).toBe(false)

    // Registering Jorge separately must preserve both
    engine.registerAudioBuffer(
      'hola',
      'es-MX',
      jorgeBuffer,
      'es-MX-JorgeNeural',
    )
    expect(engine.hasAudio('hola', 'es-MX', 'es-MX-JorgeNeural')).toBe(true)
    expect(engine.hasAudio('hola', 'es-MX', 'es-MX-DaliaNeural')).toBe(true)
  })

  it('stops previous audio playback and cancels speech synthesis when stopAudio is called', () => {
    const engine = new NeuralVoiceEngine()
    const mockStop = vi.fn()
    const mockDisconnect = vi.fn()
    const mockSource = {
      stop: mockStop,
      disconnect: mockDisconnect,
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
    } as unknown as AudioBufferSourceNode

    ;(
      engine as unknown as { currentSource: AudioBufferSourceNode | null }
    ).currentSource = mockSource

    const cancelSpy = vi.fn()
    Object.defineProperty(window, 'speechSynthesis', {
      value: { cancel: cancelSpy },
      configurable: true,
      writable: true,
    })

    engine.stopAudio()

    expect(mockStop).toHaveBeenCalled()
    expect(mockDisconnect).toHaveBeenCalled()
    expect(cancelSpy).toHaveBeenCalled()
  })

  it('evicts least recently used audio buffers when exceeding maxMemoryBuffers', () => {
    const engine = new NeuralVoiceEngine(2)
    const buf1 = { duration: 1 } as unknown as AudioBuffer
    const buf2 = { duration: 2 } as unknown as AudioBuffer
    const buf3 = { duration: 3 } as unknown as AudioBuffer

    engine.registerAudioBuffer('uno', 'es-MX', buf1)
    engine.registerAudioBuffer('dos', 'es-MX', buf2)

    expect(engine.hasAudio('uno', 'es-MX')).toBe(true)
    expect(engine.hasAudio('dos', 'es-MX')).toBe(true)

    // Access 'uno' via playAudio to make it MRU
    engine.playAudio('uno', 'es-MX')

    // Register 3rd item
    engine.registerAudioBuffer('tres', 'es-MX', buf3)

    // 'dos' must have been evicted, 'uno' and 'tres' must remain
    expect(engine.hasAudio('uno', 'es-MX')).toBe(true)
    expect(engine.hasAudio('dos', 'es-MX')).toBe(false)
    expect(engine.hasAudio('tres', 'es-MX')).toBe(true)
  })

  it('hydrates previously cached audio from CacheStorage during offline prefetch without making network requests', async () => {
    const engine = new NeuralVoiceEngine()
    const mockAudioContext = {
      state: 'running',
      decodeAudioData: (
        _data: ArrayBuffer,
        success: (buf: AudioBuffer) => void,
      ) => {
        success({ duration: 1.2 } as unknown as AudioBuffer)
      },
    } as unknown as AudioContext
    ;(engine as unknown as { audioContext: AudioContext }).audioContext =
      mockAudioContext

    const cachedMp3Buffer = new Uint8Array([10, 20, 30]).buffer
    const mockCache = {
      match: vi.fn().mockImplementation((url: string) => {
        // Only return cached response for 'guardada', not for 'otra frase'
        if (url.includes('text=guardada')) {
          return Promise.resolve(
            new Response(cachedMp3Buffer, {
              status: 200,
              headers: { 'Content-Type': 'audio/mpeg' },
            }),
          )
        }
        return Promise.resolve(undefined)
      }),
      put: vi.fn().mockResolvedValue(undefined),
    }

    Object.defineProperty(window, 'caches', {
      value: {
        open: vi.fn().mockResolvedValue(mockCache),
      },
      configurable: true,
      writable: true,
    })

    // Simulate offline device
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    })

    const mockFetch = vi.fn()

    try {
      await engine.prefetch(
        [
          { text: 'guardada', locale: 'es-MX' },
          { text: 'otra frase', locale: 'es-MX' },
        ],
        mockFetch,
      )

      // Network fetch must never be called while offline
      expect(mockFetch).not.toHaveBeenCalled()

      // The phrase that was present in CacheStorage must be hydrated into memory
      expect(engine.hasAudio('guardada', 'es-MX')).toBe(true)

      // The uncached phrase was safely skipped
      expect(engine.hasAudio('otra frase', 'es-MX')).toBe(false)
    } finally {
      // Restore online state
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        configurable: true,
        writable: true,
      })
    }
  })

  it('skips decoding into memory during prefetch when memory is full while saving to CacheStorage', async () => {
    const engine = new NeuralVoiceEngine(1)
    const mockAudioContext = {
      state: 'running',
      decodeAudioData: vi.fn(
        (_data: ArrayBuffer, success: (buf: AudioBuffer) => void) => {
          success({ duration: 1 } as unknown as AudioBuffer)
        },
      ),
    } as unknown as AudioContext
    ;(engine as unknown as { audioContext: AudioContext }).audioContext =
      mockAudioContext

    const mockPut = vi.fn().mockResolvedValue(undefined)
    const mockCache = {
      match: vi.fn().mockResolvedValue(undefined),
      put: mockPut,
    }
    Object.defineProperty(window, 'caches', {
      value: {
        open: vi.fn().mockResolvedValue(mockCache),
      },
      configurable: true,
      writable: true,
    })

    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2]).buffer, {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' },
        }),
      ),
    )

    // Item 1 should fill the cache
    await engine.prefetch([{ text: 'primera', locale: 'es-MX' }], mockFetch)
    expect(engine.hasAudio('primera', 'es-MX')).toBe(true)
    const decodeCalls = (
      mockAudioContext.decodeAudioData as ReturnType<typeof vi.fn>
    ).mock.calls.length

    // Item 2: memory is full (1 item), so prefetch should save to CacheStorage but skip decoding into memory
    await engine.prefetch([{ text: 'segunda', locale: 'es-MX' }], mockFetch)
    expect(mockPut).toHaveBeenCalled()
    // decodeAudioData should not have been called for 'segunda'
    expect(
      (mockAudioContext.decodeAudioData as ReturnType<typeof vi.fn>).mock.calls
        .length,
    ).toBe(decodeCalls)
    // 'primera' was not evicted
    expect(engine.hasAudio('primera', 'es-MX')).toBe(true)
  })

  it('cooperatively yields between prefetch batches', async () => {
    const engine = new NeuralVoiceEngine()
    const mockAudioContext = {
      state: 'running',
      decodeAudioData: (
        _data: ArrayBuffer,
        success: (buf: AudioBuffer) => void,
      ) => {
        success({ duration: 1 } as unknown as AudioBuffer)
      },
    } as unknown as AudioContext
    ;(engine as unknown as { audioContext: AudioContext }).audioContext =
      mockAudioContext

    const idleSpy = vi.fn((cb: () => void) => {
      cb()
      return 1
    })
    Object.defineProperty(window, 'requestIdleCallback', {
      value: idleSpy,
      configurable: true,
      writable: true,
    })

    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2]).buffer, {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' },
        }),
      ),
    )

    // Prefetch 4 items (concurrency is 3, so 2 batches: batch 1 has 3 items, batch 2 has 1 item)
    await engine.prefetch(
      [
        { text: 'batch item 1', locale: 'es-MX' },
        { text: 'batch item 2', locale: 'es-MX' },
        { text: 'batch item 3', locale: 'es-MX' },
        { text: 'batch item 4', locale: 'es-MX' },
      ],
      mockFetch,
    )

    // requestIdleCallback should have been called between batch 1 and batch 2
    expect(idleSpy).toHaveBeenCalled()
  })

  it('populates disk cache keys from CacheStorage and detects disk-cached phrases', async () => {
    const mockRequests = [
      new Request(
        'http://localhost/api/tts?text=palabra_en_disco&locale=es-mx&voice=es-MX-DaliaNeural',
      ),
      new Request(
        'http://localhost/api/tts?text=%C2%A1buenos%20d%C3%ADas!&locale=es-mx&voice=es-MX-JorgeNeural',
      ),
    ]
    const mockCache = {
      keys: vi.fn().mockResolvedValue(mockRequests),
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
    }
    Object.defineProperty(window, 'caches', {
      value: {
        open: vi.fn().mockResolvedValue(mockCache),
      },
      configurable: true,
      writable: true,
    })

    const engine = new NeuralVoiceEngine()
    await engine.syncDiskCache()

    expect(engine.hasDiskAudio('palabra_en_disco', 'es-MX')).toBe(true)
    expect(
      engine.hasDiskAudio('palabra_en_disco', 'es-MX', 'es-MX-DaliaNeural'),
    ).toBe(true)
    // Specific opposite voice returns false when not cached
    expect(
      engine.hasDiskAudio('palabra_en_disco', 'es-MX', 'es-MX-JorgeNeural'),
    ).toBe(false)
    // Resilient to punctuation
    expect(engine.hasDiskAudio('buenos días', 'es-MX')).toBe(true)
    expect(engine.hasDiskAudio('¡buenos días!', 'es-MX')).toBe(true)
    // Non-existent phrase returns false
    expect(engine.hasDiskAudio('no existe', 'es-MX')).toBe(false)
  })

  it('prunes unreferenced audio from CacheStorage and cleans up disk/memory caches', async () => {
    const req1 = new Request(
      'http://localhost/api/tts?text=active_phrase&locale=es-mx&voice=es-MX-DaliaNeural',
    )
    const req2 = new Request(
      'http://localhost/api/tts?text=deleted_phrase&locale=es-mx&voice=es-MX-JorgeNeural',
    )
    const mockDelete = vi.fn().mockResolvedValue(true)
    const mockCache = {
      keys: vi.fn().mockResolvedValue([req1, req2]),
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      delete: mockDelete,
    }
    Object.defineProperty(window, 'caches', {
      value: {
        open: vi.fn().mockResolvedValue(mockCache),
      },
      configurable: true,
      writable: true,
    })

    const engine = new NeuralVoiceEngine()
    await engine.syncDiskCache()
    expect(engine.hasDiskAudio('active_phrase', 'es-MX')).toBe(true)
    expect(engine.hasDiskAudio('deleted_phrase', 'es-MX')).toBe(true)

    // Prune with only 'active_phrase' present
    const prunedCount = await engine.pruneUnusedAudio([
      { text: 'active_phrase', locale: 'es-MX' },
    ])
    expect(prunedCount).toBe(1)
    expect(mockDelete).toHaveBeenCalledTimes(1)
    const deletedArg: unknown = mockDelete.mock.calls[0]?.[0]
    const deletedUrl =
      deletedArg instanceof Request ? deletedArg.url : String(deletedArg)
    expect(deletedUrl).toContain('deleted_phrase')
    expect(deletedUrl).not.toContain('active_phrase')

    // Deleted phrase is no longer recognized as disk-cached
    expect(engine.hasDiskAudio('deleted_phrase', 'es-MX')).toBe(false)
    expect(engine.hasDiskAudio('active_phrase', 'es-MX')).toBe(true)
  })

  it('awaits in-flight disk key population before pruning unused audio', async () => {
    let resolveKeys!: (value: Request[]) => void
    const keysPromise = new Promise<Request[]>((resolve) => {
      resolveKeys = resolve
    })
    const req1 = new Request(
      'http://localhost/api/tts?text=active_phrase&locale=es-mx&voice=es-MX-DaliaNeural',
    )
    const req2 = new Request(
      'http://localhost/api/tts?text=deleted_phrase&locale=es-mx&voice=es-MX-JorgeNeural',
    )
    const mockDelete = vi.fn().mockResolvedValue(true)
    let callCount = 0
    const mockCache = {
      keys: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return keysPromise
        }
        return Promise.resolve([req1, req2])
      }),
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      delete: mockDelete,
    }
    Object.defineProperty(window, 'caches', {
      value: {
        open: vi.fn().mockResolvedValue(mockCache),
      },
      configurable: true,
      writable: true,
    })

    const engine = new NeuralVoiceEngine()
    let pruneResolved = false
    const prunePromise = engine
      .pruneUnusedAudio([{ text: 'active_phrase', locale: 'es-MX' }])
      .then((count) => {
        pruneResolved = true
        return count
      })

    // Before keysPromise resolves, pruneUnusedAudio must still be awaiting diskKeysPromise
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(pruneResolved).toBe(false)

    // Resolve the background disk keys population
    resolveKeys([req1, req2])

    const prunedCount = await prunePromise
    expect(prunedCount).toBe(1)
    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(engine.hasDiskAudio('deleted_phrase', 'es-MX')).toBe(false)
    expect(engine.hasDiskAudio('active_phrase', 'es-MX')).toBe(true)
  })

  it('retries disk cache population if an earlier attempt failed', async () => {
    let attempt = 0
    const req = new Request(
      'http://localhost/api/tts?text=retry_phrase&locale=es-mx&voice=es-MX-DaliaNeural',
    )
    const mockCache = {
      keys: vi.fn().mockImplementation(() => {
        attempt++
        if (attempt === 1)
          return Promise.reject(new Error('Cache transient read failure'))
        return Promise.resolve([req])
      }),
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
    }
    Object.defineProperty(window, 'caches', {
      value: {
        open: vi.fn().mockResolvedValue(mockCache),
      },
      configurable: true,
      writable: true,
    })

    const engine = new NeuralVoiceEngine()
    // First attempt fails transiently
    await engine.syncDiskCache()
    expect(engine.hasDiskAudio('retry_phrase', 'es-MX')).toBe(false)

    // Second attempt recovers and populates keys
    await engine.syncDiskCache()
    expect(engine.hasDiskAudio('retry_phrase', 'es-MX')).toBe(true)
  })
})

describe('LruAudioCache', () => {
  it('enforces maximum capacity by evicting the least recently used entries', () => {
    const cache = new LruAudioCache(2)
    const buf1 = { duration: 1 } as unknown as AudioBuffer
    const buf2 = { duration: 2 } as unknown as AudioBuffer
    const buf3 = { duration: 3 } as unknown as AudioBuffer

    cache.set('k1', buf1)
    cache.set('k2', buf2)
    expect(cache.size).toBe(2)
    expect(cache.has('k1')).toBe(true)
    expect(cache.has('k2')).toBe(true)

    // Adding a 3rd entry evicts the oldest entry ('k1')
    cache.set('k3', buf3)
    expect(cache.size).toBe(2)
    expect(cache.has('k1')).toBe(false)
    expect(cache.has('k2')).toBe(true)
    expect(cache.has('k3')).toBe(true)
  })

  it('refreshes item position upon get() to prevent eviction of recently accessed items', () => {
    const cache = new LruAudioCache(2)
    const buf1 = { duration: 1 } as unknown as AudioBuffer
    const buf2 = { duration: 2 } as unknown as AudioBuffer
    const buf3 = { duration: 3 } as unknown as AudioBuffer

    cache.set('k1', buf1)
    cache.set('k2', buf2)

    // Access 'k1' to promote it to most recently used
    expect(cache.get('k1')).toBe(buf1)

    // Adding 'k3' should now evict 'k2', keeping 'k1' and 'k3'
    cache.set('k3', buf3)
    expect(cache.size).toBe(2)
    expect(cache.has('k1')).toBe(true)
    expect(cache.has('k2')).toBe(false)
    expect(cache.has('k3')).toBe(true)
  })

  it('updates existing keys without growing size or evicting other keys', () => {
    const cache = new LruAudioCache(2)
    const buf1 = { duration: 1 } as unknown as AudioBuffer
    const buf2 = { duration: 2 } as unknown as AudioBuffer
    const buf1Updated = { duration: 1.5 } as unknown as AudioBuffer

    cache.set('k1', buf1)
    cache.set('k2', buf2)
    expect(cache.size).toBe(2)

    cache.set('k1', buf1Updated)
    expect(cache.size).toBe(2)
    expect(cache.get('k1')).toBe(buf1Updated)
    expect(cache.has('k2')).toBe(true)
  })

  it('supports delete, clear, and key/value/entry iteration', () => {
    const cache = new LruAudioCache(3)
    const buf1 = { duration: 1 } as unknown as AudioBuffer
    const buf2 = { duration: 2 } as unknown as AudioBuffer

    cache.set('a', buf1)
    cache.set('b', buf2)

    expect(Array.from(cache.keys())).toEqual(['a', 'b'])
    expect(Array.from(cache.values())).toEqual([buf1, buf2])
    expect(Array.from(cache.entries())).toEqual([
      ['a', buf1],
      ['b', buf2],
    ])
    expect(Array.from(cache)).toEqual([
      ['a', buf1],
      ['b', buf2],
    ])

    expect(cache.delete('a')).toBe(true)
    expect(cache.has('a')).toBe(false)
    expect(cache.size).toBe(1)

    cache.clear()
    expect(cache.size).toBe(0)
  })

  it('defensively clamps maxSize to at least 1', () => {
    const cacheZero = new LruAudioCache(0)
    expect(cacheZero.maxSize).toBe(1)

    const cacheNegative = new LruAudioCache(-10)
    expect(cacheNegative.maxSize).toBe(1)

    const buf1 = { duration: 1 } as unknown as AudioBuffer
    const buf2 = { duration: 2 } as unknown as AudioBuffer

    cacheZero.set('a', buf1)
    expect(cacheZero.size).toBe(1)
    expect(cacheZero.get('a')).toBe(buf1)

    // Second insertion evicts the first because maxSize is clamped to 1
    cacheZero.set('b', buf2)
    expect(cacheZero.size).toBe(1)
    expect(cacheZero.get('a')).toBeUndefined()
    expect(cacheZero.get('b')).toBe(buf2)
  })
})

describe('isShortPhraseForDualVoice', () => {
  it('identifies short phrases eligible for dual-voice playback', () => {
    expect(isShortPhraseForDualVoice('hola')).toBe(true)
    expect(isShortPhraseForDualVoice('buenos días')).toBe(true)
    expect(isShortPhraseForDualVoice('la cuenta por')).toBe(true)
    expect(isShortPhraseForDualVoice('la cuenta por favor')).toBe(false) // 4 words
    expect(isShortPhraseForDualVoice('')).toBe(false)
    expect(
      isShortPhraseForDualVoice('supercalifragilisticoexpialidoso extra largo'),
    ).toBe(false) // > 30 characters
  })
})

describe('Dual-voice playback', () => {
  it('schedules playback of alternate voice for short Spanish phrases with brief pause', () => {
    vi.useFakeTimers()
    const engine = new NeuralVoiceEngine()
    const mockSource = {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null as (() => void) | null,
    }
    const mockAudioContext = {
      state: 'running',
      createBufferSource: vi.fn().mockReturnValue(mockSource),
      destination: {},
    } as unknown as AudioContext
    ;(engine as unknown as { audioContext: AudioContext }).audioContext =
      mockAudioContext

    const daliaBuffer = { duration: 0.8 } as unknown as AudioBuffer
    const jorgeBuffer = { duration: 0.9 } as unknown as AudioBuffer

    engine.registerAudioBuffer(
      'hola',
      'es-MX',
      daliaBuffer,
      'es-MX-DaliaNeural',
    )
    engine.registerAudioBuffer(
      'hola',
      'es-MX',
      jorgeBuffer,
      'es-MX-JorgeNeural',
    )

    const playSpy = vi.spyOn(engine, 'playAudio')
    engine.playAudio('hola', 'es-MX', 'es-MX-DaliaNeural')

    expect(mockSource.start).toHaveBeenCalledTimes(1)
    // Simulate first voice audio finishing
    mockSource.onended?.()

    // Alternate voice not played immediately (pause window)
    expect(playSpy).toHaveBeenCalledTimes(1)

    // Advance timers past 320ms pause
    vi.advanceTimersByTime(350)

    // Alternate voice (Jorge) should now have been invoked with dualVoice: false
    expect(playSpy).toHaveBeenCalledTimes(2)
    expect(playSpy).toHaveBeenLastCalledWith(
      'hola',
      'es-MX',
      'es-MX-JorgeNeural',
      { dualVoice: false },
    )
    vi.useRealTimers()
  })

  it('cancels pending dual voice playback if stopAudio is called during the pause', () => {
    vi.useFakeTimers()
    const engine = new NeuralVoiceEngine()
    const mockSource = {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null as (() => void) | null,
    }
    const mockAudioContext = {
      state: 'running',
      createBufferSource: vi.fn().mockReturnValue(mockSource),
      destination: {},
    } as unknown as AudioContext
    ;(engine as unknown as { audioContext: AudioContext }).audioContext =
      mockAudioContext

    const daliaBuffer = { duration: 0.8 } as unknown as AudioBuffer
    engine.registerAudioBuffer(
      'hola',
      'es-MX',
      daliaBuffer,
      'es-MX-DaliaNeural',
    )

    const playSpy = vi.spyOn(engine, 'playAudio')
    engine.playAudio('hola', 'es-MX', 'es-MX-DaliaNeural')
    mockSource.onended?.()

    // Stop audio before timer fires
    engine.stopAudio()
    vi.advanceTimersByTime(400)

    // Second voice should NOT be called
    expect(playSpy).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('does not trigger dual voice playback for long phrases or when dualVoice is false', () => {
    vi.useFakeTimers()
    const engine = new NeuralVoiceEngine()
    const mockSource = {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null as (() => void) | null,
    }
    const mockAudioContext = {
      state: 'running',
      createBufferSource: vi.fn().mockReturnValue(mockSource),
      destination: {},
    } as unknown as AudioContext
    ;(engine as unknown as { audioContext: AudioContext }).audioContext =
      mockAudioContext

    const longBuffer = { duration: 2.5 } as unknown as AudioBuffer
    engine.registerAudioBuffer(
      'hola',
      'es-MX',
      longBuffer,
      'es-MX-DaliaNeural',
    )

    const playSpy = vi.spyOn(engine, 'playAudio')
    // Duration > 1.35s should not qualify
    engine.playAudio('hola', 'es-MX', 'es-MX-DaliaNeural')
    mockSource.onended?.()
    vi.advanceTimersByTime(500)
    expect(playSpy).toHaveBeenCalledTimes(1)

    // Explicit dualVoice: false should not qualify
    const shortBuffer = { duration: 0.5 } as unknown as AudioBuffer
    engine.registerAudioBuffer('si', 'es-MX', shortBuffer, 'es-MX-DaliaNeural')
    engine.playAudio('si', 'es-MX', 'es-MX-DaliaNeural', { dualVoice: false })
    mockSource.onended?.()
    vi.advanceTimersByTime(500)
    expect(playSpy).toHaveBeenCalledTimes(2) // 1 previous + 1 current = 2, no extra alternate
    vi.useRealTimers()
  })
})

