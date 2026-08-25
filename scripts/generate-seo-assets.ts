import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { execSync } from 'node:child_process'

async function main() {
  console.log('🏗️ Building project for authentic screenshot capture...')
  execSync('npm run build', { stdio: 'inherit' })

  // Simple static server for dist
  const distDir = resolve(process.cwd(), 'dist')
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
  }

  const server = createServer((req, res) => {
    const rawPath = req.url ? new URL(req.url, 'http://127.0.0.1:4199').pathname : '/'
    const sanitizedRelPath = rawPath === '/' ? 'index.html' : rawPath.slice(1).replace(/\.\./g, '')
    const targetFile = resolve(distDir, sanitizedRelPath)

    const finalPath =
      targetFile.startsWith(distDir) && existsSync(targetFile)
        ? targetFile
        : resolve(distDir, 'index.html')

    const ext = extname(finalPath)
    const mime = mimeTypes[ext] ?? 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': mime })
    res.end(readFileSync(finalPath))
  })

  await new Promise<void>((res) =>
    server.listen(4199, '127.0.0.1', () => res()),
  )
  console.log('✔ Static server listening on http://127.0.0.1:4199')

  const browser = await chromium.launch()

  // 1. Desktop Screenshot (1280x720)
  console.log('📸 Capturing authentic desktop screenshot...')
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  })
  const desktopPage = await desktopContext.newPage()
  await desktopPage.goto('http://127.0.0.1:4199/#/')
  await desktopPage.waitForSelector('.brand')
  await desktopPage.waitForTimeout(500)
  await desktopPage.screenshot({ path: 'public/screenshot-wide.png' })
  await desktopContext.close()
  console.log('✔ Generated public/screenshot-wide.png')

  // 2. Mobile Screenshot (390x844 @2x = 780x1688)
  console.log('📸 Capturing authentic mobile screenshot...')
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto('http://127.0.0.1:4199/#/')
  await mobilePage.waitForSelector('.brand')
  await mobilePage.waitForTimeout(500)
  await mobilePage.screenshot({ path: 'public/screenshot-mobile.png' })
  await mobileContext.close()
  console.log('✔ Generated public/screenshot-mobile.png')

  // 3. High-Quality Open Graph Card (1200x630)
  console.log('🎨 Rendering high-resolution OpenGraph card (1200x630)...')
  const ogContext = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  })
  const ogPage = await ogContext.newPage()

  const welcomeImgBase64 = readFileSync(
    resolve(process.cwd(), 'assets/jolito-welcome.png'),
  ).toString('base64')

  const ogHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @font-face {
    font-family: 'Bricolage Grotesque';
    src: url('/fonts/bricolage-grotesque-normal-400-800-latin.woff2') format('woff2');
    font-weight: 400 800;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px;
    height: 630px;
    background: #fdf5f8;
    font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
  }
  .card {
    width: 100%;
    height: 100%;
    background: #ffffff;
    border-radius: 36px;
    border: 3px solid #f3d2df;
    display: flex;
    position: relative;
    overflow: hidden;
    box-shadow: 0 16px 48px rgba(194, 51, 99, 0.08);
  }
  .left {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 60px 40px 60px 64px;
    z-index: 2;
    max-width: 720px;
  }
  .brand-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-title {
    font-size: 54px;
    font-weight: 800;
    color: #c23363;
    letter-spacing: -0.03em;
  }
  .brand-pill {
    background: #fdf2f6;
    color: #c23363;
    border: 1.5px solid #fad2e1;
    font-size: 16px;
    font-weight: 700;
    padding: 6px 14px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .headline {
    font-size: 38px;
    font-weight: 800;
    color: #2a2026;
    line-height: 1.15;
    letter-spacing: -0.02em;
    margin-top: 16px;
  }
  .tagline {
    font-size: 22px;
    font-weight: 500;
    color: #6b5b65;
    line-height: 1.45;
    margin-top: 14px;
  }
  .pills-row {
    display: flex;
    gap: 12px;
    margin-top: 24px;
    flex-wrap: nowrap;
  }
  .feature-pill {
    background: #fdf5f8;
    border: 2px solid #ebd0db;
    padding: 8px 18px;
    border-radius: 999px;
    font-size: 16px;
    font-weight: 700;
    color: #9e2951;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }
  .bottom-row {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .domain-badge {
    background: #c23363;
    color: #ffffff;
    font-size: 26px;
    font-weight: 800;
    padding: 12px 28px;
    border-radius: 18px;
    letter-spacing: -0.01em;
    box-shadow: 0 6px 16px rgba(194, 51, 99, 0.3);
  }
  .sub-note {
    font-size: 19px;
    font-weight: 600;
    color: #6b5b65;
  }
  .right {
    position: absolute;
    right: 20px;
    bottom: -10px;
    width: 440px;
    height: 520px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .mascot {
    width: 420px;
    height: auto;
    object-fit: contain;
    filter: drop-shadow(0 12px 24px rgba(194, 51, 99, 0.12));
  }
</style>
</head>
<body>
  <div class="card">
    <div class="left">
      <div>
        <div class="brand-row">
          <span class="brand-title">Jolito</span>
          <span class="brand-pill">Mexican Spanish</span>
        </div>
        <h1 class="headline">Spoken Mexican Spanish at your rhythm.</h1>
        <p class="tagline">Multimodal spaced repetition with natural audio, meaningful visuals, and active recall that make daily practice inviting.</p>
        <div class="pills-row">
          <div class="feature-pill">🔊 Native Audio</div>
          <div class="feature-pill">🧠 Spaced Repetition</div>
          <div class="feature-pill">⚡ 100% Offline PWA</div>
        </div>
      </div>
      <div class="bottom-row">
        <div class="domain-badge">joli.to</div>
        <div class="sub-note">Free • No Account Required • Installable PWA</div>
      </div>
    </div>
    <div class="right">
      <img class="mascot" src="data:image/png;base64,${welcomeImgBase64}" alt="Jolito Mascot" />
    </div>
  </div>
</body>
</html>`

  await ogPage.setContent(ogHtml)
  await ogPage.screenshot({ path: 'public/og-image.png' })
  await ogContext.close()
  console.log('✔ Generated pixel-perfect public/og-image.png')

  await browser.close()
  server.close()
  console.log('🎉 All authentic SEO assets generated successfully!')
}

main().catch((err) => {
  console.error('Error generating assets:', err)
  process.exit(1)
})
