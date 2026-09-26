import { describe, it, expect, vi } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  parseCliArgs,
  resolveRoutes,
  uploadToLitterbox,
  formatMarkdownReport,
  createPreviewServer,
  isServerReachable,
  DEFAULT_ROUTES,
  VIEWPORTS,
  type ScreenshotResult,
} from './verify-ui'

describe('verify-ui script', () => {
  describe('parseCliArgs', () => {
    it('returns default options when no arguments provided', () => {
      const options = parseCliArgs([])
      expect(options.build).toBe(true)
      expect(options.localOnly).toBe(false)
      expect(options.viewports).toEqual(['mobile', 'desktop'])
      expect(options.colorSchemes).toEqual(['light', 'dark'])
      expect(options.routes).toEqual([])
      expect(options.target).toBeUndefined()
      expect(options.outDir).toBe('.screenshots')
      expect(options.timeoutMs).toBe(30000)
      expect(options.help).toBe(false)
    })

    it('parses --url flag', () => {
      expect(parseCliArgs(['--url', 'http://localhost:5173']).url).toBe(
        'http://localhost:5173',
      )
      expect(parseCliArgs(['--url=https://preview.workers.dev']).url).toBe(
        'https://preview.workers.dev',
      )
    })

    it('parses --no-build and --build flags', () => {
      expect(parseCliArgs(['--no-build']).build).toBe(false)
      expect(parseCliArgs(['--build']).build).toBe(true)
    })

    it('parses multiple --route flags', () => {
      const options = parseCliArgs([
        '--route',
        '/deck',
        '--route=/create',
        '--route',
        '#/privacy',
      ])
      expect(options.routes).toEqual(['/deck', '/create', '#/privacy'])
    })

    it('parses --target flag', () => {
      expect(parseCliArgs(['--target', '.deck-table']).target).toBe(
        '.deck-table',
      )
      expect(parseCliArgs(['--target=#practice-card']).target).toBe(
        '#practice-card',
      )
    })

    it('parses --viewport flag with single, multiple, and all', () => {
      expect(parseCliArgs(['--viewport', 'mobile']).viewports).toEqual([
        'mobile',
      ])
      expect(parseCliArgs(['--viewport=desktop']).viewports).toEqual([
        'desktop',
      ])
      expect(parseCliArgs(['--viewport', 'mobile,desktop']).viewports).toEqual([
        'mobile',
        'desktop',
      ])
      expect(parseCliArgs(['--viewport', 'all']).viewports).toEqual([
        'mobile',
        'desktop',
      ])
    })

    it('parses --theme and --color-scheme flags', () => {
      expect(parseCliArgs(['--theme', 'dark']).colorSchemes).toEqual(['dark'])
      expect(parseCliArgs(['--color-scheme=light']).colorSchemes).toEqual([
        'light',
      ])
      expect(parseCliArgs(['--theme', 'all']).colorSchemes).toEqual([
        'light',
        'dark',
      ])
    })

    it('parses --local-only, --out, --timeout, and --help flags', () => {
      const options = parseCliArgs([
        '--local-only',
        '--out',
        'tmp/screens',
        '--timeout',
        '5000',
        '--help',
      ])
      expect(options.localOnly).toBe(true)
      expect(options.outDir).toBe('tmp/screens')
      expect(options.timeoutMs).toBe(5000)
      expect(options.help).toBe(true)
    })
  })

  describe('resolveRoutes', () => {
    it('returns DEFAULT_ROUTES when empty list provided', () => {
      const routes = resolveRoutes([])
      expect(routes).toEqual(DEFAULT_ROUTES)
      expect(routes.map((r) => r.id)).toEqual([
        'home',
        'review',
        'deck',
        'grammar',
        'create',
      ])
    })

    it('normalizes known paths to hash routes', () => {
      expect(resolveRoutes(['/'])).toEqual([
        { id: 'home', name: 'Home', path: '#/' },
      ])
      expect(resolveRoutes(['/deck'])).toEqual([
        { id: 'deck', name: 'Deck Manager', path: '#/deck' },
      ])
      expect(resolveRoutes(['/review'])).toEqual([
        { id: 'review', name: 'Review', path: '#/study' },
      ])
      expect(resolveRoutes(['#/grammar'])).toEqual([
        { id: 'grammar', name: 'Grammar', path: '#/grammar' },
      ])
      expect(resolveRoutes(['/create'])).toEqual([
        { id: 'create', name: 'Create Card', path: '#/create' },
      ])
      expect(resolveRoutes(['/why-jolito'])).toEqual([
        { id: 'why-jolito', name: 'Why Jolito', path: '#/why-jolito' },
      ])
      expect(resolveRoutes(['#/privacy'])).toEqual([
        { id: 'privacy', name: 'Privacy Modal', path: '#/privacy' },
      ])
    })

    it('formats custom route slugs gracefully', () => {
      const custom = resolveRoutes(['/account-settings', 'demo-feature'])
      expect(custom[0]).toEqual({
        id: 'account-settings',
        name: 'Account Settings',
        path: '#/account-settings',
      })
      expect(custom[1]).toEqual({
        id: 'demo-feature',
        name: 'Demo Feature',
        path: '#/demo-feature',
      })
    })
  })

  describe('uploadToLitterbox', () => {
    const tempDir = join(process.cwd(), 'node_modules/.tmp/verify-ui-tests')
    const testFile = join(tempDir, 'sample-test.png')

    mkdirSync(tempDir, { recursive: true })
    writeFileSync(testFile, Buffer.from('fake-png-content'))

    it('successfully uploads and returns remote URL on HTTP 200', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('https://litter.catbox.moe/abc1234.png\n'),
      } as Response)

      const res = await uploadToLitterbox(testFile, mockFetch)
      expect(res.uploaded).toBe(true)
      expect(res.url).toBe('https://litter.catbox.moe/abc1234.png')
      expect(res.error).toBeUndefined()
    })

    it('falls back to local file path when fetch fails or times out', async () => {
      const mockFetch = vi
        .fn<typeof fetch>()
        .mockRejectedValue(new Error('Network timeout'))

      const res = await uploadToLitterbox(testFile, mockFetch)
      expect(res.uploaded).toBe(false)
      expect(res.url).toBe(testFile)
      expect(res.error).toBe('Network timeout')
    })

    it('falls back to local file path when HTTP response status is not 200', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      } as Response)

      const res = await uploadToLitterbox(testFile, mockFetch)
      expect(res.uploaded).toBe(false)
      expect(res.url).toBe(testFile)
      expect(res.error).toContain('HTTP 502 Bad Gateway')
    })

    it('falls back to local file path when response text is malformed', async () => {
      const mockFetch = vi.fn<typeof fetch>().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('<html>Error processing image</html>'),
      } as Response)

      const res = await uploadToLitterbox(testFile, mockFetch)
      expect(res.uploaded).toBe(false)
      expect(res.url).toBe(testFile)
      expect(res.error).toContain('Unexpected response from upload service')
    })
  })

  describe('formatMarkdownReport', () => {
    const mockResults: ScreenshotResult[] = [
      {
        viewId: 'home',
        viewName: 'Home',
        routePath: '#/',
        viewportKey: 'desktop',
        viewportName: 'Desktop',
        dimensions: '1280x800',
        colorScheme: 'light',
        localPath: '/app/.screenshots/home-desktop-light.png',
        url: 'https://litter.catbox.moe/home-desktop-light.png',
        uploaded: true,
      },
      {
        viewId: 'home',
        viewName: 'Home',
        routePath: '#/',
        viewportKey: 'mobile',
        viewportName: 'Mobile',
        dimensions: '390x844 (@2x)',
        colorScheme: 'dark',
        localPath: '/app/.screenshots/home-mobile-dark.png',
        url: '/app/.screenshots/home-mobile-dark.png',
        uploaded: false,
        error: 'Offline',
      },
    ]

    it('generates markdown table and grouped direct image preview blocks', () => {
      const report = formatMarkdownReport(mockResults, {
        relativeRoot: '/app',
      })

      expect(report).toContain('### Visual Verification Previews')
      expect(report).toContain(
        '| View | Viewport | Theme | Dimensions | Status | Preview Link |',
      )
      expect(report).toContain(
        '| Home | Desktop | Light | 1280x800 | Uploaded (72h) | [Direct Image](https://litter.catbox.moe/home-desktop-light.png) |',
      )
      expect(report).toContain(
        '| Home | Mobile | Dark | 390x844 (@2x) | Local File (Offline) | [.screenshots/home-mobile-dark.png](/app/.screenshots/home-mobile-dark.png) |',
      )

      expect(report).toContain('#### Home')
      expect(report).toContain(
        '- **Desktop (1280x800, Light)**:\n  ![Home • Desktop • Light](https://litter.catbox.moe/home-desktop-light.png)',
      )
      expect(report).toContain(
        '- **Mobile (390x844 (@2x), Dark)**:\n  ![Home • Mobile • Dark](/app/.screenshots/home-mobile-dark.png)',
      )
    })
  })

  describe('Preview Server & Reachability', () => {
    it('spins up programmatic Vite preview server and shuts down cleanly', async () => {
      const server = await createPreviewServer(process.cwd(), 0)
      expect(server.port).toBeGreaterThan(0)
      expect(server.baseUrl).toBe(`http://127.0.0.1:${server.port}`)

      // Root path serves index.html
      const rootRes = await fetch(server.baseUrl)
      expect(rootRes.status).toBe(200)
      expect(await rootRes.text()).toContain('<!doctype html>')

      // Reachability check
      expect(await isServerReachable(server.baseUrl)).toBe(true)

      // Teardown
      await server.close()
      expect(await isServerReachable(server.baseUrl)).toBe(false)
    })
  })

  describe('Viewports specification contract', () => {
    it('matches exact viewport dimension specifications', () => {
      expect(VIEWPORTS.mobile.width).toBe(390)
      expect(VIEWPORTS.mobile.height).toBe(844)
      expect(VIEWPORTS.mobile.deviceScaleFactor).toBe(2)
      expect(VIEWPORTS.mobile.isMobile).toBe(true)
      expect(VIEWPORTS.mobile.hasTouch).toBe(true)

      expect(VIEWPORTS.desktop.width).toBe(1280)
      expect(VIEWPORTS.desktop.height).toBe(800)
      expect(VIEWPORTS.desktop.isMobile).toBe(false)
      expect(VIEWPORTS.desktop.hasTouch).toBe(false)
    })
  })
})
