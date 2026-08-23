import type { AppServices, Clock, IdGenerator } from '../../application/ports'
import { OfflineCardAssistant } from '../../application/card-assistant'
import { LocalStorageCardRepository } from './card-repository'
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

export function createBrowserServices(): AppServices {
  return {
    clock: new SystemClock(),
    ids: new RandomIdGenerator(),
    cards: new LocalStorageCardRepository(),
    speaker: new LayeredNeuralSpeaker(),
    sounds: new WebAudioSoundPlayer(),
    assistant: new OfflineCardAssistant(),
  }
}
