import { chromium, type BrowserContext } from '@playwright/test'
import { preview } from 'vite'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, join, basename, relative } from 'node:path'
import { execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export interface ViewportDefinition {
  key: 'mobile' | 'desktop'
  name: string
  width: number
  height: number
  deviceScaleFactor: number
  isMobile: boolean
  hasTouch: boolean
}

export const VIEWPORTS: Record<'mobile' | 'desktop', ViewportDefinition> = {
  mobile: {
    key: 'mobile',
    name: 'Mobile',
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  desktop: {
    key: 'desktop',
    name: 'Desktop',
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
}

export interface RouteTarget {
  id: string
  name: string
  path: string
}

export const DEFAULT_ROUTES: RouteTarget[] = [
  { id: 'home', name: 'Home', path: '#/' },
  { id: 'review', name: 'Review', path: '#/study' },
  { id: 'deck', name: 'Deck Manager', path: '#/deck' },
  { id: 'grammar', name: 'Grammar', path: '#/grammar' },
  { id: 'create', name: 'Create Card', path: '#/create' },
]

export interface VerifyUiOptions {
  url?: string | undefined
  build: boolean
  routes: string[]
  target?: string | undefined
  viewports: Array<'mobile' | 'desktop'>
  colorSchemes: Array<'light' | 'dark'>
  localOnly: boolean
  outDir: string
  timeoutMs: number
  help: boolean
}

export function parseCliArgs(args: string[]): VerifyUiOptions {
  const options: VerifyUiOptions = {
    build: true,
    routes: [],
    viewports: ['mobile', 'desktop'],
    colorSchemes: ['light', 'dark'],
    localOnly: false,
    outDir: '.screenshots',
    timeoutMs: 30000,
    help: false,
  }

  let i = 0
  while (i < args.length) {
    const arg = args[i]
    if (!arg) {
      i++
      continue
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true
      i++
    } else if (arg === '--url') {
      const val = args[++i]
      if (val) options.url = val
      i++
    } else if (arg.startsWith('--url=')) {
      options.url = arg.slice('--url='.length)
      i++
    } else if (arg === '--no-build') {
      options.build = false
      i++
    } else if (arg === '--build') {
      options.build = true
      i++
    } else if (arg === '--route') {
      const val = args[++i]
      if (val) options.routes.push(val)
      i++
    } else if (arg.startsWith('--route=')) {
      options.routes.push(arg.slice('--route='.length))
      i++
    } else if (arg === '--target') {
      const val = args[++i]
      if (val) options.target = val
      i++
    } else if (arg.startsWith('--target=')) {
      options.target = arg.slice('--target='.length)
      i++
    } else if (arg === '--viewport') {
      const val = args[++i]
      if (val) {
        options.viewports = parseViewportList(val)
      }
      i++
    } else if (arg.startsWith('--viewport=')) {
      options.viewports = parseViewportList(arg.slice('--viewport='.length))
      i++
    } else if (arg === '--theme' || arg === '--color-scheme') {
      const val = args[++i]
      if (val) {
        options.colorSchemes = parseColorSchemeList(val)
      }
      i++
    } else if (
      arg.startsWith('--theme=') ||
      arg.startsWith('--color-scheme=')
    ) {
      const val = arg.split('=')[1] ?? ''
      options.colorSchemes = parseColorSchemeList(val)
      i++
    } else if (arg === '--local-only') {
      options.localOnly = true
      i++
    } else if (arg === '--out') {
      const val = args[++i]
      if (val) options.outDir = val
      i++
    } else if (arg.startsWith('--out=')) {
      options.outDir = arg.slice('--out='.length)
      i++
    } else if (arg === '--timeout') {
      const val = Number.parseInt(args[++i] ?? '', 10)
      if (!Number.isNaN(val)) options.timeoutMs = val
      i++
    } else if (arg.startsWith('--timeout=')) {
      const val = Number.parseInt(arg.slice('--timeout='.length), 10)
      if (!Number.isNaN(val)) options.timeoutMs = val
      i++
    } else {
      i++
    }
  }

  return options
}

function parseViewportList(raw: string): Array<'mobile' | 'desktop'> {
  const parts = raw
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
  const list: Array<'mobile' | 'desktop'> = []
  for (const part of parts) {
    if (part === 'all') {
      return ['mobile', 'desktop']
    }
    if (part === 'mobile' || part === 'desktop') {
      if (!list.includes(part)) list.push(part)
    }
  }
  return list.length > 0 ? list : ['mobile', 'desktop']
}

function parseColorSchemeList(raw: string): Array<'light' | 'dark'> {
  const parts = raw
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
  const list: Array<'light' | 'dark'> = []
  for (const part of parts) {
    if (part === 'all') {
      return ['light', 'dark']
    }
    if (part === 'light' || part === 'dark') {
      if (!list.includes(part)) list.push(part)
    }
  }
  return list.length > 0 ? list : ['light', 'dark']
}

export function resolveRoutes(routes: string[]): RouteTarget[] {
  if (routes.length === 0) {
    return DEFAULT_ROUTES
  }

  return routes.map((raw) => {
    const clean = raw.trim()
    if (clean === '/' || clean === '#/' || clean === '#') {
      return { id: 'home', name: 'Home', path: '#/' }
    }

    if (clean.startsWith('#/')) {
      const slug = clean.slice(2).replace(/\/+$/, '')
      return resolveKnownRouteSlug(slug, clean)
    }

    if (clean.startsWith('#')) {
      const slug = clean.slice(1).replace(/\/+$/, '')
      return resolveKnownRouteSlug(slug, `#/${slug}`)
    }

    if (clean.startsWith('/')) {
      const slug = clean.slice(1).replace(/\/+$/, '')
      return resolveKnownRouteSlug(slug, `#/${slug}`)
    }

    return resolveKnownRouteSlug(clean, `#/${clean}`)
  })
}

function resolveKnownRouteSlug(slug: string, fullPath: string): RouteTarget {
  const lower = slug.toLowerCase()
  if (lower === '' || lower === 'welcome' || lower === 'home') {
    return { id: 'home', name: 'Home', path: '#/' }
  }
  if (lower === 'study' || lower === 'review') {
    return { id: 'review', name: 'Review', path: '#/study' }
  }
  if (lower === 'deck' || lower === 'cards' || lower === 'library') {
    return { id: 'deck', name: 'Deck Manager', path: '#/deck' }
  }
  if (lower === 'grammar') {
    return { id: 'grammar', name: 'Grammar', path: '#/grammar' }
  }
  if (lower === 'create') {
    return { id: 'create', name: 'Create Card', path: '#/create' }
  }
  if (lower === 'complete') {
    return { id: 'complete', name: 'Session Complete', path: '#/complete' }
  }
  if (lower === 'why-jolito' || lower === 'why') {
    return { id: 'why-jolito', name: 'Why Jolito', path: '#/why-jolito' }
  }
  if (lower === 'privacy' || lower === 'privacy-policy') {
    return { id: 'privacy', name: 'Privacy Modal', path: '#/privacy' }
  }
  if (lower === 'feedback' || lower === 'contact') {
    return { id: 'feedback', name: 'Feedback Modal', path: '#/feedback' }
  }

  const id = slug.toLowerCase().replace(/[^a-z0-9_-]/g, '-')
  const name = slug
    .split(/[-_/]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return { id, name: name || slug, path: fullPath }
}

export async function uploadToLitterbox(
  filePath: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 15000,
): Promise<{ url: string; uploaded: boolean; error?: string }> {
  try {
    const fileBytes = readFileSync(filePath)
    const fileName = basename(filePath)
    const blob = new Blob([fileBytes], { type: 'image/png' })
    const formData = new FormData()
    formData.append('reqtype', 'fileupload')
    formData.append('time', '72h')
    formData.append('fileToUpload', blob, fileName)

    const response = await fetchFn(
      'https://litterbox.catbox.moe/resources/internals/api.php',
      {
        method: 'POST',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: formData,
        signal: AbortSignal.timeout(timeoutMs),
      },
    )

    if (!response.ok) {
      throw new Error(
        `Upload failed with HTTP ${response.status} ${response.statusText}`,
      )
    }

    const text = (await response.text()).trim()
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
      throw new Error(`Unexpected response from upload service: ${text}`)
    }

    return { url: text, uploaded: true }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { url: filePath, uploaded: false, error: errorMsg }
  }
}

export interface ScreenshotResult {
  viewId: string
  viewName: string
  routePath: string
  target?: string | undefined
  viewportKey: 'mobile' | 'desktop'
  viewportName: string
  dimensions: string
  colorScheme: 'light' | 'dark'
  localPath: string
  url: string
  uploaded: boolean
  error?: string | undefined
}

export function formatMarkdownReport(
  results: ScreenshotResult[],
  options?: { relativeRoot?: string | undefined },
): string {
  const root = options?.relativeRoot ?? process.cwd()

  const tableHeader = [
    '| View | Viewport | Theme | Dimensions | Status | Preview Link |',
    '| :--- | :--- | :--- | :--- | :--- | :--- |',
  ]

  const tableRows = results.map((r) => {
    const displayPath = relative(root, r.localPath) || r.localPath
    let status = 'Uploaded (72h)'
    let link = `[Direct Image](${r.url})`

    if (!r.uploaded) {
      status = r.error
        ? `Local File (${r.error})`
        : 'Local File (Upload skipped)'
      link = `[${displayPath}](${r.url})`
    }

    return `| ${r.viewName} | ${r.viewportName} | ${capitalize(r.colorScheme)} | ${r.dimensions} | ${status} | ${link} |`
  })

  // Group previews by view
  const views = Array.from(new Set(results.map((r) => r.viewName)))
  const previews: string[] = []

  for (const view of views) {
    previews.push(`#### ${view}`)
    const viewResults = results.filter((r) => r.viewName === view)
    for (const r of viewResults) {
      const alt = `${r.viewName} • ${r.viewportName} • ${capitalize(r.colorScheme)}`
      previews.push(
        `- **${r.viewportName} (${r.dimensions}, ${capitalize(r.colorScheme)})**:`,
      )
      previews.push(`  ![${alt}](${r.url})`)
    }
    previews.push('')
  }

  const hasLocalFallback = results.some((r) => !r.url.startsWith('http'))
  const notes = hasLocalFallback
    ? [
        '> [!NOTE]',
        '> Some preview links refer to local files (offline or upload skipped). Local file paths do not render directly inside GitHub PR comments.',
        '',
      ]
    : []

  return [
    '### Visual Verification Previews',
    '',
    ...tableHeader,
    ...tableRows,
    '',
    '### Direct Image Previews',
    '',
    ...previews,
    ...notes,
  ].join('\n')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export interface ServerInstance {
  baseUrl: string
  close?: () => Promise<void>
}

export async function createPreviewServer(
  rootDir: string,
  port = 0,
): Promise<{
  port: number
  baseUrl: string
  close: () => Promise<void>
}> {
  const previewServer = await preview({
    root: rootDir,
    preview: {
      port,
      host: '127.0.0.1',
    },
  })

  const addr = previewServer.httpServer.address()
  const assignedPort =
    typeof addr === 'object' && addr && 'port' in addr ? addr.port : port
  const baseUrl = `http://127.0.0.1:${assignedPort}`

  return {
    port: assignedPort,
    baseUrl,
    close: async () => {
      await previewServer.close()
    },
  }
}

export async function isServerReachable(
  url: string,
  timeoutMs = 600,
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

export async function findOrStartServer(options: {
  url?: string | undefined
  build: boolean
  rootDir: string
}): Promise<ServerInstance> {
  if (options.url) {
    return { baseUrl: options.url.replace(/\/+$/, '') }
  }

  const distDir = join(options.rootDir, 'dist')
  const indexHtml = join(distDir, 'index.html')

  if (options.build || !existsSync(indexHtml)) {
    console.log('Building dist prior to visual verification...')
    execSync('npm run build', {
      cwd: options.rootDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_SUPABASE_URL:
          process.env.VITE_SUPABASE_URL || 'https://mock.supabase.co',
        VITE_SUPABASE_ANON_KEY:
          process.env.VITE_SUPABASE_ANON_KEY || 'mock-key',
      },
    })
  }

  console.log('Starting Vite preview server on ephemeral port...')
  const server = await createPreviewServer(options.rootDir)
  console.log(`Preview server listening at ${server.baseUrl}`)

  return {
    baseUrl: server.baseUrl,
    close: server.close,
  }
}

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
      dueAt: Date.now() - 5000,
      intervalDays: 1,
      easeFactor: 2.5,
      reviews: 2,
      lapses: 0,
    },
    contentRevision: 1,
    resetRevision: { generation: 0, at: 0 },
    createdAt: Date.now() - 86400000,
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
      dueAt: Date.now() - 2000,
      intervalDays: 3,
      easeFactor: 2.6,
      reviews: 4,
      lapses: 0,
    },
    contentRevision: 1,
    resetRevision: { generation: 0, at: 0 },
    createdAt: Date.now() - 86400000 * 3,
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
      dueAt: Date.now() - 1000,
      intervalDays: 0,
      easeFactor: 2.5,
      reviews: 0,
      lapses: 0,
    },
    contentRevision: 1,
    resetRevision: { generation: 0, at: 0 },
    createdAt: Date.now(),
  },
]

