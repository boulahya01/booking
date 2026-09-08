/// <reference lib="webworker" />

import { version } from '$service-worker'

const worker = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (globalThis))
const CACHE = `uneem-runtime-${version}`

// Do not eagerly download every route/static asset during service-worker install.
// Browser/CDN caching already handles normal static files. Only cache versioned
// SvelteKit immutable chunks after the app actually requests them.
worker.addEventListener('install', () => {
  // Keep updates non-disruptive: the existing page remains controlled until the
  // user applies an available update through the normal PWA update flow.
})

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => (
            key.startsWith('uneem-shell-') ||
            key.startsWith('unembook-shell-') ||
            key.startsWith('uneem-runtime-')
          ) && key !== CACHE)
          .map((key) => caches.delete(key))
      )
      await worker.clients.claim()
    })
  )
})

worker.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void worker.skipWaiting()
  }
})

worker.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== worker.location.origin || !url.pathname.startsWith('/_app/immutable/')) return

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request)
      if (cached) return cached

      const response = await fetch(event.request)
      if (response.ok) void cache.put(event.request, response.clone())
      return response
    })
  )
})
