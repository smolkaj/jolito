import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve, join, sep } from 'node:path'
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'

const SIZES = [
  {
    name: 'iphone-6.7',
    deviceKeyword: 'IPHONE_67',
    width: 430,
    height: 932,
    deviceScaleFactor: 3, // renders 1290 x 2796 px (Apple App Store standard)
    outputDir: 'fastlane/screenshots/en-US/iphone-6.7',
  },
  {
    name: 'ipad-12.9',
    deviceKeyword: 'IPAD_PRO_3GEN_129',
    width: 1024,
    height: 1366,
    deviceScaleFactor: 2, // renders 2048 x 2732 px (Apple App Store standard)
    outputDir: 'fastlane/screenshots/en-US/ipad-12.9',
  },
]

async function main() {
  const rootDir = resolve(import.meta.dirname, '..')
  const distDir = join(rootDir, 'dist')

  if (!existsSync(join(distDir, 'index.html'))) {
    console.error(
      'Error: dist/index.html not found. Run `npm run build` first.',
    )
    process.exit(1)
  }

  // Simple static HTTP server serving dist/
  const server = createServer((req, res) => {
    let reqPath: string
    try {
      reqPath = decodeURIComponent((req.url || '/').split('?')[0] || '/')
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('Bad Request')
      return
    }

    if (reqPath.includes('\0')) {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('Bad Request')
      return
    }

    if (reqPath === '/' || !reqPath.includes('.')) {
      reqPath = '/index.html'
    }

    const normalizedRelative = reqPath.startsWith('/') ? reqPath : `/${reqPath}`
    const filePath = resolve(distDir, `.${normalizedRelative}`)

    if (!filePath.startsWith(distDir + sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('Forbidden')
      return
    }

    if (existsSync(filePath)) {
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

  const port = await new Promise<number>((resolvePort) => {
    server.listen(0, () => {
      const addr = server.address()
      resolvePort(typeof addr === 'object' && addr ? addr.port : 4173)
    })
  })

  const baseUrl = `http://localhost:${port}`
  console.log(`Preview server listening at ${baseUrl}`)

  const browser = await chromium.launch()

  try {
    const deliverDir = join(rootDir, 'fastlane/screenshots/en-US')
    mkdirSync(deliverDir, { recursive: true })

    for (const size of SIZES) {
      console.log(`Capturing screenshots for ${size.name}...`)
      const targetDir = join(rootDir, size.outputDir)
      mkdirSync(targetDir, { recursive: true })

      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: size.deviceScaleFactor,
        isMobile: true,
        hasTouch: true,
      })

      const page = await context.newPage()

      // 1. Welcome Screen
      await page.goto(`${baseUrl}/#/`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(300)
      const welcomeFile = '01-welcome.png'
      const welcomeDeliver = `01-${size.deviceKeyword}-welcome.png`
      await page.screenshot({ path: join(targetDir, welcomeFile) })
      await page.screenshot({ path: join(deliverDir, welcomeDeliver) })

      // 2. Create Screen with realistic card preview
      await page.goto(`${baseUrl}/#/create`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(300)
      const spanishInput = page.locator('#spanish')
      if (await spanishInput.isVisible()) {
        await spanishInput.fill('¡Qué padre!')
        await page.locator('#english').fill('How cool! / That’s awesome!')
        await page
          .locator('#context')
          .fill('¡Qué padre que viniste a la fiesta!')
        await page.waitForTimeout(300)
      }
      const createFile = '02-create.png'
      const createDeliver = `02-${size.deviceKeyword}-create.png`
      await page.screenshot({ path: join(targetDir, createFile) })
      await page.screenshot({ path: join(deliverDir, createDeliver) })

      // 3. Study / Practice Screen
      await page.goto(`${baseUrl}/#/study`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(300)
      const answerInput = page.locator('#answer')
      if (await answerInput.isVisible()) {
        await answerInput.fill('aguacate')
        await page.waitForTimeout(200)
      }
      const studyFile = '03-study.png'
      const studyDeliver = `03-${size.deviceKeyword}-study.png`
      await page.screenshot({ path: join(targetDir, studyFile) })
      await page.screenshot({ path: join(deliverDir, studyDeliver) })

      // 4. Deck Management Screen
      await page.goto(`${baseUrl}/#/deck`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(300)
      const deckFile = '04-deck.png'
      const deckDeliver = `04-${size.deviceKeyword}-deck.png`
      await page.screenshot({ path: join(targetDir, deckFile) })
      await page.screenshot({ path: join(deliverDir, deckDeliver) })

      // 5. Complete Screen
      await page.goto(`${baseUrl}/#/complete`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(300)
      const completeFile = '05-complete.png'
      const completeDeliver = `05-${size.deviceKeyword}-complete.png`
      await page.screenshot({ path: join(targetDir, completeFile) })
      await page.screenshot({ path: join(deliverDir, completeDeliver) })

      await context.close()
    }

    console.log('Successfully captured all App Store Connect screenshot sets.')
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
