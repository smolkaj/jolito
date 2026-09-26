import { describe, expect, it } from 'vitest'
import {
  analyzeWorktrees,
  checkUncommittedChanges,
  cleanWorktrees,
  getMergedBranchNames,
  isBranchMerged,
  listWorktrees,
  main,
  parseWorktreePorcelain,
  startWorktree,
  type CommandRunner,
  type FsOperations,
} from './agent-worktree.ts'

describe('parseWorktreePorcelain', () => {
  it('parses standard git worktree list porcelain output', () => {
    const rawOutput = `
worktree /home/steffen/src/jolito
HEAD d811e646e469142e499d5c025f2143026fd2c88e
branch refs/heads/main

worktree /home/steffen/src/jolito-feature
HEAD a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4
branch refs/heads/agy/feature-branch

worktree /home/steffen/src/jolito-detached
HEAD 50ae41265ed775e55b5ef1a3f05637fa0154d545
detached
`
    const records = parseWorktreePorcelain(rawOutput)
    expect(records).toHaveLength(3)

    expect(records[0]).toEqual({
      path: '/home/steffen/src/jolito',
      head: 'd811e646e469142e499d5c025f2143026fd2c88e',
      branch: 'main',
      detached: false,
      bare: false,
    })

    expect(records[1]).toEqual({
      path: '/home/steffen/src/jolito-feature',
      head: 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4',
      branch: 'agy/feature-branch',
      detached: false,
      bare: false,
    })

    expect(records[2]).toEqual({
      path: '/home/steffen/src/jolito-detached',
      head: '50ae41265ed775e55b5ef1a3f05637fa0154d545',
      branch: undefined,
      detached: true,
      bare: false,
    })
  })

  it('handles locked, prunable, and bare worktrees', () => {
    const rawOutput = `
worktree /home/steffen/src/jolito-locked
HEAD 1111111111111111111111111111111111111111
branch refs/heads/locked-branch
locked work in progress

worktree /home/steffen/src/jolito-prunable
HEAD 2222222222222222222222222222222222222222
prunable gitdir file points to non-existent location
`
    const records = parseWorktreePorcelain(rawOutput)
    expect(records).toHaveLength(2)
    expect(records[0]?.locked).toBe('work in progress')
    expect(records[1]?.prunable).toBe(
      'gitdir file points to non-existent location',
    )
  })

  it('handles empty output gracefully', () => {
    expect(parseWorktreePorcelain('')).toEqual([])
    expect(parseWorktreePorcelain('   \n\n  ')).toEqual([])
  })
})

describe('getMergedBranchNames', () => {
  it('aggregates branches from git remote, local, and gh pr list', () => {
    const mockRunner: CommandRunner = (cmd, args) => {
      if (cmd === 'git' && args.includes('-r')) {
        return '  origin/merged-remote-1\n  origin/main\n  origin/HEAD -> origin/main\n'
      }
      if (cmd === 'git' && args.includes('--merged')) {
        return '* main\n  merged-local-1\n'
      }
      if (cmd === 'gh') {
        return JSON.stringify([
          { headRefName: 'agy/merged-pr-1' },
          { headRefName: 'agy/merged-pr-2' },
        ])
      }
      return ''
    }

    const merged = getMergedBranchNames(mockRunner)
    expect(merged.has('merged-remote-1')).toBe(true)
    expect(merged.has('merged-local-1')).toBe(true)
    expect(merged.has('agy/merged-pr-1')).toBe(true)
    expect(merged.has('agy/merged-pr-2')).toBe(true)
    expect(merged.has('unmerged-branch')).toBe(false)
  })

  it('does not throw when gh command fails (e.g. offline/no gh cli)', () => {
    const mockRunner: CommandRunner = (cmd, args) => {
      if (cmd === 'git' && args.includes('-r')) {
        return '  origin/remote-merged\n'
      }
      if (cmd === 'gh') {
        throw new Error('gh: command not found')
      }
      return ''
    }

    const merged = getMergedBranchNames(mockRunner)
    expect(merged.has('remote-merged')).toBe(true)
    expect(merged.size).toBeGreaterThanOrEqual(1)
  })
})

describe('isBranchMerged', () => {
  it('returns true if branch is in the merged set', () => {
    const merged = new Set(['branch-a'])
    expect(isBranchMerged('branch-a', merged)).toBe(true)
  })

  it('falls back to merge-base check if branch is not in the set', () => {
    const merged = new Set(['branch-a'])
    const mockRunner: CommandRunner = (_cmd, args) => {
      if (args.includes('refs/heads/branch-b')) {
        return '' // Exits 0
      }
      throw new Error('not ancestor')
    }

    expect(isBranchMerged('branch-b', merged, mockRunner)).toBe(true)
    expect(isBranchMerged('branch-c', merged, mockRunner)).toBe(false)
  })
})

