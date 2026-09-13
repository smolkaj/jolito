/* global self, caches, fetch, URL, Request */

// Replaced by the explicit Vite offline-shell build step.
const BUILD_ID = '__JOLITO_BUILD_ID__'
const CACHE_NAME = `jolito-shell-${BUILD_ID}`
const BUILD_ASSETS = /* __JOLITO_BUILD_ASSETS__ */ []
const scopePath = new URL(self.registration.scope).pathname
// Cache the canonical navigation URL; static hosts redirect /index.html to /.
// A redirected cached Response cannot satisfy a navigation with redirect: manual.
const shellUrl = scopePath
const PWA_ASSETS = [
  `${scopePath}manifest.webmanifest`,
  `${scopePath}favicon.svg`,
  `${scopePath}favicon.png`,
  `${scopePath}favicon-96x96.png`,
  `${scopePath}favicon-48x48.png`,
  `${scopePath}favicon-32x32.png`,
  `${scopePath}favicon-16x16.png`,
  `${scopePath}favicon.ico`,
  `${scopePath}apple-touch-icon.png`,
  `${scopePath}icon-192.png`,
  `${scopePath}icon-512.png`,
  `${scopePath}icon-512-maskable.png`,
  `${scopePath}og-image.png`,
  `${scopePath}fonts/bricolage-grotesque-normal-400-800-latin.woff2`,
  `${scopePath}fonts/bricolage-grotesque-normal-400-800-latin-ext.woff2`,
  `${scopePath}dict/es-en.json`,
  `${scopePath}dict/es-lemmas.json`,
]

const REQUIRED_URLS = Array.from(
  new Set([
    shellUrl,
    ...PWA_ASSETS,
    ...BUILD_ASSETS.map((file) => `${scopePath}${file}`),
  ]),
)

// A static host can substitute the SPA document for a missing asset with HTTP
// 200. Both installation and readiness must validate the cached responses, not
// just transport success. This inventory contains one HTML document: the root.
async function verifyShell(cache) {
  await Promise.all(
    REQUIRED_URLS.map(async (url) => {
      const response = await cache.match(url)
      if (!response?.ok)
        throw new Error(`Required offline asset is missing: ${url}`)
      if (url === shellUrl) {
        const html = await response.text()
        if (
          !html.includes(`<meta name="jolito-build" content="${BUILD_ID}">`)
        ) {
          throw new Error('Offline HTML belongs to a different build')
        }
      } else {
        const contentType = response.headers
          .get('Content-Type')
          ?.split(';')[0]
          .trim()
          .toLowerCase()
        if (
          contentType === 'text/html' ||
          contentType === 'application/xhtml+xml'
        ) {
          throw new Error(
            `Required offline asset was replaced with HTML: ${url}`,
          )
        }
      }
    }),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME)
        // addAll is atomic: neither HTTP failures nor quota errors publish a partial shell.
        await cache.addAll(
          REQUIRED_URLS.map(
            (url) =>
              new Request(new URL(url, self.location.origin), {
                cache: 'reload',
              }),
          ),
        )
        await verifyShell(cache)
      } catch (error) {
        await caches.delete(CACHE_NAME)
        throw error
      }
      // Updates wait for old tabs to close, keeping their HTML and lazy assets
      // usable until the browser can activate the new complete build safely.
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(
            (key) => key.startsWith('jolito-shell-') && key !== CACHE_NAME,
          )
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CHECK_OFFLINE_READY') return
  event.waitUntil(
    (async () => {
      try {
        if (event.data.buildId !== BUILD_ID) {
          event.ports[0]?.postMessage('cache-error')
          return
        }
        const cache = await caches.open(CACHE_NAME)
        await verifyShell(cache)
        event.ports[0]?.postMessage('cached')
      } catch {
        event.ports[0]?.postMessage('cache-error')
      }
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const requestUrl = new URL(request.url)
  if (
    request.method !== 'GET' ||
    requestUrl.origin !== self.location.origin ||
    requestUrl.pathname.startsWith(`${scopePath}api/`)
  )
    return

  // The installed HTML and its assets are one complete build. A navigation must
  // not replace it with HTML from a failed (or only partially deployed) update.
  // Browser service-worker updates install the next build before taking control.
  // App routes use hash fragments at the scope root. Standalone documents
  // (including Privacy and Acknowledgements) retain their host navigation.
  if (
    request.mode === 'navigate' &&
    (requestUrl.pathname === shellUrl ||
      requestUrl.pathname === `${scopePath}index.html`)
  ) {
    event.respondWith(
      caches
        .open(CACHE_NAME)
        .then(async (cache) => (await cache.match(shellUrl)) ?? fetch(request)),
    )
    return
  }

  // Only the installer writes the shell. Runtime requests do not create a second
  // cache population path, and APIs/audio remain owned by their app services.
  if (REQUIRED_URLS.includes(requestUrl.pathname)) {
    event.respondWith(
      caches
        .open(CACHE_NAME)
        .then(
          async (cache) =>
            (await cache.match(request, { ignoreVary: true })) ??
            fetch(request),
        ),
    )
  }
})
