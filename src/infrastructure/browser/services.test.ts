import { describe, expect, it, vi } from 'vitest'
import { OfflineCardAssistant } from '../../application/card-assistant'
import { LayeredNeuralSpeaker } from './neural-speaker'
import {
  createBrowserServices,
  RandomIdGenerator,
  SystemClock,
} from './services'

describe('createBrowserServices', () => {
  it('instantiates all required application services and triggers prewarming', () => {
    const speakerSpy = vi
      .spyOn(LayeredNeuralSpeaker.prototype, 'prewarm')
      .mockResolvedValue(true)
    const assistantSpy = vi
      .spyOn(OfflineCardAssistant.prototype, 'loadDictionary')
      .mockResolvedValue(true)

    const services = createBrowserServices()

    expect(speakerSpy).toHaveBeenCalledTimes(1)
    expect(assistantSpy).toHaveBeenCalledTimes(1)
    expect(services.clock).toBeDefined()
    expect(services.ids).toBeDefined()
    expect(services.cards).toBeDefined()
    expect(services.speaker).toBeDefined()
    expect(services.sounds).toBeDefined()
    expect(services.assistant).toBeDefined()
    expect(services.auth).toBeDefined()
    expect(services.sync).toBeDefined()
    expect(services.feedback).toBeDefined()

    speakerSpy.mockRestore()
    assistantSpy.mockRestore()
  })

  it('SystemClock provides current epoch timestamp', () => {
    const clock = new SystemClock()
    const now = clock.now()
    expect(typeof now).toBe('number')
    expect(now).toBeGreaterThan(0)
  })

  it('RandomIdGenerator generates unique IDs with default and custom prefix', () => {
    const gen = new RandomIdGenerator()
    const id1 = gen.nextId()
    const id2 = gen.nextId('card')

    expect(id1.startsWith('note-')).toBe(true)
    expect(id2.startsWith('card-')).toBe(true)
    expect(id1).not.toEqual(id2)
  })
})
