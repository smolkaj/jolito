import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { compareAnswer, normalizeTypography, splitEnumeration } from './answer'

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

  it('treats missing inverted marks as exact matches when rest of answer matches', () => {
    const question = compareAnswer(
      'Dónde está el metro?',
      '¿Dónde está el metro?',
    )
    expect(question.isExact).toBe(true)
    expect(question.expectedSegments).toEqual([
      { value: '¿Dónde está el metro?', status: 'match' },
    ])
    expect(question.typedSegments).toEqual([
      { value: 'Dónde está el metro?', status: 'match' },
    ])

    const exclamation = compareAnswer('Genial!', '¡Genial!')
    expect(exclamation.isExact).toBe(true)
    expect(exclamation.expectedSegments).toEqual([
      { value: '¡Genial!', status: 'match' },
    ])
    expect(exclamation.typedSegments).toEqual([
      { value: 'Genial!', status: 'match' },
    ])

    const midSentence = compareAnswer('Hola, cómo estás?', 'Hola, ¿cómo estás?')
    expect(midSentence.isExact).toBe(true)
    expect(midSentence.expectedSegments).toEqual([
      { value: 'Hola, ¿cómo estás?', status: 'match' },
    ])
  })

  it('gently highlights missing accents and inverted marks as accent guidance without marking words as wrong', () => {
    const result = compareAnswer('Donde esta', '¿Dónde está?')
    expect(result.isExact).toBe(false)
    expect(result.expectedSegments).toEqual([
      { value: '¿', status: 'accent' },
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

  it('normalizes spacing around semicolons without leading space', () => {
    expect(normalizeTypography('hola; buenos días')).toBe('hola; buenos días')
    expect(normalizeTypography('hola ; buenos días')).toBe('hola; buenos días')
    expect(normalizeTypography('hola;buenos días')).toBe('hola; buenos días')
    expect(normalizeTypography('hola  ;  buenos días')).toBe(
      'hola; buenos días',
    )
    expect(normalizeTypography(' ; ')).toBe(';')
  })

  it('leaves plain ASCII text unchanged', () => {
    expect(normalizeTypography('hello world...')).toBe('hello world...')
  })
})

describe('splitEnumeration', () => {
  it('splits on slash and semicolon', () => {
    expect(splitEnumeration('take / drink')).toEqual({
      items: ['take', 'drink'],
      delimiters: [' / '],
      primaryDelim: ' / ',
      primaryDelimChar: '/',
    })

    expect(splitEnumeration('hola; buenos días')).toEqual({
      items: ['hola', 'buenos días'],
      delimiters: ['; '],
      primaryDelim: '; ',
      primaryDelimChar: ';',
    })
  })

  it('preserves grammatical commas inside phrases without splitting them', () => {
    expect(splitEnumeration('yes, please / no, thank you')).toEqual({
      items: ['yes, please', 'no, thank you'],
      delimiters: [' / '],
      primaryDelim: ' / ',
      primaryDelimChar: '/',
    })

    // Conversational sentences with commas are not alternative enumerations
    expect(splitEnumeration('To go, please')).toBeNull()
    expect(splitEnumeration('La cuenta, por favor')).toBeNull()
    expect(splitEnumeration('No, gracias')).toBeNull()
  })

  it('ignores delimiters inside parentheses and brackets', () => {
    expect(splitEnumeration('to know (facts / skills)')).toBeNull()
    expect(splitEnumeration('to know [facts / skills]')).toBeNull()
    expect(splitEnumeration('to have (auxiliary) / there is')).toEqual({
      items: ['to have (auxiliary)', 'there is'],
      delimiters: [' / '],
      primaryDelim: ' / ',
      primaryDelimChar: '/',
    })
  })

  it('returns null for non-enumerations and incomplete inputs', () => {
    expect(splitEnumeration('restaurante')).toBeNull()
    expect(splitEnumeration('Where is the metro?')).toBeNull()
    expect(splitEnumeration('')).toBeNull()
    expect(splitEnumeration('take / ')).toBeNull()
    expect(splitEnumeration(' / take')).toBeNull()
    expect(splitEnumeration('; take')).toBeNull()
    expect(splitEnumeration('take;')).toBeNull()
  })
})

describe('compareAnswer (enumeration commutativity & missing words)', () => {
  it('treats reversed items as an exact match across slash and semicolon', () => {
    const slash = compareAnswer('drink / take', 'take / drink')
    expect(slash.isExact).toBe(true)

    const semi = compareAnswer('buenos días; hola', 'hola; buenos días')
    expect(semi.isExact).toBe(true)
  })

  it('accepts comma as an item delimiter when user types an answer to an enumeration card', () => {
    const commaForSlash = compareAnswer('drink, take', 'take / drink')
    expect(commaForSlash.isExact).toBe(true)

    const commaForSemi = compareAnswer('buenos días, hola', 'hola; buenos días')
    expect(commaForSemi.isExact).toBe(true)
  })

  it('handles 3-item permutations as exact matches', () => {
    const perm1 = compareAnswer(
      'Later / Right now / In a minute',
      'Right now / In a minute / Later',
    )
    expect(perm1.isExact).toBe(true)

    const perm2 = compareAnswer('dos ; tres ; uno', 'uno ; dos ; tres')
    expect(perm2.isExact).toBe(true)
  })

  it('preserves sentence word order for phrases with grammatical commas without scrambling', () => {
    // Omitting comma in "To go, please" highlights the missing comma without inverting words
    const toGo = compareAnswer('To go please', 'To go, please')
    expect(toGo.isExact).toBe(false)
    expect(toGo.expectedSegments).toEqual([
      { value: 'To go', status: 'match' },
      { value: ',', status: 'missing' },
      { value: ' please', status: 'match' },
    ])
    expect(toGo.typedSegments).toEqual([
      { value: 'To go please', status: 'match' },
    ])

    // "No, gracias" is not scrambled into "gracias, No"
    const noGracias = compareAnswer('No gracias', 'No, gracias')
    expect(noGracias.isExact).toBe(false)
    expect(noGracias.expectedSegments).toEqual([
      { value: 'No', status: 'match' },
      { value: ',', status: 'missing' },
      { value: ' gracias', status: 'match' },
    ])

    // Scrambled sentence is NOT accepted as exact match
    const invertedSentence = compareAnswer('please, To go', 'To go, please')
    expect(invertedSentence.isExact).toBe(false)
  })

  it('shows missing words at the end when only a subset of items is typed', () => {
    // User typed second item only
    const typedSecond = compareAnswer('drink', 'take / drink')
    expect(typedSecond.isExact).toBe(false)
    expect(typedSecond.typedSegments).toEqual([
      { value: 'drink', status: 'match' },
    ])
    expect(typedSecond.expectedSegments).toEqual([
      { value: 'drink', status: 'match' },
      { value: ' / take', status: 'missing' },
    ])

    // User typed first item only
    const typedFirst = compareAnswer('take', 'take / drink')
    expect(typedFirst.isExact).toBe(false)
    expect(typedFirst.typedSegments).toEqual([
      { value: 'take', status: 'match' },
    ])
    expect(typedFirst.expectedSegments).toEqual([
      { value: 'take', status: 'match' },
      { value: ' / drink', status: 'missing' },
    ])

    // User typed 2 out of 3 items in reverse order
    const permMissing = compareAnswer('tres, uno', 'uno / dos / tres')
    expect(permMissing.isExact).toBe(false)
    expect(permMissing.typedSegments).toEqual([
      { value: 'tres, uno', status: 'match' },
    ])
    expect(permMissing.expectedSegments).toEqual([
      { value: 'tres / uno', status: 'match' },
      { value: ' / dos', status: 'missing' },
    ])

    // User typed 1 out of 3 items
    const singleOfThree = compareAnswer('dos', 'uno / dos / tres')
    expect(singleOfThree.isExact).toBe(false)
    expect(singleOfThree.typedSegments).toEqual([
      { value: 'dos', status: 'match' },
    ])
    expect(singleOfThree.expectedSegments).toEqual([
      { value: 'dos', status: 'match' },
      { value: ' / uno / tres', status: 'missing' },
    ])
  })

  it('aligns typos within items commutatively while keeping missing words at the end', () => {
    // Typo in one item, both items present
    const typoPerm = compareAnswer('drnk / take', 'take / drink')
    expect(typoPerm.isExact).toBe(false)
    expect(typoPerm.typedSegments).toEqual([
      { value: 'drnk / take', status: 'match' },
    ])
    expect(typoPerm.expectedSegments).toEqual([
      { value: 'dr', status: 'match' },
      { value: 'i', status: 'missing' },
      { value: 'nk / take', status: 'match' },
    ])

    // Typo in one item, other item missing
    const typoMissing = compareAnswer('drnk', 'take / drink')
    expect(typoMissing.isExact).toBe(false)
    expect(typoMissing.typedSegments).toEqual([
      { value: 'drnk', status: 'match' },
    ])
    expect(typoMissing.expectedSegments).toEqual([
      { value: 'dr', status: 'match' },
      { value: 'i', status: 'missing' },
      { value: 'nk', status: 'match' },
      { value: ' / take', status: 'missing' },
    ])
  })

  it('handles extra items gracefully', () => {
    // Extra item at the end
    const extraEnd = compareAnswer('take / drink / sleep', 'take / drink')
    expect(extraEnd.isExact).toBe(false)
    expect(extraEnd.typedSegments).toEqual([
      { value: 'take / drink', status: 'match' },
      { value: ' / sleep', status: 'extra' },
    ])
    expect(extraEnd.expectedSegments).toEqual([
      { value: 'take / drink', status: 'match' },
    ])

    // Extra item at the beginning
    const extraStart = compareAnswer('eat / take / drink', 'take / drink')
    expect(extraStart.isExact).toBe(false)
    expect(extraStart.typedSegments).toEqual([
      { value: 'eat / ', status: 'extra' },
      { value: 'take / drink', status: 'match' },
    ])
    expect(extraStart.expectedSegments).toEqual([
      { value: 'take / drink', status: 'match' },
    ])
  })

  it('handles inverted punctuation with commutativity', () => {
    const invertedExact = compareAnswer(
      'Dónde queda? / Dónde está?',
      '¿Dónde está? / ¿Dónde queda?',
    )
    expect(invertedExact.isExact).toBe(true)

    const invertedMissing = compareAnswer('Genial!', '¡Genial! / ¡Maravilloso!')
    expect(invertedMissing.isExact).toBe(false)
    expect(invertedMissing.typedSegments).toEqual([
      { value: 'Genial!', status: 'match' },
    ])
    expect(invertedMissing.expectedSegments).toEqual([
      { value: '¡Genial!', status: 'match' },
      { value: ' / ', status: 'missing' },
      { value: '¡', status: 'accent' },
      { value: 'Maravilloso!', status: 'missing' },
    ])
  })

  it('falls back to sequential diff when no items match', () => {
    const disjoint = compareAnswer('cat', 'take / drink')
    expect(disjoint.isExact).toBe(false)
    expect(disjoint.typedSegments).toEqual([{ value: 'cat', status: 'extra' }])
    expect(disjoint.expectedSegments).toEqual([
      { value: 'take / drink', status: 'missing' },
    ])
  })

  it('falls back to single item when typed delimiter has fewer than two valid items', () => {
    const trailingDelim = compareAnswer('take / ', 'take / drink')
    expect(trailingDelim.isExact).toBe(false)
    expect(trailingDelim.typedSegments).toEqual([
      { value: 'take', status: 'match' },
      { value: ' /', status: 'extra' },
    ])
    expect(trailingDelim.expectedSegments).toEqual([
      { value: 'take', status: 'match' },
      { value: ' / drink', status: 'missing' },
    ])
  })

  it('rejects malformed inputs with leading, trailing, or consecutive delimiters as exact matches', () => {
    // Trailing delimiter on otherwise complete answer
    const trailing = compareAnswer('take / drink /', 'take / drink')
    expect(trailing.isExact).toBe(false)
    expect(trailing.typedSegments).toEqual([
      { value: 'take / drink', status: 'match' },
      { value: ' /', status: 'extra' },
    ])
    expect(trailing.expectedSegments).toEqual([
      { value: 'take / drink', status: 'match' },
    ])

    // Leading delimiter
    const leading = compareAnswer('/ take / drink', 'take / drink')
    expect(leading.isExact).toBe(false)
    expect(leading.typedSegments).toEqual([
      { value: '/ ', status: 'extra' },
      { value: 'take / drink', status: 'match' },
    ])
    expect(leading.expectedSegments).toEqual([
      { value: 'take / drink', status: 'match' },
    ])

    // Consecutive delimiters
    const consecutive = compareAnswer('take // drink', 'take / drink')
    expect(consecutive.isExact).toBe(false)
    expect(consecutive.typedSegments).toEqual([
      { value: 'take', status: 'match' },
      { value: ' / /', status: 'extra' },
      { value: 'drink', status: 'match' },
    ])
    expect(consecutive.expectedSegments).toEqual([
      { value: 'take / drink', status: 'match' },
    ])
  })

  it('preserves delimiters inside parentheses in typed answers without splitting', () => {
    const result = compareAnswer(
      'there is, to have (auxiliary, helper)',
      'to have (auxiliary) / there is',
    )
    expect(result.isExact).toBe(false)
    expect(result.typedSegments).toEqual([
      { value: 'there is, to have (auxiliary', status: 'match' },
      { value: ', helper', status: 'extra' },
      { value: ')', status: 'match' },
    ])
    expect(result.expectedSegments).toEqual([
      { value: 'there is / to have (auxiliary)', status: 'match' },
    ])
  })

  it('handles typed input consisting only of delimiters', () => {
    const onlyDelim = compareAnswer(' / ', 'take / drink')
    expect(onlyDelim.isExact).toBe(false)
    expect(onlyDelim.typedSegments).toEqual([{ value: '/', status: 'extra' }])
    expect(onlyDelim.expectedSegments).toEqual([
      { value: 'take / drink', status: 'missing' },
    ])
  })
})
