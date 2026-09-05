import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { compareAnswer, normalizeTypography } from './answer'

describe('compareAnswer (character-level affine diff)', () => {
  it('recognizes exact matches', () => {
    const result = compareAnswer(
      '¿Dónde está el metro?',
      '¿Dónde está el metro?',
    )
    expect(result.isExact).toBe(true)
    expect(result.expectedSegments).toEqual([
      { value: '¿Dónde está el metro?', status: 'match' },
    ])
    expect(result.typedSegments).toEqual([
      { value: '¿Dónde está el metro?', status: 'match' },
    ])
  })

  it('handles space variations cleanly (e.g. "may be" vs "maybe") without crossing out words', () => {
    const result = compareAnswer('may be', 'maybe')
    expect(result.isExact).toBe(false)
    expect(result.typedSegments).toEqual([
      { value: 'may', status: 'match' },
      { value: ' ', status: 'extra' },
      { value: 'be', status: 'match' },
    ])
    expect(result.expectedSegments).toEqual([
      { value: 'maybe', status: 'match' },
    ])
  })

  it('gently highlights missing accents as accent guidance without marking words as wrong', () => {
    const result = compareAnswer('Donde esta', '¿Dónde está?')
    expect(result.isExact).toBe(false)
    expect(result.expectedSegments).toEqual([
      { value: '¿', status: 'missing' },
      { value: 'D', status: 'match' },
      { value: 'ó', status: 'accent' },
      { value: 'nde est', status: 'match' },
      { value: 'á', status: 'accent' },
      { value: '?', status: 'missing' },
    ])
    expect(result.typedSegments).toEqual([
      { value: 'Donde esta', status: 'match' },
    ])
  })

  it('treats capitalization differences as case-insensitive matches without case diff indicators', () => {
    const result = compareAnswer('may be', 'Maybe')
    expect(result.isExact).toBe(false)
    expect(result.typedSegments).toEqual([
      { value: 'may', status: 'match' },
      { value: ' ', status: 'extra' },
      { value: 'be', status: 'match' },
    ])
    expect(result.expectedSegments).toEqual([
      { value: 'Maybe', status: 'match' },
    ])
  })

  it('treats casing variations across the entire string as matches', () => {
    const result = compareAnswer('hola', 'Hola')
    expect(result.isExact).toBe(false)
    expect(result.typedSegments).toEqual([{ value: 'hola', status: 'match' }])
    expect(result.expectedSegments).toEqual([
      { value: 'Hola', status: 'match' },
    ])

    const allCaps = compareAnswer('HOLA MUNDO', 'hola mundo')
    expect(allCaps.isExact).toBe(false)
    expect(allCaps.typedSegments).toEqual([
      { value: 'HOLA MUNDO', status: 'match' },
    ])
    expect(allCaps.expectedSegments).toEqual([
      { value: 'hola mundo', status: 'match' },
    ])
  })

  it('detects character typos within words', () => {
    const transposition = compareAnswer('restuarante', 'restaurante')
    expect(transposition.isExact).toBe(false)
    expect(transposition.typedSegments).toEqual([
      { value: 'rest', status: 'match' },
      { value: 'ua', status: 'extra' },
      { value: 'rante', status: 'match' },
    ])
    expect(transposition.expectedSegments).toEqual([
      { value: 'rest', status: 'match' },
      { value: 'au', status: 'missing' },
      { value: 'rante', status: 'match' },
    ])

    const missingChar = compareAnswer('resturante', 'restaurante')
    expect(missingChar.isExact).toBe(false)
    expect(missingChar.typedSegments).toEqual([
      { value: 'resturante', status: 'match' },
    ])
    expect(missingChar.expectedSegments).toEqual([
      { value: 'rest', status: 'match' },
      { value: 'a', status: 'missing' },
      { value: 'urante', status: 'match' },
    ])
  })

  it('favors contiguous matches over fragmented single-character noise across words', () => {
    // "apple" and "cherry" both contain "e", but matching the isolated "e" would fragment "cherry"
    const result = compareAnswer('apple pie', 'cherry pie')
    expect(result.isExact).toBe(false)
    expect(result.typedSegments).toEqual([
      { value: 'apple', status: 'extra' },
      { value: ' pie', status: 'match' },
    ])
    expect(result.expectedSegments).toEqual([
      { value: 'cherry', status: 'missing' },
      { value: ' pie', status: 'match' },
    ])

    // Words with completely disjoint characters
    const disjoint = compareAnswer('cat', 'dog')
    expect(disjoint.isExact).toBe(false)
    expect(disjoint.typedSegments).toEqual([{ value: 'cat', status: 'extra' }])
    expect(disjoint.expectedSegments).toEqual([
      { value: 'dog', status: 'missing' },
    ])

    // Words with shared morphological suffixes
    const suffixMatch = compareAnswer('gato', 'perro')
    expect(suffixMatch.isExact).toBe(false)
    expect(suffixMatch.typedSegments).toEqual([
      { value: 'gat', status: 'extra' },
      { value: 'o', status: 'match' },
    ])
    expect(suffixMatch.expectedSegments).toEqual([
      { value: 'perr', status: 'missing' },
      { value: 'o', status: 'match' },
    ])
  })

  it('disambiguates repeated words by aligning contiguous phrases', () => {
    const trailingPhrase = compareAnswer('el gato', 'el perro y el gato')
    expect(trailingPhrase.isExact).toBe(false)
    expect(trailingPhrase.typedSegments).toEqual([
      { value: 'el gato', status: 'match' },
    ])
    expect(trailingPhrase.expectedSegments).toEqual([
      { value: 'el perro y ', status: 'missing' },
      { value: 'el gato', status: 'match' },
    ])

    const leadingPhrase = compareAnswer('el perro', 'el perro y el gato')
    expect(leadingPhrase.isExact).toBe(false)
    expect(leadingPhrase.typedSegments).toEqual([
      { value: 'el perro', status: 'match' },
    ])
    expect(leadingPhrase.expectedSegments).toEqual([
      { value: 'el perro', status: 'match' },
      { value: ' y el gato', status: 'missing' },
    ])
  })

  it('handles missing words in phrases', () => {
    const result = compareAnswer('Where is metro', 'Where is the metro?')
    expect(result.isExact).toBe(false)
    expect(result.expectedSegments).toEqual([
      { value: 'Where is ', status: 'match' },
      { value: 'the ', status: 'missing' },
      { value: 'metro', status: 'match' },
      { value: '?', status: 'missing' },
    ])
    expect(result.typedSegments).toEqual([
      { value: 'Where is metro', status: 'match' },
    ])

    const trailing = compareAnswer('tal', 'tal vez')
    expect(trailing.isExact).toBe(false)
    expect(trailing.expectedSegments).toEqual([
      { value: 'tal', status: 'match' },
      { value: ' vez', status: 'missing' },
    ])

    const trailingExtra = compareAnswer('tal vez extra', 'tal vez')
    expect(trailingExtra.isExact).toBe(false)
    expect(trailingExtra.typedSegments).toEqual([
      { value: 'tal vez', status: 'match' },
      { value: ' extra', status: 'extra' },
    ])
  })

  it('handles empty inputs cleanly', () => {
    expect(compareAnswer('', '')).toEqual({
      isExact: true,
      expectedSegments: [],
      typedSegments: [],
    })

    expect(compareAnswer('', 'expected')).toEqual({
      isExact: false,
      expectedSegments: [{ value: 'expected', status: 'missing' }],
      typedSegments: [],
    })

    expect(compareAnswer('extra', '')).toEqual({
      isExact: false,
      expectedSegments: [],
      typedSegments: [{ value: 'extra', status: 'extra' }],
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
          expect(comparison.isExact).toBe(true)
          expect(comparison.expectedSegments).toEqual(
            sentence ? [{ value: sentence, status: 'match' }] : [],
          )
        },
      ),
    )
  })

  it('treats macOS typographic ellipsis as three dots', () => {
    const result = compareAnswer(
      'it works well to\u2026',
      'it works well to...',
    )
    expect(result.isExact).toBe(true)
  })

  it('treats macOS smart quotes as plain quotes', () => {
    const single = compareAnswer('\u2018it works\u2019', "'it works'")
    expect(single.isExact).toBe(true)

    const double = compareAnswer('\u201Cit works\u201D', '"it works"')
    expect(double.isExact).toBe(true)
  })

  it('treats macOS en/em dashes as hyphens', () => {
    const enDash = compareAnswer('well\u2013known', 'well-known')
    expect(enDash.isExact).toBe(true)

    const emDash = compareAnswer('stop\u2014go', 'stop-go')
    expect(emDash.isExact).toBe(true)
  })

  it('treats slash spacing variations as exact matches', () => {
    const withoutSpaces = compareAnswer('to take/drink', 'to take / drink')
    expect(withoutSpaces.isExact).toBe(true)

    const reverse = compareAnswer('to take / drink', 'to take/drink')
    expect(reverse.isExact).toBe(true)

    const irregular = compareAnswer('to take  /  drink', 'to take / drink')
    expect(irregular.isExact).toBe(true)
  })

  it('aligns delimiters cleanly when typing has typos alongside delimiter spacing differences', () => {
    const result = compareAnswer('to take/drnk', 'to take / drink')
    expect(result.isExact).toBe(false)
    expect(result.typedSegments).toEqual([
      { value: 'to take / drnk', status: 'match' },
    ])
    expect(result.expectedSegments).toEqual([
      { value: 'to take / dr', status: 'match' },
      { value: 'i', status: 'missing' },
      { value: 'nk', status: 'match' },
    ])
  })

  it('aligns isolated characters and single-letter words without swallowing them into whitespace gaps', () => {
    // Hyphens with space variations
    const hyphenResult = compareAnswer('well - known', 'well-known')
    expect(hyphenResult.isExact).toBe(false)
    expect(hyphenResult.typedSegments).toEqual([
      { value: 'well', status: 'match' },
      { value: ' ', status: 'extra' },
      { value: '-', status: 'match' },
      { value: ' ', status: 'extra' },
      { value: 'known', status: 'match' },
    ])
    expect(hyphenResult.expectedSegments).toEqual([
      { value: 'well-known', status: 'match' },
    ])

    // Single-letter Spanish words without spaces
    const singleLetterResult = compareAnswer('panyvino', 'pan y vino')
    expect(singleLetterResult.isExact).toBe(false)
    expect(singleLetterResult.typedSegments).toEqual([
      { value: 'panyvino', status: 'match' },
    ])
    expect(singleLetterResult.expectedSegments).toEqual([
      { value: 'pan', status: 'match' },
      { value: ' ', status: 'missing' },
      { value: 'y', status: 'match' },
      { value: ' ', status: 'missing' },
      { value: 'vino', status: 'match' },
    ])
  })
})

