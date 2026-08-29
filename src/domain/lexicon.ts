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

export function weightedSpanishDistance(
  source: string,
  target: string,
): number {
  const sLen = source.length
  const tLen = target.length

  if (sLen === 0) return tLen
  if (tLen === 0) return sLen
  if (Math.abs(sLen - tLen) > 3) return Math.abs(sLen - tLen)

  const d: number[][] = []
  for (let i = 0; i <= sLen; i++) {
    d.push(new Array<number>(tLen + 1).fill(0))
  }

  for (let i = 1; i <= sLen; i++) {
    const sChar = source.charAt(i - 1)
    const delCost =
      sChar === 'h' || (i > 1 && source.charAt(i - 2) === sChar) ? 0.4 : 1.0
    d[i]![0] = d[i - 1]![0]! + delCost
  }

  for (let j = 1; j <= tLen; j++) {
    const tChar = target.charAt(j - 1)
    const insCost =
      tChar === 'h' || (j > 1 && target.charAt(j - 2) === tChar) ? 0.4 : 1.0
    d[0]![j] = d[0]![j - 1]! + insCost
  }

  for (let i = 1; i <= sLen; i++) {
    const sChar = source.charAt(i - 1)
    for (let j = 1; j <= tLen; j++) {
      const tChar = target.charAt(j - 1)
      let cost = 1.0
      if (sChar === tChar) {
        cost = 0.0
      } else if (
        (sChar === 'b' && tChar === 'v') ||
        (sChar === 'v' && tChar === 'b') ||
        ((sChar === 'c' || sChar === 's' || sChar === 'z') &&
          (tChar === 'c' || tChar === 's' || tChar === 'z')) ||
        (sChar === 'g' && tChar === 'j') ||
        (sChar === 'j' && tChar === 'g')
      ) {
        cost = 0.4
      } else if (
        (sChar === 'y' && tChar === 'l') ||
        (sChar === 'l' && tChar === 'y')
      ) {
        cost = 0.5
      }

      const delCost =
        sChar === 'h' || (i > 1 && source.charAt(i - 2) === sChar) ? 0.4 : 1.0
      const insCost =
        tChar === 'h' || (j > 1 && target.charAt(j - 2) === tChar) ? 0.4 : 1.0

      let min = Math.min(
        d[i - 1]![j]! + delCost,
        d[i]![j - 1]! + insCost,
        d[i - 1]![j - 1]! + cost,
      )

      if (
        i > 1 &&
        j > 1 &&
        sChar === target.charAt(j - 2) &&
        source.charAt(i - 2) === tChar
      ) {
        min = Math.min(min, d[i - 2]![j - 2]! + 0.8)
      }

      d[i]![j] = min
    }
  }

  return d[sLen]![tLen]!
}

/**
 * Unpacks a compact stem-encoded lemma dictionary where keys are headwords/lemmas
 * and values are space-delimited inflected forms (prefixed with ~ if sharing the verb stem).
 */
export function unpackLemmas(
  packed: Record<string, string | string[]>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const [lemma, formsVal] of Object.entries(packed)) {
    const stem =
      lemma.endsWith('ar') || lemma.endsWith('er') || lemma.endsWith('ir')
        ? lemma.slice(0, -2)
        : lemma
    const forms = Array.isArray(formsVal)
      ? formsVal
      : typeof formsVal === 'string' &&
          (formsVal.includes(' ') || formsVal.startsWith('~'))
        ? formsVal.split(' ')
        : [formsVal]

    for (let i = 0; i < forms.length; i++) {
      const token = forms[i]
      if (!token) continue
      const form = token.charCodeAt(0) === 126 ? stem + token.slice(1) : token
      if (!result[form]) {
        result[form] = [lemma]
      } else if (!result[form].includes(lemma)) {
        result[form].push(lemma)
      }
    }
  }
  return result
}

