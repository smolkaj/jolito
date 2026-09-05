export type DiffStatus = 'match' | 'extra' | 'missing' | 'accent'

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

/** Replace common OS-level typographic substitutions with ASCII equivalents and normalize delimiter spacing. */
export const normalizeTypography = (text: string): string =>
  text
    .replace(/\u2026/g, '...')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\//g, ' / ')
    .replace(/\s+/g, ' ')
    .trim()

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

const MATCH_SCORE_EXACT = 4
const MATCH_SCORE_ACCENT = 3
const CONTINUOUS_MATCH_BONUS = 4
const GAP_OPEN_PENALTY = 5
const GAP_OPEN_SPACE_PENALTY = 2
const GAP_EXTEND_PENALTY = 0
const NEG_INF = -1e9

const isWhitespace = (ch: string): boolean => /\s/.test(ch)

function matchScore(tChar: string, eChar: string): number {
  if (tChar.toLowerCase() === eChar.toLowerCase()) return MATCH_SCORE_EXACT
  const normT = baseNormalize(tChar)
  const normE = baseNormalize(eChar)
  if (normT.length > 0 && normT === normE) return MATCH_SCORE_ACCENT
  return 0
}

const STATE_MATCH = 0
const STATE_EXTRA = 1
const STATE_MISSING = 2

export function compareAnswer(
  typed: string,
  expected: string,
): AnswerComparison {
  const tTrim = normalizeTypography(typed.trim())
  const eTrim = normalizeTypography(expected.trim())

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

  const N = tChars.length
  const M = eChars.length

  // Suffix Affine Dynamic Programming (Gotoh's algorithm with contiguous match bonus):
  // M_score[i][j]: best alignment score from (i, j) to (N, M) starting with matching tChars[i] and eChars[j]
  // X_score[i][j]: best alignment score starting with an extra char tChars[i]
  // Y_score[i][j]: best alignment score starting with a missing char eChars[j]
  const M_score = Array.from({ length: N + 1 }, () =>
    Array<number>(M + 1).fill(NEG_INF),
  )
  const X_score = Array.from({ length: N + 1 }, () =>
    Array<number>(M + 1).fill(NEG_INF),
  )
  const Y_score = Array.from({ length: N + 1 }, () =>
    Array<number>(M + 1).fill(NEG_INF),
  )

  M_score[N]![M] = 0
  X_score[N]![M] = 0
  Y_score[N]![M] = 0

  for (let i = N - 1; i >= 0; i--) {
    const penalty = isWhitespace(tChars[i]!)
      ? GAP_OPEN_SPACE_PENALTY
      : GAP_OPEN_PENALTY
    X_score[i]![M] = -penalty - (N - 1 - i) * GAP_EXTEND_PENALTY
  }

  for (let j = M - 1; j >= 0; j--) {
    const penalty = isWhitespace(eChars[j]!)
      ? GAP_OPEN_SPACE_PENALTY
      : GAP_OPEN_PENALTY
    Y_score[N]![j] = -penalty - (M - 1 - j) * GAP_EXTEND_PENALTY
  }

  for (let i = N - 1; i >= 0; i--) {
    const tc = tChars[i]!
    for (let j = M - 1; j >= 0; j--) {
      const ec = eChars[j]!
      const score = matchScore(tc, ec)

      if (score > 0) {
        const toM = M_score[i + 1]![j + 1]! + score + CONTINUOUS_MATCH_BONUS
        const toX = X_score[i + 1]![j + 1]! + score
        const toY = Y_score[i + 1]![j + 1]! + score
        M_score[i]![j] = Math.max(toM, toX, toY)
      }

      // X: extra character in typed (gap in expected)
      const xPenalty = isWhitespace(tc)
        ? GAP_OPEN_SPACE_PENALTY
        : GAP_OPEN_PENALTY
      const xToM = M_score[i + 1]![j]! - xPenalty
      const xToX = X_score[i + 1]![j]! - GAP_EXTEND_PENALTY
      const xToY = Y_score[i + 1]![j]! - GAP_EXTEND_PENALTY
      X_score[i]![j] = Math.max(xToM, xToX, xToY)

      // Y: missing character in typed (gap in typed)
      const yPenalty = isWhitespace(ec)
        ? GAP_OPEN_SPACE_PENALTY
        : GAP_OPEN_PENALTY
      const yToM = M_score[i]![j + 1]! - yPenalty
      const yToY = Y_score[i]![j + 1]! - GAP_EXTEND_PENALTY
      const yToX = X_score[i]![j + 1]! - GAP_EXTEND_PENALTY
      Y_score[i]![j] = Math.max(yToM, yToY, yToX)
    }
  }

  let i = 0
  let j = 0
  const maxStart = Math.max(M_score[0]![0]!, X_score[0]![0]!, Y_score[0]![0]!)

  let state =
    maxStart === M_score[0]![0]!
      ? STATE_MATCH
      : maxStart === X_score[0]![0]!
        ? STATE_EXTRA
        : STATE_MISSING

  const typedRaw: DiffSegment[] = []
  const expectedRaw: DiffSegment[] = []

  while (i < N || j < M) {
    if (state === STATE_MATCH && i < N && j < M) {
      const tc = tChars[i]!
      const ec = eChars[j]!
      const score = matchScore(tc, ec)

      if (tc.toLowerCase() === ec.toLowerCase()) {
        typedRaw.push({ value: tc, status: 'match' })
        expectedRaw.push({ value: ec, status: 'match' })
      } else {
        typedRaw.push({ value: tc, status: 'match' })
        expectedRaw.push({ value: ec, status: 'accent' })
      }

      const toM = M_score[i + 1]![j + 1]! + score + CONTINUOUS_MATCH_BONUS
      const toX = X_score[i + 1]![j + 1]! + score

      if (M_score[i]![j] === toM) {
        state = STATE_MATCH
      } else if (M_score[i]![j] === toX) {
        state = STATE_EXTRA
      } else {
        state = STATE_MISSING
      }
      i++
      j++
    } else if ((state === STATE_EXTRA || j >= M) && i < N) {
      const tc = tChars[i]!
      typedRaw.push({ value: tc, status: 'extra' })

      const xPenalty = isWhitespace(tc)
        ? GAP_OPEN_SPACE_PENALTY
        : GAP_OPEN_PENALTY
      const toX = X_score[i + 1]![j]! - GAP_EXTEND_PENALTY
      const toM = M_score[i + 1]![j]! - xPenalty

      if (X_score[i]![j] === toX) {
        state = STATE_EXTRA
      } else if (X_score[i]![j] === toM) {
        state = STATE_MATCH
      } else {
        state = STATE_MISSING
      }
      i++
    } else {
      const ec = eChars[j]!
      expectedRaw.push({ value: ec, status: 'missing' })

      const yPenalty = isWhitespace(ec)
        ? GAP_OPEN_SPACE_PENALTY
        : GAP_OPEN_PENALTY
      const toY = Y_score[i]![j + 1]! - GAP_EXTEND_PENALTY
      const toM = M_score[i]![j + 1]! - yPenalty

      if (Y_score[i]![j] === toY) {
        state = STATE_MISSING
      } else if (Y_score[i]![j] === toM) {
        state = STATE_MATCH
      } else {
        state = STATE_EXTRA
      }
      j++
    }
  }

  const typedSegments = groupSegments(typedRaw)
  const expectedSegments = groupSegments(expectedRaw)

  return {
    typedSegments,
    expectedSegments,
    isExact: false,
  }
}
