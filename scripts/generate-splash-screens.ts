import { chromium } from '@playwright/test'
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

interface DeviceSpec {
  name: string
  width: number // logical pt
  height: number // logical pt
  pixelRatio: number
  filename: string
}

export const DEVICES: DeviceSpec[] = [
  // iPhone 16 Pro Max
  {
    name: 'iPhone 16 Pro Max',
    width: 440,
    height: 956,
    pixelRatio: 3,
    filename: 'apple-splash-1320-2868.png',
  },
  // iPhone 16 Plus, 15 Pro Max, 15 Plus, 14 Pro Max
  {
    name: 'iPhone 16 Plus / 15 Pro Max / 14 Pro Max',
    width: 430,
    height: 932,
    pixelRatio: 3,
    filename: 'apple-splash-1290-2796.png',
  },
  // iPhone 14 Plus, 13 Pro Max, 12 Pro Max
  {
    name: 'iPhone 14 Plus / 13 Pro Max / 12 Pro Max',
    width: 428,
    height: 926,
    pixelRatio: 3,
    filename: 'apple-splash-1284-2778.png',
  },
  // iPhone 16 Pro
  {
    name: 'iPhone 16 Pro',
    width: 402,
    height: 874,
    pixelRatio: 3,
    filename: 'apple-splash-1206-2622.png',
  },
  // iPhone 16, 15 Pro, 15, 14 Pro
  {
    name: 'iPhone 16 / 15 Pro / 15 / 14 Pro',
    width: 393,
    height: 852,
    pixelRatio: 3,
    filename: 'apple-splash-1179-2556.png',
  },
  // iPhone 14, 13, 13 Pro, 12, 12 Pro
  {
    name: 'iPhone 14 / 13 / 12',
    width: 390,
    height: 844,
    pixelRatio: 3,
    filename: 'apple-splash-1170-2532.png',
  },
  // iPhone 11 Pro Max, XS Max
  {
    name: 'iPhone 11 Pro Max / XS Max',
    width: 414,
    height: 896,
    pixelRatio: 3,
    filename: 'apple-splash-1242-2688.png',
  },
  // iPhone 11, XR
  {
    name: 'iPhone 11 / XR',
    width: 414,
    height: 896,
    pixelRatio: 2,
    filename: 'apple-splash-828-1792.png',
  },
  // iPhone 13 mini, 12 mini, 11 Pro, XS, X
  {
    name: 'iPhone 13 mini / 12 mini / 11 Pro / XS / X',
    width: 375,
    height: 812,
    pixelRatio: 3,
    filename: 'apple-splash-1125-2436.png',
  },
  // iPhone SE 3/2, 8, 7, 6s
  {
    name: 'iPhone SE / 8 / 7',
    width: 375,
    height: 667,
    pixelRatio: 2,
    filename: 'apple-splash-750-1334.png',
  },
  // iPad Pro 12.9"
  {
    name: 'iPad Pro 12.9"',
    width: 1024,
    height: 1366,
    pixelRatio: 2,
    filename: 'apple-splash-2048-2732.png',
  },
  // iPad Pro 11"
  {
    name: 'iPad Pro 11"',
    width: 834,
    height: 1194,
    pixelRatio: 2,
    filename: 'apple-splash-1668-2388.png',
  },
  // iPad 10.9" / 10th gen
  {
    name: 'iPad 10.9"',
    width: 820,
    height: 1180,
    pixelRatio: 2,
    filename: 'apple-splash-1640-2360.png',
  },
  // iPad 10.2" (9th/8th/7th gen)
  {
    name: 'iPad 10.2"',
    width: 810,
    height: 1080,
    pixelRatio: 2,
    filename: 'apple-splash-1620-2160.png',
  },
  // iPad mini (6th/7th gen)
  {
    name: 'iPad mini',
    width: 744,
    height: 1133,
    pixelRatio: 2,
    filename: 'apple-splash-1488-2266.png',
  },
]