export class LexiconIndex {
  private entries: LexiconEntry[] = []
  private normalizedSpanishMap: Map<string, LexiconEntry> = new Map()
  private normalizedEnglishMap: Map<string, LexiconEntry> = new Map()
  private lemmaMap: Map<string, string[]> = new Map()
  private esBigramIndex: Map<string, number[]> = new Map()
  private enBigramIndex: Map<string, number[]> = new Map()
  private esLengthBuckets: Map<number, number[]> = new Map()
  private enLengthBuckets: Map<number, number[]> = new Map()

  constructor(
    entries: LexiconEntry[] = [],
    lemmas: Record<string, string | string[]> = {},
  ) {
    this.addEntries(entries)
    this.setLemmaMap(lemmas)
  }

  setLemmaMap(lemmas: Record<string, string | string[]>): void {
    let source = lemmas
    for (const val of Object.values(lemmas)) {
      if (
        typeof val === 'string' &&
        (val.includes(' ') || val.startsWith('~'))
      ) {
        source = unpackLemmas(lemmas)
        break
      }
    }

    for (const [form, lemma] of Object.entries(source)) {
      const normForm = normalizeForSearch(form)
      if (!normForm) continue
      const list = Array.isArray(lemma) ? lemma : [lemma]
      const normList: string[] = []
      for (const l of list) {
        const normL = normalizeForSearch(l)
        if (normL && !normList.includes(normL)) {
          normList.push(normL)
        }
      }
      if (normList.length === 0) continue

      const existing = this.lemmaMap.get(normForm)
      if (!existing) {
        this.lemmaMap.set(normForm, normList)
      } else {
        const isExactMatch = form.toLowerCase() === normForm
        const merged = isExactMatch
          ? [...normList, ...existing.filter((t) => !normList.includes(t))]
          : [...existing, ...normList.filter((t) => !existing.includes(t))]
        this.lemmaMap.set(normForm, merged)
      }
    }
  }

