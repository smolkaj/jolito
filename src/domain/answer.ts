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

export const stripInvertedPunctuation = (text: string): string =>
  text.replace(/[¿¡]/gu, '')

/** Replace common OS-level typographic substitutions with ASCII equivalents and normalize delimiter spacing. */
export const normalizeTypography = (text: string): string =>
  text
    .replace(/\u2026/g, '...')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\//g, ' / ')
    .replace(/;/g, ' ; ')
    .replace(/\s+/g, ' ')
    .trim()

export const baseNormalize = (text: string): string =>
  stripPunctuation(stripDiacritics(text.toLocaleLowerCase()))

function groupSegments(segments: DiffSegment[]): DiffSegment[] {
  const result: DiffSegment[] = []
  for (const seg of segments) {
    if (seg.value.length === 0) continue
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

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, idx) => idx)
  let curr = new Array<number>(b.length + 1)

  for (let i = 0; i < a.length; i++) {
    curr[0] = i + 1
    const aChar = a[i]
    for (let j = 0; j < b.length; j++) {
      const cost = aChar === b[j] ? 0 : 1
      curr[j + 1] = Math.min(curr[j]! + 1, prev[j + 1]! + 1, prev[j]! + cost)
    }
    const temp = prev
    prev = curr
    curr = temp
  }

  return prev[b.length]!
}

function itemSimilarity(t: string, e: string): number {
  const tTrim = normalizeTypography(t.trim())
  const eTrim = normalizeTypography(e.trim())

  if (tTrim === eTrim) return 1.0

  const tLower = tTrim.toLowerCase()
  const eLower = eTrim.toLowerCase()
  if (tLower === eLower) return 0.99

  const tNormInverted = stripInvertedPunctuation(tLower)
  const eNormInverted = stripInvertedPunctuation(eLower)
  if (tNormInverted.length > 0 && tNormInverted === eNormInverted) return 0.98

  const tBase = baseNormalize(tTrim)
  const eBase = baseNormalize(eTrim)
  if (tBase.length > 0 && tBase === eBase) return 0.95

  const maxLen = Math.max(tLower.length, eLower.length)
  const dist = levenshtein(tLower, eLower)
  return 1 - dist / maxLen
}

export type ParsedEnumeration = {
  items: string[]
  delimiters: string[]
  primaryDelim: string
  primaryDelimChar: '/' | ';'
}

/**
 * Splits text into enumeration items if it contains alternative delimiters ('/' or ';') outside parentheses or brackets.
 * Grammatical commas are preserved so standard sentences ("To go, please", "No, gracias") are not scrambled.
 */
export function splitEnumeration(text: string): ParsedEnumeration | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  let parenDepth = 0
  let slashCount = 0
  let semiCount = 0

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (ch === '(' || ch === '[') {
      parenDepth++
      continue
    }
    if (ch === ')' || ch === ']') {
      parenDepth = Math.max(0, parenDepth - 1)
      continue
    }

    if (parenDepth === 0) {
      if (ch === '/') {
        slashCount++
      } else if (ch === ';') {
        semiCount++
      }
    }
  }

  const primaryDelimChar: '/' | ';' | null =
    slashCount > 0 ? '/' : semiCount > 0 ? ';' : null

  if (!primaryDelimChar) {
    return null
  }

  const primaryDelim = primaryDelimChar === '/' ? ' / ' : '; '
  const rawItems: string[] = []
  let itemStart = 0
  parenDepth = 0

  let i = 0
  while (i < trimmed.length) {
    const ch = trimmed[i]
    if (ch === '(' || ch === '[') {
      parenDepth++
      i++
      continue
    }
    if (ch === ')' || ch === ']') {
      parenDepth = Math.max(0, parenDepth - 1)
      i++
      continue
    }

    if (parenDepth === 0 && ch === primaryDelimChar) {
      rawItems.push(trimmed.slice(itemStart, i).trim())
      let nextI = i + 1
      while (nextI < trimmed.length && /\s/.test(trimmed[nextI]!)) {
        nextI++
      }
      itemStart = nextI
      i = nextI
      continue
    }
    i++
  }

  rawItems.push(trimmed.slice(itemStart).trim())

  const validItems = rawItems.filter((item) => item.length > 0)
  if (validItems.length < 2) {
    return null
  }

  const delimiters = Array.from(
    { length: validItems.length - 1 },
    () => primaryDelim,
  )

  return {
    items: validItems,
    delimiters,
    primaryDelim,
    primaryDelimChar,
  }
}

