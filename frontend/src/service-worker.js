/// <reference lib="webworker" />

import { build, files, version } from '$service-worker'

const worker = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (globalThis))
const CACHE = `uneem-shell-${version}`

// Only cache compiled app assets and files from /static. Dynamic pages,
// Supabase requests, availability and booking mutations always use the network.
const ASSETS = [...build, ...files]

worker.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  )
})

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => (key.startsWith('uneem-shell-') || key.startsWith('unembook-shell-')) && key !== CACHE)
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
  if (url.origin !== worker.location.origin || !ASSETS.includes(url.pathname)) return

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(url.pathname)
      return cached || fetch(event.request)
    })
  )
})
