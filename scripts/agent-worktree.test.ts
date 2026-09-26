import { describe, expect, it } from 'vitest'
import {
  analyzeWorktrees,
  checkUncommittedChanges,
  cleanWorktrees,
  getMergedBranchData,
  isBranchMerged,
  listWorktrees,
  main,
  parseTaskInput,
  parseWorktreePorcelain,
  startWorktree,
  type CommandRunner,
  type FsOperations,
  type MergedBranchData,
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

describe('getMergedBranchData', () => {
  it('aggregates branches and head commit OIDs from git and gh', () => {
    const mockRunner: CommandRunner = (cmd, args) => {
      if (cmd === 'git' && args.includes('-r')) {
        return '  origin/merged-remote-1\n  origin/main\n  origin/HEAD -> origin/main\n'
      }
      if (cmd === 'git' && args.includes('--merged')) {
        return '* main\n  merged-local-1\n'
      }
      if (cmd === 'gh') {
        return JSON.stringify([
          { headRefName: 'agy/merged-pr-1', headRefOid: 'sha-pr-1' },
          { headRefName: 'agy/merged-pr-2', headRefOid: 'sha-pr-2' },
        ])
      }
      return ''
    }

    const { gitMerged, prMerged } = getMergedBranchData(mockRunner)
    expect(gitMerged.has('merged-remote-1')).toBe(true)
    expect(gitMerged.has('merged-local-1')).toBe(true)
    expect(prMerged.get('agy/merged-pr-1')).toEqual(['sha-pr-1'])
    expect(prMerged.get('agy/merged-pr-2')).toEqual(['sha-pr-2'])
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

    const { gitMerged, prMerged } = getMergedBranchData(mockRunner)
    expect(gitMerged.has('remote-merged')).toBe(true)
    expect(prMerged.size).toBe(0)
  })
})

describe('isBranchMerged', () => {
  const mergedData: MergedBranchData = {
    gitMerged: new Set(['branch-git']),
    prMerged: new Map([['agy/pr-branch', ['sha-pr-commit']]]),
  }

  it('returns true when head commit matches the merged PR headRefOid', () => {
    const mockRunner: CommandRunner = () => {
      throw new Error('Not an ancestor')
    }
    expect(
      isBranchMerged('agy/pr-branch', 'sha-pr-commit', mergedData, mockRunner),
    ).toBe(true)
  })

  it('returns false when branch was merged in a PR but local worktree has new unmerged commits', () => {
    const mockRunner: CommandRunner = (_cmd, args) => {
      if (args[0] === 'merge-base') {
        throw new Error('Not ancestor')
      }
      if (args[0] === 'rev-list') {
        return 'commit-new-unpushed-1\n' // Indicates new commits!
      }
      return ''
    }
    expect(
      isBranchMerged(
        'agy/pr-branch',
        'sha-new-local-commit',
        mergedData,
        mockRunner,
      ),
    ).toBe(false)
  })

  it('returns true if branch commit is an ancestor of origin/main', () => {
    const mockRunner: CommandRunner = (_cmd, args) => {
      if (args.includes('sha-ancestor')) {
        return '' // Exits 0
      }
      throw new Error('not ancestor')
    }

    expect(
      isBranchMerged('random-branch', 'sha-ancestor', mergedData, mockRunner),
    ).toBe(true)
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

describe('parseTaskInput', () => {
  it('parses bare task name defaulting to agy agent', () => {
    const parsed = parseTaskInput('my-task')
    expect(parsed).toEqual({
      agent: 'agy',
      taskName: 'my-task',
      branch: 'agy/my-task',
    })
  })

  it('parses explicit agent/task format', () => {
    const parsed = parseTaskInput('codex/debt-clean')
    expect(parsed).toEqual({
      agent: 'codex',
      taskName: 'debt-clean',
      branch: 'codex/debt-clean',
    })
  })

  it('rejects invalid characters', () => {
    expect(() => parseTaskInput('bad task name')).toThrow(/Invalid task name/)
    expect(() => parseTaskInput('bad/agent/extra')).toThrow(
      /Invalid task format/,
    )
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

  it('accurately classifies status, safeToPrune, and agent for each worktree', () => {
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

    const mergedData: MergedBranchData = {
      gitMerged: new Set(),
      prMerged: new Map([
        ['agy/merged-clean', ['1111111111111111111111111111111111111111']],
        ['agy/merged-dirty', ['2222222222222222222222222222222222222222']],
      ]),
    }

    const analyses = analyzeWorktrees({
      runCmd: mockRunner,
      fsOps: mockFs,
      mergedData,
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
    expect(analyses[2]?.agent).toBe('agy')

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

worktree /home/steffen/src/jolito-other-agent
HEAD 2222222222222222222222222222222222222222
branch refs/heads/codex/merged-codex

worktree /home/steffen/src/jolito-merged-dirty
HEAD 3333333333333333333333333333333333333333
branch refs/heads/agy/merged-dirty
`

  const mockFs: FsOperations = {
    existsSync: () => true,
    realpathSync: (p) => p,
  }

  const mergedData: MergedBranchData = {
    gitMerged: new Set(),
    prMerged: new Map([
      ['agy/merged-clean', ['1111111111111111111111111111111111111111']],
      ['codex/merged-codex', ['2222222222222222222222222222222222222222']],
      ['agy/merged-dirty', ['3333333333333333333333333333333333333333']],
    ]),
  }

  it('respects multi-agent boundaries: skips other agents worktrees unless --all is passed', () => {
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
      return ''
    }

    const logMessages: string[] = []
    const result = cleanWorktrees({
      dryRun: false,
      force: false,
      agent: 'agy',
      all: false,
      runCmd: mockRunner,
      fsOps: mockFs,
      mergedData,
      log: (msg) => logMessages.push(msg),
      cwd: '/home/steffen/src/jolito-current',
    })

    // agy/merged-clean is removed
    expect(result.removed).toEqual([
      {
        path: '/home/steffen/src/jolito-merged-clean',
        branch: 'agy/merged-clean',
      },
    ])
    // codex/merged-codex is skipped because it belongs to another agent!
    expect(
      result.skipped.some((s) => s.reason.includes('Belongs to agent "codex"')),
    ).toBe(true)
    expect(
      executedCommands.some((c) =>
        c.includes('worktree remove /home/steffen/src/jolito-other-agent'),
      ),
    ).toBe(false)
  })

  it('cleans other agent worktrees when --all is passed', () => {
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
      return ''
    }

    const result = cleanWorktrees({
      dryRun: false,
      force: false,
      all: true,
      runCmd: mockRunner,
      fsOps: mockFs,
      mergedData,
      log: () => {},
      cwd: '/home/steffen/src/jolito-current',
    })

    expect(result.removed).toEqual([
      {
        path: '/home/steffen/src/jolito-merged-clean',
        branch: 'agy/merged-clean',
      },
      {
        path: '/home/steffen/src/jolito-other-agent',
        branch: 'codex/merged-codex',
      },
      {
        path: '/home/steffen/src/jolito-merged-dirty',
        branch: 'agy/merged-dirty',
      },
    ])
  })

  it('deletes local branch ref when worktree is removed', () => {
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
      return ''
    }

    cleanWorktrees({
      dryRun: false,
      agent: 'agy',
      runCmd: mockRunner,
      fsOps: mockFs,
      mergedData,
      log: () => {},
      cwd: '/home/steffen/src/jolito-current',
    })

    expect(
      executedCommands.some((c) =>
        c.includes('git branch -d agy/merged-clean'),
      ),
    ).toBe(true)
  })

  it('falls back to git branch -D when squash-merged branch deletion is rejected by git branch -d', () => {
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
        if (args[0] === 'branch' && args[1] === '-d') {
          throw new Error('error: The branch is not fully merged')
        }
      }
      return ''
    }

    const logMessages: string[] = []
    cleanWorktrees({
      dryRun: false,
      agent: 'agy',
      runCmd: mockRunner,
      fsOps: mockFs,
      mergedData,
      log: (msg) => logMessages.push(msg),
      cwd: '/home/steffen/src/jolito-current',
    })

    // git branch -d was attempted first
    expect(
      executedCommands.some((c) =>
        c.includes('git branch -d agy/merged-clean'),
      ),
    ).toBe(true)
    // and then git branch -D was successfully executed
    expect(
      executedCommands.some((c) =>
        c.includes('git branch -D agy/merged-clean'),
      ),
    ).toBe(true)
    expect(
      logMessages.some((m) =>
        m.includes('Deleted squash-merged local branch: agy/merged-clean'),
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
      if (args.includes('--verify')) {
        throw new Error('Branch does not exist')
      }
      return ''
    }

    const createdSymlinks: Array<{ target: string; path: string }> = []
    const mockFs: FsOperations = {
      existsSync: (p: string) => {
        if (p === '/home/steffen/src/jolito/node_modules') return true
        return false
      },
      symlinkSync: (target: string, path: string) => {
        createdSymlinks.push({ target, path })
      },
    }

    const result = startWorktree('my-feature', {
      runCmd: mockRunner,
      log: () => {},
      fsOps: mockFs,
      cwd: '/home/steffen/src/jolito',
    })

    expect(result.path).toBe('/home/steffen/src/jolito-my-feature')
    expect(result.branch).toBe('agy/my-feature')
    expect(result.symlinkCreated).toBe(true)

    expect(
      executedCommands.some((c) => c.includes('git fetch origin main')),
    ).toBe(true)
    expect(
      executedCommands.some((c) =>
        c.includes(
          'git worktree add -b agy/my-feature /home/steffen/src/jolito-my-feature origin/main',
        ),
      ),
    ).toBe(true)
  })

  it('supports explicit agent prefix in task name', () => {
    const executedCommands: string[] = []
    const mockRunner: CommandRunner = (cmd, args) => {
      executedCommands.push(`${cmd} ${args.join(' ')}`)
      if (args.includes('--git-common-dir')) {
        return '/home/steffen/src/jolito/.git'
      }
      if (args.includes('--verify')) {
        throw new Error('Branch does not exist')
      }
      return ''
    }

    const mockFs: FsOperations = {
      existsSync: () => false,
      symlinkSync: () => {},
    }

    const result = startWorktree('codex/quick-fix', {
      runCmd: mockRunner,
      log: () => {},
      fsOps: mockFs,
      cwd: '/home/steffen/src/jolito',
    })

    expect(result.branch).toBe('codex/quick-fix')
    expect(result.path).toBe('/home/steffen/src/jolito-quick-fix')
  })

  it('rejects if local branch already exists', () => {
    const mockRunner: CommandRunner = (_cmd, args) => {
      if (args.includes('--verify')) {
        return 'commit-hash' // Branch exists!
      }
      return ''
    }

    const mockFs: FsOperations = {
      existsSync: () => false,
      symlinkSync: () => {},
    }

    expect(() =>
      startWorktree('existing-branch', {
        runCmd: mockRunner,
        fsOps: mockFs,
        cwd: '/home/steffen/src/jolito',
      }),
    ).toThrow(/already exists locally/)
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
        return JSON.stringify([
          {
            headRefName: 'agy/merged',
            headRefOid: '1111111111111111111111111111111111111111',
          },
        ])
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
