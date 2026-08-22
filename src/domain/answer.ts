export type SegmentStatus =
  'match' | 'missing' | 'extra' | 'accent' | 'punctuation'

export type TokenSegment = {
  value: string
  status: SegmentStatus
}

export type TokenStatus =
  'match' | 'accent' | 'punctuation' | 'typo' | 'missing' | 'extra'

export type TypedToken = {
  value: string
  status: 'match' | 'accent' | 'punctuation' | 'typo' | 'extra'
  segments?: TokenSegment[]
}

export type ExpectedToken = {
  value: string
  status: 'match' | 'accent' | 'punctuation' | 'typo' | 'missing'
  segments?: TokenSegment[]
}

export type MatchQuality = 'exact' | 'accents-only' | 'close' | 'different'

export type AnswerComparison = {
  typed: TypedToken[]
  expected: ExpectedToken[]
  quality: MatchQuality
  qualityLabel: string
  extra: string[]
}

export const stripDiacritics = (text: string): string =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/gu, '')

export const stripPunctuation = (text: string): string =>
  text.replace(/[^\p{L}\p{M}\p{N}]/gu, '')

export const baseNormalize = (text: string): string =>
  stripPunctuation(stripDiacritics(text.toLocaleLowerCase()))

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = i
    for (let j = 1; j <= b.length; j++) {
      const val =
        a[i - 1] === b[j - 1]
          ? row[j - 1]!
          : Math.min(row[j - 1]!, row[j]!, prev) + 1
      row[j - 1] = prev
      prev = val
    }
    row[b.length] = prev
  }
  return row[b.length]!
}

function groupSegments(segments: TokenSegment[]): TokenSegment[] {
  const result: TokenSegment[] = []
  for (const seg of segments) {
    if (!seg.value) continue
    const last = result[result.length - 1]
    if (last && last.status === seg.status) {
      last.value += seg.value
    } else {
      result.push({ ...seg })
    }
  }
  return result
}

export function diffWordSegments(
  typedWord: string,
  expectedWord: string,
): {
  typedSegments: TokenSegment[]
  expectedSegments: TokenSegment[]
} {
  if (typedWord === expectedWord) {
    return {
      typedSegments: [{ value: typedWord, status: 'match' }],
      expectedSegments: [{ value: expectedWord, status: 'match' }],
    }
  }

  const tChars = Array.from(typedWord)
  const eChars = Array.from(expectedWord)
  const dp = Array.from({ length: tChars.length + 1 }, () =>
    Array<number>(eChars.length + 1).fill(0),
  )

  for (let i = tChars.length - 1; i >= 0; i--) {
    for (let j = eChars.length - 1; j >= 0; j--) {
      const tc = tChars[i]!
      const ec = eChars[j]!
      const isBaseMatch =
        tc === ec ||
        (baseNormalize(tc).length > 0 &&
          baseNormalize(tc) === baseNormalize(ec))
      if (isBaseMatch) {
        dp[i]![j] = dp[i + 1]![j + 1]! + 2
      } else {
        dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
      }
    }
  }

  const typedSegments: TokenSegment[] = []
  const expectedSegments: TokenSegment[] = []

  let ti = 0
  let ej = 0

  while (ti < tChars.length && ej < eChars.length) {
    const tc = tChars[ti]!
    const ec = eChars[ej]!
    const isBaseMatch =
      tc === ec ||
      (baseNormalize(tc).length > 0 && baseNormalize(tc) === baseNormalize(ec))

    if (isBaseMatch) {
      if (tc === ec || tc.toLowerCase() === ec.toLowerCase()) {
        typedSegments.push({ value: tc, status: 'match' })
        expectedSegments.push({ value: ec, status: 'match' })
      } else {
        typedSegments.push({ value: tc, status: 'accent' })
        expectedSegments.push({ value: ec, status: 'accent' })
      }
      ti++
      ej++
    } else if (dp[ti + 1]![ej]! >= dp[ti]![ej + 1]!) {
      typedSegments.push({ value: tc, status: 'extra' })
      ti++
    } else {
      expectedSegments.push({ value: ec, status: 'missing' })
      ej++
    }
  }

  while (ti < tChars.length) {
    typedSegments.push({ value: tChars[ti]!, status: 'extra' })
    ti++
  }
  while (ej < eChars.length) {
    expectedSegments.push({ value: eChars[ej]!, status: 'missing' })
    ej++
  }

  return {
    typedSegments: groupSegments(typedSegments),
    expectedSegments: groupSegments(expectedSegments),
  }
}

const tokenize = (text: string): string[] =>
  text.trim().split(/\s+/).filter(Boolean)

