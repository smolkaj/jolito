import { describe, expect, it, vi } from 'vitest'
import {
  checkPreviewHealth,
  isValidAppHtml,
  normalizeBranchName,
  parseCliArgs,
  printHelp,
  resolvePreviewUrl,
  waitForPreview,
} from './preview-wait'

describe('normalizeBranchName', () => {
  it('converts slashes and underscores to hyphens and lowercases', () => {
    expect(normalizeBranchName('agy/preview-wait')).toBe('agy-preview-wait')
    expect(normalizeBranchName('AGY_Feature_Branch')).toBe('agy-feature-branch')
    expect(normalizeBranchName('codex/fix_bug_123')).toBe('codex-fix-bug-123')
  })

  it('collapses multiple hyphens and trims leading/trailing hyphens', () => {
    expect(normalizeBranchName('---feat---test---')).toBe('feat-test')
    expect(normalizeBranchName('feat//sub__dir')).toBe('feat-sub-dir')
  })

  it('strips characters not allowed in DNS subdomains', () => {
    expect(normalizeBranchName('branch#name!@$%^&*()')).toBe('branchname')
    expect(normalizeBranchName('user.name/branch')).toBe('username-branch')
  })

  it('truncates branch prefix to 56 characters so prefix-jolito is within 63 char DNS limit', () => {
    const longBranch = 'a'.repeat(80)
    const normalized = normalizeBranchName(longBranch)
    expect(normalized).toHaveLength(56)
    expect(`${normalized}-jolito`).toHaveLength(63)
  })

  it('strips trailing hyphens resulting from truncation', () => {
    const longBranch = `${'a'.repeat(55)}-${'b'.repeat(20)}`
    const normalized = normalizeBranchName(longBranch)
    expect(normalized).toBe('a'.repeat(55))
    expect(normalized.endsWith('-')).toBe(false)
  })

  it('throws on empty or non-normalizable branch names', () => {
    expect(() => normalizeBranchName('')).toThrow('Branch name cannot be empty')
    expect(() => normalizeBranchName('   ')).toThrow(
      'Branch name cannot be empty',
    )
    expect(() => normalizeBranchName('!@#$%^')).toThrow(
      'cannot be normalized to a valid subdomain',
    )
  })
})

describe('resolvePreviewUrl', () => {
  it('constructs workers.dev URL from branch name', () => {
    expect(resolvePreviewUrl('agy/preview-wait')).toBe(
      'https://agy-preview-wait-jolito.smolkaj.workers.dev',
    )
  })

  it('preserves fully qualified https and http URLs', () => {
    expect(
      resolvePreviewUrl('https://custom-preview.smolkaj.workers.dev/'),
    ).toBe('https://custom-preview.smolkaj.workers.dev')
    expect(resolvePreviewUrl('http://localhost:3000/')).toBe(
      'http://localhost:3000',
    )
  })

  it('prepends https to bare domain strings', () => {
    expect(
      resolvePreviewUrl('agy-preview-wait-jolito.smolkaj.workers.dev'),
    ).toBe('https://agy-preview-wait-jolito.smolkaj.workers.dev')
  })

  it('derives from environment variable when input omitted', () => {
    const prevBranch = process.env.BRANCH_NAME
    try {
      process.env.BRANCH_NAME = 'feature/env-branch'
      expect(resolvePreviewUrl()).toBe(
        'https://feature-env-branch-jolito.smolkaj.workers.dev',
      )
    } finally {
      if (prevBranch !== undefined) {
        process.env.BRANCH_NAME = prevBranch
      } else {
        delete process.env.BRANCH_NAME
      }
    }
  })
})

