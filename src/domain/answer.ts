export type ExpectedToken = {
  value: string
  status: 'match' | 'missing'
}

export type AnswerComparison = {
  expected: ExpectedToken[]
  extra: string[]
}

const tokenize = (text: string): string[] =>
  text.trim().split(/\s+/).filter(Boolean)

const normalize = (token: string): string =>
  token.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

const isMatch = (left: string, right: string): boolean => {
  const normalizedLeft = normalize(left)
  return normalizedLeft.length > 0 && normalizedLeft === normalize(right)
}

/**
 * Produces a stable, language-tolerant comparison for self-evaluation.
 *
 * It deliberately ignores case and punctuation, but does not decide whether a
 * learner's answer is semantically acceptable. That judgment remains theirs.
 */
export function compareAnswer(
  typed: string,
  expected: string,
): AnswerComparison {
  const typedTokens = tokenize(typed)
  const expectedTokens = tokenize(expected)
  const lengths = Array.from({ length: typedTokens.length + 1 }, () =>
    Array<number>(expectedTokens.length + 1).fill(0),
  )

  for (
    let typedIndex = typedTokens.length - 1;
    typedIndex >= 0;
    typedIndex -= 1
  ) {
    for (
      let expectedIndex = expectedTokens.length - 1;
      expectedIndex >= 0;
      expectedIndex -= 1
    ) {
      const below = lengths[typedIndex + 1]![expectedIndex]!
      const right = lengths[typedIndex]![expectedIndex + 1]!
      const diagonal = lengths[typedIndex + 1]![expectedIndex + 1]!
      lengths[typedIndex]![expectedIndex] = isMatch(
        typedTokens[typedIndex]!,
        expectedTokens[expectedIndex]!,
      )
        ? diagonal + 1
        : Math.max(below, right)
    }
  }

  const result: AnswerComparison = { expected: [], extra: [] }
  let typedIndex = 0
  let expectedIndex = 0

  while (
    typedIndex < typedTokens.length &&
    expectedIndex < expectedTokens.length
  ) {
    const typedToken = typedTokens[typedIndex]!
    const expectedToken = expectedTokens[expectedIndex]!
    if (isMatch(typedToken, expectedToken)) {
      result.expected.push({ value: expectedToken, status: 'match' })
      typedIndex += 1
      expectedIndex += 1
      continue
    }

    const below = lengths[typedIndex + 1]![expectedIndex]!
    const right = lengths[typedIndex]![expectedIndex + 1]!
    if (below >= right) {
      result.extra.push(typedToken)
      typedIndex += 1
    } else {
      result.expected.push({ value: expectedToken, status: 'missing' })
      expectedIndex += 1
    }
  }

  for (; expectedIndex < expectedTokens.length; expectedIndex += 1) {
    result.expected.push({
      value: expectedTokens[expectedIndex]!,
      status: 'missing',
    })
  }
  for (; typedIndex < typedTokens.length; typedIndex += 1) {
    result.extra.push(typedTokens[typedIndex]!)
  }

  return result
}
