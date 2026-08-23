import { MEXICAN_SPANISH_DICTIONARY } from '../domain/dictionary-data'
import {
  LexiconIndex,
  type AutocompleteSuggestion,
  type LexiconEntry,
} from '../domain/lexicon'
import type { CardAssistant } from './ports'

export class OfflineCardAssistant implements CardAssistant {
  private index: LexiconIndex
  private isLoaded = false

  constructor(entries: LexiconEntry[] = MEXICAN_SPANISH_DICTIONARY) {
    this.index = new LexiconIndex(entries)
  }

  async loadDictionary(url = './dict/es-en.json'): Promise<boolean> {
    if (this.isLoaded) return true
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
      // Offline or network error: gracefully keep bundled seeds
    }
    return false
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
  entries: LexiconEntry[] = MEXICAN_SPANISH_DICTIONARY,
): CardAssistant {
  return new OfflineCardAssistant(entries)
}
