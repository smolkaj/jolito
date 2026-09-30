import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ESLint } from 'eslint'

void test('ESLint resolves no-use-before-define error rule for source files', async () => {
  const eslint = new ESLint()
  const rawConfig = (await eslint.calculateConfigForFile('src/jolito.tsx')) as {
    rules?: Record<string, unknown>
  }
  const ruleConfig =
    rawConfig.rules?.['@typescript-eslint/no-use-before-define']

  assert.ok(
    ruleConfig,
    'Rule @typescript-eslint/no-use-before-define must be configured',
  )
  const severity = Array.isArray(ruleConfig)
    ? (ruleConfig[0] as unknown)
    : ruleConfig
  assert.ok(
    severity === 2 || severity === 'error',
    `Expected rule severity to be 'error' (2), got ${String(severity)}`,
  )

  const options = Array.isArray(ruleConfig)
    ? (ruleConfig[1] as Record<string, unknown>)
    : {}
  assert.strictEqual(
    options['variables'],
    true,
    'Variable references before declaration must be blocked',
  )
  assert.strictEqual(
    options['classes'],
    true,
    'Class references before declaration must be blocked',
  )
  assert.strictEqual(
    options['functions'],
    false,
    'Functions should remain hoisted and idiomatic',
  )
})

void test('ESLint catches Temporal Dead Zone variable access before definition', async () => {
  const eslint = new ESLint()
  const tdzCode = [
    'export function sampleView(): number {',
    '  function handleAction(): number {',
    '    if (isReady) return 1',
    '    return 0',
    '  }',
    '  const isReady = true',
    '  return handleAction()',
    '}',
  ].join('\n')

  const [result] = await eslint.lintText(tdzCode, {
    filePath: 'src/jolito.tsx',
  })
  assert.ok(result, 'Expected lint results from eslint.lintText')

  const tdzError = result.messages.find(
    (m) => m.ruleId === '@typescript-eslint/no-use-before-define',
  )
  assert.ok(
    tdzError,
    `Expected @typescript-eslint/no-use-before-define error for uninitialized variable, found: ${JSON.stringify(result.messages)}`,
  )
  assert.match(
    tdzError.message,
    /'isReady' was used before it was defined/,
    'Error message must indicate use-before-define on isReady',
  )
})

void test('Deck Manager table pills enforce single-line nowrap and adequate status track in CSS', async () => {
  const fs = await import('node:fs')
  const styles = fs.readFileSync('src/styles.css', 'utf8')

  // 1. .deck-stat-chip must declare white-space: nowrap and flex-shrink: 0
  const statChipBlock = styles.match(/\.deck-stat-chip\s*\{[^}]+\}/)?.[0]
  assert.ok(statChipBlock, 'Expected .deck-stat-chip rule in src/styles.css')
  assert.match(
    statChipBlock,
    /white-space:\s*nowrap;/,
    '.deck-stat-chip must have white-space: nowrap',
  )
  assert.match(
    statChipBlock,
    /flex-shrink:\s*0;/,
    '.deck-stat-chip must have flex-shrink: 0',
  )

  // 2. .deck-stat-chip.is-mini must declare white-space: nowrap and flex-shrink: 0
  const miniChipBlock = styles.match(
    /\.deck-stat-chip\.is-mini\s*\{[^}]+\}/,
  )?.[0]
  assert.ok(
    miniChipBlock,
    'Expected .deck-stat-chip.is-mini rule in src/styles.css',
  )
  assert.match(
    miniChipBlock,
    /white-space:\s*nowrap;/,
    '.deck-stat-chip.is-mini must have white-space: nowrap',
  )
  assert.match(
    miniChipBlock,
    /flex-shrink:\s*0;/,
    '.deck-stat-chip.is-mini must have flex-shrink: 0',
  )

  // 3. Status column grid tracks in header and row must allocate >= 84px to prevent clipping multi-word badges (e.g. "Due in 30d")
  const headerGrid = styles.match(/\.deck-list-table-header\s*\{[^}]+\}/)?.[0]
  assert.ok(
    headerGrid,
    'Expected .deck-list-table-header rule in src/styles.css',
  )
  assert.match(
    headerGrid,
    /grid-template-columns:[^;]*minmax\(84px,\s*96px\)/,
    '.deck-list-table-header status column track must be at least minmax(84px, 96px)',
  )

  const rowGrid = styles.match(/\.deck-card-row\s*\{[^}]+\}/)?.[0]
  assert.ok(rowGrid, 'Expected .deck-card-row rule in src/styles.css')
  assert.match(
    rowGrid,
    /grid-template-columns:[^;]*minmax\(84px,\s*96px\)/,
    '.deck-card-row status column track must be at least minmax(84px, 96px)',
  )
})

void test('quality.yml decouples WebKit from parallel browser shards to protect apt mirror throughput', async () => {
  const fs = await import('node:fs')
  const workflow = fs.readFileSync('.github/workflows/quality.yml', 'utf8')

  // 1. browser-shard must only install and test chromium
  const browserShardMatch = workflow.match(
    /browser-shard:[\s\S]*?(?=\n\s\s[a-z0-9_-]+:|$)/,
  )?.[0]
  assert.ok(browserShardMatch, 'Expected browser-shard job in quality.yml')
  assert.doesNotMatch(
    browserShardMatch,
    /install-deps\s+chromium\s+webkit/,
    'browser-shard must not install webkit dependencies (prevents apt mirror congestion across matrix)',
  )
  assert.match(
    browserShardMatch,
    /--project=chromium/,
    'browser-shard test execution must be restricted to chromium',
  )

  // 2. browser-webkit must exist as a dedicated isolated job
  const browserWebkitMatch = workflow.match(
    /browser-webkit:[\s\S]*?(?=\n\s\s[a-z0-9_-]+:|$)/,
  )?.[0]
  assert.ok(
    browserWebkitMatch,
    'Expected dedicated browser-webkit job in quality.yml',
  )
  assert.match(
    browserWebkitMatch,
    /--project=webkit/,
    'browser-webkit test execution must target webkit',
  )

  // 3. browser aggregator gate must require both browser-shard and browser-webkit
  const browserAggregatorMatch = workflow.match(
    /browser:[\s\S]*?(?=\n\s\s[a-z0-9_-]+:|$)/,
  )?.[0]
  assert.ok(
    browserAggregatorMatch,
    'Expected browser aggregator job in quality.yml',
  )
  assert.match(
    browserAggregatorMatch,
    /needs:\s*\[browser-shard,\s*browser-webkit\]/,
    'browser aggregator gate must depend on both browser-shard and browser-webkit',
  )
})