function parseTypedItems(text: string): {
  items: string[]
  delimiters: string[]
} {
  const trimmed = text.trim()
  if (!trimmed) return { items: [], delimiters: [] }

  let slashCount = 0
  let semiCount = 0
  let commaCount = 0

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (ch === '/') slashCount++
    else if (ch === ';') semiCount++
    else if (ch === ',') commaCount++
  }

  const delimChar: '/' | ';' | ',' | null =
    slashCount > 0 ? '/' : semiCount > 0 ? ';' : commaCount > 0 ? ',' : null

  if (!delimChar) {
    return { items: [trimmed], delimiters: [] }
  }

  const delimStr = delimChar === '/' ? ' / ' : delimChar === ';' ? '; ' : ', '
  const rawItems: string[] = []
  let itemStart = 0

  let i = 0
  while (i < trimmed.length) {
    if (trimmed[i] === delimChar) {
      rawItems.push(trimmed.slice(itemStart, i).trim())
      let nextI = i + 1
      while (nextI < trimmed.length && /\s/.test(trimmed[nextI]!)) {
        nextI++
      }
      itemStart = nextI
      i = nextI
      continue
    }
    i++
  }

  rawItems.push(trimmed.slice(itemStart).trim())
  const validItems = rawItems.filter((it) => it.length > 0)
  if (validItems.length < 2) {
    return { items: [trimmed], delimiters: [] }
  }

  const delimiters = Array.from(
    { length: validItems.length - 1 },
    () => delimStr,
  )

  return { items: validItems, delimiters }
}

function missingItemSegments(item: string): DiffSegment[] {
  const raw: DiffSegment[] = Array.from(item).map((ch) => ({
    value: ch,
    status: ch === '¿' || ch === '¡' ? 'accent' : 'missing',
  }))
  return groupSegments(raw)
}

