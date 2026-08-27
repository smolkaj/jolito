/* global self, caches, fetch, URL */

const CACHE_NAME = 'jolito-shell-v4'
const scopePath = new URL(self.registration.scope).pathname
const shellUrl = scopePath
const indexUrl = `${scopePath}index.html`
const PWA_ASSETS = [
  `${scopePath}manifest.webmanifest`,
  `${scopePath}favicon.svg`,
  `${scopePath}favicon.png`,
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
  `${scopePath}audio/aguacate-es.mp3`,
  `${scopePath}audio/avocado-en.mp3`,
  `${scopePath}audio/que-padre-es.mp3`,
  `${scopePath}audio/how-cool-en.mp3`,
  `${scopePath}audio/donde-esta-el-metro-es.mp3`,
  `${scopePath}audio/where-is-the-metro-en.mp3`,
  `${scopePath}audio/nos-vemos-al-rato-es.mp3`,
  `${scopePath}audio/see-you-later-en.mp3`,
  `${scopePath}audio/la-cuenta-por-favor-es.mp3`,
  `${scopePath}audio/the-bill-please-en.mp3`,
  `${scopePath}audio/para-llevar-es.mp3`,
  `${scopePath}audio/to-go-en.mp3`,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          [shellUrl, indexUrl, ...PWA_ASSETS].map((url) =>
            cache.add(url).catch(() => {}),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_URLS' || !Array.isArray(event.data.urls))
    return

  const uniqueUrls = Array.from(new Set(event.data.urls)).filter(
    (url) =>
      typeof url === 'string' &&
      new URL(url, self.location.origin).origin === self.location.origin,
  )
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(uniqueUrls.map((url) => cache.add(url).catch(() => {}))),
      )
      .then(() => event.ports[0]?.postMessage('cached'))
      .catch(() => event.ports[0]?.postMessage('cached')),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (
    request.method !== 'GET' ||
    new URL(request.url).origin !== self.location.origin
  )
    return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(indexUrl, copy))
          return response
        })
        .catch(
          async () => (await caches.match(indexUrl)) ?? caches.match(shellUrl),
        ),
    )
    return
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
