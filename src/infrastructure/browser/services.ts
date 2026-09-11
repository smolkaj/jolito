import { Capacitor } from '@capacitor/core'
import type {
  AppServices,
  Clock,
  CardLoadResult,
  IdGenerator,
  Speaker,
} from '../../application/ports'
import { OfflineCardAssistant } from '../../application/card-assistant'
import {
  SessionStorageError,
  SupabaseAuthService,
} from '../supabase/auth-service'
import { SupabaseFeedbackService } from '../supabase/feedback-service'
import { SupabaseSyncService } from '../supabase/sync-service'
import { BrowserDeletionLock, NativeDeletionLock } from './deletion-lock'
import { getOrCreateDeviceId } from './device-id'
import { LocalStorageCardRepository } from './card-repository'
import { BrowserHapticsPlayer } from './haptics'
import { LayeredNeuralSpeaker } from './neural-speaker'
import { WebAudioSoundPlayer } from './sound'
import { EnhancedBrowserSpeaker } from './speech'

export class SystemClock implements Clock {
  now(): number {
    return Date.now()
  }
}

export class RandomIdGenerator implements IdGenerator {
  nextId(prefix = 'note'): string {
    return typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
      ? `${prefix}-${crypto.randomUUID()}`
      : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
}

export {
  EnhancedBrowserSpeaker,
  EnhancedBrowserSpeaker as BrowserSpeaker,
  LayeredNeuralSpeaker,
}

class StorageInitializationError extends Error {}
class DeckInitializationError extends Error {
  constructor(
    readonly recovery: Extract<CardLoadResult, { status: 'recovery' }>,
  ) {
    super(recovery.message)
  }
}

function openBrowserStorage(): { storage: Storage; deviceId: string } {
  try {
    const storage = window.localStorage
    const deviceId = getOrCreateDeviceId(storage)
    return { storage, deviceId }
  } catch {
    throw new StorageInitializationError(
      'Jolito couldn’t access device storage. Allow storage access in your browser, then try again.',
    )
  }
}

export function initializeBrowserServices():
  | { status: 'ready'; services: AppServices }
  | Extract<CardLoadResult, { status: 'recovery' }> {
  try {
    return { status: 'ready', services: createBrowserServices() }
  } catch (error) {
    if (error instanceof DeckInitializationError) return error.recovery
    if (
      !(error instanceof StorageInitializationError) &&
      !(error instanceof SessionStorageError)
    )
      throw error
    return {
      status: 'recovery',
      reason: 'unavailable',
      raw: null,
      cards: [],
      message: error.message,
    }
  }
}

export function createBrowserServices(): AppServices {
  // Resolve storage and device identity before any service subscribes or prewarms.
  // The startup boundary can then recover without leaving partially created services.
  const { storage, deviceId } = openBrowserStorage()
  let cards!: LocalStorageCardRepository
  const auth = new SupabaseAuthService(
    undefined,
    undefined,
    storage,
    (owner) => {
      cards = new LocalStorageCardRepository(storage, owner?.id ?? null)
      const loaded = cards.load([])
      if (loaded.status === 'recovery')
        throw new DeckInitializationError(loaded)
    },
  )
  const assistant = new OfflineCardAssistant()
  void assistant.loadDictionary()

  const speaker: Speaker = Capacitor.isNativePlatform()
    ? new EnhancedBrowserSpeaker()
    : new LayeredNeuralSpeaker()
  void speaker.prewarm?.()

  const sync = new SupabaseSyncService(auth, undefined, undefined, deviceId)
  const feedback = new SupabaseFeedbackService(
    auth,
    undefined,
    undefined,
    '/api/feedback',
  )

  return {
    deletionLock: Capacitor.isNativePlatform()
      ? new NativeDeletionLock()
      : new BrowserDeletionLock(navigator.locks),
    clock: new SystemClock(),
    ids: new RandomIdGenerator(),
    cards,
    speaker,
    sounds: new WebAudioSoundPlayer(),
    haptics: new BrowserHapticsPlayer(),
    assistant,
    auth,
    sync,
    feedback,
  }
}