const authSession = {
  accessToken: 'valid-verify-session',
  refreshToken: 'valid-refresh-token',
  expiresAt: Date.now() + 3600000 * 24 * 30,
  user: { id: 'usr-verify', email: 'hola@jolito.app' },
}

const librariesEnvelope = {
  version: 1,
  accounts: {
    'user:usr-verify': {
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

export async function prepareContext(
  context: BrowserContext,
  viewport: ViewportDefinition,
): Promise<void> {
  // Mock Supabase sync & auth RPCs so connection pill displays green "Synced" state
  await context.route('**/rest/v1/**', async (route) => {
    const url = route.request().url()
    if (url.includes('read_deck_snapshot')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            user_id: 'usr-verify',
            revision: 1,
            updated_at: new Date().toISOString(),
            data: {
              version: 1,
              app: 'jolito',
              updatedAt: new Date().toISOString(),
              deviceId: 'dev-verify',
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
    ({ session, libs, legacyCards, isPhone }) => {
      // Seed default active deck state if unpopulated
      if (!window.localStorage.getItem('jolito-libraries-v1')) {
        window.localStorage.setItem('jolito-libraries-v1', JSON.stringify(libs))
      }
      if (!window.localStorage.getItem('jolito-library-v1')) {
        window.localStorage.setItem(
          'jolito-library-v1',
          JSON.stringify({ version: 1, cards: legacyCards }),
        )
      }
      if (!window.localStorage.getItem('jolito-auth-session-v1')) {
        window.localStorage.setItem(
          'jolito-auth-session-v1',
          JSON.stringify(session),
        )
      }
      window.sessionStorage.removeItem('jolito:has-keyboard')

      const setSafeAreas = () => {
        if (!document.documentElement) return
        delete document.documentElement.dataset.keyboard
        document.documentElement.style.setProperty(
          '--safe-area-inset-top',
          isPhone ? '59px' : '24px',
        )
        document.documentElement.style.setProperty(
          '--safe-area-inset-bottom',
          isPhone ? '34px' : '20px',
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
      isPhone: viewport.isMobile,
    },
  )
}

export function printHelp(): void {
  console.log(`
jolito verify-ui — Automated UI Visual Verification Tool

Usage:
  npm run verify:ui [options]
  node scripts/verify-ui.ts [options]

Options:
  --url <url>              Use running preview/dev server (e.g. http://localhost:5173 or preview URL)
  --no-build               Skip npm run build when starting local preview server
  --route <path>           Specific route/view to capture (repeatable, e.g. --route /deck --route /grammar)
  --target <selector>      CSS selector to screenshot specific element (e.g. .deck-table)
  --viewport <type>        mobile, desktop, or all (default: all)
  --theme <mode>           light, dark, or all (default: all)
  --local-only             Capture screenshots locally only, skip ephemeral upload to Litterbox
  --out <dir>              Output directory for captured PNGs (default: .screenshots)
  --timeout <ms>           Navigation and selector wait timeout (default: 30000)
  --help, -h               Show this help message

Default Views:
  - Home:          #/
  - Review:        #/study
  - Deck Manager:  #/deck
  - Grammar:       #/grammar
  - Create Card:   #/create
`)
}

export async function runVerification(
  options: VerifyUiOptions,
  rootDir = process.cwd(),
): Promise<ScreenshotResult[]> {
  const resolvedRoutes = resolveRoutes(options.routes)
  const outDir = resolve(rootDir, options.outDir)
  mkdirSync(outDir, { recursive: true })

  const server = await findOrStartServer({
    url: options.url,
    build: options.build,
    rootDir,
  })

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  const results: ScreenshotResult[] = []

  try {
    console.log('Launching headless Chromium browser...')
    browser = await chromium.launch()

    for (const route of resolvedRoutes) {
      for (const vpKey of options.viewports) {
        const vp = VIEWPORTS[vpKey]
        for (const scheme of options.colorSchemes) {
          const targetSlug = options.target
            ? `-${options.target.replace(/[^a-zA-Z0-9_-]/g, '_')}`
            : ''
          const filename = `${route.id}${targetSlug}-${vp.key}-${scheme}.png`
          const filePath = join(outDir, filename)
          const dimensions = `${vp.width}x${vp.height}${vp.deviceScaleFactor > 1 ? ` (@${vp.deviceScaleFactor}x)` : ''}`

          console.log(
            `Capturing: ${route.name} | ${vp.name} | ${scheme} -> ${filename}`,
          )

          const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: vp.deviceScaleFactor,
            isMobile: vp.isMobile,
            hasTouch: vp.hasTouch,
            colorScheme: scheme,
          })

          await prepareContext(context, vp)
          const page = await context.newPage()

          try {
            const targetUrl = `${server.baseUrl}/${route.path.replace(/^\//, '')}`
            await page.goto(targetUrl, {
              waitUntil: 'domcontentloaded',
              timeout: options.timeoutMs,
            })

            // Wait for web fonts and disable transitions/animations for crisp determinism
            await page.evaluate(() => document.fonts.ready)
            await page.addStyleTag({
              content: `
                *, *::before, *::after {
                  transition: none !important;
                  animation: none !important;
                  caret-color: transparent !important;
                }
              `,
            })
            await page.waitForTimeout(150)

            if (options.target) {
              const locator = page.locator(options.target).first()
              await locator.waitFor({
                state: 'visible',
                timeout: options.timeoutMs,
              })
              await locator.screenshot({ path: filePath })
            } else {
              await page.screenshot({ path: filePath, fullPage: false })
            }

            let url = filePath
            let uploaded = false
            let uploadError: string | undefined

            if (!options.localOnly) {
              console.log(`Uploading ${filename} to Litterbox (72h)...`)
              const upload = await uploadToLitterbox(filePath)
              url = upload.url
              uploaded = upload.uploaded
              uploadError = upload.error
              if (uploaded) {
                console.log(`Uploaded: ${url}`)
              } else {
                console.warn(
                  `Upload fallback to local file (${uploadError ?? 'Unknown error'})`,
                )
              }
            }

            results.push({
              viewId: route.id,
              viewName: route.name,
              routePath: route.path,
              target: options.target,
              viewportKey: vp.key,
              viewportName: vp.name,
              dimensions,
              colorScheme: scheme,
              localPath: filePath,
              url,
              uploaded,
              error: uploadError,
            })
          } finally {
            await context.close()
          }
        }
      }
    }
  } finally {
    if (browser) {
      await browser.close()
    }
    if (server.close) {
      console.log('Shutting down local preview server...')
      await server.close()
    }
  }

  return results
}

async function main() {
  const args = process.argv.slice(2)
  const options = parseCliArgs(args)

  if (options.help) {
    printHelp()
    process.exit(0)
  }

  try {
    const results = await runVerification(options)
    const report = formatMarkdownReport(results)
    console.log('\n' + report + '\n')
  } catch (err) {
    console.error('Visual verification failed:', err)
    process.exit(1)
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main()
}
