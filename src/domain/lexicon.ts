export type LexiconEntry = {
  spanish: string
  english: string
  context?: string
  tag?: 'slang' | 'idiom' | 'food' | 'travel' | 'basics' | 'common'
}

export type AutocompleteSuggestion = LexiconEntry & {
  matchType: 'exact' | 'prefix' | 'lemma' | 'fuzzy'
  matchedForm?: string
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

export function extractGlossTerms(english: string): string[] {
  const parts = english
    .split(/[/;,]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const terms = new Set<string>()
  for (const part of parts) {
    terms.add(part)
    if (part.toLowerCase().startsWith('to ') && part.length > 3) {
      const bare = part.slice(3).trim()
      if (bare) terms.add(bare)
    }
  }
  return Array.from(terms)
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
  private lemmaMap: Map<string, string> = new Map()

  constructor(
    entries: LexiconEntry[] = [],
    lemmas: Record<string, string> = {},
  ) {
    this.addEntries(entries)
    this.setLemmaMap(lemmas)
  }

  setLemmaMap(lemmas: Record<string, string>): void {
    for (const [form, lemma] of Object.entries(lemmas)) {
      const normForm = normalizeForSearch(form)
      const normLemma = normalizeForSearch(lemma)
      if (normForm && normLemma) {
        this.lemmaMap.set(normForm, normLemma)
      }
    }
  }

  addEntries(entries: LexiconEntry[]): void {
    for (const entry of entries) {
      const normEs = normalizeForSearch(entry.spanish)
      if (normEs && this.normalizedSpanishMap.has(normEs)) {
        continue
      }
      this.entries.push(entry)
      if (normEs) {
        this.normalizedSpanishMap.set(normEs, entry)
      }

      const enTerms = extractGlossTerms(entry.english)
      for (const term of enTerms) {
        const normEn = normalizeForSearch(term)
        if (normEn && !this.normalizedEnglishMap.has(normEn)) {
          this.normalizedEnglishMap.set(normEn, entry)
        }
      }
      const fullNormEn = normalizeForSearch(entry.english)
      if (fullNormEn && !this.normalizedEnglishMap.has(fullNormEn)) {
        this.normalizedEnglishMap.set(fullNormEn, entry)
      }
    }
  }

  count(): number {
    return this.entries.length
  }

  lemmaCount(): number {
    return this.lemmaMap.size
  }

  private getTerms(entry: LexiconEntry, lang: 'es' | 'en'): string[] {
    if (lang === 'es') {
      return [normalizeForSearch(entry.spanish)]
    }
    const terms = extractGlossTerms(entry.english).map(normalizeForSearch)
    const full = normalizeForSearch(entry.english)
    if (!terms.includes(full)) terms.push(full)
    return terms.filter(Boolean)
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

    const addResult = (
      entry: LexiconEntry,
      matchType: 'exact' | 'prefix' | 'lemma' | 'fuzzy',
      matchedForm?: string,
    ) => {
      if (seen.has(entry.spanish)) return
      seen.add(entry.spanish)
      const item: AutocompleteSuggestion = { ...entry, matchType }
      if (matchedForm !== undefined) {
        item.matchedForm = matchedForm
      }
      results.push(item)
    }

    // 1. Exact matches
    for (const entry of this.entries) {
      const terms = this.getTerms(entry, lang)
      if (terms.some((t) => t === normalized)) {
        addResult(entry, 'exact')
        if (results.length >= limit) return results
      }
    }

    // 2. Prefix matches on headwords / terms
    for (const entry of this.entries) {
      if (seen.has(entry.spanish)) continue
      const terms = this.getTerms(entry, lang)
      if (terms.some((t) => t.startsWith(normalized))) {
        addResult(entry, 'prefix')
        if (results.length >= limit) return results
      }
    }

    // 3. Lemma resolution (Spanish only)
    if (lang === 'es' && results.length < limit) {
      const lemmaTarget = this.lemmaMap.get(normalized)
      if (lemmaTarget) {
        const lemmaEntry = this.normalizedSpanishMap.get(lemmaTarget)
        if (lemmaEntry && !seen.has(lemmaEntry.spanish)) {
          addResult(lemmaEntry, 'lemma', query.trim())
          if (results.length >= limit) return results
        }
      }
    }

    // 4. Word-boundary matches (e.g. "padre" matching "qué padre", "minute" matching "in a minute")
    if (results.length < limit) {
      for (const entry of this.entries) {
        if (seen.has(entry.spanish)) continue
        const terms = this.getTerms(entry, lang)
        const matchesWordBoundary = terms.some((t) => {
          const words = t.split(/\s+/)
          return words.some((w) => w.startsWith(normalized))
        })
        if (matchesWordBoundary) {
          addResult(entry, 'prefix')
          if (results.length >= limit) return results
        }
      }
    }

    // 5. Substring matches (only for queries >= 3 characters, lowest priority)
    if (results.length < limit && normalized.length >= 3) {
      for (const entry of this.entries) {
        if (seen.has(entry.spanish)) continue
        const terms = this.getTerms(entry, lang)
        if (terms.some((t) => t.includes(normalized))) {
          addResult(entry, 'prefix')
          if (results.length >= limit) break
        }
      }
    }

    return results
  }

  didYouMean(query: string, lang: 'es' | 'en' = 'es'): LexiconEntry | null {
    const normalized = normalizeForSearch(query)
    if (normalized.length < 3) return null

    if (lang === 'es') {
      if (
        this.normalizedSpanishMap.has(normalized) ||
        this.lemmaMap.has(normalized)
      ) {
        return null
      }
    } else {
      if (this.normalizedEnglishMap.has(normalized)) {
        return null
      }
    }

    let bestMatch: LexiconEntry | null = null
    let minDistance = Infinity
    const maxAllowedDistance = normalized.length <= 4 ? 1 : 2

    for (const entry of this.entries) {
      const terms = this.getTerms(entry, lang)

      for (const normTarget of terms) {
        if (normTarget.startsWith(normalized)) continue

        if (
          Math.abs(normTarget.length - normalized.length) <= maxAllowedDistance
        ) {
          const distance = damerauLevenshtein(normalized, normTarget)
          if (distance <= maxAllowedDistance && distance < minDistance) {
            minDistance = distance
            bestMatch = entry
          }
        }
      }
    }

    return bestMatch
  }

  translate(text: string, from: 'es' | 'en' = 'es'): LexiconEntry | null {
    const normalized = normalizeForSearch(text)
    if (!normalized) return null

    if (from === 'es') {
      const exact = this.normalizedSpanishMap.get(normalized)
      if (exact) return exact

      const lemmaTarget = this.lemmaMap.get(normalized)
      if (lemmaTarget) {
        return this.normalizedSpanishMap.get(lemmaTarget) ?? null
      }
      return null
    }

    return this.normalizedEnglishMap.get(normalized) ?? null
  }
}
