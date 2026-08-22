import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { compareAnswer, diffWordSegments, levenshtein } from './answer'

describe('levenshtein distance', () => {
  it('calculates string edit distances correctly', () => {
    expect(levenshtein('metro', 'metro')).toBe(0)
    expect(levenshtein('restuarante', 'restaurante')).toBe(2)
    expect(levenshtein('gato', 'pato')).toBe(1)
    expect(levenshtein('', 'hola')).toBe(4)
    expect(levenshtein('hola', '')).toBe(4)
  })
})

describe('diffWordSegments', () => {
  it('groups matching, missing, extra, and accented segments within words', () => {
    const accents = diffWordSegments('esta', 'está')
    expect(accents.expectedSegments).toEqual([
      { value: 'est', status: 'match' },
      { value: 'á', status: 'accent' },
    ])
    expect(accents.typedSegments).toEqual([
      { value: 'est', status: 'match' },
      { value: 'a', status: 'accent' },
    ])

    const typo = diffWordSegments('restuarante', 'restaurante')
    expect(typo.expectedSegments).toEqual([
      { value: 'resta', status: 'match' },
      { value: 'u', status: 'missing' },
      { value: 'rante', status: 'match' },
    ])

    const trailing = diffWordSegments('metroxyz', 'metro')
    expect(trailing.typedSegments).toEqual([
      { value: 'metro', status: 'match' },
      { value: 'xyz', status: 'extra' },
    ])
  })
})

describe('compareAnswer', () => {
  it('recognizes exact matches', () => {
    const result = compareAnswer(
      '¿Dónde está el metro?',
      '¿Dónde está el metro?',
    )
    expect(result.quality).toBe('exact')
    expect(result.qualityLabel).toBe('Exact match')
    expect(result.expected.every((token) => token.status === 'match')).toBe(
      true,
    )
    expect(result.typed.every((token) => token.status === 'match')).toBe(true)
    expect(result.extra).toEqual([])
  })

  it('tolerates missing inverted marks and missing accents as gentle accent notes without failing words', () => {
    const result = compareAnswer('Donde esta el metro', '¿Dónde está el metro?')
    expect(result.quality).toBe('accents-only')
    expect(result.qualityLabel).toBe('Close (check accents)')
    expect(result.expected).toEqual([
      {
        value: '¿Dónde',
        status: 'accent',
        segments: [
          { value: '¿', status: 'missing' },
          { value: 'D', status: 'match' },
          { value: 'ó', status: 'accent' },
          { value: 'nde', status: 'match' },
        ],
      },
      {
        value: 'está',
        status: 'accent',
        segments: [
          { value: 'est', status: 'match' },
          { value: 'á', status: 'accent' },
        ],
      },
      {
        value: 'el',
        status: 'match',
        segments: [{ value: 'el', status: 'match' }],
      },
      {
        value: 'metro?',
        status: 'match',
        segments: [
          { value: 'metro', status: 'match' },
          { value: '?', status: 'missing' },
        ],
      },
    ])
    expect(result.extra).toEqual([])
  })

  it('detects and highlights single-letter typos within words', () => {
    const result = compareAnswer('el restuarante', 'el restaurante')
    expect(result.quality).toBe('close')
    expect(result.qualityLabel).toBe('Close')
    expect(result.expected[1]).toMatchObject({
      value: 'restaurante',
      status: 'typo',
    })
    expect(result.typed[1]).toMatchObject({
      value: 'restuarante',
      status: 'typo',
    })
  })

  it('handles missing and extra words with inline alignment', () => {
    const result = compareAnswer(
      'Could make this to go',
      'Could you make it to go?',
    )
    expect(result.quality).toBe('different')
    expect(result.qualityLabel).toBe('You decide')
    expect(result.expected).toEqual([
      {
        value: 'Could',
        status: 'match',
        segments: [{ value: 'Could', status: 'match' }],
      },
      { value: 'you', status: 'missing' },
      {
        value: 'make',
        status: 'match',
        segments: [{ value: 'make', status: 'match' }],
      },
      { value: 'it', status: 'missing' },
      {
        value: 'to',
        status: 'match',
        segments: [{ value: 'to', status: 'match' }],
      },
      {
        value: 'go?',
        status: 'match',
        segments: [
          { value: 'go', status: 'match' },
          { value: '?', status: 'missing' },
        ],
      },
    ])
    expect(result.typed).toEqual([
      {
        value: 'Could',
        status: 'match',
        segments: [{ value: 'Could', status: 'match' }],
      },
      {
        value: 'make',
        status: 'match',
        segments: [{ value: 'make', status: 'match' }],
      },
      { value: 'this', status: 'extra' },
      {
        value: 'to',
        status: 'match',
        segments: [{ value: 'to', status: 'match' }],
      },
      {
        value: 'go',
        status: 'match',
        segments: [{ value: 'go', status: 'match' }],
      },
    ])
    expect(result.extra).toEqual(['this'])
  })

  it('handles empty inputs cleanly', () => {
    expect(compareAnswer('', '')).toEqual({
      quality: 'exact',
      qualityLabel: 'Exact match',
      expected: [],
      typed: [],
      extra: [],
    })

    expect(compareAnswer('', 'expected words')).toEqual({
      quality: 'different',
      qualityLabel: 'You decide',
      expected: [
        { value: 'expected', status: 'missing' },
        { value: 'words', status: 'missing' },
      ],
      typed: [],
      extra: [],
    })

    expect(compareAnswer('extra words', '')).toEqual({
      quality: 'different',
      qualityLabel: 'You decide',
      expected: [],
      typed: [
        { value: 'extra', status: 'extra' },
        { value: 'words', status: 'extra' },
      ],
      extra: ['extra', 'words'],
    })
  })

  it('always marks identical sequences as exact match', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc
            .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), {
              minLength: 1,
              maxLength: 12,
            })
            .map((characters) => characters.join('')),
          {
            minLength: 1,
            maxLength: 8,
          },
        ),
        (words) => {
          const sentence = words.join(' ')
          const comparison = compareAnswer(sentence, sentence)
          expect(comparison.quality).toBe('exact')
          expect(comparison.extra).toEqual([])
          expect(
            comparison.expected.every((token) => token.status === 'match'),
          ).toBe(true)
        },
      ),
    )
  })
})
