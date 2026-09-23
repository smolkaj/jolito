import { execFileSync } from 'node:child_process'
import {
  evaluateMainHealth,
  type WorkflowRun,
  type OpenPullRequest,
} from './check-main-health.ts'

export interface QueuedPR {
  number: number
  title: string
  createdAt: string
  headRefName?: string
  mergeable?: string
  mergeStateStatus?: string
  labels?: Array<{ name: string }>
}

export interface CoordinatorOptions {
  prNumber?: number | undefined
  dryRun?: boolean | undefined
  repoArgs?: string[] | undefined
  maxWaitMinutes?: number | undefined
  checkIntervalSeconds?: number | undefined
}

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

export function runGh(
  args: string[],
  repoArgs: string[] = [],
  options: { timeout?: number } = {},
): string {
  const fullArgs = [...args]
  if (repoArgs.length > 0 && !args.includes('--repo') && !args.includes('-R')) {
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
        '--json',
        'number,title,createdAt,headRefName,mergeable,mergeStateStatus',
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
): QueuedPR | null {
  try {
    const output = runGh(
      [
        'pr',
        'view',
        String(prNumber),
        '--json',
        'number,title,createdAt,headRefName,mergeable,mergeStateStatus,labels',
      ],
      repoArgs,
    )
    return JSON.parse(output) as QueuedPR
  } catch (error) {
    console.error(`Failed to fetch PR #${prNumber} details:`, error)
    return null
  }
}

export function evaluateMainlineSettlement(
  runs: WorkflowRun[],
  coreWorkflows: string[] = ['Quality', 'iOS Native Build', 'CodeQL'],
): { settled: boolean; inProgress: WorkflowRun[]; latestSha?: string } {
  if (runs.length === 0) {
    return { settled: true, inProgress: [] }
  }

  const latestSha = runs[0]?.headSha
  if (!latestSha) {
    return { settled: true, inProgress: [] }
  }

  const latestRuns = runs.filter((r) => r.headSha === latestSha)
  const inProgress = latestRuns.filter(
    (r) =>
      coreWorkflows.includes(r.workflowName) &&
      (r.status === 'in_progress' || r.status === 'queued'),
  )

  return {
    settled: inProgress.length === 0,
    inProgress,
    latestSha,
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

export function waitForMainlineSettle(
  repoArgs: string[] = [],
  maxWaitMinutes = 30,
  intervalSeconds = 15,
): boolean {
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
          '20',
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

    const { settled, inProgress, latestSha } = evaluateMainlineSettlement(runs)
    if (settled) {
      return true
    }

    console.log(
      `Mainline CI on commit ${latestSha?.slice(0, 7)} has in-progress runs (${inProgress.map((r) => r.workflowName).join(', ')}). Waiting ${intervalSeconds}s...`,
    )
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

  // For non-hotfix PRs, wait for any in-flight mainline CI runs to settle first
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
  try {
    runGh(
      [
        'pr',
        'checks',
        String(prNumber),
        '--watch',
        `--interval=${intervalSeconds}`,
        '--fail-fast',
      ],
      repoArgs,
      { timeout: maxWaitMinutes * 60 * 1000 },
    )
    console.log(`✓ All checks passed on PR #${prNumber}`)
    return { success: true }
  } catch (error: unknown) {
    const err = error as { stderr?: string; stdout?: string; message?: string }
    const errorMsg =
      err?.stderr || err?.stdout || err?.message || 'Checks failed or timed out'
    console.error(`❌ Checks failed on PR #${prNumber}:\n${errorMsg}`)
    return { success: false, error: String(errorMsg) }
  }
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
): boolean {
  const {
    dryRun = false,
    repoArgs = [],
    checkIntervalSeconds = 15,
    maxWaitMinutes = 30,
  } = options

  console.log(`\n========================================`)
  console.log(`Processing PR #${pr.number}: "${pr.title}"`)
  console.log(`========================================`)

  // 1. Verify mainline health (including waiting for in-flight main CI)
  const healthy = verifyMainHealth(
    pr,
    allOpenPrs,
    repoArgs,
    maxWaitMinutes,
    checkIntervalSeconds,
  )
  if (!healthy) {
    console.error(
      `Halting merge coordinator: mainline is currently failing or in-flight runs timed out. Awaiting fix-main hotfix.`,
    )
    return false
  }

  // 2. Refresh PR details & check mergeability / conflicts
  const freshPr = fetchPRDetails(pr.number, repoArgs) ?? pr
  const mergeability = evaluatePRMergeability(freshPr)
  if (!mergeability.canMerge) {
    if (mergeability.message) {
      console.error(mergeability.message)
      removeReadyLabel(pr.number, repoArgs, dryRun)
      postPRComment(pr.number, mergeability.message, repoArgs, dryRun)
    }
    return false
  }

  // 3. Wait for all status checks to pass
  if (!dryRun) {
    const checkResult = waitForChecks(
      pr.number,
      repoArgs,
      checkIntervalSeconds,
      maxWaitMinutes,
    )
    if (!checkResult.success) {
      const msg =
        `❌ **Merge Coordinator**: Required checks failed or timed out for PR #${pr.number}.\n\n` +
        `Error output:\n\`\`\`\n${checkResult.error || 'Checks failed'}\n\`\`\`\n\n` +
        `Removed \`ready-to-merge\` label. Please fix failures and re-enqueue once green.`
      removeReadyLabel(pr.number, repoArgs, dryRun)
      postPRComment(pr.number, msg, repoArgs, dryRun)
      return false
    }
  }

  // 4. Squash merge PR into main
  const mergeResult = squashMergePR(pr.number, repoArgs, dryRun)
  if (!mergeResult.success) {
    const msg =
      `❌ **Merge Coordinator**: Failed to squash-merge PR #${pr.number} into \`main\`.\n\n` +
      `Error details:\n\`\`\`\n${mergeResult.error || 'Unknown error'}\n\`\`\`\n\n` +
      `Removed \`ready-to-merge\` label.`
    removeReadyLabel(pr.number, repoArgs, dryRun)
    postPRComment(pr.number, msg, repoArgs, dryRun)
    return false
  }

  // 5. Clean up label
  removeReadyLabel(pr.number, repoArgs, dryRun)
  return true
}

export function coordinate(options: CoordinatorOptions = {}): void {
  const { prNumber, repoArgs = [] } = options

  console.log('Starting Jolito Merge Coordinator...')

  // Fetch all open PRs in the repository to guarantee hotfix mutex fidelity
  const allOpenPrs = fetchAllOpenPRs(repoArgs)

  if (prNumber) {
    const pr = fetchPRDetails(prNumber, repoArgs)
    if (!pr) {
      console.error(`PR #${prNumber} not found. Exiting.`)
      process.exit(1)
    }
    const success = processQueuedPR(pr, allOpenPrs, options)
    if (!success) {
      process.exit(1)
    }
    return
  }

  // Drain mode: process all PRs labeled ready-to-merge
  const queue = fetchQueuedPRs(repoArgs)
  if (queue.length === 0) {
    console.log(
      'No pull requests currently queued with "ready-to-merge" label.',
    )
    return
  }

  console.log(`Found ${queue.length} PR(s) in merge queue:`)
  queue.forEach((p, idx) =>
    console.log(`  ${idx + 1}. #${p.number}: "${p.title}"`),
  )

  for (const pr of queue) {
    // Refresh all open PRs before each landing to detect new hotfixes
    const currentOpenPrs = fetchAllOpenPRs(repoArgs)
    const success = processQueuedPR(pr, currentOpenPrs, options)
    if (!success) {
      console.warn(
        `Stopped draining queue after PR #${pr.number} failed or was skipped.`,
      )
      break
    }
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
