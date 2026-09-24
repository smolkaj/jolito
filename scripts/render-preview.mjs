import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { readFileSync, statSync, mkdirSync } from 'node:fs'
import { resolve, join, sep } from 'node:path'

const rootDir = process.cwd()
const distDir = join(rootDir, 'dist')
const outDir = join(rootDir, 'preview-screenshots')
mkdirSync(outDir, { recursive: true })

const server = createServer((req, res) => {
  let reqPath = decodeURIComponent((req.url || '/').split('?')[0] || '/')
  if (reqPath === '/' || !reqPath.includes('.')) reqPath = '/index.html'
  const filePath = resolve(
    distDir,
    `.${reqPath.startsWith('/') ? reqPath : `/${reqPath}`}`,
  )
  if (!filePath.startsWith(distDir + sep)) {
    res.writeHead(403)
    res.end()
    return
  }
  const isFile = statSync(filePath, { throwIfNoEntry: false })?.isFile()
  if (isFile) {
    const ext = filePath.split('.').pop()
    const contentTypes = {
      html: 'text/html',
      js: 'application/javascript',
      css: 'text/css',
      png: 'image/png',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      wasm: 'application/wasm',
    }
    res.writeHead(200, {
      'Content-Type': contentTypes[ext || ''] || 'application/octet-stream',
    })
    res.end(readFileSync(filePath))
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(readFileSync(join(distDir, 'index.html')))
  }
})

const port = await new Promise((res) =>
  server.listen(0, () => res(server.address().port)),
)
const baseUrl = `http://localhost:${port}`

const now = Date.now()
const sampleCards = [
  {
    id: 'card-1:es-en',
    noteId: 'note-1',
    prompt: 'el aguacate',
    answer: 'avocado',
    direction: 'es-en',
    context: 'Traditional Mexican staple from Michoacán.',
    scene: 'conversation',
    schedule: {
      state: 'learning',
      dueAt: now - 5000,
      intervalDays: 1,
      easeFactor: 2.5,
      reviews: 2,
      lapses: 0,
    },
    contentRevision: 1,
    resetRevision: { generation: 0, at: 0 },
    createdAt: now - 86400000,
  },
  {
    id: 'card-2:es-en',
    noteId: 'note-2',
    prompt: '¿Mande?',
    answer: 'Pardon? / What was that?',
    direction: 'es-en',
    context: 'Quintessential polite Mexican response.',
    scene: 'conversation',
    schedule: {
      state: 'review',
      dueAt: now - 2000,
      intervalDays: 3,
      easeFactor: 2.6,
      reviews: 4,
      lapses: 0,
    },
    contentRevision: 1,
    resetRevision: { generation: 0, at: 0 },
    createdAt: now - 86400000 * 3,
  },
]

const authSession = {
  accessToken: 'valid-session',
  refreshToken: 'valid-refresh-token',
  expiresAt: now + 3600000 * 24 * 30,
  user: { id: 'usr-preview', email: 'preview@jolito.app' },
}

const librariesEnvelope = {
  version: 1,
  accounts: {
    'user:usr-preview': {
      version: 3,
      cards: sampleCards,
      deletedCardIds: [],
    },
  },
  guest: {
    version: 3,
    cards: sampleCards,
    deletedCardIds: [],
  },
}

const browser = await chromium.launch()

async function captureScreen(
  name,
  theme = 'dark',
  viewport = { width: 393, height: 852 },
  path = '#/',
) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    colorScheme: theme,
  })

  await context.addInitScript(
    ({ session, libs, legacyCards, themeMode }) => {
      window.localStorage.setItem(
        'jolito-auth-session-v1',
        JSON.stringify(session),
      )
      window.localStorage.setItem('jolito-libraries-v1', JSON.stringify(libs))
      window.localStorage.setItem(
        'jolito-library-v1',
        JSON.stringify({ version: 1, cards: legacyCards }),
      )
      if (themeMode) {
        document.documentElement.setAttribute('data-theme', themeMode)
      }
    },
    {
      session: authSession,
      libs: librariesEnvelope,
      legacyCards: sampleCards,
      themeMode: theme,
    },
  )

  const page = await context.newPage()
  await page.goto(`${baseUrl}/${path}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)

  const filename = join(
    outDir,
    `${name}-${theme}-${viewport.width}x${viewport.height}.png`,
  )
  await page.screenshot({ path: filename, fullPage: false })
  console.log(`Saved screenshot: ${filename}`)
  await context.close()
  return filename
}

async function capturePracticeRevealed(theme = 'dark') {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    colorScheme: theme,
  })

  await context.addInitScript(
    ({ session, libs, legacyCards, themeMode }) => {
      window.localStorage.setItem(
        'jolito-auth-session-v1',
        JSON.stringify(session),
      )
      window.localStorage.setItem('jolito-libraries-v1', JSON.stringify(libs))
      window.localStorage.setItem(
        'jolito-library-v1',
        JSON.stringify({ version: 1, cards: legacyCards }),
      )
      if (themeMode) {
        document.documentElement.setAttribute('data-theme', themeMode)
      }
    },
    {
      session: authSession,
      libs: librariesEnvelope,
      legacyCards: sampleCards,
      themeMode: theme,
    },
  )

  const page = await context.newPage()
  await page.goto(`${baseUrl}/#/review`)
  await page.waitForLoadState('networkidle')
  const input = page.locator('.answer-input')
  await input.waitFor({ state: 'visible' })
  await input.fill('avokado') // intentional typo to test diff comparison!
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)

  const filename = join(outDir, `practice-revealed-diff-${theme}.png`)
  await page.screenshot({ path: filename, fullPage: false })
  console.log(`Saved screenshot: ${filename}`)
  await context.close()
  return filename
}

console.log('Capturing preview screens...')
await captureScreen(
  'welcome-desktop',
  'dark',
  { width: 1200, height: 800 },
  '#/',
)
await captureScreen('welcome', 'dark', { width: 393, height: 852 }, '#/')
await captureScreen('welcome', 'light', { width: 393, height: 852 }, '#/')
await captureScreen('grammar', 'dark', { width: 393, height: 852 }, '#/grammar')
await captureScreen('create', 'dark', { width: 393, height: 852 }, '#/create')
await captureScreen('deck', 'dark', { width: 393, height: 852 }, '#/deck')
await captureScreen(
  'practice-prompt',
  'dark',
  { width: 393, height: 852 },
  '#/review',
)
await capturePracticeRevealed('dark')
await capturePracticeRevealed('light')

async function captureDemoDeckModal(theme = 'dark') {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    colorScheme: theme,
  })
  await context.addInitScript(
    ({ themeMode }) => {
      window.localStorage.clear()
      if (themeMode) {
        document.documentElement.setAttribute('data-theme', themeMode)
      }
    },
    { themeMode: theme },
  )
  const page = await context.newPage()
  await page.goto(`${baseUrl}/#/deck`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  const filename = join(outDir, `demo-deck-modal-${theme}-393x852.png`)
  await page.screenshot({ path: filename, fullPage: false })
  console.log(`Saved screenshot: ${filename}`)
  await context.close()
}

await captureDemoDeckModal('dark')

await browser.close()
server.close()
console.log('Done.')
