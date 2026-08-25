import {
  LexiconIndex,
  type AutocompleteSuggestion,
  type LexiconEntry,
} from '../domain/lexicon'
import type { CardAssistant } from './ports'

export class OfflineCardAssistant implements CardAssistant {
  private index: LexiconIndex
  private isLoaded = false
  private loadPromise: Promise<boolean> | null = null

  constructor(entries: LexiconEntry[] = []) {
    this.index = new LexiconIndex(entries)
  }

  async loadDictionary(url = '/dict/es-en.json'): Promise<boolean> {
    if (this.isLoaded) return true
    if (this.loadPromise) return this.loadPromise
    this.loadPromise = (async () => {
      try {
        const response = await fetch(url)
        if (!response.ok) return false
        const data = (await response.json()) as LexiconEntry[]
        if (Array.isArray(data)) {
          this.index.addEntries(data)
          this.isLoaded = true
          return true
        }
      } catch {
        // Offline or network error: gracefully keep current index
      }
      return false
    })().then((success) => {
      if (!success) {
        this.loadPromise = null
      }
      return success
    })
    return this.loadPromise
  }

  suggest(
    query: string,
    lang: 'es' | 'en' = 'es',
    limit = 5,
  ): AutocompleteSuggestion[] {
    return this.index.suggest(query, lang, limit)
  }

  didYouMean(query: string, lang: 'es' | 'en' = 'es'): LexiconEntry | null {
    return this.index.didYouMean(query, lang)
  }

  translate(text: string, from: 'es' | 'en' = 'es'): LexiconEntry | null {
    return this.index.translate(text, from)
  }

  entryCount(): number {
    return this.index.count()
  }
}

export function createCardAssistant(
  entries: LexiconEntry[] = [],
): CardAssistant {
  return new OfflineCardAssistant(entries)
}
