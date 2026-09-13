import { describe, expect, it, vi } from 'vitest'
import { createStudyCards } from '../../domain/card'
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

it.each(
  [
    { failure: 'transient first read', raw: null },
    { failure: 'malformed JSON', raw: '{broken' },
    { failure: 'invalid session schema', raw: '{"user":{"id":"A"}}' },
    { failure: 'empty stored value', raw: '' },
  ].flatMap((failure) =>
    [false, true].map((redirect) => ({ ...failure, redirect })),
  ),
)(
  'preserves ownership evidence through $failure with redirect=$redirect, then retries safely',
  ({ failure, raw, redirect }) => {
    localStorage.clear()
    const authKey = 'jolito-auth-session-v1'
    const legacyKey = 'jolito-library-v1'
    const valid = JSON.stringify({
      accessToken: 'A-token',
      refreshToken: 'A-refresh',
      expiresAt: Date.now() + 3600000,
      user: { id: 'A', email: 'A@example.com' },
    })
    const storedAuth = raw ?? valid
    const legacy = JSON.stringify({
      version: 3,
      cards: createStudyCards(
        {
          spanish: 'A-private',
          english: 'A',
          context: '',
          bidirectional: false,
        },
        'A',
        0,
      ),
      deletedCardIds: [],
    })
    localStorage.setItem(authKey, storedAuth)
    localStorage.setItem(legacyKey, legacy)
    const hash = redirect
      ? `#access_token=header.${btoa(JSON.stringify({ sub: 'B', email: 'B@example.com' }))}.signature&refresh_token=B-refresh`
      : '#/deck'
    window.history.replaceState({}, '', hash)
    const prewarm = vi
      .spyOn(LayeredNeuralSpeaker.prototype, 'prewarm')
      .mockResolvedValue(true)
    const dictionary = vi
      .spyOn(OfflineCardAssistant.prototype, 'loadDictionary')
      .mockResolvedValue(true)
    const get = Object.getOwnPropertyDescriptor(Storage.prototype, 'getItem')!
      .value as (this: Storage, key: string) => string | null
    let firstRead = true
    const read = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(function (this: Storage, key: string) {
        if (key === authKey && firstRead) {
          firstRead = false
          if (failure === 'transient first read')
            throw new DOMException('Blocked', 'SecurityError')
        }
        return get.call(this, key)
      })
    const result = initializeBrowserServices()
    if (result.status === 'ready') result.services.auth.destroy?.()
    expect(result).toMatchObject({ status: 'recovery' })
    expect(localStorage.getItem(authKey)).toBe(storedAuth)
    expect(localStorage.getItem(legacyKey)).toBe(legacy)
    expect(localStorage.getItem('jolito-libraries-v1')).toBeNull()
    expect(window.location.hash).toBe(hash)
    expect(prewarm).not.toHaveBeenCalled()
    expect(dictionary).not.toHaveBeenCalled()
    read.mockRestore()
    if (failure !== 'transient first read') {
      // A second attempt cannot erase malformed evidence and reinterpret absence.
      expect(initializeBrowserServices()).toMatchObject({ status: 'recovery' })
      expect(localStorage.getItem(authKey)).toBe(storedAuth)
    }
    // Restore access to the original session, then retry the unchanged intent.
    localStorage.setItem(authKey, valid)
    const retried = initializeBrowserServices()
    expect(retried.status).toBe('ready')
    if (retried.status === 'ready') {
      expect(retried.services.auth.getCurrentUser()?.id).toBe(
        redirect ? 'B' : 'A',
      )
      expect(localStorage.getItem('jolito-libraries-v1')).toContain('user:A')
      expect(localStorage.getItem('jolito-libraries-v1')).not.toContain(
        '"guest"',
      )
      retried.services.auth.destroy?.()
    }
    expect(localStorage.getItem(legacyKey)).toBe(legacy)
    prewarm.mockRestore()
    dictionary.mockRestore()
    window.history.replaceState({}, '', '/')
    localStorage.clear()
  },
)
