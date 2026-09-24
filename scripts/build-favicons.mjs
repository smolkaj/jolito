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

const iosOnly =
  process.argv.includes('--ios-only') || process.argv.includes('--check-ios')
const checkIos = process.argv.includes('--check-ios')
const iosIcon =
  '../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'

// Write public/favicon.svg
if (!iosOnly)
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), option4Svg, 'utf8')
console.log('Saved public/favicon.svg (Option 4: Ramillete Radial)')

// Generate raster icons for production & PWA
async function buildRasters() {
  const browser = await chromium.launch()

  // 1. Browser tab & search engine favicons (transparent background for light/dark tab strips)
  const tabFavicons = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-48x48.png', size: 48 },
    { name: 'favicon-96x96.png', size: 96 },
    { name: 'favicon.png', size: 32 },
  ]

  for (const item of iosOnly ? [] : tabFavicons) {
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
    { name: iosIcon, size: 1024, scale: 0.88 },
    { name: 'apple-touch-icon.png', size: 180, scale: 0.88 },
    { name: 'icon-192.png', size: 192, scale: 0.88 },
    { name: 'icon-512.png', size: 512, scale: 0.88 },
    { name: 'icon-512-maskable.png', size: 512, scale: 0.8 },
  ]

  for (const item of appIcons.filter(
    (item) => !iosOnly || item.name === iosIcon,
  )) {
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
    const rendered = await page.screenshot({ omitBackground: false })
    const destination = path.join(publicDir, item.name)
    if (checkIos) {
      if (!fs.readFileSync(destination).equals(rendered)) {
        throw new Error(
          'iOS icon differs from the canonical brand. Run node scripts/build-favicons.mjs --ios-only',
        )
      }
    } else {
      fs.writeFileSync(destination, rendered)
    }
    await page.close()
  }

  // 3. Android launcher & adaptive icons (mipmap densities)
  const androidResDir = path.join(rootDir, 'android/app/src/main/res')
  if (!iosOnly && fs.existsSync(androidResDir)) {
    const androidMipmaps = [
      { density: 'mdpi', size: 48, fgSize: 108, fgMark: 72 },
      { density: 'hdpi', size: 72, fgSize: 162, fgMark: 108 },
      { density: 'xhdpi', size: 96, fgSize: 216, fgMark: 144 },
      { density: 'xxhdpi', size: 144, fgSize: 324, fgMark: 216 },
      { density: 'xxxhdpi', size: 192, fgSize: 432, fgMark: 288 },
    ]

    for (const item of androidMipmaps) {
      const mipmapDir = path.join(androidResDir, `mipmap-${item.density}`)
      if (!fs.existsSync(mipmapDir)) {
        fs.mkdirSync(mipmapDir, { recursive: true })
      }

      // Legacy launcher & round launcher (solid #fdf5f8 background, 88% scale)
      const markSize = Math.round(item.size * 0.88)
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
      const launcherBuffer = await page.screenshot({ omitBackground: false })
      fs.writeFileSync(path.join(mipmapDir, 'ic_launcher.png'), launcherBuffer)
      fs.writeFileSync(
        path.join(mipmapDir, 'ic_launcher_round.png'),
        launcherBuffer,
      )
      await page.close()

      // Adaptive foreground (transparent background, centered mark)
      const fgPage = await browser.newPage({
        viewport: { width: item.fgSize, height: item.fgSize },
        deviceScaleFactor: 1,
      })
      await fgPage.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              width: ${item.fgSize}px;
              height: ${item.fgSize}px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: transparent;
              overflow: hidden;
            }
            .mark-wrapper {
              width: ${item.fgMark}px;
              height: ${item.fgMark}px;
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
      const fgBuffer = await fgPage.screenshot({ omitBackground: true })
      fs.writeFileSync(
        path.join(mipmapDir, 'ic_launcher_foreground.png'),
        fgBuffer,
      )
      await fgPage.close()
    }
  }

  await browser.close()
  console.log(
    'Generated production raster icons (transparent tab favicons + solid paper app icons + Android mipmaps)',
  )
}

// Generate multi-layer favicon.ico (16, 32, 48px)
function buildIco() {
  const script = `
from PIL import Image
import os

public_dir = "${publicDir}"
png48 = os.path.join(public_dir, "favicon-48x48.png")
png32 = os.path.join(public_dir, "favicon-32x32.png")
png16 = os.path.join(public_dir, "favicon-16x16.png")
ico_out = os.path.join(public_dir, "favicon.ico")

img48 = Image.open(png48).convert("RGBA")
img32 = Image.open(png32).convert("RGBA")
img16 = Image.open(png16).convert("RGBA")

img48.save(ico_out, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=[img32, img16])
print("Built multi-layer favicon.ico")
`
  execSync(`python3 -c '${script}'`, { stdio: 'inherit' })
}

async function main() {
  await buildRasters()
  if (!iosOnly) buildIco()
  console.log('Production favicon build complete!')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
