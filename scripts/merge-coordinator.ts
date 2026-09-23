import { execFileSync } from 'node:child_process'
import {
  evaluateMainHealth,
  type WorkflowRun,
  type OpenPullRequest,
} from './check-main-health.ts'

export interface QueuedPR {
  number: number
  title: string
  state?: string
  createdAt: string
  headRefName?: string
  mergeable?: string
  mergeStateStatus?: string
  labels?: Array<{ name: string }>
}

export interface PRCheckItem {
  name: string
  state: string
  bucket: string
  workflow?: string
}

export interface CoordinatorOptions {
  prNumber?: number | undefined
  dryRun?: boolean | undefined
  repoArgs?: string[] | undefined
  maxWaitMinutes?: number | undefined
  checkIntervalSeconds?: number | undefined
}

export type ProcessPRResult =
  | { outcome: 'merged' }
  | { outcome: 'disqualified'; reason: string }
  | { outcome: 'mainline_halt'; reason: string }

export const REQUIRED_RULESET_CHECKS = [
  'Quality gates',
  'Browser smoke tests',
  'Dependency review',
  'CodeQL analysis',
  'Xcode iOS compilation gate',
]

export function sortPRQueue(prs: QueuedPR[]): QueuedPR[] {
  return [...prs].sort((a, b) => {
    // 1. Hotfixes starting with 'fix-main:' always take highest priority
    const aHotfix = a.title.trim().startsWith('fix-main:')
    const bHotfix = b.title.trim().startsWith('fix-main:')
    if (aHotfix && !bHotfix) return -1
    if (!aHotfix && bHotfix) return 1

    // 2. Strict FIFO order by creation timestamp
    if (a.createdAt !== b.createdAt) {
      return a.createdAt.localeCompare(b.createdAt)
    }
    return a.number - b.number
  })
}

export function getRepoName(repoArgs: string[] = []): string {
  const repoIdx = repoArgs.findIndex((a) => a === '--repo' || a === '-R')
  if (repoIdx !== -1 && repoArgs[repoIdx + 1]) {
    return repoArgs[repoIdx + 1]!
  }
  return process.env.GH_REPO || 'smolkaj/jolito'
}

export function runGh(
  args: string[],
  repoArgs: string[] = [],
  options: { timeout?: number } = {},
): string {
  const fullArgs = [...args]
  // gh api does not accept --repo / -R flags; repository is already encoded in the endpoint URI
  if (
    repoArgs.length > 0 &&
    args[0] !== 'api' &&
    !args.includes('--repo') &&
    !args.includes('-R')
  ) {
    fullArgs.push(...repoArgs)
  }
  return execFileSync('gh', fullArgs, {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
    timeout: options.timeout,
    env: { ...process.env },
  }).trim()
}

export function fetchAllOpenPRs(repoArgs: string[] = []): OpenPullRequest[] {
  try {
    const output = runGh(
      [
        'pr',
        'list',
        '--state',
        'open',
        '--limit',
        '100',
        '--json',
        'number,title,createdAt',
      ],
      repoArgs,
    )
    return JSON.parse(output || '[]') as OpenPullRequest[]
  } catch (error) {
    console.error('Failed to fetch open PRs:', error)
    return []
  }
}

export function fetchQueuedPRs(repoArgs: string[] = []): QueuedPR[] {
  try {
    const output = runGh(
      [
        'pr',
        'list',
        '--label',
        'ready-to-merge',
        '--state',
        'open',
        '--limit',
        '100',
        '--json',
        'number,title,state,createdAt,headRefName,mergeable,mergeStateStatus',
      ],
      repoArgs,
    )
    const parsed = JSON.parse(output || '[]') as QueuedPR[]
    return sortPRQueue(parsed)
  } catch (error) {
    console.error('Failed to fetch queued PRs:', error)
    return []
  }
}

