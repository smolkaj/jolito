import { chromium, type BrowserContext } from '@playwright/test'
import { createServer } from 'node:http'
import { readFileSync, copyFileSync, statSync, mkdirSync } from 'node:fs'
import { resolve, join, sep } from 'node:path'
import { execSync } from 'node:child_process'

const rootDir = process.cwd()
const distDir = join(rootDir, 'dist')
const iosOutputDir = join(rootDir, 'fastlane/native-screenshots/en-US')
const androidImagesDir = join(rootDir, 'fastlane/metadata/android/en-US/images')
const androidPhoneDir = join(androidImagesDir, 'phoneScreenshots')
const androidSevenInchDir = join(androidImagesDir, 'sevenInchScreenshots')
const androidTenInchDir = join(androidImagesDir, 'tenInchScreenshots')

const isAndroidOnly = process.argv.includes('--android-only')
const isIosOnly = process.argv.includes('--ios-only')
const includeIos = !isAndroidOnly
const includeAndroid = !isIosOnly

if (includeIos) {
  mkdirSync(iosOutputDir, { recursive: true })
}
if (includeAndroid) {
  mkdirSync(androidImagesDir, { recursive: true })
  mkdirSync(androidPhoneDir, { recursive: true })
  mkdirSync(androidSevenInchDir, { recursive: true })
  mkdirSync(androidTenInchDir, { recursive: true })
}

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

async function prepareContext(
  context: BrowserContext,
  isPhone: boolean,
  platform: 'ios' | 'android' = 'ios',
) {
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
    ({ session, libs, legacyCards, isMobilePhone, platformName }) => {
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
        document.documentElement.dataset.platform = platformName
        delete document.documentElement.dataset.keyboard
        document.documentElement.style.setProperty(
          '--safe-area-inset-top',
          platformName === 'android' ? '28px' : isMobilePhone ? '59px' : '24px',
        )
        document.documentElement.style.setProperty(
          '--safe-area-inset-bottom',
          platformName === 'android' ? '16px' : isMobilePhone ? '34px' : '20px',
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
      platformName: platform,
    },
  )
}

interface TargetDevice {
  prefix: string
  platform: 'ios' | 'android'
  width: number
  height: number
  scale: number
  isPhone: boolean
  outputDir: string
  userAgent: string
}

const ALL_DEVICES: TargetDevice[] = [
  // iOS Devices
  {
    prefix: 'iPhone_17_Pro_Max',
    platform: 'ios',
    width: 440,
    height: 956,
    scale: 3, // Renders 1320 x 2868
    isPhone: true,
    outputDir: iosOutputDir,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
  },
  {
    prefix: 'iPad_Pro_13-inch',
    platform: 'ios',
    width: 1032,
    height: 1376,
    scale: 2, // Renders 2064 x 2752
    isPhone: false,
    outputDir: iosOutputDir,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
  },
  // Android Devices
  {
    prefix: 'Pixel_9_Pro',
    platform: 'android',
    width: 412,
    height: 915,
    scale: 2.621359, // Renders 1080 x 2400 (exact 9:20 phone standard)
    isPhone: true,
    outputDir: androidPhoneDir,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  },
  {
    prefix: 'Nexus_7',
    platform: 'android',
    width: 600,
    height: 960,
    scale: 2, // Renders 1200 x 1920 (exact 16:10 7-inch tablet)
    isPhone: false,
    outputDir: androidSevenInchDir,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Nexus 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  },
  {
    prefix: 'Pixel_Tablet',
    platform: 'android',
    width: 800,
    height: 1280,
    scale: 2, // Renders 1600 x 2560 (exact 16:10 10-inch tablet)
    isPhone: false,
    outputDir: androidTenInchDir,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  },
]

const targetDevices = ALL_DEVICES.filter((d) => {
  if (d.platform === 'ios') return includeIos
  if (d.platform === 'android') return includeAndroid
  return true
})

