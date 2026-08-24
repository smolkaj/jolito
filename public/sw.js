/* global self, caches, fetch, URL */

const CACHE_NAME = 'jolito-shell-v1'
const scopePath = new URL(self.registration.scope).pathname
const shellUrl = scopePath
const indexUrl = `${scopePath}index.html`
const PWA_ASSETS = [
  `${scopePath}manifest.webmanifest`,
  `${scopePath}favicon.svg`,
  `${scopePath}favicon.png`,
  `${scopePath}favicon-32x32.png`,
  `${scopePath}favicon-16x16.png`,
  `${scopePath}apple-touch-icon.png`,
  `${scopePath}icon-192.png`,
  `${scopePath}icon-512.png`,
  `${scopePath}icon-512-maskable.png`,
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
