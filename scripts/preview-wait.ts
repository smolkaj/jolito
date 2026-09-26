import { execSync } from 'node:child_process'
import process from 'node:process'
import { setTimeout as nodeSetTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const DEFAULT_PREVIEW_DOMAIN_SUFFIX = 'jolito.smolkaj.workers.dev'
export const MAX_SUBDOMAIN_LABEL_LENGTH = 63 // RFC 1035 max DNS label length
// Suffix is '-jolito' (7 chars), so prefix is capped at 56 chars
export const MAX_BRANCH_PREFIX_LENGTH = 56

/**
 * Normalizes a git branch name into a valid Cloudflare preview subdomain prefix:
 * - Lowercases characters
 * - Replaces '/' and '_' with '-'
 * - Strips non-alphanumeric characters (except '-')
 * - Collapses consecutive hyphens and trims leading/trailing hyphens
 * - Truncates to ensure the combined DNS label does not exceed 63 characters
 */
export function normalizeBranchName(branch: string): string {
  if (!branch || typeof branch !== 'string' || !branch.trim()) {
    throw new Error('Branch name cannot be empty')
  }

  let normalized = branch
    .trim()
    .toLowerCase()
    .replace(/[/_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!normalized) {
    throw new Error(
      `Branch name "${branch}" cannot be normalized to a valid subdomain`,
    )
  }

  if (normalized.length > MAX_BRANCH_PREFIX_LENGTH) {
    normalized = normalized
      .slice(0, MAX_BRANCH_PREFIX_LENGTH)
      .replace(/-+$/, '')
  }

  return normalized
}

/**
 * Retrieves the current git branch name from environment variables or `git rev-parse`.
 */
export function getCurrentGitBranch(): string {
  const envBranch =
    process.env.BRANCH_NAME ||
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME
  if (envBranch && envBranch.trim()) {
    return envBranch.trim()
  }

  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (branch && branch !== 'HEAD') {
      return branch
    }
  } catch {
    // Handled by downstream error
  }

  throw new Error(
    'Unable to determine current git branch. Pass a branch name or URL as an argument.',
  )
}

/**
 * Resolves a preview URL from an explicit branch name or URL, or falls back to current git branch.
 */
export function resolvePreviewUrl(
  input?: string,
  domainSuffix = DEFAULT_PREVIEW_DOMAIN_SUFFIX,
): string {
  const target = input?.trim() || getCurrentGitBranch()

  if (target.startsWith('http://') || target.startsWith('https://')) {
    const url = new URL(target)
    return url.toString().replace(/\/$/, '')
  }

  if (target.includes('.')) {
    return `https://${target.replace(/\/$/, '')}`
  }

  const normalized = normalizeBranchName(target)
  return `https://${normalized}-${domainSuffix}`
}

/**
 * Validates that the HTTP response body contains genuine Jolito application HTML
 * rather than a Cloudflare gateway error page (e.g. 522/520) or DNS fallback.
 */
export function isValidAppHtml(html: string): boolean {
  if (!html || typeof html !== 'string') {
    return false
  }

  const lower = html.toLowerCase()
  if (
    lower.includes('cloudflare ray id') ||
    lower.includes('error 520') ||
    lower.includes('error 521') ||
    lower.includes('error 522') ||
    lower.includes('error 523') ||
    lower.includes('error 524') ||
    lower.includes('error 525') ||
    lower.includes('error 526') ||
    lower.includes('522 connection timed out') ||
    lower.includes('520 web server is returning an unknown error')
  ) {
    return false
  }

  const hasRootDiv = /<div\s+[^>]*id=["']root["']/i.test(html)
  const hasAppTitle = /<title>[^<]*jolito/i.test(html)
  const hasAppEntrypoint =
    /<script[^>]+src=["'][^"']*(?:main\.tsx|assets\/index-[^"']+\.js)["']/i.test(
      html,
    ) || /<script[^>]+type=["']module["']/i.test(html)

  return hasRootDiv || (hasAppTitle && hasAppEntrypoint)
}

export interface HealthCheckResult {
  ok: boolean
  status?: number | undefined
  error?: string | undefined
}

/**
 * Performs a single health check probe against the target URL.
 */
export async function checkPreviewHealth(
  url: string,
  options: { fetchTimeoutMs?: number; fetchFn?: typeof fetch } = {},
): Promise<HealthCheckResult> {
  const fetchTimeoutMs = options.fetchTimeoutMs ?? 10_000
  const fetchFn = options.fetchFn ?? fetch

  try {
    const res = await fetchFn(url, {
      signal: AbortSignal.timeout(fetchTimeoutMs),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'jolito-preview-health-checker/1.0',
      },
    })

    if (res.status !== 200) {
      return {
        ok: false,
        status: res.status,
        error: `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`,
      }
    }

    const text = await res.text()
    if (!isValidAppHtml(text)) {
      return {
        ok: false,
        status: res.status,
        error:
          'HTTP 200 received but response is not valid Jolito application HTML',
      }
    }

    return {
      ok: true,
      status: 200,
    }
  } catch (err) {
    const errorMsg =
      err instanceof Error
        ? err.name === 'TimeoutError'
          ? `Request timed out after ${fetchTimeoutMs}ms`
          : err.message
        : String(err)
    return {
      ok: false,
      error: errorMsg,
    }
  }
}

export interface WaitForPreviewProgress {
  elapsedMs: number
  attempt: number
  lastError?: string | undefined
  lastStatus?: number | undefined
}

export interface WaitForPreviewOptions {
  url: string
  timeoutMs?: number
  initialIntervalMs?: number
  maxIntervalMs?: number
  backoffFactor?: number
  fetchTimeoutMs?: number
  fetchFn?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  onProgress?: (progress: WaitForPreviewProgress) => void
}

export interface WaitForPreviewResult {
  success: boolean
  elapsedMs: number
  totalAttempts: number
  error?: string | undefined
}

/**
 * Polls the preview URL with exponential backoff until healthy or timed out.
 */
export async function waitForPreview(
  options: WaitForPreviewOptions,
): Promise<WaitForPreviewResult> {
  const {
    url,
    timeoutMs = 180_000,
    initialIntervalMs = 3_000,
    maxIntervalMs = 10_000,
    backoffFactor = 1.5,
    fetchTimeoutMs = 10_000,
    fetchFn = fetch,
    sleep = nodeSetTimeout,
    now = Date.now,
    onProgress,
  } = options

  const startTime = now()
  let interval = initialIntervalMs
  let attempt = 1
  let lastResult: HealthCheckResult | undefined

  while (true) {
    const health = await checkPreviewHealth(url, {
      fetchTimeoutMs,
      fetchFn,
    })
    lastResult = health

    const elapsed = now() - startTime

    if (health.ok) {
      return {
        success: true,
        elapsedMs: elapsed,
        totalAttempts: attempt,
      }
    }

    onProgress?.({
      elapsedMs: elapsed,
      attempt,
      lastError: health.error,
      lastStatus: health.status,
    })

    if (elapsed >= timeoutMs) {
      break
    }

    const remaining = timeoutMs - elapsed
    const sleepTime = Math.min(interval, remaining)
    if (sleepTime <= 0) {
      break
    }

    await sleep(sleepTime)
    interval = Math.min(Math.round(interval * backoffFactor), maxIntervalMs)
    attempt++
  }

  const finalElapsed = now() - startTime
  const lastDiag =
    lastResult?.error ??
    (lastResult?.status ? `HTTP ${lastResult.status}` : 'Unknown error')
  return {
    success: false,
    elapsedMs: finalElapsed,
    totalAttempts: attempt,
    error: `Timed out after ${(timeoutMs / 1000).toFixed(0)}s waiting for ${url} (last diagnostic: ${lastDiag})`,
  }
}

export interface ParsedCliArgs {
  target?: string | undefined
  timeoutSeconds: number
  help: boolean
}

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  let target: string | undefined
  let timeoutSeconds = 180
  let help = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg) continue
    if (arg === '--help' || arg === '-h') {
      help = true
    } else if (arg === '--timeout' || arg === '-t') {
      const next = argv[++i]
      if (!next || isNaN(Number(next)) || Number(next) <= 0) {
        throw new Error(`Invalid value for --timeout: ${next ?? ''}`)
      }
      timeoutSeconds = Number(next)
    } else if (arg.startsWith('--timeout=')) {
      const val = arg.slice('--timeout='.length)
      if (!val || isNaN(Number(val)) || Number(val) <= 0) {
        throw new Error(`Invalid value for --timeout: ${val}`)
      }
      timeoutSeconds = Number(val)
    } else if (!arg.startsWith('-')) {
      if (!target) {
        target = arg
      }
    }
  }

  return { target, timeoutSeconds, help }
}

