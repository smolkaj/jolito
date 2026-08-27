import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { chromium } from '@playwright/test'

const rootDir = path.resolve(import.meta.dirname, '..')
const publicDir = path.join(rootDir, 'public')

// Option 4: Ramillete Radial (Symmetrical 6-petal modernist crown)
const option4Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">
  <rect x="3" y="6.5" width="11" height="4.5" rx="2.25" transform="rotate(-22 8.5 8.75)" fill="#e4007c" />
  <rect x="1" y="13.75" width="12" height="4.5" rx="2.25" fill="#e4007c" />
  <rect x="3" y="21" width="11" height="4.5" rx="2.25" transform="rotate(22 8.5 23.25)" fill="#e4007c" />

  <rect x="18" y="6.5" width="11" height="4.5" rx="2.25" transform="rotate(22 23.5 8.75)" fill="#e4007c" />
  <rect x="19" y="13.75" width="12" height="4.5" rx="2.25" fill="#e4007c" />
  <rect x="18" y="21" width="11" height="4.5" rx="2.25" transform="rotate(-22 23.5 23.25)" fill="#e4007c" />

  <circle cx="16" cy="16" r="6" fill="#121815" />
  <circle cx="16" cy="16" r="4.2" fill="#f59e0b" />
  <circle cx="16" cy="16" r="2.2" fill="#ffffff" />
</svg>`

// Write public/favicon.svg
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), option4Svg, 'utf8')
console.log('Saved public/favicon.svg (Option 4: Ramillete Radial)')

// Generate raster icons for production & PWA
async function buildRasters() {
  const browser = await chromium.launch()

  // 1. Browser tab favicons (transparent background for light/dark tab strips)
  const tabFavicons = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon.png', size: 32 },
  ]

  for (const item of tabFavicons) {
    const page = await browser.newPage({
      viewport: { width: item.size, height: item.size },
      deviceScaleFactor: 1,
    })
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; }
          body { width: ${item.size}px; height: ${item.size}px; display: flex; overflow: hidden; background: transparent; }
          svg { width: 100%; height: 100%; }
        </style>
      </head>
      <body>${option4Svg}</body>
      </html>
    `)
    await page.screenshot({
      path: path.join(publicDir, item.name),
      omitBackground: true,
    })
    await page.close()
  }

  // 2. App launcher & Home screen icons (iOS apple-touch-icon, Android/PWA icons)
  // iOS renders transparent touch icons with a black background; we use solid
  // Jolito Paper (#fdf5f8) with prominent 88% scale for bold native appearance.
  const appIcons = [
    { name: 'apple-touch-icon.png', size: 180, scale: 0.88 },
    { name: 'icon-192.png', size: 192, scale: 0.88 },
    { name: 'icon-512.png', size: 512, scale: 0.88 },
    { name: 'icon-512-maskable.png', size: 512, scale: 0.8 },
  ]

  for (const item of appIcons) {
    const markSize = Math.round(item.size * item.scale)
    const page = await browser.newPage({
      viewport: { width: item.size, height: item.size },
      deviceScaleFactor: 1,
    })
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: ${item.size}px;
            height: ${item.size}px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fdf5f8;
            overflow: hidden;
          }
          .mark-wrapper {
            width: ${markSize}px;
            height: ${markSize}px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          svg { width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        <div class="mark-wrapper">
          ${option4Svg}
        </div>
      </body>
      </html>
    `)
    await page.screenshot({
      path: path.join(publicDir, item.name),
      omitBackground: false,
    })
    await page.close()
  }

  await browser.close()
  console.log(
    'Generated production raster icons (transparent tab favicons + solid paper app icons)',
  )
}

// Generate multi-layer favicon.ico (16, 32, 48px)
function buildIco() {
  const script = `
from PIL import Image
import os

public_dir = "${publicDir}"
png32 = os.path.join(public_dir, "favicon-32x32.png")
png16 = os.path.join(public_dir, "favicon-16x16.png")
ico_out = os.path.join(public_dir, "favicon.ico")

img32 = Image.open(png32).convert("RGBA")
img16 = Image.open(png16).convert("RGBA")
img48 = img32.resize((48, 48), Image.Resampling.LANCZOS)

img32.save(ico_out, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=[img16, img48])
print("Built multi-layer favicon.ico")
`
  execSync(`python3 -c '${script}'`, { stdio: 'inherit' })
}

async function main() {
  await buildRasters()
  buildIco()
  console.log('Production favicon build complete!')
}

main().catch(console.error)
