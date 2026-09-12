import { execFileSync } from 'node:child_process'

export interface WorkflowRun {
  workflowName: string
  conclusion: string | null
  status: string
  url: string
  headSha: string
  createdAt?: string
}

export interface HealthEvaluation {
  healthy: boolean
  message: string
  failures?: WorkflowRun[]
  hotfixBypass?: boolean
  latest?: Record<string, WorkflowRun>
}

export function evaluateMainHealth(
  runs: WorkflowRun[],
  { prTitle = '', headRef = '' }: { prTitle?: string; headRef?: string } = {},
): HealthEvaluation {
  // Hotfix escape hatch: if this PR is explicitly fixing main, do not block it
  const isHotfix =
    headRef.startsWith('fix-main/') ||
    headRef.startsWith('hotfix/') ||
    prTitle.toLowerCase().includes('fix-main') ||
    prTitle.toLowerCase().includes('[fix-main]')

  if (isHotfix) {
    return {
      healthy: true,
      hotfixBypass: true,
      message:
        'PR is explicitly marked as a mainline hotfix. Bypassing mainline health check.',
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
  const headRef = process.env.HEAD_REF ?? ''

  // Only run when in CI or explicitly requested
  if (!process.env.GITHUB_ACTIONS && !process.argv.includes('--force')) {
    console.log(
      'Skipping mainline health check in local environment (run with --force to test).',
    )
    return
  }

  try {
    const output = execFileSync(
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

    const runs = JSON.parse(output) as WorkflowRun[]
    const result = evaluateMainHealth(runs, { prTitle, headRef })

    if (!result.healthy) {
      console.error(
        '\n================================================================',
      )
      console.error('BLOCKED: origin/main is currently failing CI!')
      console.error(
        '================================================================',
      )
      console.error(result.message)
      console.error(
        '\nPRs cannot be tested or merged on top of a broken mainline.',
      )
      console.error('Fix main first or name your branch fix-main/* to bypass.')
      console.error(
        '================================================================\n',
      )
      process.exit(1)
    }

    console.log(result.message)
  } catch (err) {
    const error = err as Error
    if (process.env.GITHUB_ACTIONS) {
      console.error('Failed to query mainline runs via gh CLI:', error.message)
      process.exit(1)
    } else {
      console.warn('Unable to verify mainline health locally:', error.message)
    }
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  main()
}
