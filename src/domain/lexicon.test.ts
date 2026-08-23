import { describe, expect, it } from 'vitest'
import {
  damerauLevenshtein,
  LexiconIndex,
  normalizeForSearch,
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
    spanish: 'Qué padre',
    english: 'How cool',
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
]

describe('normalizeForSearch', () => {
  it('strips accents and lowercase strings', () => {
    expect(normalizeForSearch('Qué padre')).toBe('que padre')
    expect(normalizeForSearch('¿Dónde está?')).toBe('donde esta')
    expect(normalizeForSearch('¡Órale!')).toBe('orale')
    expect(normalizeForSearch('  aguacate  ')).toBe('aguacate')
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

describe('LexiconIndex', () => {
  const index = new LexiconIndex([
    ...TEST_DICTIONARY,
    // Duplicate entry to test deduplication in map
    {
      spanish: 'aguacate',
      english: 'avocado',
      context: 'Duplicate test.',
      tag: 'food',
    },
  ])

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
      expect(results[0]?.spanish).toBe('Qué padre')
    })

    it('finds substring matches when prefix matches are fewer than limit', () => {
      const results = index.suggest('favor')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.spanish).toBe('la cuenta, por favor')
    })

    it('finds matches when searching in English', () => {
      const results = index.suggest('avocado', 'en')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.spanish).toBe('aguacate')
      expect(results[0]?.english).toBe('avocado')
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

    it('returns null for exact matches in Spanish and English', () => {
      expect(index.didYouMean('aguacate', 'es')).toBeNull()
      expect(index.didYouMean('Qué padre', 'es')).toBeNull()
      expect(index.didYouMean('avocado', 'en')).toBeNull()
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

    it('translates exact phrase from English to Spanish', () => {
      const result = index.translate('avocado', 'en')
      expect(result).not.toBeNull()
      expect(result?.spanish).toBe('aguacate')
    })

    it('translates accent-insensitively', () => {
      const result = index.translate('que padre', 'es')
      expect(result).not.toBeNull()
      expect(result?.spanish).toBe('Qué padre')
    })

    it('returns null for unknown phrases', () => {
      expect(index.translate('unknown word', 'es')).toBeNull()
    })
  })
})