describe('checkUncommittedChanges', () => {
  it('returns false when git status is clean', () => {
    const mockRunner: CommandRunner = () => ''
    expect(checkUncommittedChanges(process.cwd(), mockRunner)).toBe(false)
  })

  it('returns true when git status reports modifications or untracked files', () => {
    const mockRunner: CommandRunner = () => ' M src/foo.ts\n?? new-file.txt\n'
    expect(checkUncommittedChanges(process.cwd(), mockRunner)).toBe(true)
  })

  it('returns false if directory does not exist on disk', () => {
    expect(checkUncommittedChanges('/non/existent/path/for/sure')).toBe(false)
  })
})

describe('analyzeWorktrees', () => {
  const samplePorcelain = `
worktree /home/steffen/src/jolito
HEAD d811e646e469142e499d5c025f2143026fd2c88e
branch refs/heads/main

worktree /home/steffen/src/jolito-current
HEAD d811e646e469142e499d5c025f2143026fd2c88e
branch refs/heads/agy/current-task

worktree /home/steffen/src/jolito-merged-clean
HEAD 1111111111111111111111111111111111111111
branch refs/heads/agy/merged-clean

worktree /home/steffen/src/jolito-merged-dirty
HEAD 2222222222222222222222222222222222222222
branch refs/heads/agy/merged-dirty

worktree /home/steffen/src/jolito-unmerged
HEAD 3333333333333333333333333333333333333333
branch refs/heads/agy/in-progress

worktree /home/steffen/src/jolito-detached
HEAD 4444444444444444444444444444444444444444
detached
`

  it('accurately classifies status and safeToPrune for each worktree', () => {
    const mockRunner: CommandRunner = (cmd, args) => {
      if (cmd === 'git') {
        if (args[0] === 'worktree' && args[1] === 'list') {
          return samplePorcelain
        }
        if (args.includes('--git-common-dir')) {
          return '/home/steffen/src/jolito/.git'
        }
        if (args.includes('--show-toplevel')) {
          return '/home/steffen/src/jolito-current'
        }
        if (args.includes('status')) {
          const wtPath = args[args.indexOf('-C') + 1]
          if (wtPath === '/home/steffen/src/jolito-merged-dirty') {
            return ' M dirty-file.ts\n'
          }
          return ''
        }
        if (args[0] === 'merge-base') {
          throw new Error('Not an ancestor')
        }
      }
      return ''
    }

    const mockFs: FsOperations = {
      existsSync: () => true,
      realpathSync: (p) => p,
    }

    const mergedBranches = new Set(['agy/merged-clean', 'agy/merged-dirty'])
    const analyses = analyzeWorktrees({
      runCmd: mockRunner,
      fsOps: mockFs,
      mergedBranches,
      cwd: '/home/steffen/src/jolito-current',
    })

    expect(analyses).toHaveLength(6)

    // 1. Main repo: ACTIVE, safeToPrune: false
    expect(analyses[0]?.status).toBe('ACTIVE')
    expect(analyses[0]?.isMainRepo).toBe(true)
    expect(analyses[0]?.safeToPrune).toBe(false)

    // 2. Current worktree: ACTIVE, safeToPrune: false
    expect(analyses[1]?.status).toBe('ACTIVE')
    expect(analyses[1]?.isCurrent).toBe(true)
    expect(analyses[1]?.safeToPrune).toBe(false)

    // 3. Merged and clean: MERGED, safeToPrune: true
    expect(analyses[2]?.status).toBe('MERGED')
    expect(analyses[2]?.hasUncommittedChanges).toBe(false)
    expect(analyses[2]?.safeToPrune).toBe(true)

    // 4. Merged but dirty: MERGED, safeToPrune: false
    expect(analyses[3]?.status).toBe('MERGED')
    expect(analyses[3]?.hasUncommittedChanges).toBe(true)
    expect(analyses[3]?.safeToPrune).toBe(false)

    // 5. Unmerged branch: UNMERGED, safeToPrune: false
    expect(analyses[4]?.status).toBe('UNMERGED')
    expect(analyses[4]?.safeToPrune).toBe(false)

    // 6. Detached HEAD: DETACHED, safeToPrune: false
    expect(analyses[5]?.status).toBe('DETACHED')
    expect(analyses[5]?.safeToPrune).toBe(false)
  })
})

