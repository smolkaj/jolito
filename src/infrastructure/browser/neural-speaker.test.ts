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
