export type DiffStatus = 'match' | 'case' | 'extra' | 'missing' | 'accent'

export type DiffSegment = {
  value: string
  status: DiffStatus
}

export type AnswerComparison = {
  typedSegments: DiffSegment[]
  expectedSegments: DiffSegment[]
  isExact: boolean
}

export const stripDiacritics = (text: string): string =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/gu, '')

export const stripPunctuation = (text: string): string =>
  text.replace(/[^\p{L}\p{M}\p{N}]/gu, '')

export const baseNormalize = (text: string): string =>
  stripPunctuation(stripDiacritics(text.toLocaleLowerCase()))

function groupSegments(segments: DiffSegment[]): DiffSegment[] {
  const result: DiffSegment[] = []
  for (const seg of segments) {
    const last = result[result.length - 1]
    if (last && last.status === seg.status) {
      last.value += seg.value
    } else {
      result.push({ ...seg })
    }
  }
  return result
}

function matchScore(tChar: string, eChar: string): number {
  if (tChar === eChar) return 4
  if (tChar.toLowerCase() === eChar.toLowerCase()) return 4
  const normT = baseNormalize(tChar)
  const normE = baseNormalize(eChar)
  if (normT.length > 0 && normT === normE) return 3
  return 0
}

export function compareAnswer(
  typed: string,
  expected: string,
): AnswerComparison {
  const tTrim = typed.trim()
  const eTrim = expected.trim()

  if (tTrim === eTrim) {
    return {
      typedSegments: tTrim ? [{ value: tTrim, status: 'match' }] : [],
      expectedSegments: eTrim ? [{ value: eTrim, status: 'match' }] : [],
      isExact: true,
    }
  }

  const tChars = Array.from(tTrim)
  const eChars = Array.from(eTrim)

  if (tChars.length === 0) {
    return {
      typedSegments: [],
      expectedSegments: [{ value: eTrim, status: 'missing' }],
      isExact: false,
    }
  }

  if (eChars.length === 0) {
    return {
      typedSegments: [{ value: tTrim, status: 'extra' }],
      expectedSegments: [],
      isExact: false,
    }
  }

  // Needleman-Wunsch / LCS Dynamic Programming
  const dp = Array.from({ length: tChars.length + 1 }, () =>
    Array<number>(eChars.length + 1).fill(0),
  )

  for (let i = tChars.length - 1; i >= 0; i--) {
    for (let j = eChars.length - 1; j >= 0; j--) {
      const score = matchScore(tChars[i]!, eChars[j]!)
      if (score > 0) {
        dp[i]![j] = Math.max(
          dp[i + 1]![j + 1]! + score,
          dp[i + 1]![j]!,
          dp[i]![j + 1]!,
        )
      } else {
        dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
      }
    }
  }

  const typedRaw: DiffSegment[] = []
  const expectedRaw: DiffSegment[] = []

  let ti = 0
  let ej = 0

  while (ti < tChars.length && ej < eChars.length) {
    const tc = tChars[ti]!
    const ec = eChars[ej]!
    const score = matchScore(tc, ec)

    if (score > 0 && dp[ti]![ej] === dp[ti + 1]![ej + 1]! + score) {
      if (tc === ec) {
        typedRaw.push({ value: tc, status: 'match' })
        expectedRaw.push({ value: ec, status: 'match' })
      } else if (tc.toLowerCase() === ec.toLowerCase()) {
        typedRaw.push({ value: tc, status: 'case' })
        expectedRaw.push({ value: ec, status: 'case' })
      } else {
        typedRaw.push({ value: tc, status: 'match' })
        expectedRaw.push({ value: ec, status: 'accent' })
      }
      ti++
      ej++
    } else if (dp[ti + 1]![ej]! >= dp[ti]![ej + 1]!) {
      typedRaw.push({ value: tc, status: 'extra' })
      ti++
    } else {
      expectedRaw.push({ value: ec, status: 'missing' })
      ej++
    }
  }

  while (ti < tChars.length) {
    typedRaw.push({ value: tChars[ti]!, status: 'extra' })
    ti++
  }

  while (ej < eChars.length) {
    expectedRaw.push({ value: eChars[ej]!, status: 'missing' })
    ej++
  }

  const typedSegments = groupSegments(typedRaw)
  const expectedSegments = groupSegments(expectedRaw)

  return {
    typedSegments,
    expectedSegments,
    isExact: false,
  }
}