describe('cleanWorktrees', () => {
  const samplePorcelain = `
worktree /home/steffen/src/jolito
HEAD d811e646e469142e499d5c025f2143026fd2c88e
branch refs/heads/main

worktree /home/steffen/src/jolito-current
HEAD d811e646e469142e499d5c025f2143026fd2c88e
branch refs/heads/agy/current-task

worktree /home/steffen/src/jolito-merged-clean
HEAD 1111111111111111111111111111111111111111
branch refs/heads/agy/merged-clean

worktree /home/steffen/src/jolito-merged-dirty
HEAD 2222222222222222222222222222222222222222
branch refs/heads/agy/merged-dirty

worktree /home/steffen/src/jolito-unmerged
HEAD 3333333333333333333333333333333333333333
branch refs/heads/agy/unmerged
`

  const mockFs: FsOperations = {
    existsSync: () => true,
    realpathSync: (p) => p,
  }

  it('in dry-run mode, identifies safe-to-remove worktrees without executing git remove/prune', () => {
    const executedCommands: string[] = []
    const mockRunner: CommandRunner = (cmd, args) => {
      executedCommands.push(`${cmd} ${args.join(' ')}`)
      if (cmd === 'git') {
        if (args[0] === 'worktree' && args[1] === 'list') {
          return samplePorcelain
        }
        if (args.includes('--git-common-dir')) {
          return '/home/steffen/src/jolito/.git'
        }
        if (args.includes('--show-toplevel')) {
          return '/home/steffen/src/jolito-current'
        }
        if (args.includes('status')) {
          const wtPath = args[args.indexOf('-C') + 1]
          if (wtPath === '/home/steffen/src/jolito-merged-dirty') {
            return ' M dirty.ts\n'
          }
          return ''
        }
        if (args[0] === 'merge-base') {
          throw new Error('Not an ancestor')
        }
      }
      if (cmd === 'gh') {
        return JSON.stringify([
          { headRefName: 'agy/merged-clean' },
          { headRefName: 'agy/merged-dirty' },
        ])
      }
      return ''
    }

    const logMessages: string[] = []
    const result = cleanWorktrees({
      dryRun: true,
      force: false,
      runCmd: mockRunner,
      fsOps: mockFs,
      log: (msg) => logMessages.push(msg),
      cwd: '/home/steffen/src/jolito-current',
    })

    expect(result.removed).toEqual([
      {
        path: '/home/steffen/src/jolito-merged-clean',
        branch: 'agy/merged-clean',
      },
    ])
    expect(result.skipped).toEqual([
      {
        path: '/home/steffen/src/jolito-merged-dirty',
        branch: 'agy/merged-dirty',
        reason: 'Uncommitted changes present (use --force to remove)',
      },
    ])

    // Should NOT have run git worktree remove or git worktree prune
    const hasWorktreeRemove = executedCommands.some((c) =>
      c.includes('worktree remove'),
    )
    const hasWorktreePrune = executedCommands.some((c) =>
      c.includes('worktree prune'),
    )
    expect(hasWorktreeRemove).toBe(false)
    expect(hasWorktreePrune).toBe(false)

    expect(
      logMessages.some((m) =>
        m.includes(
          '[dry-run] Would remove worktree: /home/steffen/src/jolito-merged-clean',
        ),
      ),
    ).toBe(true)
  })

  it('removes clean merged worktrees and prunes metadata when not in dry-run', () => {
    const executedCommands: string[] = []
    const mockRunner: CommandRunner = (cmd, args) => {
      executedCommands.push(`${cmd} ${args.join(' ')}`)
      if (cmd === 'git') {
        if (args[0] === 'worktree' && args[1] === 'list') {
          return samplePorcelain
        }
        if (args.includes('--git-common-dir')) {
          return '/home/steffen/src/jolito/.git'
        }
        if (args.includes('--show-toplevel')) {
          return '/home/steffen/src/jolito-current'
        }
        if (args.includes('status')) {
          return ''
        }
        if (args[0] === 'merge-base') {
          throw new Error('Not an ancestor')
        }
      }
      if (cmd === 'gh') {
        return JSON.stringify([{ headRefName: 'agy/merged-clean' }])
      }
      return ''
    }

    const result = cleanWorktrees({
      dryRun: false,
      force: false,
      runCmd: mockRunner,
      fsOps: mockFs,
      log: () => {},
      cwd: '/home/steffen/src/jolito-current',
    })

    expect(result.removed).toHaveLength(1)
    expect(result.removed[0]?.path).toBe(
      '/home/steffen/src/jolito-merged-clean',
    )
    expect(result.pruned).toBe(true)

    expect(
      executedCommands.some((c) =>
        c.includes('git worktree remove /home/steffen/src/jolito-merged-clean'),
      ),
    ).toBe(true)
    expect(executedCommands.some((c) => c.includes('git worktree prune'))).toBe(
      true,
    )

    // NEVER remove main repository or current worktree
    expect(
      executedCommands.some((c) =>
        c.includes('worktree remove /home/steffen/src/jolito '),
      ),
    ).toBe(false)
    expect(
      executedCommands.some((c) =>
        c.includes('worktree remove /home/steffen/src/jolito-current'),
      ),
    ).toBe(false)
  })

  it('removes dirty worktrees with --force when requested', () => {
    const executedCommands: string[] = []
    const mockRunner: CommandRunner = (cmd, args) => {
      executedCommands.push(`${cmd} ${args.join(' ')}`)
      if (cmd === 'git') {
        if (args[0] === 'worktree' && args[1] === 'list') {
          return samplePorcelain
        }
        if (args.includes('--git-common-dir')) {
          return '/home/steffen/src/jolito/.git'
        }
        if (args.includes('--show-toplevel')) {
          return '/home/steffen/src/jolito-current'
        }
        if (args.includes('status')) {
          return ' M dirty.ts\n'
        }
        if (args[0] === 'merge-base') {
          throw new Error('Not an ancestor')
        }
      }
      if (cmd === 'gh') {
        return JSON.stringify([{ headRefName: 'agy/merged-dirty' }])
      }
      return ''
    }

    const result = cleanWorktrees({
      dryRun: false,
      force: true,
      runCmd: mockRunner,
      fsOps: mockFs,
      log: () => {},
      cwd: '/home/steffen/src/jolito-current',
    })

    expect(result.removed).toEqual([
      {
        path: '/home/steffen/src/jolito-merged-dirty',
        branch: 'agy/merged-dirty',
      },
    ])
    expect(
      executedCommands.some((c) =>
        c.includes(
          'git worktree remove --force /home/steffen/src/jolito-merged-dirty',
        ),
      ),
    ).toBe(true)
  })
})

