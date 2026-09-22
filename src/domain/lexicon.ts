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
      (lemma.endsWith('ar') || lemma.endsWith('er') || lemma.endsWith('ir')) &&
      lemma.length > 2
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

type TrieEntry = {
  entryIdx: number
  isSubphrase?: boolean | undefined
}

class TrieNode {
  children: Map<string, TrieNode> = new Map()
  entries?: TrieEntry[] | undefined
}

export class AutocompleteTrie {
  root = new TrieNode()

  insert(phrase: string, entryIdx: number, isSubphrase = false): void {
    let node = this.root
    for (let i = 0; i < phrase.length; i++) {
      const ch = phrase.charAt(i)
      let next = node.children.get(ch)
      if (!next) {
        next = new TrieNode()
        node.children.set(ch, next)
      }
      node = next
    }
    if (!node.entries) {
      node.entries = []
    }
    node.entries.push({ entryIdx, isSubphrase })
  }

  findExactPrefix(
    query: string,
    maxCollect = 10,
  ): Array<{ entryIdx: number; isSubphrase?: boolean | undefined }> {
    let node: TrieNode | undefined = this.root
    for (let i = 0; i < query.length; i++) {
      node = node.children.get(query.charAt(i))
      if (!node) return []
    }

    const results: Array<{
      entryIdx: number
      isSubphrase?: boolean | undefined
    }> = []
    const seen = new Set<number>()
    const queue: TrieNode[] = [node]

    while (queue.length > 0 && results.length < maxCollect) {
      const cur = queue.shift()!
      if (cur.entries) {
        for (const e of cur.entries) {
          if (!seen.has(e.entryIdx)) {
            seen.add(e.entryIdx)
            results.push(e)
            if (results.length >= maxCollect) break
          }
        }
      }
      for (const child of cur.children.values()) {
        queue.push(child)
      }
    }

    return results
  }

  searchFuzzy(
    query: string,
    maxDistance: number,
    lang: 'es' | 'en',
    maxCollect = 20,
  ): Map<number, { distance: number; isSubphrase: boolean }> {
    const m = query.length
    const initialRow: number[] = new Array<number>(m + 1)
    for (let j = 0; j <= m; j++) {
      initialRow[j] = j
    }

    const matches = new Map<
      number,
      { distance: number; isSubphrase: boolean }
    >()

    const record = (
      entryIdx: number,
      distance: number,
      isSubphrase: boolean,
    ) => {
      const existing = matches.get(entryIdx)
      if (
        !existing ||
        distance < existing.distance - 0.001 ||
        (Math.abs(distance - existing.distance) <= 0.001 &&
          !isSubphrase &&
          existing.isSubphrase)
      ) {
        matches.set(entryIdx, { distance, isSubphrase })
      }
    }

    const collectSubtree = (
      node: TrieNode,
      prefixDist: number,
      isSub: boolean,
    ) => {
      let count = 0
      const queue: TrieNode[] = [node]
      while (queue.length > 0 && count < maxCollect) {
        const cur = queue.shift()!
        if (cur.entries) {
          for (const e of cur.entries) {
            record(e.entryIdx, prefixDist, isSub || !!e.isSubphrase)
            count++
            if (count >= maxCollect) break
          }
        }
        for (const child of cur.children.values()) {
          queue.push(child)
        }
      }
    }

    const dfs = (
      node: TrieNode,
      prevChar: string | null,
      parentRow: number[],
      grandParentRow: number[] | null,
      depth: number,
    ) => {
      for (const [ch, child] of node.children.entries()) {
        const curRow = new Array<number>(m + 1)
        const delCost = lang === 'es' && ch === 'h' ? 0.4 : 1.0
        curRow[0] = parentRow[0]! + delCost
        let minRow = curRow[0]

        for (let j = 1; j <= m; j++) {
          const qChar = query.charAt(j - 1)
          let subCost = 1.0
          if (qChar === ch) {
            subCost = 0.0
          } else if (lang === 'es') {
            if (
              (qChar === 'b' && ch === 'v') ||
              (qChar === 'v' && ch === 'b') ||
              ((qChar === 'c' || qChar === 's' || qChar === 'z') &&
                (ch === 'c' || ch === 's' || ch === 'z')) ||
              (qChar === 'g' && ch === 'j') ||
              (qChar === 'j' && ch === 'g')
            ) {
              subCost = 0.4
            } else if (
              (qChar === 'y' && ch === 'l') ||
              (qChar === 'l' && ch === 'y')
            ) {
              subCost = 0.5
            }
          }

          const insCost = lang === 'es' && qChar === 'h' ? 0.4 : 1.0

          let cost = Math.min(
            parentRow[j]! + delCost,
            curRow[j - 1]! + insCost,
            parentRow[j - 1]! + subCost,
          )

          if (
            j > 1 &&
            prevChar !== null &&
            grandParentRow !== null &&
            qChar === prevChar &&
            query.charAt(j - 2) === ch
          ) {
            cost = Math.min(cost, grandParentRow[j - 2]! + 0.8)
          }

          curRow[j] = cost
          if (cost < minRow) {
            minRow = cost
          }
        }

        if (minRow > maxDistance) {
          continue
        }

        const terminalDist = curRow[m]
        if (terminalDist === undefined) {
          continue
        }

        if (child.entries && terminalDist <= maxDistance) {
          for (const e of child.entries) {
            record(e.entryIdx, terminalDist, !!e.isSubphrase)
          }
        }

        if (depth + 1 >= m - 1 && terminalDist <= maxDistance) {
          collectSubtree(child, terminalDist, false)
        }

        dfs(child, ch, curRow, parentRow, depth + 1)
      }
    }

    dfs(this.root, null, initialRow, null, 0)
    return matches
  }
}