describe('isValidAppHtml', () => {
  it('returns true for HTML with root div', () => {
    expect(
      isValidAppHtml(
        '<!doctype html><html><body><div id="root"></div></body></html>',
      ),
    ).toBe(true)
    expect(
      isValidAppHtml(
        '<div class="app-shell" id=\'root\'><span>Loaded</span></div>',
      ),
    ).toBe(true)
  })

  it('returns true for HTML with Jolito title and script entrypoint', () => {
    const html = `
      <!doctype html>
      <html>
        <head><title>Jolito — Mexican Spanish that sticks</title></head>
        <body><script type="module" src="/src/main.tsx"></script></body>
      </html>
    `
    expect(isValidAppHtml(html)).toBe(true)
  })

  it('returns false for Cloudflare 522/520 error pages', () => {
    const cf522 = `
      <!DOCTYPE html>
      <html>
        <head><title>522: Connection timed out</title></head>
        <body>
          <h1>Error 522</h1>
          <p>Cloudflare Ray ID: 8c1234567890abcd</p>
        </body>
      </html>
    `
    expect(isValidAppHtml(cf522)).toBe(false)

    const cf520 = `
      <!DOCTYPE html>
      <html>
        <head><title>520: Web server is returning an unknown error</title></head>
        <body><p>Cloudflare Ray ID: 12345</p></body>
      </html>
    `
    expect(isValidAppHtml(cf520)).toBe(false)
  })

  it('returns false for empty or non-app markup', () => {
    expect(isValidAppHtml('')).toBe(false)
    expect(isValidAppHtml('<html><body>Hello World</body></html>')).toBe(false)
    expect(isValidAppHtml('404 Not Found')).toBe(false)
  })
})

describe('checkPreviewHealth', () => {
  it('returns ok: true on HTTP 200 with valid application HTML', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        '<!doctype html><html><body><div id="root"></div></body></html>',
        {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'text/html' },
        },
      ),
    )

    const result = await checkPreviewHealth('https://preview.workers.dev', {
      fetchFn: mockFetch,
    })

    expect(result).toEqual({ ok: true, status: 200 })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs?.[0]).toBe('https://preview.workers.dev')
  })

  it('returns ok: false on HTTP 522 status', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('Error 522', {
        status: 522,
        statusText: 'Connection timed out',
      }),
    )

    const result = await checkPreviewHealth('https://preview.workers.dev', {
      fetchFn: mockFetch,
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(522)
    expect(result.error).toBe('HTTP 522 Connection timed out')
  })

  it('returns ok: false on HTTP 200 with invalid HTML', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html><body>Under construction</body></html>', {
        status: 200,
        statusText: 'OK',
      }),
    )

    const result = await checkPreviewHealth('https://preview.workers.dev', {
      fetchFn: mockFetch,
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(200)
    expect(result.error).toContain(
      'HTTP 200 received but response is not valid Jolito application HTML',
    )
  })

  it('catches network fetch errors', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('getaddrinfo ENOTFOUND preview.workers.dev'))

    const result = await checkPreviewHealth('https://preview.workers.dev', {
      fetchFn: mockFetch,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('ENOTFOUND')
  })
})

