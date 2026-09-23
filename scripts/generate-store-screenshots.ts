import { chromium, type BrowserContext } from '@playwright/test'
import { createServer } from 'node:http'
import { readFileSync, statSync, mkdirSync } from 'node:fs'
import { resolve, join, sep } from 'node:path'

const rootDir = process.cwd()
const distDir = join(rootDir, 'dist')
const outputDir = join(rootDir, 'fastlane/native-screenshots/en-US')
mkdirSync(outputDir, { recursive: true })

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
      Object.defineProperty(navigator, 'onLine', { value: false })

      const injectChrome = () => {
        if (!document.head || !document.body) return
        if (document.querySelector('.ios-status-bar')) return

        const style = document.createElement('style')
        style.textContent = `
          :root {
            --safe-area-inset-top: ${isMobilePhone ? '59px' : '24px'} !important;
            --safe-area-inset-bottom: ${isMobilePhone ? '34px' : '20px'} !important;
          }
          body {
            padding-top: var(--safe-area-inset-top) !important;
            padding-bottom: var(--safe-area-inset-bottom) !important;
          }
          .ios-status-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: ${isMobilePhone ? '59px' : '24px'};
            z-index: 99999;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 ${isMobilePhone ? '36px' : '24px'};
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
            font-size: ${isMobilePhone ? '17px' : '14px'};
            font-weight: 600;
            color: #000000;
            pointer-events: none;
            background: rgba(253, 245, 248, 0.96);
            backdrop-filter: blur(12px);
          }
          .ios-island {
            position: fixed;
            top: 11px;
            left: 50%;
            transform: translateX(-50%);
            width: 125px;
            height: 37px;
            background: #000000;
            border-radius: 20px;
            z-index: 100000;
            pointer-events: none;
          }
          .ios-home-indicator {
            position: fixed;
            bottom: 8px;
            left: 50%;
            transform: translateX(-50%);
            width: 140px;
            height: 5px;
            background: #000000;
            border-radius: 3px;
            z-index: 99999;
            pointer-events: none;
            opacity: 0.7;
          }
        `
        document.head.appendChild(style)

        const bar = document.createElement('div')
        bar.className = 'ios-status-bar'
        bar.innerHTML = `
          <span>9:41</span>
          <div style="display: flex; gap: 7px; align-items: center;">
            <svg width="18" height="13" viewBox="0 0 18 13" fill="#000"><path d="M9 2.5C12.1 2.5 15 3.8 17.1 5.9L15.5 7.5C13.8 5.8 11.5 4.8 9 4.8C6.5 4.8 4.2 5.8 2.5 7.5L0.9 5.9C3 3.8 5.9 2.5 9 2.5ZM9 6.8C10.7 6.8 12.3 7.5 13.5 8.7L9 13.2L4.5 8.7C5.7 7.5 7.3 6.8 9 6.8Z"/></svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="none" stroke="#000" stroke-width="1.2" rx="3"><rect x="0.6" y="0.6" width="21" height="10.8" rx="3"/><path d="M23.5 4v4" stroke-linecap="round"/><rect x="2.5" y="2.5" width="16" height="7" rx="1.5" fill="#000"/></svg>
          </div>
        `
        document.body.appendChild(bar)

        if (isMobilePhone) {
          const island = document.createElement('div')
          island.className = 'ios-island'
          document.body.appendChild(island)
        }

        const home = document.createElement('div')
        home.className = 'ios-home-indicator'
        document.body.appendChild(home)
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectChrome)
      } else {
        injectChrome()
      }
      setTimeout(injectChrome, 100)
      setTimeout(injectChrome, 400)
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
  },
  {
    prefix: 'iPad_Pro_13-inch',
    width: 1032,
    height: 1376,
    scale: 2, // Renders 2064 x 2752
    isPhone: false,
  },
]

for (const dev of DEVICES) {
  console.log(`Capturing for ${dev.prefix}...`)
  const context = await browser.newContext({
    viewport: { width: dev.width, height: dev.height },
    deviceScaleFactor: dev.scale,
    isMobile: dev.isPhone,
    hasTouch: true,
  })
  await prepareContext(context, dev.isPhone)
  const page = await context.newPage()

  // 1. Welcome with Mascot Greeting Bubble
  await page.goto(`${baseUrl}/#/`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  const mascot = page.getByRole('button', { name: /meet jolito the ajolote/i })
  if (await mascot.isVisible()) {
    await mascot.click()
    await page.waitForTimeout(400)
  }
  const file01 = join(outputDir, `1_${dev.prefix}_01-welcome.png`)
  await page.screenshot({ path: file01 })
  console.log(`Saved ${file01}`)

  // 2. Study Prompt (Active Recall)
  await page.goto(`${baseUrl}/#/study`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  const answerInput = page.getByLabel('Your answer')
  if (await answerInput.isVisible()) {
    await answerInput.fill('Pardon?')
    await page.waitForTimeout(300)
  }
  const file02 = join(outputDir, `2_${dev.prefix}_02-study.png`)
  await page.screenshot({ path: file02 })
  console.log(`Saved ${file02}`)

  // 3. Review Answer & SRS Grading
  await page.keyboard.press('Enter')
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
