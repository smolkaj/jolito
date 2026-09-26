import { z } from 'zod'
import {
  LexiconIndex,
  SEED_LEXICON,
  lexiconEntrySchema,
  type AutocompleteSuggestion,
  type LexiconEntry,
} from '../domain/lexicon'
import type { CardAssistant } from './ports'

const lemmasSchema = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]),
)

export class OfflineCardAssistant implements CardAssistant {
  private index: LexiconIndex
  private isLoaded = false
  private loadPromise: Promise<boolean> | null = null

  constructor(
    entries: LexiconEntry[] = SEED_LEXICON,
    lemmas: Record<string, string | string[]> = {},
  ) {
    this.index = new LexiconIndex(entries, lemmas)
  }

  async loadDictionary(
    url = '/dict/es-en.json',
    lemmasUrl = '/dict/es-lemmas.json',
  ): Promise<boolean> {
    if (this.isLoaded) return true
    if (this.loadPromise) return this.loadPromise
    this.loadPromise = (async () => {
      try {
        const [dictResp, lemmasResp] = await Promise.all([
          fetch(url),
          fetch(lemmasUrl).catch(() => null),
        ])
        if (!dictResp.ok) return false
        const rawData: unknown = await dictResp.json()
        const parsedData = z.array(lexiconEntrySchema).safeParse(rawData)
        if (parsedData.success) {
          this.index.addEntries(parsedData.data)
          if (lemmasResp && lemmasResp.ok) {
            try {
              const rawLemmas: unknown = await lemmasResp.json()
              const parsedLemmas = lemmasSchema.safeParse(rawLemmas)
              if (parsedLemmas.success) {
                this.index.setLemmaMap(parsedLemmas.data)
              }
            } catch {
              // Ignore lemma parsing error if missing or invalid
            }
          }
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

  translate(text: string, from: 'es' | 'en' = 'es'): LexiconEntry | null {
    return this.index.translate(text, from)
  }

  entryCount(): number {
    return this.index.count()
  }

  lemmaCount(): number {
    return this.index.lemmaCount()
  }
}

export function createCardAssistant(
  entries: LexiconEntry[] = [],
  lemmas: Record<string, string | string[]> = {},
): CardAssistant {
  return new OfflineCardAssistant(entries, lemmas)
}
