import { writable } from 'svelte/store'

type PwaUpdateState = {
  available: boolean
  applying: boolean
}

export const pwaUpdateState = writable<PwaUpdateState>({ available: false, applying: false })

let registration: ServiceWorkerRegistration | null = null
let initialized = false
let reloading = false

function markWaitingWorker() {
  if (registration?.waiting && navigator.serviceWorker.controller) {
    pwaUpdateState.set({ available: true, applying: false })
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
    if (document.visibilityState === 'visible') void registration?.update()
  }

  navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
  document.addEventListener('visibilitychange', handleVisibility)

  void navigator.serviceWorker.ready.then((readyRegistration) => {
    registration = readyRegistration
    markWaitingWorker()
    watchInstalling(registration.installing)
    registration.addEventListener('updatefound', () => watchInstalling(registration?.installing ?? null))
    void registration.update()
  })

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    document.removeEventListener('visibilitychange', handleVisibility)
    initialized = false
    registration = null
  }
}

export async function applyPwaUpdate(): Promise<void> {
  if (!registration) return
  pwaUpdateState.update((state) => ({ ...state, applying: true }))

  if (!registration.waiting) {
    await registration.update()
    markWaitingWorker()
  }

  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  } else {
    pwaUpdateState.set({ available: false, applying: false })
  }
}
