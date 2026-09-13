import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { expect, test } from '@playwright/test'

// Real HTTP failures reach the service worker; page route mocks cannot model
// the browser's install/activation rules or CacheStorage's atomic addAll.
for (const failure of ['HTTP error', 'HTML fallback'] as const) {
  test(`keeps a complete app through a ${failure} upgrade, offline reload, and recovery`, async ({
    page,
    context,
  }, testInfo) => {
    let deployment: 'original' | 'broken' | 'recovered' = 'original'
    const types: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.webmanifest': 'application/manifest+json',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.woff2': 'font/woff2',
      '.wasm': 'application/wasm',
    }
    const server = createServer((request, response) => {
      void (async () => {
        const path = new URL(request.url!, 'http://localhost').pathname
        // Match production static hosting: /index.html redirects to the scope root.
        if (path === '/index.html') {
          response.writeHead(308, { Location: '/' }).end()
          return
        }
        const documentPath =
          path !== '/' && !extname(path)
            ? `${path.replace(/\/$/, '')}.html`
            : path
        response.setHeader('Cache-Control', 'no-store')
        response.setHeader(
          'Content-Type',
          types[extname(documentPath)] ??
            (path === '/' ? 'text/html' : 'application/octet-stream'),
        )
        if (
          deployment === 'broken' &&
          failure === 'HTTP error' &&
          path !== '/sw.js'
        ) {
          response.writeHead(503).end('deployment unavailable')
          return
        }
        // Cloudflare's SPA fallback returns the matching index with status 200
        // when a required JS asset is missing from an otherwise valid deployment.
        const htmlFallback =
          deployment === 'broken' &&
          failure === 'HTML fallback' &&
          /^\/assets\/index-.*\.js$/.test(path)
        if (htmlFallback)
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
        const file = resolve(
          'dist',
          path === '/' || htmlFallback ? 'index.html' : `.${documentPath}`,
        )
        let contents = await readFile(file)
        if (path === '/sw.js' && deployment !== 'original') {
          contents = Buffer.from(
            contents
              .toString()
              .replace(
                /const BUILD_ID = '([a-f0-9]+)'/,
                "const BUILD_ID = '$1-next'",
              ),
          )
        }
        if ((path === '/' || htmlFallback) && deployment !== 'original') {
          contents = Buffer.from(
            contents
              .toString()
              .replace(
                /name="jolito-build" content="([a-f0-9]+)"/,
                'name="jolito-build" content="$1-next"',
              ),
          )
        }
        if (path === '/' || htmlFallback) {
          contents = Buffer.from(
            contents
              .toString()
              .replace(
                '<head>',
                `<head><meta name="test-deployment" content="${deployment}">`,
              ),
          )
        }
        response.end(contents)
      })().catch(() => response.writeHead(404).end())
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('Missing test server address')
    const visitDocuments = async (appBuild: 'original' | 'recovered') => {
      const documents = await context.newPage()
      for (const [path, title] of [
        ['/privacy', 'Privacy Policy'],
        ['/acknowledgements', 'Acknowledgements'],
        ['/update', 'Update Jolito safely'],
      ] as const) {
        await documents.goto(`http://127.0.0.1:${address.port}${path}`)
        await expect(
          documents.getByRole('heading', { name: title, exact: true }),
        ).toBeVisible()
        await expect(
          documents.locator('meta[name="jolito-build"]'),
        ).toHaveCount(0)
        await documents
          .getByRole('link', { name: 'Jolito', exact: true })
          .click()
        await expect(
          documents.getByRole('heading', {
            name: /make the words you meet stick/i,
          }),
        ).toBeVisible()
        await expect(
          documents.locator('meta[name="test-deployment"]'),
        ).toHaveAttribute('content', appBuild)
      }
      await documents.close()
    }
    try {
      await page.goto(`http://127.0.0.1:${address.port}/`)
      await page.locator('html[data-offline-ready="true"]').waitFor()
      await page.reload()
      await expect(
        page.getByRole('heading', { name: /make the words you meet stick/i }),
      ).toBeVisible()
      await expect(
        page.locator('meta[name="test-deployment"]'),
      ).toHaveAttribute('content', 'original')

      await visitDocuments('original')

      const update = () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.ready
          const state = new Promise<string>((resolve) => {
            registration.addEventListener(
              'updatefound',
              () => {
                const worker = registration.installing!
                worker.addEventListener('statechange', () => {
                  if (
                    worker.state === 'redundant' ||
                    worker.state === 'installed'
                  )
                    resolve(worker.state)
                })
              },
              { once: true },
            )
          })
          await registration.update()
          return state
        })
      deployment = 'broken'
      expect(await update()).toBe('redundant')
      await page.reload()
      await expect(
        page.locator('meta[name="test-deployment"]'),
      ).toHaveAttribute('content', 'original')
      await context.setOffline(true)
      await page.reload()
      await page.locator('html[data-offline-ready="true"]').waitFor()
      await expect(
        page.getByRole('heading', { name: /make the words you meet stick/i }),
      ).toBeVisible()
      await page.getByRole('button', { name: /^create a card$/i }).click()
      const spanish = page.getByRole('combobox', { name: /mexican spanish/i })
      await spanish.fill('ahor')
      await expect(page.getByText('ahorita')).toBeVisible()
      await page.screenshot({
        path: testInfo.outputPath('offline-after-failed-update.png'),
      })

      deployment = 'recovered'
      await context.setOffline(false)
      expect(await update()).toBe('installed')
      await expect(spanish).toHaveValue('ahor')
      // A new tab also receives the installed old HTML while this update waits.
      const otherTab = await context.newPage()
      await otherTab.goto(`http://127.0.0.1:${address.port}/`)
      await expect(
        otherTab.locator('meta[name="test-deployment"]'),
      ).toHaveAttribute('content', 'original')
      await otherTab.locator('html[data-offline-ready="true"]').waitFor()
      await otherTab.close()
      await visitDocuments('original')
      await expect(spanish).toHaveValue('ahor')

      // A page from a different build (e.g. a hard reload bypassing the worker)
      // cannot borrow the old worker's readiness acknowledgement.
      const rejected = page.waitForEvent('console', {
        predicate: (message) =>
          message.text().includes('Offline preparation failed'),
      })
      await page.evaluate(() => {
        const build = document.querySelector<HTMLMetaElement>(
          'meta[name="jolito-build"]',
        )!
        build.content += '-next'
        window.dispatchEvent(
          new PageTransitionEvent('pageshow', { persisted: true }),
        )
      })
      await rejected
      await expect(page.locator('html')).toHaveAttribute(
        'data-offline-ready',
        'false',
      )
      await page.evaluate(() => {
        const build = document.querySelector<HTMLMetaElement>(
          'meta[name="jolito-build"]',
        )!
        build.content = build.content.replace('-next', '')
        window.dispatchEvent(
          new PageTransitionEvent('pageshow', { persisted: true }),
        )
      })
      await page.locator('html[data-offline-ready="true"]').waitFor()
      // The running tab keeps its complete old build until it closes.
      await expect(
        page.getByRole('heading', { name: 'New flashcard' }),
      ).toBeVisible()
      await page.close()
      page = await context.newPage()
      await page.goto(`http://127.0.0.1:${address.port}/`)
      await expect(
        page.locator('meta[name="test-deployment"]'),
      ).toHaveAttribute('content', 'recovered')
      await visitDocuments('recovered')
      await page.locator('html[data-offline-ready="true"]').waitFor()
      await context.setOffline(true)
      await page.reload()
      await expect(
        page.getByRole('heading', { name: /make the words you meet stick/i }),
      ).toBeVisible()
      await expect(
        page.locator('meta[name="test-deployment"]'),
      ).toHaveAttribute('content', 'recovered')
    } finally {
      await context.setOffline(false)
      await page.close()
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  })
}
