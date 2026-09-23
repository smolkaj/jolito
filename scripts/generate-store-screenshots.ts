import { chromium, type BrowserContext } from '@playwright/test'
import { createServer } from 'node:http'
import { readFileSync, statSync, mkdirSync } from 'node:fs'
import { resolve, join, sep } from 'node:path'
import { execSync } from 'node:child_process'

const rootDir = process.cwd()
const distDir = join(rootDir, 'dist')
const outputDir = join(rootDir, 'fastlane/native-screenshots/en-US')
mkdirSync(outputDir, { recursive: true })

console.log('Building dist prior to screenshot generation...')
execSync(
  'VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=mock-key npm run build',
  { stdio: 'inherit' },
)

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
    const contentTypes: Record<string, string> = {
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

const port = await new Promise<number>((res) =>
  server.listen(0, () => {
    const addr = server.address()
    res(typeof addr === 'object' && addr ? addr.port : 4173)
  }),
)
const baseUrl = `http://localhost:${port}`

const browser = await chromium.launch()

const now = Date.now()
const sampleCards = [
  {
    id: 'card-1:es-en',
    noteId: 'note-1',
    prompt: '¿Mande?',
    answer: 'Pardon? / What was that?',
    direction: 'es-en',
    context:
      'Quintessential polite Mexican response when you did not hear someone or when your name is called.',
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
    prompt: '¡Qué padre!',
    answer: 'How cool! / That’s awesome!',
    direction: 'es-en',
    context:
      'Very common Mexican idiom expressing that something is great, wonderful, or fun.',
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
  {
    id: 'card-3:es-en',
    noteId: 'note-3',
    prompt: 'Ahorita',
    answer: 'Right now / In a minute / Later',
    direction: 'es-en',
    context:
      'Mexican temporal expression: depending on tone and context, can mean right this second, shortly, or never.',
    scene: 'conversation',
    schedule: {
      state: 'new',
      dueAt: now - 1000,
      intervalDays: 0,
      easeFactor: 2.5,
      reviews: 0,
      lapses: 0,
    },
    contentRevision: 1,
    resetRevision: { generation: 0, at: 0 },
    createdAt: now,
  },
  {
    id: 'card-4:es-en',
    noteId: 'note-4',
    prompt: 'No manches',
    answer: 'No way! / You’re kidding!',
    direction: 'es-en',
    context:
      'Widely used informal Mexican expression of surprise or disbelief.',
    scene: 'conversation',
    schedule: {
      state: 'review',
      dueAt: now + 86400000,
      intervalDays: 5,
      easeFactor: 2.5,
      reviews: 5,
      lapses: 0,
    },
    contentRevision: 1,
    resetRevision: { generation: 0, at: 0 },
    createdAt: now - 86400000 * 5,
  },
  {
    id: 'card-5:es-en',
    noteId: 'note-5',
    prompt: 'Se me fue la onda',
    answer: 'I lost my train of thought',
    direction: 'es-en',
    context:
      'Casual Mexican idiom used when you momentarily forget what you were about to say.',
    scene: 'conversation',
    schedule: {
      state: 'review',
      dueAt: now + 86400000 * 2,
      intervalDays: 8,
      easeFactor: 2.6,
      reviews: 6,
      lapses: 0,
    },
    contentRevision: 1,
    resetRevision: { generation: 0, at: 0 },
    createdAt: now - 86400000 * 8,
  },
]

const authSession = {
  accessToken: 'valid-store-session',
  refreshToken: 'valid-refresh-token',
  expiresAt: now + 3600000 * 24 * 30,
  user: { id: 'usr-store', email: 'hola@jolito.app' },
}

const librariesEnvelope = {
  version: 1,
  accounts: {
    'user:usr-store': {
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

async function prepareContext(context: BrowserContext, isPhone: boolean) {
  // Mock Supabase sync & auth RPCs so connection pill displays green "Synced" state
  await context.route('**/rest/v1/**', async (route) => {
    const url = route.request().url()
    if (url.includes('read_deck_snapshot')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            user_id: 'usr-store',
            revision: 1,
            updated_at: new Date().toISOString(),
            data: {
              version: 1,
              app: 'jolito',
              updatedAt: new Date().toISOString(),
              deviceId: 'dev-store',
              cards: sampleCards,
              deletedCardIds: [],
            },
          },
        ]),
      })
    } else if (
      url.includes('compare_and_set_deck') ||
      url.includes('commit_deck_snapshot')
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(2),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }
  })

  await context.route('**/auth/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: authSession.accessToken,
        refresh_token: authSession.refreshToken,
        expires_at: authSession.expiresAt,
        user: authSession.user,
      }),
    })
  })

  await context.route('**/api/**', async (route) => {
    await route.fulfill({ status: 200, body: '{}' })
  })

  await context.addInitScript(
    ({ session, libs, legacyCards, isMobilePhone }) => {
      window.localStorage.setItem(
        'jolito-auth-session-v1',
        JSON.stringify(session),
      )
      window.localStorage.setItem('jolito-libraries-v1', JSON.stringify(libs))
      window.localStorage.setItem(
        'jolito-library-v1',
        JSON.stringify({ version: 1, cards: legacyCards }),
      )
      window.sessionStorage.removeItem('jolito:has-keyboard')

      const setSafeAreas = () => {
        if (!document.documentElement) return
        document.documentElement.dataset.platform = 'ios'
        delete document.documentElement.dataset.keyboard
        document.documentElement.style.setProperty(
          '--safe-area-inset-top',
          isMobilePhone ? '59px' : '24px',
        )
        document.documentElement.style.setProperty(
          '--safe-area-inset-bottom',
          isMobilePhone ? '34px' : '20px',
        )
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setSafeAreas)
      } else {
        setSafeAreas()
      }
      setTimeout(setSafeAreas, 50)
      setTimeout(setSafeAreas, 300)
    },
    {
      session: authSession,
      libs: librariesEnvelope,
      legacyCards: sampleCards,
      isMobilePhone: isPhone,
    },
  )
}