async function generateSplashScreens() {
  const rootDir = process.cwd()
  const splashDir = resolve(rootDir, 'public/splash')
  mkdirSync(splashDir, { recursive: true })

  const welcomeImgBase64 = readFileSync(
    resolve(rootDir, 'assets/jolito-welcome.webp'),
  ).toString('base64')

  const browser = await chromium.launch()

  console.log(
    `🎨 Generating ${DEVICES.length} iOS splash screens with solo smiling Jolito mascot...`,
  )

  // Render solo smiling mascot centered on Jolito paper background
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 100vw;
    height: 100vh;
    background-color: #fdf5f8;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .mascot-container {
    display: flex;
    align-items: center;
    justify-content: center;
    /* Optical center adjustment: slightly above absolute midpoint */
    transform: translateY(-2%);
  }
  .mascot {
    width: min(190px, 48vw);
    height: auto;
    object-fit: contain;
    filter: drop-shadow(0 14px 28px rgba(18, 24, 21, 0.08));
  }
</style>
</head>
<body>
  <div class="mascot-container">
    <img class="mascot" src="data:image/webp;base64,${welcomeImgBase64}" alt="Jolito" />
  </div>
</body>
</html>`

  for (const device of DEVICES) {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.pixelRatio,
    })
    const page = await context.newPage()

    await page.setContent(html)
    const outPath = join(splashDir, device.filename)
    const rawBuffer = await page.screenshot()
    try {
      const { default: sharp } = await import('sharp')
      const compressed = await sharp(rawBuffer)
        .png({ quality: 80, compressionLevel: 9, palette: true })
        .toBuffer()
      writeFileSync(outPath, compressed)
    } catch {
      writeFileSync(outPath, rawBuffer)
    }
    await context.close()
    console.log(
      `✔ [${device.name}] ${device.filename} (${device.width * device.pixelRatio}x${device.height * device.pixelRatio})`,
    )
  }

  // Fallback splash screen (iPhone standard)
  const fallbackSource = join(splashDir, 'apple-splash-1179-2556.png')
  const fallbackDest = join(splashDir, 'apple-splash-fallback.png')
  writeFileSync(fallbackDest, readFileSync(fallbackSource))
  console.log('✔ [Fallback] apple-splash-fallback.png')

  // Android splash screens
  const androidResDir = resolve(rootDir, 'android/app/src/main/res')
  if (existsSync(androidResDir)) {
    console.log('🎨 Generating Android splash screens with Jolito mascot...')
    const androidSpecs = [
      { dir: 'drawable', width: 480, height: 320 },
      { dir: 'drawable-port-mdpi', width: 320, height: 480 },
      { dir: 'drawable-port-hdpi', width: 480, height: 800 },
      { dir: 'drawable-port-xhdpi', width: 720, height: 1280 },
      { dir: 'drawable-port-xxhdpi', width: 960, height: 1600 },
      { dir: 'drawable-port-xxxhdpi', width: 1280, height: 1920 },
      { dir: 'drawable-land-mdpi', width: 480, height: 320 },
      { dir: 'drawable-land-hdpi', width: 800, height: 480 },
      { dir: 'drawable-land-xhdpi', width: 1280, height: 720 },
      { dir: 'drawable-land-xxhdpi', width: 1600, height: 960 },
      { dir: 'drawable-land-xxxhdpi', width: 1920, height: 1280 },
    ]

    for (const spec of androidSpecs) {
      const targetDir = join(androidResDir, spec.dir)
      mkdirSync(targetDir, { recursive: true })
      const context = await browser.newContext({
        viewport: { width: spec.width, height: spec.height },
        deviceScaleFactor: 1,
      })
      const page = await context.newPage()
      await page.setContent(html)
      const outPath = join(targetDir, 'splash.png')
      const rawBuffer = await page.screenshot()
      try {
        const { default: sharp } = await import('sharp')
        const compressed = await sharp(rawBuffer)
          .png({ quality: 80, compressionLevel: 9, palette: true })
          .toBuffer()
        writeFileSync(outPath, compressed)
      } catch {
        writeFileSync(outPath, rawBuffer)
      }
      await context.close()
      console.log(
        `✔ [Android] ${spec.dir}/splash.png (${spec.width}x${spec.height})`,
      )
    }
    console.log('🎉 Android splash screens generated successfully!')
  }

  await browser.close()
  console.log('🎉 iOS and Android splash screens generated successfully!')
}

generateSplashScreens().catch((err) => {
  console.error(err)
  process.exit(1)
})
