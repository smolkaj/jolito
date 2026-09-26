import { execFileSync } from 'node:child_process'
import {
  existsSync as nodeExistsSync,
  realpathSync as nodeRealpathSync,
  symlinkSync as nodeSymlinkSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export type WorktreeMergedStatus = 'MERGED' | 'ACTIVE' | 'UNMERGED' | 'DETACHED'

export interface RawWorktreeRecord {
  path: string
  head: string
  branch?: string | undefined
  detached: boolean
  bare: boolean
  locked?: string | undefined
  prunable?: string | undefined
}

export interface WorktreeInfo {
  path: string
  head: string
  branch?: string | undefined
  detached: boolean
  isMainRepo: boolean
  isCurrent: boolean
}

export interface WorktreeAnalysis extends WorktreeInfo {
  status: WorktreeMergedStatus
  safeToPrune: boolean
  hasUncommittedChanges: boolean
  agent?: string | undefined
}

export interface CleanResult {
  removed: Array<{ path: string; branch?: string | undefined }>
  skipped: Array<{ path: string; branch?: string | undefined; reason: string }>
  pruned: boolean
}

export interface StartResult {
  path: string
  branch: string
  symlinkCreated: boolean
}

export type CommandRunner = (
  cmd: string,
  args: string[],
  options?: { cwd?: string | undefined; timeout?: number | undefined },
) => string

export interface FsOperations {
  existsSync: (path: string) => boolean
  realpathSync?: ((path: string) => string) | undefined
  symlinkSync?: ((target: string, path: string) => void) | undefined
}

export const defaultFsOps: FsOperations = {
  existsSync: nodeExistsSync,
  realpathSync: nodeRealpathSync,
  symlinkSync: nodeSymlinkSync,
}

export const defaultRunCmd: CommandRunner = (cmd, args, options = {}) => {
  return execFileSync(cmd, args, {
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeout ?? 60_000,
  })
}

export interface MergedBranchData {
  gitMerged: Set<string>
  prMerged: Map<string, string[]>
}

export function parseWorktreePorcelain(output: string): RawWorktreeRecord[] {
  const records: RawWorktreeRecord[] = []
  let current: Partial<RawWorktreeRecord> = {}

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (current.path) {
        records.push({
          path: current.path,
          head: current.head ?? '',
          branch: current.branch,
          detached: Boolean(current.detached),
          bare: Boolean(current.bare),
          locked: current.locked,
          prunable: current.prunable,
        })
        current = {}
      }
      continue
    }

    if (trimmed.startsWith('worktree ')) {
      if (current.path) {
        records.push({
          path: current.path,
          head: current.head ?? '',
          branch: current.branch,
          detached: Boolean(current.detached),
          bare: Boolean(current.bare),
          locked: current.locked,
          prunable: current.prunable,
        })
        current = {}
      }
      current.path = trimmed.slice('worktree '.length).trim()
    } else if (trimmed.startsWith('HEAD ')) {
      current.head = trimmed.slice('HEAD '.length).trim()
    } else if (trimmed.startsWith('branch ')) {
      current.branch = trimmed
        .slice('branch '.length)
        .trim()
        .replace(/^refs\/heads\//, '')
    } else if (trimmed === 'detached') {
      current.detached = true
    } else if (trimmed === 'bare') {
      current.bare = true
    } else if (trimmed.startsWith('locked')) {
      current.locked = trimmed.slice('locked'.length).trim() || 'locked'
    } else if (trimmed.startsWith('prunable')) {
      current.prunable = trimmed.slice('prunable'.length).trim() || 'prunable'
    }
  }

  if (current.path) {
    records.push({
      path: current.path,
      head: current.head ?? '',
      branch: current.branch,
      detached: Boolean(current.detached),
      bare: Boolean(current.bare),
      locked: current.locked,
      prunable: current.prunable,
    })
  }

  return records
}

