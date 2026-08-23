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

    const played = speaker.speak('¿Dónde está el metro?', 'es-MX')
    expect(played).toBe(true)
    expect(fallbackSpeakSpy).toHaveBeenCalledWith(
      '¿Dónde está el metro?',
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
})

describe('NeuralVoiceEngine', () => {
  it('correctly registers and queries audio buffers with locale normalization', () => {
    const engine = new NeuralVoiceEngine()
    expect(engine.hasAudio('aguacate', 'es_MX')).toBe(false)

    const mockBuffer = {} as AudioBuffer
    engine.registerAudioBuffer('aguacate', 'es_MX', mockBuffer)

    // Should match both es_MX and es-MX case-insensitively
    expect(engine.hasAudio('aguacate', 'es-MX')).toBe(true)
    expect(engine.hasAudio('  AGUACATE  ', 'es_mx')).toBe(true)
    expect(engine.hasAudio('avocado', 'en-US')).toBe(false)
  })

  it('correctly registers and queries audio data URLs', () => {
    const engine = new NeuralVoiceEngine()
    engine.registerAudioDataUrl('avocado', 'en-US', 'data:audio/wav;base64,...')
    expect(engine.hasAudio('avocado', 'en-US')).toBe(true)
    expect(engine.hasAudio('avocado', 'en_US')).toBe(true)
  })

  it('returns false on playAudio when phrase is not in cache', () => {
    const engine = new NeuralVoiceEngine()
    expect(engine.playAudio('nonexistent', 'es-MX')).toBe(false)
  })
})
