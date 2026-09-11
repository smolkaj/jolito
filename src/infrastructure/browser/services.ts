import { Capacitor } from '@capacitor/core'
import type {
  AppServices,
  Clock,
  CardLoadResult,
  IdGenerator,
  Speaker,
} from '../../application/ports'
import { OfflineCardAssistant } from '../../application/card-assistant'
import { SupabaseAuthService } from '../supabase/auth-service'
import { SupabaseFeedbackService } from '../supabase/feedback-service'
import { SupabaseSyncService } from '../supabase/sync-service'
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
    if (!(error instanceof StorageInitializationError)) throw error
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
  const assistant = new OfflineCardAssistant()
  void assistant.loadDictionary()

  const speaker: Speaker = Capacitor.isNativePlatform()
    ? new EnhancedBrowserSpeaker()
    : new LayeredNeuralSpeaker()
  void speaker.prewarm?.()

  const auth = new SupabaseAuthService(undefined, undefined, storage)
  const sync = new SupabaseSyncService(auth, undefined, undefined, deviceId)
  const feedback = new SupabaseFeedbackService(
    auth,
    undefined,
    undefined,
    '/api/feedback',
  )

  return {
    clock: new SystemClock(),
    ids: new RandomIdGenerator(),
    cards: new LocalStorageCardRepository(storage),
    speaker,
    sounds: new WebAudioSoundPlayer(),
    haptics: new BrowserHapticsPlayer(),
    assistant,
    auth,
    sync,
    feedback,
  }
}
