import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const SHA_PATTERN = /^[0-9a-f]{40}$/
const SEVERITIES = new Set(['blocking', 'advisory'])
const CATEGORIES = new Set([
  'correctness',
  'security',
  'data-loss',
  'architecture',
  'test-gap',
  'accessibility',
  'performance',
  'maintainability',
  'developer-experience',
])
const ROOT_KEYS = new Set([
  'reviewed_base_sha',
  'reviewed_head_sha',
  'verdict',
  'summary',
  'findings',
])
const FINDING_KEYS = new Set([
  'severity',
  'category',
  'title',
  'explanation',
  'evidence',
  'path',
  'start_line',
  'end_line',
])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key))
}

function isBoundedString(value, minimum, maximum) {
  return (
    typeof value === 'string' &&
    value.length >= minimum &&
    value.length <= maximum
  )
}

function isSafeRelativePath(value) {
  if (!isBoundedString(value, 1, 500) || value.includes('\\')) return false
  if (value.startsWith('/') || value.endsWith('/')) return false
  const segments = value.split('/')
  return segments.every(
    (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
  )
}

function validateFinding(finding, index, problems) {
  const label = `findings[${index}]`
  if (!isRecord(finding)) {
    problems.push(`${label} must be an object`)
    return
  }
  if (!hasOnlyKeys(finding, FINDING_KEYS)) {
    problems.push(`${label} contains unsupported fields`)
  }
  if (!SEVERITIES.has(finding.severity)) {
    problems.push(`${label}.severity is invalid`)
  }
  if (!CATEGORIES.has(finding.category)) {
    problems.push(`${label}.category is invalid`)
  }
  if (!isBoundedString(finding.title, 1, 100)) {
    problems.push(`${label}.title must contain 1-100 characters`)
  }
  if (!isBoundedString(finding.explanation, 1, 4000)) {
    problems.push(`${label}.explanation must contain 1-4000 characters`)
  }
  if (!isBoundedString(finding.evidence, 1, 2000)) {
    problems.push(`${label}.evidence must contain 1-2000 characters`)
  }
  if (!isSafeRelativePath(finding.path)) {
    problems.push(`${label}.path must be a safe repository-relative path`)
  }
  if (!Number.isInteger(finding.start_line) || finding.start_line < 1) {
    problems.push(`${label}.start_line must be a positive integer`)
  }
  if (!Number.isInteger(finding.end_line) || finding.end_line < 1) {
    problems.push(`${label}.end_line must be a positive integer`)
  }
  if (
    Number.isInteger(finding.start_line) &&
    Number.isInteger(finding.end_line) &&
    finding.end_line < finding.start_line
  ) {
    problems.push(`${label}.end_line must not precede start_line`)
  }
}

function rejectedResult(baseSha, headSha, problems) {
  return {
    status: 'fail',
    reason: 'invalid-review-output',
    reviewed_base_sha: baseSha,
    reviewed_head_sha: headSha,
    blocking_count: 0,
    advisory_count: 0,
    summary: `Reviewer output was rejected:\n\n${problems
      .map((problem) => `- ${problem}`)
      .join('\n')}`,
    findings: [],
  }
}

export function evaluateReview(review, expected) {
  const problems = []

  if (!SHA_PATTERN.test(expected.baseSha)) {
    problems.push('expected base SHA is invalid')
  }
  if (!SHA_PATTERN.test(expected.headSha)) {
    problems.push('expected head SHA is invalid')
  }
  if (!isRecord(review)) {
    problems.push('review must be an object')
    return rejectedResult(expected.baseSha, expected.headSha, problems)
  }
  if (!hasOnlyKeys(review, ROOT_KEYS)) {
    problems.push('review contains unsupported fields')
  }
  if (review.reviewed_base_sha !== expected.baseSha) {
    problems.push('reviewed base SHA does not match the requested base SHA')
  }
  if (review.reviewed_head_sha !== expected.headSha) {
    problems.push('reviewed head SHA does not match the requested head SHA')
  }
  if (review.verdict !== 'pass' && review.verdict !== 'fail') {
    problems.push('verdict must be pass or fail')
  }
  if (!isBoundedString(review.summary, 1, 4000)) {
    problems.push('summary must contain 1-4000 characters')
  }
  if (!Array.isArray(review.findings)) {
    problems.push('findings must be an array')
  } else if (review.findings.length > 50) {
    problems.push('findings must not contain more than 50 entries')
  } else {
    review.findings.forEach((finding, index) =>
      validateFinding(finding, index, problems),
    )
  }

  if (problems.length > 0) {
    return rejectedResult(expected.baseSha, expected.headSha, problems)
  }

  const blockingCount = review.findings.filter(
    (finding) => finding.severity === 'blocking',
  ).length
  const advisoryCount = review.findings.length - blockingCount
  const derivedVerdict = blockingCount > 0 ? 'fail' : 'pass'

  if (review.verdict !== derivedVerdict) {
    return rejectedResult(expected.baseSha, expected.headSha, [
      `verdict ${review.verdict} contradicts ${blockingCount} blocking finding(s)`,
    ])
  }

  return {
    status: derivedVerdict,
    reason: blockingCount > 0 ? 'blocking-findings' : 'review-passed',
    reviewed_base_sha: review.reviewed_base_sha,
    reviewed_head_sha: review.reviewed_head_sha,
    blocking_count: blockingCount,
    advisory_count: advisoryCount,
    summary: review.summary,
    findings: review.findings,
  }
}

async function runCli() {
  const [baseSha, headSha, reviewPath, resultPath] = process.argv.slice(2)
  if (!baseSha || !headSha || !reviewPath || !resultPath) {
    throw new Error(
      'usage: ai-review-policy.mjs <base-sha> <head-sha> <review.json> <result.json>',
    )
  }

  let review
  try {
    review = JSON.parse(await readFile(reviewPath, 'utf8'))
  } catch (error) {
    review = null
    const detail = error instanceof Error ? error.message : String(error)
    const result = rejectedResult(baseSha, headSha, [
      `review file could not be read as JSON: ${detail}`,
    ])
    await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`)
    return
  }

  const result = evaluateReview(review, { baseSha, headSha })
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await runCli()
}
