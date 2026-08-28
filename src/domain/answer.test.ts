import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { compareAnswer, normalizeTypography } from './answer'

describe('compareAnswer (character-level LCS diff)', () => {
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

  it('tolerates capitalization nuances without fragmenting words', () => {
    const result = compareAnswer('may be', 'Maybe')
    expect(result.isExact).toBe(false)
    expect(result.typedSegments).toEqual([
      { value: 'may', status: 'match' },
      { value: ' ', status: 'extra' },
      { value: 'be', status: 'match' },
    ])
    expect(result.expectedSegments).toEqual([
      { value: 'M', status: 'case' },
      { value: 'aybe', status: 'match' },
    ])
  })

  it('detects character typos within words', () => {
    const result = compareAnswer('restuarante', 'restaurante')
    expect(result.isExact).toBe(false)
    expect(result.typedSegments).toEqual([
      { value: 'rest', status: 'match' },
      { value: 'u', status: 'extra' },
      { value: 'arante', status: 'match' },
    ])
    expect(result.expectedSegments).toEqual([
      { value: 'resta', status: 'match' },
      { value: 'u', status: 'missing' },
      { value: 'rante', status: 'match' },
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
    const result = compareAnswer('it works well to\u2026', 'it works well to...')
    expect(result.isExact).toBe(true)
  })

  it('treats macOS smart quotes as plain quotes', () => {
    const single = compareAnswer(
      '\u2018it works\u2019',
      "'it works'",
    )
    expect(single.isExact).toBe(true)

    const double = compareAnswer(
      '\u201Cit works\u201D',
      '"it works"',
    )
    expect(double.isExact).toBe(true)
  })

  it('treats macOS en/em dashes as hyphens', () => {
    const enDash = compareAnswer('well\u2013known', 'well-known')
    expect(enDash.isExact).toBe(true)

    const emDash = compareAnswer('stop\u2014go', 'stop-go')
    expect(emDash.isExact).toBe(true)
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

  it('leaves plain ASCII text unchanged', () => {
    expect(normalizeTypography('hello world...')).toBe('hello world...')
  })
})

