import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Speaker } from '../../application/ports'
import { LayeredNeuralSpeaker, NeuralVoiceEngine } from './neural-speaker'

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
    const prefetchSpy = vi.spyOn(neuralEngine, 'prefetch').mockResolvedValue()
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
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const call = fetchSpy.mock.calls[0]
    expect(call?.[0]).toBe('palabra nueva')
    expect(call?.[1]).toBe('es-MX')
    expect(typeof call?.[2]).toBe('object')
    if (call?.[2] && typeof call[2] === 'object') {
      expect(call[2].voice).toBeDefined()
    }
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
    )
    expect(fallbackSpeakSpy).not.toHaveBeenCalled()
  })

  it('plays bundled neural audio for starter words like aguacate without mocking hasAudio', () => {
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
    expect(fallbackSpeakSpy).toHaveBeenCalledWith('palabra lenta', 'es-MX')
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
    )
    expect(playAudioSpy).not.toHaveBeenCalledWith(
      'prompt 1',
      'es-MX',
      expect.any(String),
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
})

describe('NeuralVoiceEngine', () => {
  it('bundles pristine neural audio for starter and sample phrases', () => {
    const engine = new NeuralVoiceEngine()
    expect(engine.hasAudio('aguacate', 'es-MX')).toBe(true)
    expect(engine.hasAudio('  AGUACATE  ', 'es_mx')).toBe(true)
    expect(engine.hasAudio('avocado', 'en-US')).toBe(true)
    expect(engine.hasAudio('¿Dónde está el metro?', 'es-MX')).toBe(true)
    expect(engine.hasAudio('Donde esta el metro', 'es-MX')).toBe(true)
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
    const internalCache = (
      engine as unknown as { audioCache: Map<string, AudioBuffer> }
    ).audioCache
    expect(internalCache.get('es-mx:aguacate')).toBe(mockAudioBuffer)
    expect(internalCache.get('en-us:avocado')).toBe(mockAudioBuffer)

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
})
