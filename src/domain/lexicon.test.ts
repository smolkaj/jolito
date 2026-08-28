import { describe, expect, it } from 'vitest'
import {
  damerauLevenshtein,
  extractGlossTerms,
  LexiconIndex,
  normalizeForSearch,
  weightedSpanishDistance,
  type LexiconEntry,
} from './lexicon'

const TEST_DICTIONARY: LexiconEntry[] = [
  {
    spanish: 'aguacate',
    english: 'avocado',
    context: 'Key ingredient across Mexican cuisine.',
    tag: 'food',
  },
  {
    spanish: 'ahorita',
    english: 'right now / in a minute',
    context: 'Can mean immediately or never in Mexican Spanish.',
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
    spanish: 'la cuenta, por favor',
    english: 'the bill, please',
    context: 'Polite restaurant phrase.',
    tag: 'travel',
  },
  {
    spanish: 'para llevar',
    english: 'to go / takeaway',
    context: 'Used when ordering food.',
    tag: 'food',
  },
  {
    spanish: 'tener',
    english: 'to have / to possess',
    context: 'Common verb.',
    tag: 'basics',
  },
]

describe('normalizeForSearch', () => {
  it('strips accents and lowercase strings', () => {
    expect(normalizeForSearch('Qué padre')).toBe('que padre')
    expect(normalizeForSearch('¿Dónde está?')).toBe('donde esta')
    expect(normalizeForSearch('¡Órale!')).toBe('orale')
    expect(normalizeForSearch('  aguacate  ')).toBe('aguacate')
  })
})

describe('extractGlossTerms', () => {
  it('splits multi-gloss definitions on slashes, semicolons, and commas', () => {
    const terms = extractGlossTerms(
      'right now / in a minute; right away, pronto',
    )
    expect(terms).toContain('right now')
    expect(terms).toContain('in a minute')
    expect(terms).toContain('right away')
    expect(terms).toContain('pronto')
  })

  it('extracts both full infinitive and bare verb forms for English verb glosses', () => {
    const terms = extractGlossTerms('to speak / to talk')
    expect(terms).toContain('to speak')
    expect(terms).toContain('speak')
    expect(terms).toContain('to talk')
    expect(terms).toContain('talk')
  })
})

describe('damerauLevenshtein', () => {
  it('computes accurate edit distances with transpositions', () => {
    expect(damerauLevenshtein('', '')).toBe(0)
    expect(damerauLevenshtein('', 'aguacate')).toBe(8)
    expect(damerauLevenshtein('aguacate', '')).toBe(8)
    expect(damerauLevenshtein('aguacate', 'aguacate')).toBe(0)
    expect(damerauLevenshtein('aguacatte', 'aguacate')).toBe(1)
    expect(damerauLevenshtein('agaucate', 'aguacate')).toBe(1) // transposition
    expect(damerauLevenshtein('orale', 'órale')).toBe(1)
    expect(damerauLevenshtein('chido', 'chdo')).toBe(1)
    expect(damerauLevenshtein('completely', 'different')).toBeGreaterThan(4)
  })
})

describe('weightedSpanishDistance', () => {
  it('assigns lower distance to Spanish phonetic substitutions', () => {
    // Silent h insertion/deletion (0.4 vs 1.0)
    expect(weightedSpanishDistance('ablar', 'hablar')).toBeCloseTo(0.4, 1)
    expect(weightedSpanishDistance('acer', 'hacer')).toBeCloseTo(0.4, 1)

    // b/v homophones (0.4 vs 1.0)
    expect(weightedSpanishDistance('havia', 'habia')).toBeCloseTo(0.4, 1)

    // g/j homophones before e/i (0.4 vs 1.0)
    expect(weightedSpanishDistance('elejir', 'elegir')).toBeCloseTo(0.4, 1)

    // Double consonant reductions from English learners (0.4 vs 1.0)
    expect(weightedSpanishDistance('aguacatte', 'aguacate')).toBeCloseTo(0.4, 1)
    expect(weightedSpanishDistance('proffesor', 'profesor')).toBeCloseTo(0.4, 1)

    // Transpositions
    expect(weightedSpanishDistance('agaucate', 'aguacate')).toBeCloseTo(0.8, 1)

    // Large length difference
    expect(weightedSpanishDistance('a', 'aguacate')).toBeGreaterThanOrEqual(3)
  })
})