export function fetchPRDetails(
  prNumber: number,
  repoArgs: string[] = [],
  pollForMergeable = false,
): QueuedPR | null {
  const maxAttempts = pollForMergeable ? 5 : 1
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const output = runGh(
        [
          'pr',
          'view',
          String(prNumber),
          '--json',
          'number,title,state,createdAt,headRefName,mergeable,mergeStateStatus,labels',
        ],
        repoArgs,
      )
      const pr = JSON.parse(output) as QueuedPR
      if (
        !pollForMergeable ||
        pr.mergeable !== 'UNKNOWN' ||
        attempt === maxAttempts
      ) {
        return pr
      }
      execFileSync('sleep', ['2'])
    } catch (error) {
      console.error(
        `Failed to fetch PR #${prNumber} details (attempt ${attempt}):`,
        error,
      )
      if (attempt === maxAttempts) return null
      execFileSync('sleep', ['2'])
    }
  }
  return null
}

export function fetchMainHeadSha(repoArgs: string[] = []): string | null {
  try {
    const repo = getRepoName(repoArgs)
    const output = runGh(
      ['api', `repos/${repo}/commits/main`, '--jq', '.sha'],
      repoArgs,
    )
    return output.trim() || null
  } catch (error) {
    console.error('Failed to fetch main HEAD SHA:', error)
    return null
  }
}

export function evaluateMainlineSettlement(
  runs: WorkflowRun[],
  targetMainSha: string,
  coreWorkflows: string[] = [
    'Quality',
    'iOS Native Build',
    'Android Native Build',
    'CodeQL',
  ],
): { settled: boolean; inProgress: WorkflowRun[]; missingWorkflows: string[] } {
  if (!targetMainSha) {
    return { settled: true, inProgress: [], missingWorkflows: [] }
  }

  const runsForSha = runs.filter((r) => r.headSha === targetMainSha)
  const observedWorkflows = new Set(runsForSha.map((r) => r.workflowName))

  // 1. Check if all required core workflows have registered runs for this commit
  const missingWorkflows = coreWorkflows.filter(
    (w) => !observedWorkflows.has(w),
  )

  // 2. Check if any core workflows for this commit are queued or in progress
  const inProgress = runsForSha.filter(
    (r) =>
      coreWorkflows.includes(r.workflowName) &&
      (r.status === 'in_progress' || r.status === 'queued'),
  )

  const settled = missingWorkflows.length === 0 && inProgress.length === 0

  return {
    settled,
    inProgress,
    missingWorkflows,
  }
}

export function evaluatePRMergeability(pr: QueuedPR): {
  canMerge: boolean
  message?: string
} {
  if (pr.mergeable === 'CONFLICTING') {
    return {
      canMerge: false,
      message:
        `❌ **Merge Coordinator**: PR #${pr.number} has git merge conflicts with \`main\`.\n\n` +
        `Removed \`ready-to-merge\` label. Please resolve conflicts, re-verify checks, and re-enqueue.`,
    }
  }
  return { canMerge: true }
}

