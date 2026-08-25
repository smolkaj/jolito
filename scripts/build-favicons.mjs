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

  const iconSizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon.png', size: 32 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'icon-512-maskable.png', size: 512 },
  ]

  for (const item of iconSizes) {
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

  await browser.close()
  console.log('Generated production raster icons')
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
