import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluateReview } from './ai-review-policy.mjs'

const baseSha = 'a'.repeat(40)
const headSha = 'b'.repeat(40)
const expected = { baseSha, headSha }

function validReview(overrides = {}) {
  return {
    reviewed_base_sha: baseSha,
    reviewed_head_sha: headSha,
    verdict: 'pass',
    summary: 'No blocking regressions found.',
    findings: [],
    ...overrides,
  }
}

function finding(overrides = {}) {
  return {
    severity: 'blocking',
    category: 'correctness',
    title: 'Incorrect result at the boundary',
    explanation: 'The new branch returns the wrong state for an empty input.',
    evidence: 'The empty case reaches this return without normalization.',
    path: 'src/application/example.ts',
    start_line: 12,
    end_line: 14,
    ...overrides,
  }
}

test('passes a valid clean review', () => {
  const result = evaluateReview(validReview(), expected)

  assert.equal(result.status, 'pass')
  assert.equal(result.blocking_count, 0)
  assert.equal(result.advisory_count, 0)
})

test('fails when a blocking finding exists', () => {
  const result = evaluateReview(
    validReview({ verdict: 'fail', findings: [finding()] }),
    expected,
  )

  assert.equal(result.status, 'fail')
  assert.equal(result.reason, 'blocking-findings')
  assert.equal(result.blocking_count, 1)
})

test('allows advisory findings without blocking the change', () => {
  const result = evaluateReview(
    validReview({
      findings: [finding({ severity: 'advisory' })],
    }),
    expected,
  )

  assert.equal(result.status, 'pass')
  assert.equal(result.advisory_count, 1)
})

test('fails closed when the reviewer reports a stale head SHA', () => {
  const result = evaluateReview(
    validReview({ reviewed_head_sha: 'c'.repeat(40) }),
    expected,
  )

  assert.equal(result.status, 'fail')
  assert.equal(result.reason, 'invalid-review-output')
  assert.match(result.summary, /head SHA does not match/)
})

test('rejects a verdict that contradicts the findings', () => {
  const result = evaluateReview(
    validReview({ verdict: 'pass', findings: [finding()] }),
    expected,
  )

  assert.equal(result.status, 'fail')
  assert.match(result.summary, /contradicts 1 blocking finding/)
})

test('rejects unsafe finding paths and inverted line ranges', () => {
  const result = evaluateReview(
    validReview({
      verdict: 'fail',
      findings: [finding({ path: '../secret', start_line: 14, end_line: 12 })],
    }),
    expected,
  )

  assert.equal(result.status, 'fail')
  assert.match(result.summary, /safe repository-relative path/)
  assert.match(result.summary, /must not precede/)
})

test('rejects malformed root values instead of throwing', () => {
  const result = evaluateReview(null, expected)

  assert.equal(result.status, 'fail')
  assert.match(result.summary, /review must be an object/)
})