describe('startWorktree', () => {
  it('validates task name and creates worktree with node_modules symlink', () => {
    const executedCommands: string[] = []
    const mockRunner: CommandRunner = (cmd, args) => {
      executedCommands.push(`${cmd} ${args.join(' ')}`)
      if (args.includes('--git-common-dir')) {
        return '/home/steffen/src/jolito/.git'
      }
      return ''
    }

    const createdSymlinks: Array<{ target: string; path: string }> = []
    const mockFs: FsOperations = {
      existsSync: (p: string) => {
        // main node_modules exists, but target worktree does not exist yet
        if (p === '/home/steffen/src/jolito/node_modules') return true
        return false
      },
      symlinkSync: (target: string, path: string) => {
        createdSymlinks.push({ target, path })
      },
    }

    const logMessages: string[] = []
    const result = startWorktree('my-feature', {
      runCmd: mockRunner,
      log: (m) => logMessages.push(m),
      fsOps: mockFs,
      cwd: '/home/steffen/src/jolito',
    })

    expect(result.path).toBe('/home/steffen/src/jolito-my-feature')
    expect(result.branch).toBe('agy/my-feature')
    expect(result.symlinkCreated).toBe(true)

    // Verifies fetch origin main
    expect(
      executedCommands.some((c) => c.includes('git fetch origin main')),
    ).toBe(true)
    // Verifies git worktree add
    expect(
      executedCommands.some((c) =>
        c.includes(
          'git worktree add -b agy/my-feature /home/steffen/src/jolito-my-feature origin/main',
        ),
      ),
    ).toBe(true)

    // Verifies node_modules symlink
    expect(createdSymlinks).toEqual([
      {
        target: '/home/steffen/src/jolito/node_modules',
        path: '/home/steffen/src/jolito-my-feature/node_modules',
      },
    ])
  })

  it('normalizes task name if prefixed with agy/', () => {
    const executedCommands: string[] = []
    const mockRunner: CommandRunner = (cmd, args) => {
      executedCommands.push(`${cmd} ${args.join(' ')}`)
      if (args.includes('--git-common-dir')) {
        return '/home/steffen/src/jolito/.git'
      }
      return ''
    }

    const mockFs: FsOperations = {
      existsSync: () => false,
      symlinkSync: () => {},
    }

    const result = startWorktree('agy/quick-fix', {
      runCmd: mockRunner,
      log: () => {},
      fsOps: mockFs,
      cwd: '/home/steffen/src/jolito',
    })

    expect(result.branch).toBe('agy/quick-fix')
    expect(result.path).toBe('/home/steffen/src/jolito-quick-fix')
  })

  it('rejects invalid or empty task names', () => {
    expect(() => startWorktree('')).toThrow(/Task name is required/)
    expect(() => startWorktree('   ')).toThrow(/Task name is required/)
    expect(() => startWorktree('invalid task name with spaces')).toThrow(
      /Invalid task name/,
    )
  })

  it('rejects if target worktree path already exists on disk', () => {
    const mockRunner: CommandRunner = (_cmd, args) => {
      if (args.includes('--git-common-dir')) {
        return '/home/steffen/src/jolito/.git'
      }
      return ''
    }

    const mockFs: FsOperations = {
      existsSync: (p: string) => p === '/home/steffen/src/jolito-existing-task',
      symlinkSync: () => {},
    }

    expect(() =>
      startWorktree('existing-task', {
        runCmd: mockRunner,
        fsOps: mockFs,
        cwd: '/home/steffen/src/jolito',
      }),
    ).toThrow(/Target worktree directory already exists/)
  })
})