export function evaluatePRChecks(
  checks: PRCheckItem[],
  requiredContexts: string[] = REQUIRED_RULESET_CHECKS,
): {
  allPassing: boolean
  hasFailures: boolean
  pendingCount: number
  failures: PRCheckItem[]
  missingRequired: string[]
} {
  // Exclude the coordinator workflow itself to prevent self-deadlock
  const filtered = checks.filter(
    (c) =>
      c.workflow !== 'Merge Coordinator' &&
      c.name !== 'Drain merge queue' &&
      c.name !== 'Merge Coordinator',
  )

  const observedNames = new Set(filtered.map((c) => c.name))
  const missingRequired = requiredContexts.filter(
    (name) => !observedNames.has(name),
  )

  const failures = filtered.filter(
    (c) =>
      c.bucket === 'fail' ||
      c.bucket === 'cancel' ||
      c.state === 'FAILURE' ||
      c.state === 'ERROR' ||
      c.state === 'CANCELLED' ||
      c.state === 'TIMED_OUT' ||
      c.state === 'ACTION_REQUIRED',
  )

  const pending = filtered.filter(
    (c) =>
      c.bucket === 'pending' ||
      c.state === 'PENDING' ||
      c.state === 'QUEUED' ||
      c.state === 'IN_PROGRESS',
  )

  const passing = filtered.filter(
    (c) =>
      c.bucket === 'pass' ||
      c.state === 'SUCCESS' ||
      c.state === 'SKIPPED' ||
      c.state === 'NEUTRAL',
  )

  const allPassing =
    missingRequired.length === 0 &&
    failures.length === 0 &&
    pending.length === 0 &&
    filtered.length > 0 &&
    passing.length === filtered.length

  return {
    allPassing,
    hasFailures: failures.length > 0,
    pendingCount: pending.length + missingRequired.length,
    failures,
    missingRequired,
  }
}

export function waitForMainlineSettle(
  repoArgs: string[] = [],
  maxWaitMinutes = 30,
  intervalSeconds = 15,
): boolean {
  const targetMainSha = fetchMainHeadSha(repoArgs)
  if (!targetMainSha) {
    console.warn(
      'Could not resolve current origin/main SHA. Halting mainline settlement.',
    )
    return false
  }

  console.log(
    `Ensuring mainline CI on origin/main (${targetMainSha.slice(0, 7)}) is settled...`,
  )

  const start = Date.now()
  const timeoutMs = maxWaitMinutes * 60 * 1000

  while (Date.now() - start < timeoutMs) {
    let runs: WorkflowRun[]
    try {
      const runsJson = runGh(
        [
          'run',
          'list',
          '--branch',
          'main',
          '--event',
          'push',
          '--limit',
          '30',
          '--json',
          'workflowName,conclusion,status,url,headSha,createdAt',
        ],
        repoArgs,
      )
      runs = JSON.parse(runsJson || '[]') as WorkflowRun[]
    } catch (error) {
      console.warn('Warning: Could not fetch mainline runs, retrying...', error)
      execFileSync('sleep', [String(intervalSeconds)])
      continue
    }

    const { settled, inProgress, missingWorkflows } =
      evaluateMainlineSettlement(runs, targetMainSha)

    if (settled) {
      console.log(`✓ Mainline CI on ${targetMainSha.slice(0, 7)} is settled.`)
      return true
    }

    if (missingWorkflows.length > 0) {
      console.log(
        `Mainline CI on commit ${targetMainSha.slice(0, 7)} awaiting workflow registration (${missingWorkflows.join(', ')}). Waiting ${intervalSeconds}s...`,
      )
    } else {
      console.log(
        `Mainline CI on commit ${targetMainSha.slice(0, 7)} has in-progress runs (${inProgress.map((r) => r.workflowName).join(', ')}). Waiting ${intervalSeconds}s...`,
      )
    }

    execFileSync('sleep', [String(intervalSeconds)])
  }

  console.error(
    `Timed out waiting for mainline CI to settle after ${maxWaitMinutes}m`,
  )
  return false
}

