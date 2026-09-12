import { execFileSync } from 'node:child_process'

export interface WorkflowRun {
  workflowName: string
  conclusion: string | null
  status: string
  url: string
  headSha: string
  createdAt?: string
}

export interface OpenPullRequest {
  number: number
  title: string
  createdAt: string
}

export interface HealthEvaluation {
  healthy: boolean
  message: string
  failures?: WorkflowRun[]
  hotfixBypass?: boolean
  mutexBlocked?: boolean
  latest?: Record<string, WorkflowRun>
}

export function evaluateMainHealth(
  runs: WorkflowRun[],
  {
    prTitle = '',
    prNumber = 0,
    openPrs = [],
  }: {
    prTitle?: string
    prNumber?: number
    openPrs?: OpenPullRequest[]
  } = {},
): HealthEvaluation {
  // Canonical escape hatch: PR title must start with 'fix-main:'
  const isHotfix = prTitle.startsWith('fix-main:')

  if (isHotfix) {
    // Mechanical Mutex: Ensure only ONE fix-main PR is active at any time
    const activeFixPrs = openPrs
      .filter((pr) => pr.title.startsWith('fix-main:'))
      .sort((a, b) => {
        if (a.createdAt !== b.createdAt) {
          return a.createdAt.localeCompare(b.createdAt)
        }
        return a.number - b.number
      })

    if (activeFixPrs.length > 0 && prNumber > 0) {
      const lockHolder = activeFixPrs[0]
      if (lockHolder && lockHolder.number !== prNumber) {
        return {
          healthy: false,
          mutexBlocked: true,
          message:
            `❌ BLOCKED: Another mainline fix PR (#${lockHolder.number}: "${lockHolder.title}") is already active.\n` +
            `   Only ONE fix-main PR may run at a time to prevent conflicting fixes.`,
        }
      }
    }

    return {
      healthy: true,
      hotfixBypass: true,
      message:
        '✓ PR holds the canonical fix-main mutex lock. Bypassing mainline health check.',
    }
  }

  // Core workflows that define mainline health
  const CORE_WORKFLOWS = ['Quality', 'iOS Native Build', 'CodeQL']

  const completed = runs.filter((r) => r.status === 'completed')
  const latestByWorkflow: Record<string, WorkflowRun> = {}

  for (const run of completed) {
    if (!latestByWorkflow[run.workflowName]) {
      latestByWorkflow[run.workflowName] = run
    }
  }

  const failures: WorkflowRun[] = []
  for (const workflow of CORE_WORKFLOWS) {
    const run = latestByWorkflow[workflow]
    if (run && run.conclusion !== 'success' && run.conclusion !== 'skipped') {
      failures.push(run)
    }
  }

  if (failures.length > 0) {
    return {
      healthy: false,
      failures,
      message: failures
        .map(
          (f) =>
            `❌ Mainline workflow "${f.workflowName}" failed (${f.conclusion ?? 'unknown'}) on commit ${f.headSha.slice(0, 7)}:\n   URL: ${f.url}`,
        )
        .join('\n'),
    }
  }

  return {
    healthy: true,
    latest: latestByWorkflow,
    message:
      '✓ origin/main is healthy. All core workflows (Quality, iOS Native Build, CodeQL) are passing.',
  }
}

export function main(): void {
  const prTitle = process.env.PR_TITLE ?? ''
  const prNumber = Number(process.env.PR_NUMBER) || 0

  // Only run when in CI or explicitly requested
  if (!process.env.GITHUB_ACTIONS && !process.argv.includes('--force')) {
    console.log(
      'Skipping mainline health check in local environment (run with --force to test).',
    )
    return
  }

  try {
    const isHotfix = prTitle.startsWith('fix-main:')
    let openPrs: OpenPullRequest[] = []

    if (isHotfix) {
      const prsOutput = execFileSync(
        'gh',
        ['pr', 'list', '--state', 'open', '--json', 'number,title,createdAt'],
        { encoding: 'utf8' },
      )
      openPrs = JSON.parse(prsOutput) as OpenPullRequest[]
    }

    const runsOutput = execFileSync(
      'gh',
      [
        'run',
        'list',
        '--branch',
        'main',
        '--event',
        'push',
        '--limit',
        '15',
        '--json',
        'workflowName,conclusion,status,url,headSha,createdAt',
      ],
      { encoding: 'utf8' },
    )

    const runs = JSON.parse(runsOutput) as WorkflowRun[]
    const result = evaluateMainHealth(runs, { prTitle, prNumber, openPrs })

    if (!result.healthy) {
      console.error(
        '\n================================================================',
      )
      console.error('BLOCKED: Cannot proceed with PR!')
      console.error(
        '================================================================',
      )
      console.error(result.message)
      if (!result.mutexBlocked) {
        console.error(
          '\nPRs cannot be tested or merged on top of a broken mainline.',
        )
        console.error(
          "To land a hotfix for main, prefix the PR title with 'fix-main:'.",
        )
      }
      console.error(
        '================================================================\n',
      )
      process.exit(1)
    }

    console.log(result.message)
  } catch (err) {
    const error = err as Error
    if (process.env.GITHUB_ACTIONS) {
      console.error(
        'Failed to execute mainline health gate via gh CLI:',
        error.message,
      )
      process.exit(1)
    } else {
      console.warn('Unable to verify mainline health locally:', error.message)
    }
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  main()
}
