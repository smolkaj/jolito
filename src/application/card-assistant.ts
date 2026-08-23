import { MEXICAN_SPANISH_DICTIONARY } from '../domain/dictionary-data'
import {
  LexiconIndex,
  type AutocompleteSuggestion,
  type LexiconEntry,
} from '../domain/lexicon'
import type { CardAssistant } from './ports'

export class OfflineCardAssistant implements CardAssistant {
  private index: LexiconIndex

  constructor(entries: LexiconEntry[] = MEXICAN_SPANISH_DICTIONARY) {
    this.index = new LexiconIndex(entries)
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
}

export function createCardAssistant(
  entries: LexiconEntry[] = MEXICAN_SPANISH_DICTIONARY,
): CardAssistant {
  return new OfflineCardAssistant(entries)
}