export function verifyMainHealth(
  pr: QueuedPR,
  openPrs: OpenPullRequest[],
  repoArgs: string[] = [],
  maxWaitMinutes = 30,
  intervalSeconds = 15,
): boolean {
  const isHotfix = pr.title.trim().startsWith('fix-main:')

  // For non-hotfix PRs, wait for the current mainline commit CI to fully settle first
  if (!isHotfix) {
    const settled = waitForMainlineSettle(
      repoArgs,
      maxWaitMinutes,
      intervalSeconds,
    )
    if (!settled) {
      console.error(
        `Mainline CI did not settle in time. Halting landing for PR #${pr.number}.`,
      )
      return false
    }
  }

  try {
    const runsJson = runGh(
      [
        'run',
        'list',
        '--branch',
        'main',
        '--event',
        'push',
        '--limit',
        '30',
        '--json',
        'workflowName,conclusion,status,url,headSha,createdAt',
      ],
      repoArgs,
    )
    const runs = JSON.parse(runsJson || '[]') as WorkflowRun[]
    const evaluation = evaluateMainHealth(runs, {
      prTitle: pr.title,
      prNumber: pr.number,
      openPrs,
    })

    if (!evaluation.healthy) {
      console.error(`\n❌ Mainline health check failed for PR #${pr.number}:`)
      console.error(evaluation.message)
      return false
    }

    console.log(`✓ Mainline health verified: ${evaluation.message}`)
    return true
  } catch (error) {
    console.error('Failed to verify mainline health:', error)
    return false
  }
}

export function removeReadyLabel(
  prNumber: number,
  repoArgs: string[] = [],
  dryRun = false,
): void {
  if (dryRun) {
    console.log(
      `[dry-run] Would remove label "ready-to-merge" from PR #${prNumber}`,
    )
    return
  }
  try {
    runGh(
      ['pr', 'edit', String(prNumber), '--remove-label', 'ready-to-merge'],
      repoArgs,
    )
    console.log(`✓ Removed label "ready-to-merge" from PR #${prNumber}`)
  } catch (error) {
    console.warn(`Warning: Could not remove label from PR #${prNumber}:`, error)
  }
}

export function postPRComment(
  prNumber: number,
  body: string,
  repoArgs: string[] = [],
  dryRun = false,
): void {
  if (dryRun) {
    console.log(`[dry-run] Would comment on PR #${prNumber}:\n${body}`)
    return
  }
  try {
    runGh(['pr', 'comment', String(prNumber), '--body', body], repoArgs)
  } catch (error) {
    console.warn(`Warning: Could not post comment on PR #${prNumber}:`, error)
  }
}

export function waitForChecks(
  prNumber: number,
  repoArgs: string[] = [],
  intervalSeconds = 15,
  maxWaitMinutes = 30,
): { success: boolean; error?: string } {
  console.log(
    `Waiting for required checks on PR #${prNumber} (interval ${intervalSeconds}s, max ${maxWaitMinutes}m)...`,
  )
  const start = Date.now()
  const timeoutMs = maxWaitMinutes * 60 * 1000

  while (Date.now() - start < timeoutMs) {
    let checks: PRCheckItem[]
    try {
      const output = runGh(
        [
          'pr',
          'checks',
          String(prNumber),
          '--json',
          'name,state,bucket,workflow',
        ],
        repoArgs,
      )
      checks = JSON.parse(output || '[]') as PRCheckItem[]
    } catch (error) {
      console.warn(
        `Warning: Could not fetch checks for PR #${prNumber}, retrying...`,
        error,
      )
      execFileSync('sleep', [String(intervalSeconds)])
      continue
    }

    const evaluation = evaluatePRChecks(checks)

    if (evaluation.hasFailures) {
      const failedNames = evaluation.failures
        .map((f) => `${f.name} (${f.state || f.bucket})`)
        .join(', ')
      const msg = `Required status check(s) failed or were cancelled on PR #${prNumber}: ${failedNames}`
      console.error(`❌ ${msg}`)
      return { success: false, error: msg }
    }

    if (evaluation.allPassing) {
      console.log(`✓ All required checks passed on PR #${prNumber}`)
      return { success: true }
    }

    if (evaluation.missingRequired.length > 0) {
      console.log(
        `PR #${prNumber} awaiting registration of required checks (${evaluation.missingRequired.join(', ')}). Waiting ${intervalSeconds}s...`,
      )
    } else {
      console.log(
        `PR #${prNumber} has ${evaluation.pendingCount} check(s) in progress/pending. Waiting ${intervalSeconds}s...`,
      )
    }

    execFileSync('sleep', [String(intervalSeconds)])
  }

  const timeoutMsg = `Timed out waiting for required checks on PR #${prNumber} after ${maxWaitMinutes}m`
  console.error(`❌ ${timeoutMsg}`)
  return { success: false, error: timeoutMsg }
}

