import type { AppServices } from '../../application/ports'
import { BrowserCardRepository } from './card-repository'

export function createBrowserServices(): AppServices {
  return {
    cards: new BrowserCardRepository(),
    clock: { now: () => new Date() },
    ids: { next: () => crypto.randomUUID() },
    speaker: {
      speak(text, locale) {
        if (!('speechSynthesis' in window)) return
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = locale
        utterance.rate = 0.88
        window.speechSynthesis.speak(utterance)
      },
    },
  }
}