const DEVICES = [
  {
    prefix: 'iPhone_17_Pro_Max',
    width: 440,
    height: 956,
    scale: 3, // Renders 1320 x 2868
    isPhone: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
  },
  {
    prefix: 'iPad_Pro_13-inch',
    width: 1032,
    height: 1376,
    scale: 2, // Renders 2064 x 2752
    isPhone: false,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
  },
]

for (const dev of DEVICES) {
  console.log(`Capturing for ${dev.prefix}...`)
  const context = await browser.newContext({
    viewport: { width: dev.width, height: dev.height },
    deviceScaleFactor: dev.scale,
    isMobile: dev.isPhone,
    hasTouch: true,
    userAgent: dev.userAgent,
  })
  await prepareContext(context, dev.isPhone)
  const page = await context.newPage()

  // 1. Welcome Screen (clean mascot, no speech bubble)
  await page.goto(`${baseUrl}/#/`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  const file01 = join(outputDir, `1_${dev.prefix}_01-welcome.png`)
  await page.screenshot({ path: file01 })
  console.log(`Saved ${file01}`)

  // 2. Study Prompt (Active Recall - Touch First)
  await page.goto(`${baseUrl}/#/study`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)
  const answerInput = page.getByLabel('Your answer')
  if (await answerInput.isVisible()) {
    await answerInput.fill('Pardon?')
    await page.waitForTimeout(300)
  }
  const file02 = join(outputDir, `2_${dev.prefix}_02-study.png`)
  await page.screenshot({ path: file02 })
  console.log(`Saved ${file02}`)

  // 3. Review Answer & SRS Grading (Click reveal button rather than physical keyboard Enter)
  const revealBtn = page.locator('.reveal-button')
  if (await revealBtn.isVisible()) {
    await revealBtn.click()
  } else {
    const fallbackReveal = page.locator('form.answer-form button')
    if (await fallbackReveal.isVisible()) {
      await fallbackReveal.click()
    }
  }
  await page.waitForTimeout(400)
  const file03 = join(outputDir, `3_${dev.prefix}_03-review.png`)
  await page.screenshot({ path: file03 })
  console.log(`Saved ${file03}`)

  // 4. Create Card with Autocomplete
  await page.goto(`${baseUrl}/#/create`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  const spanishInput = page.getByRole('combobox', { name: /mexican spanish/i })
  if (await spanishInput.isVisible()) {
    await spanishInput.fill('ahor')
    await page.waitForTimeout(400)
  }
  const file04 = join(outputDir, `4_${dev.prefix}_04-create.png`)
  await page.screenshot({ path: file04 })
  console.log(`Saved ${file04}`)

  // 5. Deck Manager
  await page.goto(`${baseUrl}/#/deck`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  const file05 = join(outputDir, `5_${dev.prefix}_05-deck.png`)
  await page.screenshot({ path: file05 })
  console.log(`Saved ${file05}`)

  await context.close()
}

await browser.close()
server.close()
console.log('Successfully generated all App Store screenshots.')