export function squashMergePR(
  prNumber: number,
  repoArgs: string[] = [],
  dryRun = false,
): { success: boolean; error?: string } {
  if (dryRun) {
    console.log(`[dry-run] Would squash-merge PR #${prNumber} into main`)
    return { success: true }
  }
  try {
    console.log(`Squash-merging PR #${prNumber} into main...`)
    runGh(
      ['pr', 'merge', String(prNumber), '--squash', '--delete-branch'],
      repoArgs,
    )
    console.log(`✓ Successfully squash-merged PR #${prNumber} into main!`)
    return { success: true }
  } catch (error: unknown) {
    const err = error as { stderr?: string; stdout?: string; message?: string }
    const errorMsg =
      err?.stderr || err?.stdout || err?.message || 'Unknown merge failure'
    console.error(`❌ Failed to squash-merge PR #${prNumber}:`, errorMsg)
    return { success: false, error: String(errorMsg) }
  }
}

export function processQueuedPR(
  pr: QueuedPR,
  allOpenPrs: OpenPullRequest[],
  options: CoordinatorOptions = {},
): ProcessPRResult {
  const {
    dryRun = false,
    repoArgs = [],
    checkIntervalSeconds = 15,
    maxWaitMinutes = 30,
  } = options

  console.log(`\n========================================`)
  console.log(`Processing PR #${pr.number}: "${pr.title}"`)
  console.log(`========================================`)

  // Check state early
  if (pr.state && pr.state !== 'OPEN') {
    const reason = `PR #${pr.number} is not open (state: ${pr.state})`
    console.warn(`${reason}. Skipping.`)
    removeReadyLabel(pr.number, repoArgs, dryRun)
    return { outcome: 'disqualified', reason }
  }

  // 1. Verify mainline health (including waiting for in-flight main CI)
  const healthy = verifyMainHealth(
    pr,
    allOpenPrs,
    repoArgs,
    maxWaitMinutes,
    checkIntervalSeconds,
  )
  if (!healthy) {
    const reason = `Mainline is currently failing or in-flight runs timed out. Awaiting fix-main hotfix.`
    console.error(`Halting merge coordinator: ${reason}`)
    return { outcome: 'mainline_halt', reason }
  }

  // 2. Refresh PR details & check mergeability / conflicts
  const freshPr = fetchPRDetails(pr.number, repoArgs, true) ?? pr
  if (freshPr.state && freshPr.state !== 'OPEN') {
    const reason = `PR #${pr.number} is no longer open (state: ${freshPr.state})`
    console.warn(`${reason}. Skipping.`)
    removeReadyLabel(pr.number, repoArgs, dryRun)
    return { outcome: 'disqualified', reason }
  }

  const mergeability = evaluatePRMergeability(freshPr)
  if (!mergeability.canMerge) {
    const reason = `PR #${pr.number} has git merge conflicts with main`
    if (mergeability.message) {
      console.error(mergeability.message)
      removeReadyLabel(pr.number, repoArgs, dryRun)
      postPRComment(pr.number, mergeability.message, repoArgs, dryRun)
    }
    return { outcome: 'disqualified', reason }
  }

  // 3. Wait for all required status checks to pass (deadlock-free, gates guaranteed)
  if (!dryRun) {
    const checkResult = waitForChecks(
      pr.number,
      repoArgs,
      checkIntervalSeconds,
      maxWaitMinutes,
    )
    if (!checkResult.success) {
      const reason = `Required checks failed or timed out: ${checkResult.error || 'Checks failed'}`
      const msg =
        `❌ **Merge Coordinator**: Required checks failed or timed out for PR #${pr.number}.\n\n` +
        `Error output:\n\`\`\`\n${checkResult.error || 'Checks failed'}\n\`\`\`\n\n` +
        `Removed \`ready-to-merge\` label. Please fix failures and re-enqueue once green.`
      removeReadyLabel(pr.number, repoArgs, dryRun)
      postPRComment(pr.number, msg, repoArgs, dryRun)
      return { outcome: 'disqualified', reason }
    }
  }

  // 4. Squash merge PR into main
  const mergeResult = squashMergePR(pr.number, repoArgs, dryRun)
  if (!mergeResult.success) {
    const reason = `Failed to squash-merge PR into main: ${mergeResult.error || 'Unknown error'}`
    const msg =
      `❌ **Merge Coordinator**: Failed to squash-merge PR #${pr.number} into \`main\`.\n\n` +
      `Error details:\n\`\`\`\n${mergeResult.error || 'Unknown error'}\n\`\`\`\n\n` +
      `Removed \`ready-to-merge\` label.`
    removeReadyLabel(pr.number, repoArgs, dryRun)
    postPRComment(pr.number, msg, repoArgs, dryRun)
    return { outcome: 'disqualified', reason }
  }

  // 5. Clean up label
  removeReadyLabel(pr.number, repoArgs, dryRun)
  return { outcome: 'merged' }
}