export function getMergedBranchData(
  runCmd: CommandRunner = defaultRunCmd,
  cwd?: string,
): MergedBranchData {
  const gitMerged = new Set<string>()
  const prMerged = new Map<string, string[]>()

  // 1. Remote branches merged into origin/main
  try {
    const remoteOutput = runCmd(
      'git',
      ['branch', '-r', '--merged', 'origin/main'],
      { cwd },
    )
    for (const line of remoteOutput.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const branchName = trimmed.replace(/^origin\//, '')
      if (branchName && branchName !== 'HEAD' && !branchName.includes('->')) {
        gitMerged.add(branchName)
      }
    }
  } catch {
    // origin/main may not be available locally
  }

  // 2. Local branches merged into origin/main
  try {
    const localOutput = runCmd('git', ['branch', '--merged', 'origin/main'], {
      cwd,
    })
    for (const line of localOutput.split('\n')) {
      const trimmed = line.replace(/^[*+\s]+/, '').trim()
      if (trimmed && trimmed !== 'HEAD' && !trimmed.includes('->')) {
        gitMerged.add(trimmed)
      }
    }
  } catch {
    // git branch --merged may fail if origin/main ref does not exist
  }

  // 3. Merged PRs on GitHub with their merged head commit OIDs
  try {
    const ghOutput = runCmd(
      'gh',
      [
        'pr',
        'list',
        '--state',
        'merged',
        '--json',
        'headRefName,headRefOid',
        '--limit',
        '1000',
      ],
      { cwd },
    )
    const prs = JSON.parse(ghOutput) as Array<{
      headRefName?: string
      headRefOid?: string
    }>
    for (const pr of prs) {
      if (pr.headRefName && pr.headRefOid) {
        const existing = prMerged.get(pr.headRefName) ?? []
        existing.push(pr.headRefOid)
        prMerged.set(pr.headRefName, existing)
      }
    }
  } catch {
    // gh may fail if offline or not logged in; local git merged checks provide baseline
  }

  return { gitMerged, prMerged }
}

export function isBranchMerged(
  branch: string,
  headCommit: string,
  mergedData: MergedBranchData,
  runCmd: CommandRunner = defaultRunCmd,
  cwd?: string,
): boolean {
  // 1. Direct git ancestor check (fast-forward or already in origin/main)
  try {
    runCmd('git', ['merge-base', '--is-ancestor', headCommit, 'origin/main'], {
      cwd,
    })
    return true
  } catch {
    // Not an ancestor of origin/main
  }

  // 2. Git merged branch list check: verify headCommit has no unmerged commits beyond origin/main
  if (mergedData.gitMerged.has(branch)) {
    try {
      const unmergedCommits = runCmd(
        'git',
        ['rev-list', `origin/main..${headCommit}`],
        { cwd },
      )
      if (!unmergedCommits.trim()) {
        return true
      }
    } catch {
      // Fall through to PR check
    }
  }

  // 3. GitHub merged PR check: verify headCommit is contained in the PR's merged head
  const prHeadOids = mergedData.prMerged.get(branch)
  if (prHeadOids && prHeadOids.length > 0) {
    for (const prHeadOid of prHeadOids) {
      if (headCommit === prHeadOid) {
        return true
      }
      try {
        const unmergedCommits = runCmd(
          'git',
          ['rev-list', `${prHeadOid}..${headCommit}`],
          { cwd },
        )
        if (!unmergedCommits.trim()) {
          return true
        }
      } catch {
        // Check next PR head OID
      }
    }
  }

  return false
}

export function checkUncommittedChanges(
  wtPath: string,
  runCmd: CommandRunner = defaultRunCmd,
  fsOps: FsOperations = defaultFsOps,
): boolean {
  if (!fsOps.existsSync(wtPath)) {
    return false
  }
  try {
    const status = runCmd('git', ['-C', wtPath, 'status', '--porcelain'])
    return status.trim().length > 0
  } catch {
    // If git status fails (e.g. inaccessible worktree), err on side of caution
    return true
  }
}

function safeRealPath(p: string, fsOps: FsOperations = defaultFsOps): string {
  try {
    return fsOps.realpathSync ? fsOps.realpathSync(p) : resolve(p)
  } catch {
    return resolve(p)
  }
}

export function isSamePath(
  a: string,
  b: string,
  fsOps: FsOperations = defaultFsOps,
): boolean {
  return safeRealPath(a, fsOps) === safeRealPath(b, fsOps)
}

export function getMainRepoPath(
  runCmd: CommandRunner = defaultRunCmd,
  cwd?: string,
): string {
  try {
    const commonDir = runCmd(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { cwd },
    ).trim()
    if (commonDir) {
      return resolve(
        commonDir.endsWith('.git') ? dirname(commonDir) : commonDir,
      )
    }
  } catch {
    // Fallback: look at the first entry of git worktree list
  }

  try {
    const wtOutput = runCmd('git', ['worktree', 'list', '--porcelain'], { cwd })
    const records = parseWorktreePorcelain(wtOutput)
    if (records.length > 0 && records[0]?.path) {
      return resolve(records[0].path)
    }
  } catch {
    // Fallback
  }

  return resolve(cwd ?? process.cwd())
}

export function getCurrentWorktreePath(
  runCmd: CommandRunner = defaultRunCmd,
  cwd?: string,
): string {
  try {
    const topLevel = runCmd('git', ['rev-parse', '--show-toplevel'], {
      cwd,
    }).trim()
    if (topLevel) {
      return resolve(topLevel)
    }
  } catch {
    // Fallback
  }
  return resolve(cwd ?? process.cwd())
}

export function getWorktreeAgent(
  branch: string | undefined,
): string | undefined {
  if (!branch) return undefined
  const slashIdx = branch.indexOf('/')
  if (slashIdx > 0) {
    return branch.slice(0, slashIdx)
  }
  return undefined
}

export function detectCurrentAgent(
  currentWorktreePath: string,
  records: RawWorktreeRecord[],
  defaultAgent = 'agy',
): string {
  if (process.env.AGENT_ID) {
    return process.env.AGENT_ID
  }
  const currentRecord = records.find(
    (r) => resolve(r.path) === resolve(currentWorktreePath),
  )
  if (currentRecord?.branch) {
    const agent = getWorktreeAgent(currentRecord.branch)
    if (agent) return agent
  }
  return defaultAgent
}

export function analyzeWorktrees(
  options: {
    cwd?: string | undefined
    runCmd?: CommandRunner | undefined
    fsOps?: FsOperations | undefined
    mergedData?: MergedBranchData | undefined
  } = {},
): WorktreeAnalysis[] {
  const runCmd = options.runCmd ?? defaultRunCmd
  const fsOps = options.fsOps ?? defaultFsOps
  const wtOutput = runCmd('git', ['worktree', 'list', '--porcelain'], {
    cwd: options.cwd,
  })
  const records = parseWorktreePorcelain(wtOutput)

  const mainRepoPath = getMainRepoPath(runCmd, options.cwd)
  const currentWorktreePath = getCurrentWorktreePath(runCmd, options.cwd)
  const mergedData =
    options.mergedData ?? getMergedBranchData(runCmd, options.cwd)

  return records.map((record, index) => {
    const resolvedPath = resolve(record.path)
    const isMainRepo =
      index === 0 || isSamePath(resolvedPath, mainRepoPath, fsOps)

    const isCurrent = isSamePath(resolvedPath, currentWorktreePath, fsOps)
    const agent = getWorktreeAgent(record.branch)

    let status: WorktreeMergedStatus
    if (isMainRepo || isCurrent) {
      status = 'ACTIVE'
    } else if (record.detached || !record.branch) {
      status = 'DETACHED'
    } else if (
      isBranchMerged(
        record.branch,
        record.head,
        mergedData,
        runCmd,
        options.cwd,
      )
    ) {
      status = 'MERGED'
    } else {
      status = 'UNMERGED'
    }

    const hasChanges = checkUncommittedChanges(resolvedPath, runCmd, fsOps)
    const safeToPrune =
      status === 'MERGED' && !isMainRepo && !isCurrent && !hasChanges

    return {
      path: record.path,
      head: record.head,
      branch: record.branch,
      detached: record.detached,
      isMainRepo,
      isCurrent,
      status,
      safeToPrune,
      hasUncommittedChanges: hasChanges,
      agent,
    }
  })
}

export function listWorktrees(
  options: {
    cwd?: string | undefined
    runCmd?: CommandRunner | undefined
    fsOps?: FsOperations | undefined
    logTable?: ((data: unknown[]) => void) | undefined
    log?: ((msg: string) => void) | undefined
  } = {},
): WorktreeAnalysis[] {
  const analyses = analyzeWorktrees(options)
  const logTable = options.logTable ?? console.table
  const log = options.log ?? console.log

  const tableData = analyses.map((a) => ({
    Path: a.path,
    Branch: a.branch ?? '(detached)',
    Status: a.status,
    'Safe to Prune': a.safeToPrune ? 'Yes' : 'No',
  }))

  logTable(tableData)

  const safeCount = analyses.filter((a) => a.safeToPrune).length
  log(`\nTotal: ${analyses.length} worktree(s), ${safeCount} safe to prune.\n`)

  return analyses
}

export function cleanWorktrees(
  options: {
    cwd?: string | undefined
    dryRun?: boolean | undefined
    force?: boolean | undefined
    agent?: string | undefined
    all?: boolean | undefined
    deleteBranch?: boolean | undefined
    runCmd?: CommandRunner | undefined
    fsOps?: FsOperations | undefined
    mergedData?: MergedBranchData | undefined
    log?: ((msg: string) => void) | undefined
  } = {},
): CleanResult {
  const runCmd = options.runCmd ?? defaultRunCmd
  const fsOps = options.fsOps ?? defaultFsOps
  const log = options.log ?? console.log
  const currentWorktreePath = getCurrentWorktreePath(runCmd, options.cwd)

  const wtOutput = runCmd('git', ['worktree', 'list', '--porcelain'], {
    cwd: options.cwd,
  })
  const records = parseWorktreePorcelain(wtOutput)
  const activeAgent =
    options.agent ?? detectCurrentAgent(currentWorktreePath, records)

  const analyses = analyzeWorktrees({
    cwd: options.cwd,
    runCmd,
    fsOps,
    mergedData: options.mergedData,
  })

  const removed: Array<{ path: string; branch?: string | undefined }> = []
  const skipped: Array<{
    path: string
    branch?: string | undefined
    reason: string
  }> = []

  for (const wt of analyses) {
    // MUST NEVER remove main repository
    if (wt.isMainRepo) {
      continue
    }
    // MUST NEVER remove current working directory
    if (wt.isCurrent) {
      continue
    }

    if (wt.status !== 'MERGED') {
      continue
    }

    // Check multi-agent ownership: AGENTS.md invariant "Never touch another agent's worktree"
    if (!options.all && wt.agent && wt.agent !== activeAgent) {
      skipped.push({
        path: wt.path,
        branch: wt.branch,
        reason: `Belongs to agent "${wt.agent}" (use --all or --agent ${wt.agent} to clean)`,
      })
      log(
        `Skipping worktree belonging to agent "${wt.agent}": ${wt.path} (${wt.branch ?? 'detached'})`,
      )
      continue
    }

    if (wt.hasUncommittedChanges && !options.force) {
      skipped.push({
        path: wt.path,
        branch: wt.branch,
        reason: 'Uncommitted changes present (use --force to remove)',
      })
      log(
        `Skipping dirty worktree: ${wt.path} (${wt.branch ?? 'detached'}) - uncommitted changes present`,
      )
      continue
    }

    // Eligible for removal
    if (options.dryRun) {
      removed.push({ path: wt.path, branch: wt.branch })
      const forceNote = wt.hasUncommittedChanges
        ? ' [force: contains uncommitted changes]'
        : ''
      log(
        `[dry-run] Would remove worktree: ${wt.path} (${wt.branch ?? 'detached'})${forceNote}`,
      )
      if (wt.branch && (options.deleteBranch ?? true)) {
        log(`[dry-run] Would delete local branch: ${wt.branch}`)
      }
    } else {
      try {
        const removeArgs = ['worktree', 'remove']
        if (options.force) {
          removeArgs.push('--force')
        }
        removeArgs.push(wt.path)
        runCmd('git', removeArgs, { cwd: options.cwd })
        removed.push({ path: wt.path, branch: wt.branch })
        log(`Removed worktree: ${wt.path} (${wt.branch ?? 'detached'})`)

        // Also clean up local branch ref if requested (default true)
        if (wt.branch && (options.deleteBranch ?? true)) {
          try {
            const branchArgs = [
              'branch',
              options.force ? '-D' : '-d',
              wt.branch,
            ]
            runCmd('git', branchArgs, { cwd: options.cwd })
            log(`Deleted local branch: ${wt.branch}`)
          } catch {
            // Branch deletion is best-effort (e.g. if already deleted or ref mismatch)
          }
        }
      } catch (error) {
        skipped.push({
          path: wt.path,
          branch: wt.branch,
          reason: `Failed to remove: ${error instanceof Error ? error.message : String(error)}`,
        })
        log(
          `Failed to remove worktree ${wt.path}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  let pruned = false
  if (options.dryRun) {
    log('[dry-run] Would run: git worktree prune')
  } else {
    try {
      runCmd('git', ['worktree', 'prune'], { cwd: options.cwd })
      pruned = true
      log('Pruned worktree metadata.')
    } catch (error) {
      log(
        `Failed to prune worktrees: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return { removed, skipped, pruned }
}

export function parseTaskInput(
  input: string,
  defaultAgent = 'agy',
): { agent: string; taskName: string; branch: string } {
  const trimmed = input.trim()
  const parts = trimmed.split('/')
  if (parts.length === 2 && parts[0] && parts[1]) {
    const [agent, taskName] = parts
    if (
      !/^[a-zA-Z0-9._-]+$/.test(agent) ||
      !/^[a-zA-Z0-9._-]+$/.test(taskName)
    ) {
      throw new Error(
        `Invalid agent or task name "${input}". Use alphanumeric characters, dashes, underscores, and dots.`,
      )
    }
    return { agent, taskName, branch: `${agent}/${taskName}` }
  } else if (parts.length === 1 && parts[0]) {
    const taskName = parts[0]
    if (!/^[a-zA-Z0-9._-]+$/.test(taskName)) {
      throw new Error(
        `Invalid task name "${input}". Use alphanumeric characters, dashes, underscores, and dots.`,
      )
    }
    return {
      agent: defaultAgent,
      taskName,
      branch: `${defaultAgent}/${taskName}`,
    }
  } else {
    throw new Error(
      `Invalid task format "${input}". Expected "<task>" or "<agent>/<task>".`,
    )
  }
}

export function startWorktree(
  taskInput: string,
  options: {
    cwd?: string | undefined
    agent?: string | undefined
    runCmd?: CommandRunner | undefined
    log?: ((msg: string) => void) | undefined
    fsOps?: FsOperations | undefined
  } = {},
): StartResult {
  const runCmd = options.runCmd ?? defaultRunCmd
  const log = options.log ?? console.log
  const fsOps = options.fsOps ?? defaultFsOps

  if (!taskInput || typeof taskInput !== 'string' || !taskInput.trim()) {
    throw new Error(
      'Task name is required. Usage: agent-worktree start <task-name>',
    )
  }

  const defaultAgent = options.agent ?? process.env.AGENT_ID ?? 'agy'
  const { branch, taskName } = parseTaskInput(taskInput, defaultAgent)

  const mainRepoPath = getMainRepoPath(runCmd, options.cwd)
  const targetPath = resolve(mainRepoPath, '..', `jolito-${taskName}`)

  if (fsOps.existsSync(targetPath)) {
    throw new Error(`Target worktree directory already exists: ${targetPath}`)
  }

  // Check if branch already exists locally
  try {
    runCmd('git', ['rev-parse', '--verify', `refs/heads/${branch}`], {
      cwd: options.cwd,
    })
    throw new Error(
      `Branch "${branch}" already exists locally. Delete it with "git branch -d ${branch}" or pick another task name.`,
    )
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('already exists locally')
    ) {
      throw error
    }
    // Branch does not exist, which is expected
  }

  // 1. Fetch latest origin/main
  log('Fetching latest origin/main...')
  runCmd('git', ['fetch', 'origin', 'main'], { cwd: options.cwd })

  // 2. Add worktree
  log(`Creating worktree at ${targetPath} with branch ${branch}...`)
  runCmd('git', ['worktree', 'add', '-b', branch, targetPath, 'origin/main'], {
    cwd: options.cwd,
  })

  // 3. Symlink node_modules
  const mainNodeModules = join(mainRepoPath, 'node_modules')
  const targetNodeModules = join(targetPath, 'node_modules')
  let symlinkCreated = false

  if (fsOps.existsSync(mainNodeModules)) {
    if (!fsOps.existsSync(targetNodeModules)) {
      if (!fsOps.symlinkSync) {
        throw new Error('symlinkSync is required in fsOps')
      }
      fsOps.symlinkSync(mainNodeModules, targetNodeModules)
      symlinkCreated = true
      log(`Symlinked node_modules -> ${mainNodeModules}`)
    }
  } else {
    log(
      `Warning: Main node_modules does not exist at ${mainNodeModules}, skipping symlink.`,
    )
  }

  log(`Successfully created worktree:`)
  log(`  Path:    ${targetPath}`)
  log(`  Branch:  ${branch}`)
  log(`  Symlink: ${symlinkCreated ? 'created' : 'skipped'}`)

  return {
    path: targetPath,
    branch,
    symlinkCreated,
  }
}

export function main(
  argv: string[] = process.argv.slice(2),
  options: {
    cwd?: string | undefined
    runCmd?: CommandRunner | undefined
    fsOps?: FsOperations | undefined
    exit?: ((code: number) => void) | undefined
    log?: ((msg: string) => void) | undefined
    error?: ((msg: string) => void) | undefined
  } = {},
): void {
  const exit =
    options.exit ??
    ((code: number) => {
      process.exit(code)
    })
  const log = options.log ?? console.log
  const errLog = options.error ?? console.error
  const [command, ...rest] = argv

  switch (command) {
    case 'list': {
      listWorktrees({
        cwd: options.cwd,
        runCmd: options.runCmd,
        fsOps: options.fsOps,
        log,
      })
      break
    }
    case 'clean': {
      const dryRun = rest.includes('--dry-run')
      const force = rest.includes('--force')
      const all = rest.includes('--all')
      const agentIdx = rest.indexOf('--agent')
      const agent = agentIdx !== -1 ? rest[agentIdx + 1] : undefined

      cleanWorktrees({
        cwd: options.cwd,
        dryRun,
        force,
        all,
        agent,
        runCmd: options.runCmd,
        fsOps: options.fsOps,
        log,
      })
      break
    }
    case 'start': {
      const taskName = rest.find((arg) => !arg.startsWith('-'))
      if (!taskName) {
        errLog(
          'Error: Task name is required.\nUsage: agent-worktree start <task-name>',
        )
        exit(1)
        return
      }
      startWorktree(taskName, {
        cwd: options.cwd,
        runCmd: options.runCmd,
        fsOps: options.fsOps,
        log,
      })
      break
    }
    case '--help':
    case '-h':
    case 'help':
    case undefined: {
      log(
        `
Usage: agent-worktree <command> [options]

Commands:
  list                              List all worktrees with their merge and prune status
  clean                             Remove merged worktrees and prune metadata
    --dry-run                       Show what would be removed without deleting
    --force                         Remove worktrees even if they contain uncommitted changes
    --agent <id>                    Clean worktrees for specific agent (default: active agent)
    --all                           Clean merged worktrees across all agents
  start <task-name|agent/task>      Create a new worktree branched from origin/main with symlinked node_modules
      `.trim(),
      )
      if (!command) {
        exit(1)
      }
      break
    }
    default: {
      errLog(
        `Unknown command: "${command}"\nRun "agent-worktree --help" for available commands.`,
      )
      exit(1)
      break
    }
  }
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('agent-worktree.ts') ||
    process.argv[1].endsWith('agent-worktree.js'))
) {
  try {
    main()
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
