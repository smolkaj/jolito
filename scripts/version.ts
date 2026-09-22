import { execSync } from 'node:child_process'

/** Computes a chronological, git-backed app version: YYYY.MM.DD (short-hash). */
export function computeAppVersion(): string {
  try {
    const gitOutput = execSync(
      'git log -1 --format="%cd (%h)" --date="format:%Y.%m.%d"',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim()
    if (gitOutput) return gitOutput
  } catch {
    // Git is not available in all container or release environments.
  }
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
  return `${date} (dev)`
}

if (process.argv[1]?.endsWith('version.ts')) {
  console.log(computeAppVersion())
}