for (const dev of targetDevices) {
  console.log(`Capturing for ${dev.prefix}...`)
  const context = await browser.newContext({
    viewport: { width: dev.width, height: dev.height },
    deviceScaleFactor: dev.scale,
    isMobile: dev.isPhone,
    hasTouch: true,
    userAgent: dev.userAgent,
  })
  await prepareContext(context, dev.isPhone, dev.platform)
  const page = await context.newPage()

  // 1. Welcome Screen (clean mascot, no speech bubble)
  await page.goto(`${baseUrl}/#/`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  const file01 = join(dev.outputDir, `1_${dev.prefix}_01-welcome.png`)
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
  const file02 = join(dev.outputDir, `2_${dev.prefix}_02-study.png`)
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
  const file03 = join(dev.outputDir, `3_${dev.prefix}_03-review.png`)
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
  const file04 = join(dev.outputDir, `4_${dev.prefix}_04-create.png`)
  await page.screenshot({ path: file04 })
  console.log(`Saved ${file04}`)

  // 5. Deck Manager
  await page.goto(`${baseUrl}/#/deck`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  const file05 = join(dev.outputDir, `5_${dev.prefix}_05-deck.png`)
  await page.screenshot({ path: file05 })
  console.log(`Saved ${file05}`)

  await context.close()
}

if (includeAndroid) {
  console.log('Generating Google Play 512x512 icon...')
  copyFileSync(
    join(rootDir, 'public/icon-512.png'),
    join(androidImagesDir, 'icon.png'),
  )

  console.log('Generating Google Play 1024x500 feature graphic...')
  const fgContext = await browser.newContext({
    viewport: { width: 1024, height: 500 },
    deviceScaleFactor: 1,
  })
  const fgPage = await fgContext.newPage()

  const welcomeImgBase64 = readFileSync(
    resolve(rootDir, 'assets/jolito-welcome.webp'),
  ).toString('base64')
  const fontBase64 = readFileSync(
    resolve(
      rootDir,
      'public/fonts/bricolage-grotesque-normal-400-800-latin.woff2',
    ),
  ).toString('base64')

  const logoSvg = `<svg class="brand-mark" viewBox="0 0 32 32" width="80" height="80" xmlns="http://www.w3.org/2000/svg">
  <g fill="#e4007c">
    <rect x="3" y="6.5" width="11" height="4.5" rx="2.25" transform="rotate(-22 8.5 8.75)" />
    <rect x="1" y="13.75" width="12" height="4.5" rx="2.25" />
    <rect x="3" y="21" width="11" height="4.5" rx="2.25" transform="rotate(22 8.5 23.25)" />
    <rect x="18" y="6.5" width="11" height="4.5" rx="2.25" transform="rotate(22 23.5 8.75)" />
    <rect x="19" y="13.75" width="12" height="4.5" rx="2.25" />
    <rect x="18" y="21" width="11" height="4.5" rx="2.25" transform="rotate(-22 23.5 23.25)" />
  </g>
  <circle cx="16" cy="16" r="6" fill="#121815" />
  <circle cx="16" cy="16" r="4.2" fill="#f59e0b" />
  <circle cx="16" cy="16" r="2.2" fill="#ffffff" />
</svg>`

  const fgHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @font-face {
    font-family: 'Bricolage Grotesque';
    src: url('data:font/woff2;base64,${fontBase64}') format('woff2');
    font-weight: 400 800;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1024px;
    height: 500px;
    background: #fdf5f8;
    font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    width: 100%;
    height: 100%;
    background: #ffffff;
    border-radius: 28px;
    border: 3px solid #121815;
    box-shadow: 6px 6px 0 #121815;
    display: flex;
    position: relative;
    overflow: hidden;
    padding: 44px 56px;
    align-items: center;
    justify-content: space-between;
  }
  .left {
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-width: 530px;
    z-index: 2;
  }
  .brand-row {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 20px;
  }
  .brand-title {
    font-size: 80px;
    font-weight: 800;
    color: #121815;
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .headline {
    font-size: 48px;
    font-weight: 800;
    color: #121815;
    line-height: 1.1;
    letter-spacing: -0.03em;
  }
  .headline em {
    font-style: normal;
    color: #e4007c;
  }
  .badge {
    display: inline-block;
    margin-top: 18px;
    padding: 6px 14px;
    background: #121815;
    color: #ffffff;
    font-size: 17px;
    font-weight: 700;
    border-radius: 12px;
    letter-spacing: 0.02em;
    width: fit-content;
  }
  .right {
    position: absolute;
    right: 20px;
    bottom: -15px;
    width: 410px;
    height: 480px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .mascot {
    width: 400px;
    height: auto;
    object-fit: contain;
    filter: drop-shadow(0 14px 28px rgba(18, 24, 21, 0.08));
  }
</style>
</head>
<body>
  <div class="card">
    <div class="left">
      <div class="brand-row">
        ${logoSvg}
        <span class="brand-title">Jolito</span>
      </div>
      <h1 class="headline">Mexican Spanish<br />that <em>sticks.</em></h1>
      <div class="badge">Spaced Repetition & Active Recall</div>
    </div>
    <div class="right">
      <img class="mascot" src="data:image/webp;base64,${welcomeImgBase64}" alt="Jolito Mascot" />
    </div>
  </div>
</body>
</html>`

  await fgPage.setContent(fgHtml)
  await fgPage.screenshot({
    path: join(androidImagesDir, 'featureGraphic.png'),
  })
  await fgContext.close()
  console.log('Saved Google Play featureGraphic.png')
}

await browser.close()
server.close()
console.log('Successfully generated all store screenshots and assets.')