export function coordinate(options: CoordinatorOptions = {}): void {
  const { prNumber, repoArgs = [] } = options

  console.log('Starting Jolito Merge Coordinator...')

  if (prNumber) {
    const pr = fetchPRDetails(prNumber, repoArgs)
    if (!pr) {
      console.error(`PR #${prNumber} not found. Exiting.`)
      process.exit(1)
    }
    const allOpenPrs = fetchAllOpenPRs(repoArgs)
    const result = processQueuedPR(pr, allOpenPrs, options)
    if (result.outcome !== 'merged') {
      process.exit(1)
    }
    return
  }

  // Drain mode: process all PRs labeled ready-to-merge dynamically
  while (true) {
    const queue = fetchQueuedPRs(repoArgs)
    if (queue.length === 0) {
      console.log(
        'No pull requests currently queued with "ready-to-merge" label.',
      )
      break
    }

    console.log(`\nFound ${queue.length} PR(s) in merge queue:`)
    queue.forEach((p, idx) =>
      console.log(`  ${idx + 1}. #${p.number}: "${p.title}"`),
    )

    const nextPr = queue[0]!
    const currentOpenPrs = fetchAllOpenPRs(repoArgs)
    const result = processQueuedPR(nextPr, currentOpenPrs, options)

    if (result.outcome === 'mainline_halt') {
      console.error(`Halting merge coordinator: ${result.reason}`)
      break
    }

    if (result.outcome === 'disqualified') {
      console.warn(
        `Disqualified PR #${nextPr.number}: ${result.reason}. Continuing queue drain...`,
      )
      continue
    }

    console.log(
      `Successfully processed PR #${nextPr.number}. Continuing queue drain...`,
    )
  }

  console.log('\nMerge Coordinator queue processing finished.')
}

export function main(): void {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const repoIdx = args.findIndex((a) => a === '--repo' || a === '-R')
  const repoVal = repoIdx !== -1 ? args[repoIdx + 1] : undefined
  const repoArgs: string[] = repoVal ? ['--repo', repoVal] : []

  const prIdx = args.indexOf('--pr')
  const prNumber =
    prIdx !== -1 && args[prIdx + 1] ? Number(args[prIdx + 1]) : undefined

  coordinate({
    prNumber,
    dryRun,
    repoArgs,
  })
}

// Only execute main when directly invoked as a script
if (
  process.argv[1] &&
  (process.argv[1].endsWith('merge-coordinator.ts') ||
    process.argv[1].endsWith('merge-coordinator.js'))
) {
  main()
}
