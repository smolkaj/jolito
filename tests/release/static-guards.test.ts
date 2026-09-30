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

  // 1. Root container must include semantic noscript crawler fallback
  assert.match(
    indexHtml,
    /<div id="root">\s*<noscript>/,
    'index.html #root container must contain semantic noscript crawler fallback',
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
    /<h2[^>]*id="why-jolito-title"[^>]*>[\s\S]*?Why another flashcard app\?[\s\S]*?<\/h2>/,
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

  // 6. Zero raw JSX delimiter expressions: no literal {' '} in static HTML
  assert.strictEqual(
    indexHtml.includes("{' '}"),
    false,
    "index.html must not contain raw JSX delimiter expressions ({' '})",
  )

  // 7. Invariant parity with domain landing content across index.html and WelcomeView.tsx
  const {
    ORIGIN_STORY,
    ORIGIN_STORY_PARAGRAPHS,
    LANDING_HERO_CONTENT,
    storyParagraphToPlainText,
  } = await import('../../src/domain/landing-content.ts')

  // Hero content parity
  assert.match(
    indexHtml,
    new RegExp(LANDING_HERO_CONTENT.headlineLead),
    'index.html must reflect LANDING_HERO_CONTENT.headlineLead',
  )
  assert.match(
    indexHtml,
    new RegExp(LANDING_HERO_CONTENT.headlineMiddle),
    'index.html must reflect LANDING_HERO_CONTENT.headlineMiddle',
  )
  assert.match(
    indexHtml,
    new RegExp(LANDING_HERO_CONTENT.headlineEmp),
    'index.html must reflect LANDING_HERO_CONTENT.headlineEmp',
  )
  assert.match(
    indexHtml,
    new RegExp(LANDING_HERO_CONTENT.ledeLead),
    'index.html must reflect LANDING_HERO_CONTENT.ledeLead',
  )
  assert.match(
    indexHtml,
    new RegExp(LANDING_HERO_CONTENT.ledeRest),
    'index.html must reflect LANDING_HERO_CONTENT.ledeRest',
  )

  // Origin story parity
  assert.match(
    indexHtml,
    new RegExp(ORIGIN_STORY.eyebrow),
    'index.html must reflect ORIGIN_STORY.eyebrow',
  )
  assert.match(
    indexHtml,
    new RegExp(ORIGIN_STORY.title.replace('?', '\\?')),
    'index.html must reflect ORIGIN_STORY.title',
  )
  assert.match(
    indexHtml,
    new RegExp(
      ORIGIN_STORY.links.ihMexico.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    ),
    'index.html must reflect ORIGIN_STORY.links.ihMexico',
  )
  assert.match(
    indexHtml,
    new RegExp(
      ORIGIN_STORY.links.spacedRepetition.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      ),
    ),
    'index.html must reflect ORIGIN_STORY.links.spacedRepetition',
  )
  assert.match(
    indexHtml,
    new RegExp(ORIGIN_STORY.resolution.prefix),
    'index.html must reflect ORIGIN_STORY.resolution.prefix',
  )
  assert.match(
    indexHtml,
    new RegExp(ORIGIN_STORY.resolution.punchline),
    'index.html must reflect ORIGIN_STORY.resolution.punchline',
  )

  const strippedHtml = indexHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  for (const paragraph of ORIGIN_STORY_PARAGRAPHS) {
    const plainText = storyParagraphToPlainText(paragraph)
    const textSnippet = plainText.slice(0, 30)
    assert.ok(
      strippedHtml.includes(textSnippet),
      `index.html text content must contain origin story paragraph snippet: "${textSnippet}"`,
    )
  }

  // WelcomeView.tsx single source of truth verification
  const welcomeViewCode = fs.readFileSync(
    'src/ui/views/WelcomeView.tsx',
    'utf8',
  )
  assert.match(
    welcomeViewCode,
    /import\s*\{[^}]*ORIGIN_STORY_PARAGRAPHS[^}]*\}\s*from\s*['"]\.\.\/\.\.\/domain\/landing-content['"]/,
    'WelcomeView.tsx must import ORIGIN_STORY_PARAGRAPHS from landing-content.ts',
  )
  assert.match(
    welcomeViewCode,
    /ORIGIN_STORY_PARAGRAPHS\.map/,
    'WelcomeView.tsx must render origin story paragraphs from ORIGIN_STORY_PARAGRAPHS',
  )
  assert.match(
    welcomeViewCode,
    /LANDING_HERO_CONTENT\.headlineMiddle/,
    'WelcomeView.tsx must consume LANDING_HERO_CONTENT.headlineMiddle',
  )
  assert.match(
    welcomeViewCode,
    /LANDING_HERO_CONTENT\.ledeLead/,
    'WelcomeView.tsx must consume LANDING_HERO_CONTENT.ledeLead',
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
