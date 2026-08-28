import { writable } from 'svelte/store'

type PwaUpdateState = {
  available: boolean
  applying: boolean
  error: boolean
}

export const pwaUpdateState = writable<PwaUpdateState>({ available: false, applying: false, error: false })

let registration: ServiceWorkerRegistration | null = null
let initialized = false
let reloading = false

function markWaitingWorker() {
  if (registration?.waiting && navigator.serviceWorker.controller) {
    pwaUpdateState.set({ available: true, applying: false, error: false })
  }
}

async function checkForUpdate() {
  if (!registration) return
  try {
    await registration.update()
    markWaitingWorker()
  } catch {
    // Background checks are best-effort. Only surface a failure after the user
    // explicitly asks to apply an update.
  }
}

function watchInstalling(worker: ServiceWorker | null) {
  if (!worker) return
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      markWaitingWorker()
    }
  })
}

function waitForInstallingWorker(worker: ServiceWorker): Promise<void> {
  if (worker.state === 'installed' || worker.state === 'redundant') return Promise.resolve()

  return new Promise((resolve) => {
    const handleStateChange = () => {
      if (worker.state !== 'installed' && worker.state !== 'redundant') return
      worker.removeEventListener('statechange', handleStateChange)
      resolve()
    }

    worker.addEventListener('statechange', handleStateChange)
  })
}

export function initPwaUpdates(): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return () => undefined
  if (initialized) return () => undefined
  initialized = true

  const handleControllerChange = () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  }

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') void checkForUpdate()
  }

  navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
  document.addEventListener('visibilitychange', handleVisibility)

  void navigator.serviceWorker.ready.then((readyRegistration) => {
    registration = readyRegistration
    markWaitingWorker()
    watchInstalling(registration.installing)
    registration.addEventListener('updatefound', () => watchInstalling(registration?.installing ?? null))
    void checkForUpdate()
  }).catch(() => undefined)

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    document.removeEventListener('visibilitychange', handleVisibility)
    initialized = false
    registration = null
  }
}

export async function applyPwaUpdate(): Promise<void> {
  if (!registration) return
  pwaUpdateState.update((state) => ({ ...state, applying: true, error: false }))

  try {
    if (!registration.waiting) {
      await registration.update()

      if (registration.installing) {
        await waitForInstallingWorker(registration.installing)
      }
    }

    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      return
    }

    pwaUpdateState.set({ available: false, applying: false, error: false })
  } catch {
    pwaUpdateState.set({ available: true, applying: false, error: true })
  }
}
