import { describe, expect, it, vi } from 'vitest'
import { BrowserDeletionLock, NativeDeletionLock } from './deletion-lock'
import { Capacitor } from '@capacitor/core'
import { EnhancedBrowserSpeaker } from './speech'
import { OfflineCardAssistant } from '../../application/card-assistant'
import { LayeredNeuralSpeaker } from './neural-speaker'
import {
  createBrowserServices,
  initializeBrowserServices,
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
    expect(services.deletionLock).toBeInstanceOf(BrowserDeletionLock)
    expect(services.clock).toBeDefined()
    expect(services.ids).toBeDefined()
    expect(services.cards).toBeDefined()
    expect(services.speaker).toBeDefined()
    expect(services.sounds).toBeDefined()
    expect(services.haptics).toBeDefined()
    expect(services.assistant).toBeDefined()
    expect(services.auth).toBeDefined()
    expect(services.sync).toBeDefined()
    expect(services.feedback).toBeDefined()

    speakerSpy.mockRestore()
    assistantSpy.mockRestore()
  })

  it.each(['getter', 'read', 'write'] as const)(
    'does not partially initialize services when storage %s is denied, then retries',
    (failure) => {
      const storage = window.localStorage
      storage.removeItem('jolito-device-id-v1')
      const prewarm = vi
        .spyOn(LayeredNeuralSpeaker.prototype, 'prewarm')
        .mockResolvedValue(true)
      const dictionary = vi
        .spyOn(OfflineCardAssistant.prototype, 'loadDictionary')
        .mockResolvedValue(true)
      const denial = () => {
        throw new DOMException('Access denied', 'SecurityError')
      }
      const access =
        failure === 'getter'
          ? vi.spyOn(window, 'localStorage', 'get').mockImplementation(denial)
          : vi
              .spyOn(
                Storage.prototype,
                failure === 'read' ? 'getItem' : 'setItem',
              )
              .mockImplementation(denial)
      expect(initializeBrowserServices()).toMatchObject({
        status: 'recovery',
        reason: 'unavailable',
        raw: null,
      })
      expect(prewarm).not.toHaveBeenCalled()
      expect(dictionary).not.toHaveBeenCalled()
      access.mockRestore()
      const ready = initializeBrowserServices()
      expect(ready.status).toBe('ready')
      expect(prewarm).toHaveBeenCalledOnce()
      expect(dictionary).toHaveBeenCalledOnce()
      if (ready.status === 'ready') ready.services.auth.destroy?.()
      prewarm.mockRestore()
      dictionary.mockRestore()
    },
  )

  it('uses device speech on native platforms without prewarming network audio', () => {
    const platform = vi
      .spyOn(Capacitor, 'isNativePlatform')
      .mockReturnValue(true)
    const prewarm = vi.spyOn(LayeredNeuralSpeaker.prototype, 'prewarm')
    const dictionary = vi
      .spyOn(OfflineCardAssistant.prototype, 'loadDictionary')
      .mockResolvedValue(true)
    const services = createBrowserServices()
    expect(services.deletionLock).toBeInstanceOf(NativeDeletionLock)
    expect(services.speaker).toBeInstanceOf(EnhancedBrowserSpeaker)
    expect('prefetch' in services.speaker).toBe(false)
    expect(prewarm).not.toHaveBeenCalled()
    ;(services.speaker as EnhancedBrowserSpeaker).destroy()

    platform.mockRestore()
    prewarm.mockRestore()
    dictionary.mockRestore()
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
