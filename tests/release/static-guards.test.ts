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

void test('index.html contains prerendered semantic landing shell for search crawlers and zero-JS accessibility', async () => {
  const fs = await import('node:fs')
  const indexHtml = fs.readFileSync('index.html', 'utf8')

  // 1. Root container must not be an empty div; must include semantic welcome-page shell
  assert.match(
    indexHtml,
    /<div id="root">\s*<main class="welcome-page"/,
    'index.html #root container must contain prerendered welcome-page shell',
  )

  // 2. Primary H1 and lede must be present in raw HTML for instant indexing
  assert.match(
    indexHtml,
    /<h1[^>]*>[\s\S]*?Make the words[\s\S]*?stick\.[\s\S]*?<\/h1>/,
    'index.html must include primary H1 headline in static HTML',
  )
  assert.match(
    indexHtml,
    /Create beautiful, spoken flashcards\./,
    'index.html must include lede description in static HTML',
  )

  // 3. Why Jolito section with origin story and outbound educational links
  assert.match(
    indexHtml,
    /<h2 id="why-jolito-title">Why another flashcard app\?<\/h2>/,
    'index.html must include "Why another flashcard app?" H2',
  )
  assert.match(
    indexHtml,
    /International House in Condesa/,
    'index.html must include origin story context in static HTML',
  )
  assert.match(
    indexHtml,
    /https:\/\/ihmexico\.mx\//,
    'index.html must preserve outbound link to IH Mexico',
  )

  // 4. Sample card preview with Mexican Spanish and English badges
  assert.match(
    indexHtml,
    /MEXICAN SPANISH/,
    'index.html must include Mexican Spanish sample badge',
  )
  assert.match(
    indexHtml,
    /el aguacate/,
    'index.html must include Mexican Spanish sample phrase',
  )

  // 5. Canonical and structured metadata
  assert.match(
    indexHtml,
    /<link rel="canonical" href="https:\/\/joli\.to\/" \/>/,
    'index.html must define canonical domain URL',
  )
  assert.match(
    indexHtml,
    /"@type":\s*"WebApplication"/,
    'index.html must define WebApplication Schema.org structured data',
  )
})