describe('waitForPreview', () => {
  it('resolves immediately when first attempt succeeds', async () => {
    const nowTime = 1000
    const now = () => nowTime
    const sleep = vi.fn(() => Promise.resolve())

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<div id="root"></div>', {
        status: 200,
        statusText: 'OK',
      }),
    )

    const result = await waitForPreview({
      url: 'https://preview.workers.dev',
      fetchFn: mockFetch,
      sleep,
      now,
    })

    expect(result.success).toBe(true)
    expect(result.totalAttempts).toBe(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('retries with exponential backoff and succeeds on subsequent attempt', async () => {
    let nowTime = 0
    const now = () => nowTime
    const sleeps: number[] = []
    const sleep = vi.fn((ms: number) => {
      sleeps.push(ms)
      nowTime += ms
      return Promise.resolve()
    })

    let attemptCount = 0
    const mockFetch = vi.fn<typeof fetch>(() => {
      attemptCount++
      if (attemptCount < 3) {
        return Promise.resolve(
          new Response('Error 522', {
            status: 522,
            statusText: 'Connection timed out',
          }),
        )
      }
      return Promise.resolve(
        new Response('<div id="root"></div>', {
          status: 200,
          statusText: 'OK',
        }),
      )
    })

    const onProgress = vi.fn()

    const result = await waitForPreview({
      url: 'https://preview.workers.dev',
      timeoutMs: 30_000,
      initialIntervalMs: 3_000,
      maxIntervalMs: 10_000,
      backoffFactor: 1.5,
      fetchFn: mockFetch,
      sleep,
      now,
      onProgress,
    })

    expect(result.success).toBe(true)
    expect(result.totalAttempts).toBe(3)
    // First backoff is 3000ms, second is 4500ms
    expect(sleeps).toEqual([3000, 4500])
    expect(onProgress).toHaveBeenCalledTimes(2)
  })

  it('caps backoff interval at maxIntervalMs', async () => {
    let nowTime = 0
    const now = () => nowTime
    const sleeps: number[] = []
    const sleep = vi.fn((ms: number) => {
      sleeps.push(ms)
      nowTime += ms
      return Promise.resolve()
    })

    let attemptCount = 0
    const mockFetch = vi.fn<typeof fetch>(() => {
      attemptCount++
      if (attemptCount <= 5) {
        return Promise.resolve(
          new Response('Waiting...', {
            status: 503,
          }),
        )
      }
      return Promise.resolve(
        new Response('<div id="root"></div>', {
          status: 200,
        }),
      )
    })

    const result = await waitForPreview({
      url: 'https://preview.workers.dev',
      timeoutMs: 60_000,
      initialIntervalMs: 3_000,
      maxIntervalMs: 5_000,
      backoffFactor: 2.0,
      fetchFn: mockFetch,
      sleep,
      now,
    })

    expect(result.success).toBe(true)
    expect(result.totalAttempts).toBe(6)
    // 3000 -> 5000 (capped from 6000) -> 5000 -> 5000 -> 5000
    expect(sleeps).toEqual([3000, 5000, 5000, 5000, 5000])
  })

  it('fails with timeout error when max duration exceeded', async () => {
    let nowTime = 0
    const now = () => nowTime
    const sleep = vi.fn((ms: number) => {
      nowTime += ms
      return Promise.resolve()
    })

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('Error 520', {
        status: 520,
        statusText: 'Unknown Error',
      }),
    )

    const result = await waitForPreview({
      url: 'https://preview.workers.dev',
      timeoutMs: 10_000,
      initialIntervalMs: 3_000,
      maxIntervalMs: 10_000,
      backoffFactor: 1.5,
      fetchFn: mockFetch,
      sleep,
      now,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Timed out after 10s')
    expect(result.error).toContain('HTTP 520 Unknown Error')
  })
})

describe('parseCliArgs', () => {
  it('parses target and default timeout', () => {
    const { target, timeoutSeconds, help } = parseCliArgs(['agy/preview-wait'])
    expect(target).toBe('agy/preview-wait')
    expect(timeoutSeconds).toBe(180)
    expect(help).toBe(false)
  })

  it('parses --timeout and -t flags', () => {
    expect(parseCliArgs(['--timeout', '60']).timeoutSeconds).toBe(60)
    expect(parseCliArgs(['-t', '45']).timeoutSeconds).toBe(45)
    expect(parseCliArgs(['--timeout=90']).timeoutSeconds).toBe(90)
  })

  it('parses help flag', () => {
    expect(parseCliArgs(['--help']).help).toBe(true)
    expect(parseCliArgs(['-h']).help).toBe(true)
  })

  it('throws on invalid timeout values', () => {
    expect(() => parseCliArgs(['--timeout', 'abc'])).toThrow(
      'Invalid value for --timeout',
    )
    expect(() => parseCliArgs(['--timeout', '-10'])).toThrow(
      'Invalid value for --timeout',
    )
    expect(() => parseCliArgs(['--timeout=foo'])).toThrow(
      'Invalid value for --timeout',
    )
  })
})

describe('printHelp', () => {
  it('prints usage information without throwing', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printHelp()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Usage: node scripts/preview-wait.ts'),
    )
    consoleSpy.mockRestore()
  })
})