export function printHelp(): void {
  console.log(`
Usage: node scripts/preview-wait.ts [branch-or-url] [options]

Waits for a Cloudflare preview deployment to become healthy (HTTP 200 + valid application HTML).

Arguments:
  [branch-or-url]       Git branch name (normalized to Cloudflare preview subdomain)
                        or explicit preview URL. Defaults to current git branch.

Options:
  -t, --timeout <sec>   Maximum seconds to wait before failing (default: 180)
  -h, --help            Show this help message
`)
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const { target, timeoutSeconds, help } = parseCliArgs(argv)

  if (help) {
    printHelp()
    return
  }

  const targetUrl = resolvePreviewUrl(target)
  console.log(
    `Waiting for Cloudflare preview at ${targetUrl} (timeout: ${timeoutSeconds}s)...`,
  )

  const result = await waitForPreview({
    url: targetUrl,
    timeoutMs: timeoutSeconds * 1000,
    onProgress: ({ elapsedMs, lastError }) => {
      const elapsedSec = Math.round(elapsedMs / 1000)
      const detail = lastError ? `, ${lastError}` : ''
      console.log(
        `Waiting for ${targetUrl} (elapsed ${elapsedSec}s${detail})...`,
      )
    },
  })

  if (result.success) {
    const readySec = (result.elapsedMs / 1000).toFixed(1)
    console.log(`✔ Preview ready at ${targetUrl} (${readySec}s elapsed)`)
  } else {
    console.error(`✖ ${result.error}`)
    process.exit(1)
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
}