function compareSequential(tTrim: string, eTrim: string): AnswerComparison {
  if (tTrim === eTrim) {
    return {
      typedSegments: tTrim ? [{ value: tTrim, status: 'match' }] : [],
      expectedSegments: eTrim ? [{ value: eTrim, status: 'match' }] : [],
      isExact: true,
    }
  }

  const tNormInverted = stripInvertedPunctuation(tTrim)
  const eNormInverted = stripInvertedPunctuation(eTrim)
  if (tNormInverted.length > 0 && tNormInverted === eNormInverted) {
    return {
      typedSegments: [{ value: tTrim, status: 'match' }],
      expectedSegments: [{ value: eTrim, status: 'match' }],
      isExact: true,
    }
  }

  const tChars = Array.from(tTrim)
  const eChars = Array.from(eTrim)

  if (tChars.length === 0) {
    const rawExpected: DiffSegment[] = eChars.map((ec) => ({
      value: ec,
      status: ec === '¿' || ec === '¡' ? 'accent' : 'missing',
    }))
    return {
      typedSegments: [],
      expectedSegments: groupSegments(rawExpected),
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

      const xPenalty = isWhitespace(tc)
        ? GAP_OPEN_SPACE_PENALTY
        : GAP_OPEN_PENALTY
      const xToM = M_score[i + 1]![j]! - xPenalty
      const xToX = X_score[i + 1]![j]! - GAP_EXTEND_PENALTY
      const xToY = Y_score[i + 1]![j]! - GAP_EXTEND_PENALTY
      X_score[i]![j] = Math.max(xToM, xToX, xToY)

      const yPenalty = isWhitespace(ec)
        ? GAP_OPEN_SPACE_PENALTY
        : GAP_OPEN_PENALTY
      const yToM = M_score[i]![j + 1]! - yPenalty
      const yToY = Y_score[i]![j + 1]! - GAP_EXTEND_PENALTY
      const yToX = X_score[i + 1]![j + 1]! - GAP_EXTEND_PENALTY
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
      const status: DiffStatus = ec === '¿' || ec === '¡' ? 'accent' : 'missing'
      expectedRaw.push({ value: ec, status })

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

  return {
    typedSegments: groupSegments(typedRaw),
    expectedSegments: groupSegments(expectedRaw),
    isExact: false,
  }
}

const MATCH_THRESHOLD = 0.45

export function compareAnswer(
  typed: string,
  expected: string,
): AnswerComparison {
  const tTrim = normalizeTypography(typed.trim())
  const eTrim = normalizeTypography(expected.trim())

  const tNormInverted = stripInvertedPunctuation(tTrim)
  const eNormInverted = stripInvertedPunctuation(eTrim)

  if (
    tTrim === eTrim ||
    (tNormInverted.length > 0 && tNormInverted === eNormInverted)
  ) {
    return {
      typedSegments: tTrim ? [{ value: tTrim, status: 'match' }] : [],
      expectedSegments: eTrim ? [{ value: eTrim, status: 'match' }] : [],
      isExact: true,
    }
  }

  if (!tTrim) {
    return compareSequential(tTrim, eTrim)
  }

  const expectedEnum = splitEnumeration(eTrim)
  if (!expectedEnum) {
    return compareSequential(tTrim, eTrim)
  }

  const typedParsed = parseTypedItems(tTrim)
  const T = typedParsed.items
  const E = expectedEnum.items
  const k = T.length
  const m = E.length

  type MatchCandidate = {
    i: number
    j: number
    sim: number
  }

  const candidates: MatchCandidate[] = []
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < m; j++) {
      const sim = itemSimilarity(T[i]!, E[j]!)
      if (sim >= MATCH_THRESHOLD) {
        candidates.push({ i, j, sim })
      }
    }
  }

  candidates.sort((a, b) => b.sim - a.sim)

  const matchedT = new Map<number, number>()
  const matchedE = new Map<number, number>()

  for (const cand of candidates) {
    if (matchedT.has(cand.i) || matchedE.has(cand.j)) continue
    matchedT.set(cand.i, cand.j)
    matchedE.set(cand.j, cand.i)
  }

  if (matchedT.size === 0) {
    return compareSequential(tTrim, eTrim)
  }

  const missingE: number[] = []
  for (let j = 0; j < m; j++) {
    if (!matchedE.has(j)) {
      missingE.push(j)
    }
  }

  let isAllExact = matchedT.size === k && missingE.length === 0
  const itemDiffs = new Map<number, AnswerComparison>()

  for (let i = 0; i < k; i++) {
    const j = matchedT.get(i)
    if (j !== undefined) {
      const diff = compareSequential(T[i]!, E[j]!)
      itemDiffs.set(i, diff)
      if (!diff.isExact) {
        isAllExact = false
      }
    } else {
      isAllExact = false
    }
  }

  if (isAllExact) {
    return {
      typedSegments: [{ value: tTrim, status: 'match' }],
      expectedSegments: [{ value: eTrim, status: 'match' }],
      isExact: true,
    }
  }

  const primaryDelim = expectedEnum.primaryDelim
  const typedRaw: DiffSegment[] = []

  for (let i = 0; i < k; i++) {
    if (i > 0) {
      const delim = typedParsed.delimiters[i - 1]!
      const isMatchedDelim = matchedT.has(i - 1) && matchedT.has(i)
      typedRaw.push({
        value: delim,
        status: isMatchedDelim ? 'match' : 'extra',
      })
    }

    const j = matchedT.get(i)
    if (j !== undefined) {
      const diff = itemDiffs.get(i)!
      typedRaw.push(...diff.typedSegments)
    } else {
      typedRaw.push({ value: T[i]!, status: 'extra' })
    }
  }

  const expectedRaw: DiffSegment[] = []
  let matchedCount = 0

  // Part 1: Matched items in the order they were typed
  for (let i = 0; i < k; i++) {
    const j = matchedT.get(i)
    if (j === undefined) continue

    if (matchedCount > 0) {
      expectedRaw.push({
        value: primaryDelim,
        status: 'match',
      })
    }

    const diff = itemDiffs.get(i)!
    expectedRaw.push(...diff.expectedSegments)
    matchedCount++
  }

  // Part 2: Missing words shown at the end
  for (const j of missingE) {
    expectedRaw.push({
      value: primaryDelim,
      status: 'missing',
    })

    expectedRaw.push(...missingItemSegments(E[j]!))
  }

  return {
    typedSegments: groupSegments(typedRaw),
    expectedSegments: groupSegments(expectedRaw),
    isExact: false,
  }
}