  addEntries(entries: LexiconEntry[]): void {
    for (const entry of entries) {
      const normEs = normalizeForSearch(entry.spanish)
      if (normEs && this.normalizedSpanishMap.has(normEs)) {
        continue
      }
      const entryIdx = this.entries.length
      this.entries.push(entry)
      if (normEs) {
        this.normalizedSpanishMap.set(normEs, entry)
        const esLen = normEs.length
        if (!this.esLengthBuckets.has(esLen)) {
          this.esLengthBuckets.set(esLen, [])
        }
        this.esLengthBuckets.get(esLen)!.push(entryIdx)
        const esBigrams = new Set<string>()
        for (let i = 0; i < normEs.length - 1; i++) {
          esBigrams.add(normEs.slice(i, i + 2))
        }
        for (const bg of esBigrams) {
          if (!this.esBigramIndex.has(bg)) {
            this.esBigramIndex.set(bg, [])
          }
          this.esBigramIndex.get(bg)!.push(entryIdx)
        }
      }

      const enTerms = extractGlossTerms(entry.english)
      const enLengths = new Set<number>()
      const enBigrams = new Set<string>()
      for (const term of enTerms) {
        const normEn = normalizeForSearch(term)
        if (normEn && !this.normalizedEnglishMap.has(normEn)) {
          this.normalizedEnglishMap.set(normEn, entry)
        }
        if (normEn) {
          enLengths.add(normEn.length)
          for (let i = 0; i < normEn.length - 1; i++) {
            enBigrams.add(normEn.slice(i, i + 2))
          }
        }
      }
      for (const enLen of enLengths) {
        if (!this.enLengthBuckets.has(enLen)) {
          this.enLengthBuckets.set(enLen, [])
        }
        this.enLengthBuckets.get(enLen)!.push(entryIdx)
      }
      for (const bg of enBigrams) {
        if (!this.enBigramIndex.has(bg)) {
          this.enBigramIndex.set(bg, [])
        }
        this.enBigramIndex.get(bg)!.push(entryIdx)
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

  private getFuzzyCandidates(query: string, lang: 'es' | 'en'): number[] {
    const qLen = query.length
    const lengthMap =
      lang === 'es' ? this.esLengthBuckets : this.enLengthBuckets
    const bigramMap = lang === 'es' ? this.esBigramIndex : this.enBigramIndex

    const candidateIndices = new Set<number>()
    if (qLen >= 4) {
      const minBigrams = qLen >= 6 ? 2 : 1
      const counts = new Map<number, number>()
      const queryBigrams = new Set<string>()
      for (let i = 0; i < qLen - 1; i++) {
        queryBigrams.add(query.slice(i, i + 2))
      }
      for (const bg of queryBigrams) {
        const list = bigramMap.get(bg)
        if (list) {
          for (const idx of list) {
            const c = (counts.get(idx) ?? 0) + 1
            counts.set(idx, c)
            if (c === minBigrams) {
              const entry = this.entries[idx]
              if (entry) {
                const terms = this.getTerms(entry, lang)
                if (terms.some((t) => Math.abs(t.length - qLen) <= 3)) {
                  candidateIndices.add(idx)
                }
              }
            }
          }
        }
      }
    }

    if (candidateIndices.size === 0) {
      for (let l = Math.max(1, qLen - 3); l <= qLen + 3; l++) {
        const list = lengthMap.get(l)
        if (list) {
          for (const idx of list) {
            candidateIndices.add(idx)
          }
        }
      }
    }

    return Array.from(candidateIndices)
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

    // 2. Lemma resolution (Spanish only - inflections of the query resolve immediately to base lemmas)
    if (lang === 'es' && results.length < limit) {
      const lemmaTargets = this.lemmaMap.get(normalized)
      if (lemmaTargets) {
        for (const lemmaTarget of lemmaTargets) {
          const lemmaEntry = this.normalizedSpanishMap.get(lemmaTarget)
          if (lemmaEntry && !seen.has(lemmaEntry.spanish)) {
            addResult(lemmaEntry, 'lemma', query.trim())
            if (results.length >= limit) return results
          }
        }
      }
    }

    // 3. Prefix matches on headwords / terms
    for (const entry of this.entries) {
      if (seen.has(entry.spanish)) continue
      const terms = this.getTerms(entry, lang)
      if (terms.some((t) => t.startsWith(normalized))) {
        addResult(entry, 'prefix')
        if (results.length >= limit) return results
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

    // 5. Fast Weighted Fuzzy matches (for queries with >= 3 characters)
    if (results.length < limit && normalized.length >= 3) {
      const maxDistance =
        normalized.length <= 4 ? 1.0 : normalized.length <= 7 ? 1.8 : 2.2
      const candidateIndices = this.getFuzzyCandidates(normalized, lang)
      const fuzzyMatches: Array<{ entry: LexiconEntry; dist: number }> = []

      for (const idx of candidateIndices) {
        const entry = this.entries[idx]
        if (!entry || seen.has(entry.spanish)) continue
        const terms = this.getTerms(entry, lang)
        let minCandidateDist = Infinity

        for (const t of terms) {
          if (Math.abs(t.length - normalized.length) <= 3) {
            const dist = weightedSpanishDistance(normalized, t)
            if (dist <= maxDistance && dist < minCandidateDist) {
              minCandidateDist = dist
            }
          }
        }

        if (minCandidateDist <= maxDistance) {
          fuzzyMatches.push({ entry, dist: minCandidateDist })
        }
      }

      fuzzyMatches.sort((a, b) => a.dist - b.dist)
      for (const { entry } of fuzzyMatches) {
        addResult(entry, 'fuzzy', query.trim())
        if (results.length >= limit) return results
      }
    }

    // 6. Substring matches (only for queries >= 3 characters, lowest priority)
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

  translate(text: string, from: 'es' | 'en' = 'es'): LexiconEntry | null {
    const normalized = normalizeForSearch(text)
    if (!normalized) return null

    if (from === 'es') {
      const exact = this.normalizedSpanishMap.get(normalized)
      if (exact) return exact

      const lemmaTargets = this.lemmaMap.get(normalized)
      if (lemmaTargets) {
        for (const target of lemmaTargets) {
          const lemmaEntry = this.normalizedSpanishMap.get(target)
          if (lemmaEntry) return lemmaEntry
        }
      }
      return null
    }

    return this.normalizedEnglishMap.get(normalized) ?? null
  }
}