describe('LexiconIndex', () => {
  const index = new LexiconIndex(
    [
      ...TEST_DICTIONARY,
      // Duplicate entry to test deduplication in map
      {
        spanish: 'aguacate',
        english: 'avocado',
        context: 'Duplicate test.',
        tag: 'food',
      },
    ],
    {
      tuvimos: 'tener',
      tengo: 'tener',
    },
  )

  describe('suggest', () => {
    it('returns empty array for empty or single-character query', () => {
      expect(index.suggest('')).toEqual([])
      expect(index.suggest('a')).toEqual([])
    })

    it('finds exact and prefix matches in Spanish', () => {
      const results = index.suggest('ahor')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.spanish).toBe('ahorita')
      expect(results[0]?.matchType).toBe('prefix')
    })

    it('matches accent-insensitively', () => {
      const results = index.suggest('que pad')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.spanish).toBe('qué padre')
    })

    it('finds substring matches when prefix matches are fewer than limit', () => {
      const results = index.suggest('favor')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.spanish).toBe('la cuenta, por favor')
    })

    it('finds matches when searching in English using individual gloss terms', () => {
      const results = index.suggest('avocado', 'en')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.spanish).toBe('aguacate')
      expect(results[0]?.english).toBe('avocado')

      const takeawayResults = index.suggest('takeaway', 'en')
      expect(takeawayResults.length).toBeGreaterThan(0)
      expect(takeawayResults[0]?.spanish).toBe('para llevar')

      const minuteResults = index.suggest('minute', 'en')
      expect(minuteResults.length).toBeGreaterThan(0)
      expect(minuteResults[0]?.spanish).toBe('ahorita')
    })

    it('resolves Spanish inflections to their base lemmas with lemma matchType', () => {
      const results = index.suggest('tuvimos', 'es')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.spanish).toBe('tener')
      expect(results[0]?.matchType).toBe('lemma')
      expect(results[0]?.matchedForm).toBe('tuvimos')
    })

    it('finds word-boundary matches in compound phrases', () => {
      const results = index.suggest('padre', 'es')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.spanish).toBe('qué padre')
    })

    it('finds fuzzy suggestions when typos occur and assigns fuzzy matchType', () => {
      const results = index.suggest('aguacatte', 'es')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.spanish).toBe('aguacate')
      expect(results[0]?.matchType).toBe('fuzzy')
      expect(results[0]?.matchedForm).toBe('aguacatte')

      const enFuzzy = index.suggest('avocaddo', 'en')
      expect(enFuzzy.length).toBeGreaterThan(0)
      expect(enFuzzy[0]?.spanish).toBe('aguacate')
      expect(enFuzzy[0]?.matchType).toBe('fuzzy')
    })

    it('limits returned suggestions to requested limit', () => {
      const results = index.suggest('a', 'es', 1)
      expect(results.length).toBeLessThanOrEqual(1)
    })
  })

  describe('didYouMean', () => {
    it('returns null for short queries under 3 characters', () => {
      expect(index.didYouMean('ag')).toBeNull()
    })

    it('returns null for exact matches and known lemmas in Spanish and English', () => {
      expect(index.didYouMean('aguacate', 'es')).toBeNull()
      expect(index.didYouMean('qué padre', 'es')).toBeNull()
      expect(index.didYouMean('avocado', 'en')).toBeNull()
      expect(index.didYouMean('tuvimos', 'es')).toBeNull() // known lemma form
    })

    it('returns fuzzy match for minor typos in Spanish and English', () => {
      const typoResult = index.didYouMean('aguacatte')
      expect(typoResult).not.toBeNull()
      expect(typoResult?.spanish).toBe('aguacate')
      expect(typoResult?.english).toBe('avocado')

      const typoResult2 = index.didYouMean('no machnes')
      expect(typoResult2).not.toBeNull()
      expect(typoResult2?.spanish).toBe('no manches')

      const typoEnResult = index.didYouMean('avocaddo', 'en')
      expect(typoEnResult).not.toBeNull()
      expect(typoEnResult?.spanish).toBe('aguacate')
    })

    it('returns null for completely unrelated words', () => {
      expect(index.didYouMean('xyzabc123')).toBeNull()
    })
  })

  describe('translate', () => {
    it('returns null for empty or whitespace query', () => {
      expect(index.translate('', 'es')).toBeNull()
      expect(index.translate('   ', 'es')).toBeNull()
    })

    it('translates exact phrase from Spanish to English', () => {
      const result = index.translate('aguacate', 'es')
      expect(result).not.toBeNull()
      expect(result?.english).toBe('avocado')
      expect(result?.context).toContain('Mexican cuisine')
    })

    it('translates exact phrase from English to Spanish across multi-term glosses', () => {
      const result = index.translate('avocado', 'en')
      expect(result).not.toBeNull()
      expect(result?.spanish).toBe('aguacate')

      const takeaway = index.translate('takeaway', 'en')
      expect(takeaway).not.toBeNull()
      expect(takeaway?.spanish).toBe('para llevar')

      const toGo = index.translate('to go', 'en')
      expect(toGo).not.toBeNull()
      expect(toGo?.spanish).toBe('para llevar')

      const rightNow = index.translate('right now', 'en')
      expect(rightNow).not.toBeNull()
      expect(rightNow?.spanish).toBe('ahorita')
    })

    it('translates inflected Spanish forms to base lemma', () => {
      const result = index.translate('tuvimos', 'es')
      expect(result).not.toBeNull()
      expect(result?.spanish).toBe('tener')
    })

    it('translates accent-insensitively', () => {
      const result = index.translate('que padre', 'es')
      expect(result).not.toBeNull()
      expect(result?.spanish).toBe('qué padre')
    })

    it('returns null for unknown phrases', () => {
      expect(index.translate('unknown word', 'es')).toBeNull()
    })
  })

  describe('addEntries and count', () => {
    it('appends new entries and updates search maps dynamically', () => {
      const dynamicIndex = new LexiconIndex()
      expect(dynamicIndex.count()).toBe(0)
      expect(dynamicIndex.lemmaCount()).toBe(0)
      expect(dynamicIndex.translate('antorcha', 'es')).toBeNull()

      dynamicIndex.addEntries([
        {
          spanish: 'antorcha',
          english: 'torch / flare',
          context: 'noun.',
          tag: 'common',
        },
      ])

      dynamicIndex.setLemmaMap({ antorchitas: 'antorcha' })

      expect(dynamicIndex.count()).toBe(1)
      expect(dynamicIndex.lemmaCount()).toBe(1)
      expect(dynamicIndex.translate('antorcha', 'es')?.english).toContain(
        'torch',
      )
      expect(dynamicIndex.translate('flare', 'en')?.spanish).toBe('antorcha')
      expect(dynamicIndex.translate('antorchitas', 'es')?.spanish).toBe(
        'antorcha',
      )
      expect(dynamicIndex.suggest('antor')).toHaveLength(1)
    })

    it('gracefully handles lemma mapping to an unindexed target word', () => {
      const indexWithDanglingLemma = new LexiconIndex([], {
        fantasma: 'no_existe',
      })
      expect(indexWithDanglingLemma.suggest('fantasma', 'es')).toEqual([])
      expect(indexWithDanglingLemma.translate('fantasma', 'es')).toBeNull()
    })
  })
})