export class LexiconIndex {
  private entries: LexiconEntry[] = []
  private normalizedSpanishMap: Map<string, LexiconEntry> = new Map()
  private normalizedEnglishMap: Map<string, LexiconEntry> = new Map()
  private lemmaMap: Map<string, string[]> = new Map()
  private esTrie: AutocompleteTrie = new AutocompleteTrie()
  private enTrie: AutocompleteTrie = new AutocompleteTrie()

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
        this.esTrie.insert(normEs, entryIdx, false)
        let spaceIdx = normEs.indexOf(' ')
        let count = 0
        while (spaceIdx !== -1 && count < 3) {
          const sub = normEs.slice(spaceIdx + 1)
          if (sub.length >= 3) {
            this.esTrie.insert(sub, entryIdx, true)
          }
          spaceIdx = normEs.indexOf(' ', spaceIdx + 1)
          count++
        }
      }

      const enTerms = extractGlossTerms(entry.english)
      const fullNormEn = normalizeForSearch(entry.english)
      if (fullNormEn && !enTerms.includes(fullNormEn)) {
        enTerms.push(fullNormEn)
      }

      for (const term of enTerms) {
        const normEn = normalizeForSearch(term)
        if (!normEn || normEn.length > 40) continue
        if (!this.normalizedEnglishMap.has(normEn)) {
          this.normalizedEnglishMap.set(normEn, entry)
        }
        this.enTrie.insert(normEn, entryIdx, false)
        let spaceIdx = normEn.indexOf(' ')
        let count = 0
        while (spaceIdx !== -1 && count < 3) {
          const sub = normEn.slice(spaceIdx + 1)
          if (sub.length >= 3) {
            this.enTrie.insert(sub, entryIdx, true)
          }
          spaceIdx = normEn.indexOf(' ', spaceIdx + 1)
          count++
        }
      }
    }
  }

  count(): number {
    return this.entries.length
  }

  lemmaCount(): number {
    return this.lemmaMap.size
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

    // 1. Exact term matches
    if (lang === 'es') {
      const exact = this.normalizedSpanishMap.get(normalized)
      if (exact) {
        addResult(exact, 'exact')
        if (results.length >= limit) return results
      }

      // 2. Lemma resolution (Spanish only)
      let lemmaTargets = this.lemmaMap.get(normalized)
      if (!lemmaTargets) {
        if (normalized.includes('b') || normalized.includes('v')) {
          const alt = normalized
            .replace(/b/g, '__b__')
            .replace(/v/g, 'b')
            .replace(/__b__/g, 'v')
          lemmaTargets = this.lemmaMap.get(alt)
        }
        if (!lemmaTargets && !normalized.startsWith('h')) {
          lemmaTargets = this.lemmaMap.get('h' + normalized)
        }
      }

      if (lemmaTargets) {
        for (const lemmaTarget of lemmaTargets) {
          const lemmaEntry = this.normalizedSpanishMap.get(lemmaTarget)
          if (lemmaEntry && !seen.has(lemmaEntry.spanish)) {
            addResult(lemmaEntry, 'lemma', query.trim())
            if (results.length >= limit) return results
          }
        }
      }
    } else {
      const exact = this.normalizedEnglishMap.get(normalized)
      if (exact) {
        addResult(exact, 'exact')
        if (results.length >= limit) return results
      }
    }

    const trie = lang === 'es' ? this.esTrie : this.enTrie

    // 3. Exact prefix completions via Trie (O(|Q|) traversal, < 0.1ms)
    const exactPrefixMatches = trie.findExactPrefix(normalized, limit)
    for (const match of exactPrefixMatches) {
      const entry = this.entries[match.entryIdx]!
      addResult(entry, 'prefix')
      if (results.length >= limit) return results
    }

    // 4. Approximate / typo search (only if no exact headword/prefix matches found)
    if (results.length === 0) {
      const maxDist =
        normalized.length <= 2 ? 0.0 : normalized.length <= 4 ? 1.0 : 2.0
      if (maxDist > 0) {
        const searchHits = trie.searchFuzzy(
          normalized,
          maxDist,
          lang,
          limit * 2,
        )

        const candidates = Array.from(searchHits.entries()).map(
          ([entryIdx, meta]) => {
            const entry = this.entries[entryIdx]!
            const primaryText =
              lang === 'es'
                ? normalizeForSearch(entry.spanish)
                : normalizeForSearch(entry.english)
            return {
              entry,
              ...meta,
              termLength: primaryText.length,
            }
          },
        )

        candidates.sort((a, b) => {
          if (Math.abs(a.distance - b.distance) > 0.001) {
            return a.distance - b.distance
          }
          if (a.isSubphrase !== b.isSubphrase) {
            return a.isSubphrase ? 1 : -1
          }
          return a.termLength - b.termLength
        })

        for (const c of candidates) {
          if (seen.has(c.entry.spanish)) continue
          addResult(c.entry, 'fuzzy', query.trim())
          if (results.length >= limit) return results
        }
      }
    }

    // 5. Fallback substring matches (only if still < limit and length >= 3)
    if (results.length < limit && normalized.length >= 3) {
      for (const entry of this.entries) {
        if (seen.has(entry.spanish)) continue
        const primary =
          lang === 'es'
            ? normalizeForSearch(entry.spanish)
            : normalizeForSearch(entry.english)
        if (primary.includes(normalized)) {
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
