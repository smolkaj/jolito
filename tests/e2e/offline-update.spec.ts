import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { expect, test } from '@playwright/test'

// Real HTTP failures reach the service worker; page route mocks cannot model
// the browser's install/activation rules or CacheStorage's atomic addAll.
test('keeps a complete rendered app through failed upgrade, offline reload, and online recovery', async ({
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
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('Content-Type', types[extname(path)] ?? 'text/html')
      if (deployment === 'broken' && path !== '/sw.js') {
        response.writeHead(503).end('deployment unavailable')
        return
      }
      const file = resolve('dist', path === '/' ? 'index.html' : `.${path}`)
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
      if (
        (path === '/' || path === '/index.html') &&
        deployment !== 'original'
      ) {
        contents = Buffer.from(
          contents
            .toString()
            .replace(
              /name="jolito-build" content="([a-f0-9]+)"/,
              'name="jolito-build" content="$1-next"',
            ),
        )
      }
      if (path === '/' || path === '/index.html') {
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
  try {
    await page.goto(`http://127.0.0.1:${address.port}/`)
    await page.locator('html[data-offline-ready="true"]').waitFor()
    await page.reload()
    await expect(
      page.getByRole('heading', { name: /make the words you meet stick/i }),
    ).toBeVisible()
    await expect(page.locator('meta[name="test-deployment"]')).toHaveAttribute(
      'content',
      'original',
    )

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
    await expect(page.locator('meta[name="test-deployment"]')).toHaveAttribute(
      'content',
      'original',
    )
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
    // A new tab also receives the installed old HTML while this update waits.
    const otherTab = await context.newPage()
    await otherTab.goto(`http://127.0.0.1:${address.port}/`)
    await expect(
      otherTab.locator('meta[name="test-deployment"]'),
    ).toHaveAttribute('content', 'original')
    await otherTab.locator('html[data-offline-ready="true"]').waitFor()
    await otherTab.close()

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
    await expect(page.locator('meta[name="test-deployment"]')).toHaveAttribute(
      'content',
      'recovered',
    )
    await page.locator('html[data-offline-ready="true"]').waitFor()
    await context.setOffline(true)
    await page.reload()
    await expect(
      page.getByRole('heading', { name: /make the words you meet stick/i }),
    ).toBeVisible()
    await expect(page.locator('meta[name="test-deployment"]')).toHaveAttribute(
      'content',
      'recovered',
    )
  } finally {
    await context.setOffline(false)
    await page.close()
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})