describe('normalizeTypography', () => {
  it('replaces ellipsis with three dots', () => {
    expect(normalizeTypography('wait\u2026')).toBe('wait...')
  })

  it('replaces smart single quotes with ASCII apostrophe', () => {
    expect(normalizeTypography('\u2018hello\u2019')).toBe("'hello'")
  })

  it('replaces smart double quotes with ASCII double quote', () => {
    expect(normalizeTypography('\u201Chi\u201D')).toBe('"hi"')
  })

  it('replaces en-dash and em-dash with hyphen', () => {
    expect(normalizeTypography('a\u2013b')).toBe('a-b')
    expect(normalizeTypography('a\u2014b')).toBe('a-b')
  })

  it('normalizes spacing around slash delimiters', () => {
    expect(normalizeTypography('take/drink')).toBe('take / drink')
    expect(normalizeTypography('take / drink')).toBe('take / drink')
    expect(normalizeTypography('take  /  drink')).toBe('take / drink')
    expect(normalizeTypography('take /drink')).toBe('take / drink')
    expect(normalizeTypography('take/ drink')).toBe('take / drink')
    expect(normalizeTypography(' / ')).toBe('/')
  })

  it('leaves plain ASCII text unchanged', () => {
    expect(normalizeTypography('hello world...')).toBe('hello world...')
  })
})
