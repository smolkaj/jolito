export type LexiconEntry = {
  spanish: string
  english: string
  context?: string
  tag?: 'slang' | 'idiom' | 'food' | 'travel' | 'basics' | 'common'
}

export type AutocompleteSuggestion = LexiconEntry & {
  matchType: 'exact' | 'prefix' | 'fuzzy'
}

export const SEED_LEXICON: LexiconEntry[] = [
  {
    spanish: 'aguacate',
    english: 'avocado',
    context: 'Key ingredient across Mexican cuisine.',
    tag: 'food',
  },
  {
    spanish: 'ahorita',
    english: 'right now / in a bit',
    context: 'Iconic Mexican time nuance: right now, soon, or never.',
    tag: 'slang',
  },
  {
    spanish: 'qué padre',
    english: 'how cool / fantastic',
    context: 'Quintessential Mexican Spanish slang for something great.',
    tag: 'slang',
  },
  {
    spanish: 'no manches',
    english: 'no way / you are kidding',
    context: 'Everyday Mexican expression of disbelief.',
    tag: 'slang',
  },
  {
    spanish: 'chela',
    english: 'beer',
    context: 'Casual Mexican word for a cold beer.',
    tag: 'slang',
  },
]

export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:"'()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function damerauLevenshtein(source: string, target: string): number {
  const sLen = source.length
  const tLen = target.length

  if (sLen === 0) return tLen
  if (tLen === 0) return sLen

  const d: number[][] = []
  for (let i = 0; i <= sLen; i++) {
    const row: number[] = new Array<number>(tLen + 1).fill(0)
    row[0] = i
    d.push(row)
  }
  for (let j = 0; j <= tLen; j++) {
    d[0]![j] = j
  }

  for (let i = 1; i <= sLen; i++) {
    const sChar = source.charAt(i - 1)
    for (let j = 1; j <= tLen; j++) {
      const tChar = target.charAt(j - 1)
      const cost = sChar === tChar ? 0 : 1

      let min = Math.min(
        d[i - 1]![j]! + 1, // deletion
        d[i]![j - 1]! + 1, // insertion
        d[i - 1]![j - 1]! + cost, // substitution
      )

      if (
        i > 1 &&
        j > 1 &&
        sChar === target.charAt(j - 2) &&
        source.charAt(i - 2) === tChar
      ) {
        min = Math.min(min, d[i - 2]![j - 2]! + 1)
      }

      d[i]![j] = min
    }
  }

  return d[sLen]![tLen]!
}

export class LexiconIndex {
  private entries: LexiconEntry[] = []
  private normalizedSpanishMap: Map<string, LexiconEntry> = new Map()
  private normalizedEnglishMap: Map<string, LexiconEntry> = new Map()

  constructor(entries: LexiconEntry[] = []) {
    this.addEntries(entries)
  }

  addEntries(entries: LexiconEntry[]): void {
    for (const entry of entries) {
      const normEs = normalizeForSearch(entry.spanish)
      const normEn = normalizeForSearch(entry.english)
      if (normEs && this.normalizedSpanishMap.has(normEs)) {
        continue
      }
      this.entries.push(entry)
      if (normEs) {
        this.normalizedSpanishMap.set(normEs, entry)
      }
      if (normEn && !this.normalizedEnglishMap.has(normEn)) {
        this.normalizedEnglishMap.set(normEn, entry)
      }
    }
  }

  count(): number {
    return this.entries.length
  }

  suggest(
    query: string,
    lang: 'es' | 'en' = 'es',
    limit = 5,
  ): AutocompleteSuggestion[] {
    const normalized = normalizeForSearch(query)
    if (normalized.length < 2) return []

    const results: AutocompleteSuggestion[] = []
    const seen = new Set<string>()

    // 1. Exact & Prefix Matches
    for (const entry of this.entries) {
      const targetText = lang === 'es' ? entry.spanish : entry.english
      const normTarget = normalizeForSearch(targetText)

      if (normTarget === normalized) {
        results.push({ ...entry, matchType: 'exact' })
        seen.add(entry.spanish)
      } else if (normTarget.startsWith(normalized)) {
        results.push({ ...entry, matchType: 'prefix' })
        seen.add(entry.spanish)
      }

      if (results.length >= limit) return results
    }

    // 2. Word-boundary / Substring matches
    if (results.length < limit) {
      for (const entry of this.entries) {
        if (seen.has(entry.spanish)) continue
        const targetText = lang === 'es' ? entry.spanish : entry.english
        const normTarget = normalizeForSearch(targetText)

        if (normTarget.includes(normalized)) {
          results.push({ ...entry, matchType: 'prefix' })
          seen.add(entry.spanish)
          if (results.length >= limit) break
        }
      }
    }

    return results
  }

  didYouMean(query: string, lang: 'es' | 'en' = 'es'): LexiconEntry | null {
    const normalized = normalizeForSearch(query)
    if (normalized.length < 3) return null

    // If it's already an exact match, no typo fix needed
    if (lang === 'es' && this.normalizedSpanishMap.has(normalized)) {
      return null
    }
    if (lang === 'en' && this.normalizedEnglishMap.has(normalized)) {
      return null
    }

    let bestMatch: LexiconEntry | null = null
    let minDistance = Infinity
    const maxAllowedDistance = normalized.length <= 4 ? 1 : 2

    for (const entry of this.entries) {
      const targetText = lang === 'es' ? entry.spanish : entry.english
      const normTarget = normalizeForSearch(targetText)

      // Skip exact prefix matches (autocomplete already handles those)
      if (normTarget.startsWith(normalized)) continue

      const distance = damerauLevenshtein(normalized, normTarget)
      if (distance <= maxAllowedDistance && distance < minDistance) {
        minDistance = distance
        bestMatch = entry
      }
    }

    return bestMatch
  }

  translate(text: string, from: 'es' | 'en' = 'es'): LexiconEntry | null {
    const normalized = normalizeForSearch(text)
    if (!normalized) return null

    if (from === 'es') {
      return this.normalizedSpanishMap.get(normalized) ?? null
    }
    return this.normalizedEnglishMap.get(normalized) ?? null
  }
}