function scoreWordMatch(typed: string, expected: string): number {
  if (typed === expected) return 10
  const normT = baseNormalize(typed)
  const normE = baseNormalize(expected)
  if (normT.length > 0 && normT === normE) return 8
  if (normT.length >= 3 && normE.length >= 3) {
    const dist = levenshtein(normT, normE)
    if (dist <= 1) return 5
    if (dist <= 2) return 3
  }
  return 0
}

export function classifyTokenStatus(
  tWord: string,
  eWord: string,
): 'match' | 'accent' | 'typo' {
  if (tWord === eWord) return 'match'
  const normT = baseNormalize(tWord)
  const normE = baseNormalize(eWord)
  if (normT.length > 0 && normT === normE) {
    const diacriticT = stripPunctuation(tWord.toLowerCase().normalize('NFD'))
    const diacriticE = stripPunctuation(eWord.toLowerCase().normalize('NFD'))
    if (diacriticT === diacriticE) {
      return 'match'
    }
    return 'accent'
  }
  return 'typo'
}

export function compareAnswer(
  typed: string,
  expected: string,
): AnswerComparison {
  const typedTokens = tokenize(typed)
  const expectedTokens = tokenize(expected)

  if (typedTokens.length === 0 && expectedTokens.length === 0) {
    return {
      typed: [],
      expected: [],
      quality: 'exact',
      qualityLabel: 'Exact match',
      extra: [],
    }
  }

  // Dynamic Programming Word Alignment
  const dp = Array.from({ length: typedTokens.length + 1 }, () =>
    Array<number>(expectedTokens.length + 1).fill(0),
  )

  for (let i = typedTokens.length - 1; i >= 0; i--) {
    for (let j = expectedTokens.length - 1; j >= 0; j--) {
      const score = scoreWordMatch(typedTokens[i]!, expectedTokens[j]!)
      const diagonal = dp[i + 1]![j + 1]! + score
      const below = dp[i + 1]![j]!
      const right = dp[i]![j + 1]!
      dp[i]![j] = Math.max(diagonal, below, right)
    }
  }

  const typedResult: TypedToken[] = []
  const expectedResult: ExpectedToken[] = []
  const extraWords: string[] = []

  let ti = 0
  let ej = 0

  while (ti < typedTokens.length && ej < expectedTokens.length) {
    const tWord = typedTokens[ti]!
    const eWord = expectedTokens[ej]!
    const score = scoreWordMatch(tWord, eWord)

    if (score > 0 && dp[ti]![ej]! === dp[ti + 1]![ej + 1]! + score) {
      const { typedSegments, expectedSegments } = diffWordSegments(tWord, eWord)
      const status = classifyTokenStatus(tWord, eWord)

      typedResult.push({ value: tWord, status, segments: typedSegments })
      expectedResult.push({ value: eWord, status, segments: expectedSegments })
      ti++
      ej++
    } else if (dp[ti + 1]![ej]! >= dp[ti]![ej + 1]!) {
      typedResult.push({ value: tWord, status: 'extra' })
      extraWords.push(tWord)
      ti++
    } else {
      expectedResult.push({ value: eWord, status: 'missing' })
      ej++
    }
  }

  while (ti < typedTokens.length) {
    typedResult.push({ value: typedTokens[ti]!, status: 'extra' })
    extraWords.push(typedTokens[ti]!)
    ti++
  }

  while (ej < expectedTokens.length) {
    expectedResult.push({ value: expectedTokens[ej]!, status: 'missing' })
    ej++
  }

  // Assess Match Quality
  const hasMissing = expectedResult.some((t) => t.status === 'missing')
  const hasExtra = typedResult.some((t) => t.status === 'extra')
  const hasTypo = expectedResult.some((t) => t.status === 'typo')
  const hasAccentDiff = expectedResult.some((t) => t.status === 'accent')
  const allExact =
    !hasMissing &&
    !hasExtra &&
    !hasTypo &&
    !hasAccentDiff &&
    expectedResult.every((t) => t.status === 'match')

  let quality: MatchQuality = 'different'
  let qualityLabel = 'You decide'

  if (allExact) {
    quality = 'exact'
    qualityLabel = 'Exact match'
  } else if (!hasMissing && !hasExtra && !hasTypo && hasAccentDiff) {
    quality = 'accents-only'
    qualityLabel = 'Close (check accents)'
  } else if (!hasMissing && !hasExtra && hasTypo) {
    quality = 'close'
    qualityLabel = 'Close'
  }

  return {
    typed: typedResult,
    expected: expectedResult,
    quality,
    qualityLabel,
    extra: extraWords,
  }
}
