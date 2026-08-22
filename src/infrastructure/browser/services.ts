import type {
  AppServices,
  Clock,
  IdGenerator,
  Speaker,
} from '../../application/ports'
import { LocalStorageCardRepository } from './card-repository'
import { WebAudioSoundPlayer } from './sound'

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

export class BrowserSpeaker implements Speaker {
  supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.SpeechSynthesisUtterance === 'function'
    )
  }

  speak(text: string, locale: string): boolean {
    if (!this.supported()) return false

    try {
      window.speechSynthesis.cancel()
      const utterance = new window.SpeechSynthesisUtterance(text)
      utterance.lang = locale
      utterance.rate = locale === 'es-MX' ? 0.86 : 0.9
      window.speechSynthesis.speak(utterance)
      return true
    } catch {
      return false
    }
  }
}

export function createBrowserServices(): AppServices {
  return {
    clock: new SystemClock(),
    ids: new RandomIdGenerator(),
    cards: new LocalStorageCardRepository(),
    speaker: new BrowserSpeaker(),
    sounds: new WebAudioSoundPlayer(),
  }
}
