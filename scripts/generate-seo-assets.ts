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
    const rawPath = req.url
      ? new URL(req.url, 'http://127.0.0.1:4199').pathname
      : '/'
    const sanitizedRelPath =
      rawPath === '/' ? 'index.html' : rawPath.slice(1).replace(/\.\./g, '')
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
  const fontBase64 = readFileSync(
    resolve(
      process.cwd(),
      'public/fonts/bricolage-grotesque-normal-400-800-latin.woff2',
    ),
  ).toString('base64')

  const logoSvg = `<svg class="brand-mark" viewBox="0 0 32 32" width="54" height="54" xmlns="http://www.w3.org/2000/svg">
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

  const ogHtml = `<!DOCTYPE html>
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
    border: 3px solid #121815;
    box-shadow: 6px 6px 0 #121815;
    display: flex;
    position: relative;
    overflow: hidden;
    padding: 54px 64px;
  }
  .left {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    max-width: 590px;
    z-index: 2;
  }
  .brand-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .brand-mark {
    display: block;
    flex-shrink: 0;
  }
  .brand-title {
    font-size: 54px;
    font-weight: 800;
    color: #121815;
    letter-spacing: -0.035em;
    line-height: 1;
  }
  .brand-pill {
    background: #fdf0f7;
    color: #e4007c;
    border: 2px solid #fad2e1;
    font-size: 15px;
    font-weight: 800;
    padding: 6px 14px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .main-copy {
    margin-top: 16px;
  }
  .headline {
    font-size: 54px;
    font-weight: 800;
    color: #121815;
    line-height: 1.06;
    letter-spacing: -0.03em;
  }
  .headline em {
    font-style: normal;
    color: #e4007c;
  }
  .tagline {
    font-size: 26px;
    font-weight: 600;
    color: #4b5a52;
    line-height: 1.35;
    margin-top: 18px;
    letter-spacing: -0.01em;
    max-width: 520px;
  }
  .bottom-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .domain-badge {
    background: #e4007c;
    color: #ffffff;
    font-size: 28px;
    font-weight: 800;
    padding: 12px 28px;
    border-radius: 999px;
    border: 2.5px solid #121815;
    box-shadow: 3px 3px 0 #121815;
    letter-spacing: -0.01em;
  }
  .feature-tag {
    background: #eaf3ed;
    color: #234734;
    border: 2px solid #9ec2ad;
    font-size: 18px;
    font-weight: 700;
    padding: 10px 20px;
    border-radius: 999px;
  }
  .right {
    position: absolute;
    right: 14px;
    bottom: -20px;
    width: 490px;
    height: 560px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .mascot {
    width: 490px;
    height: auto;
    object-fit: contain;
    filter: drop-shadow(0 14px 28px rgba(18, 24, 21, 0.1));
  }
</style>
</head>
<body>
  <div class="card">
    <div class="left">
      <div>
        <div class="brand-row">
          ${logoSvg}
          <span class="brand-title">Jolito</span>
          <span class="brand-pill">Mexican Spanish</span>
        </div>
        <div class="main-copy">
          <h1 class="headline">Spoken Mexican Spanish that <em>sticks.</em></h1>
          <p class="tagline">Beautiful flashcards with natural audio, practiced at your rhythm.</p>
        </div>
      </div>
      <div class="bottom-row">
        <div class="domain-badge">joli.to</div>
        <span class="feature-tag">100% Free & Offline</span>
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
