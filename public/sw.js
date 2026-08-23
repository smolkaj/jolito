/* global self, caches, fetch, URL */

const CACHE_NAME = 'jolito-shell-v1'
const scopePath = new URL(self.registration.scope).pathname
const shellUrl = scopePath
const indexUrl = `${scopePath}index.html`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([shellUrl, indexUrl]))
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

  const urls = event.data.urls.filter(
    (url) =>
      typeof url === 'string' &&
      new URL(url, self.location.origin).origin === self.location.origin,
  )
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(urls))
      .then(() => event.ports[0]?.postMessage('cached')),
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
