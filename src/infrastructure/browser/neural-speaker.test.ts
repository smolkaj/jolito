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
    expect(mockPlayBuffer).toHaveBeenCalledWith('aguacate', 'es-MX')
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
    const prewarmSpy = vi.spyOn(neuralEngine, 'prewarm').mockResolvedValue()
    const speaker = new LayeredNeuralSpeaker({
      neuralEngine,
      fallbackSpeaker,
    })

    await speaker.prewarm()
    expect(prewarmSpy).toHaveBeenCalled()
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

    await engine.prewarm(mockFetch)

    expect(mockFetch).toHaveBeenCalled()
    // Should have decoded and registered in audioCache
    const internalCache = (
      engine as unknown as { audioCache: Map<string, AudioBuffer> }
    ).audioCache
    expect(internalCache.get('es-mx:aguacate')).toBe(mockAudioBuffer)
    expect(internalCache.get('en-us:avocado')).toBe(mockAudioBuffer)

    // Calling prewarm again should be idempotent and not re-fetch
    const callCount = mockFetch.mock.calls.length
    await engine.prewarm(mockFetch)
    expect(mockFetch.mock.calls.length).toBe(callCount)
  })

  it('handles network errors gracefully during prewarm without throwing', async () => {
    const engine = new NeuralVoiceEngine()
    const failingFetch = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(engine.prewarm(failingFetch)).resolves.toBeUndefined()
  })

  it('handles non-ok HTTP responses and decode failures gracefully during prewarm', async () => {
    const engine = new NeuralVoiceEngine()
    const mockAudioContext = {
      decodeAudioData: vi.fn().mockRejectedValue(new Error('Decode failed')),
    } as unknown as AudioContext
    ;(engine as unknown as { audioContext: AudioContext }).audioContext =
      mockAudioContext

    const notFoundFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })

    await expect(engine.prewarm(notFoundFetch)).resolves.toBeUndefined()
  })
})