describe('listWorktrees', () => {
  it('calls logTable with formatted table data and logs summary', () => {
    const samplePorcelain = `
worktree /home/steffen/src/jolito
HEAD d811e646e469142e499d5c025f2143026fd2c88e
branch refs/heads/main

worktree /home/steffen/src/jolito-merged
HEAD 1111111111111111111111111111111111111111
branch refs/heads/agy/merged
`
    const mockRunner: CommandRunner = (cmd, args) => {
      if (cmd === 'git') {
        if (args[0] === 'worktree' && args[1] === 'list') {
          return samplePorcelain
        }
        if (args.includes('--git-common-dir')) {
          return '/home/steffen/src/jolito/.git'
        }
        if (args.includes('--show-toplevel')) {
          return '/home/steffen/src/jolito'
        }
        if (args.includes('status')) {
          return ''
        }
      }
      if (cmd === 'gh') {
        return JSON.stringify([{ headRefName: 'agy/merged' }])
      }
      return ''
    }

    const tableLogged: unknown[] = []
    const messages: string[] = []

    const analyses = listWorktrees({
      runCmd: mockRunner,
      logTable: (data) => tableLogged.push(...data),
      log: (msg) => messages.push(msg),
      cwd: '/home/steffen/src/jolito',
    })

    expect(analyses).toHaveLength(2)
    expect(tableLogged).toEqual([
      {
        Path: '/home/steffen/src/jolito',
        Branch: 'main',
        Status: 'ACTIVE',
        'Safe to Prune': 'No',
      },
      {
        Path: '/home/steffen/src/jolito-merged',
        Branch: 'agy/merged',
        Status: 'MERGED',
        'Safe to Prune': 'Yes',
      },
    ])
    expect(
      messages.some((m) =>
        m.includes('Total: 2 worktree(s), 1 safe to prune.'),
      ),
    ).toBe(true)
  })
})

describe('main CLI', () => {
  it('prints help message when --help is passed', () => {
    const logs: string[] = []
    let exitCode: number | undefined
    main(['--help'], {
      log: (m) => logs.push(m),
      exit: (code) => {
        exitCode = code
      },
    })
    expect(exitCode).toBeUndefined()
    expect(logs.some((l) => l.includes('Usage: agent-worktree'))).toBe(true)
  })

  it('prints help and exits with 1 when no command is passed', () => {
    const logs: string[] = []
    let exitCode: number | undefined
    main([], {
      log: (m) => logs.push(m),
      exit: (code) => {
        exitCode = code
      },
    })
    expect(exitCode).toBe(1)
    expect(logs.some((l) => l.includes('Usage: agent-worktree'))).toBe(true)
  })

  it('reports error and exits with 1 on unknown command', () => {
    const errors: string[] = []
    let exitCode: number | undefined
    main(['foobar'], {
      error: (m) => errors.push(m),
      exit: (code) => {
        exitCode = code
      },
    })
    expect(exitCode).toBe(1)
    expect(errors.some((e) => e.includes('Unknown command: "foobar"'))).toBe(
      true,
    )
  })

  it('reports error and exits with 1 when start command lacks task name', () => {
    const errors: string[] = []
    let exitCode: number | undefined
    main(['start'], {
      error: (m) => errors.push(m),
      exit: (code) => {
        exitCode = code
      },
    })
    expect(exitCode).toBe(1)
    expect(errors.some((e) => e.includes('Task name is required'))).toBe(true)
  })
})
