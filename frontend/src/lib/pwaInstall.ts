import { get, writable } from 'svelte/store'

type InstallOutcome = 'accepted' | 'dismissed' | 'ios' | 'unavailable'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type PwaInstallState = {
  standalone: boolean
  available: boolean
  ios: boolean
}

const initialState: PwaInstallState = {
  standalone: false,
  available: false,
  ios: false
}

export const pwaInstallState = writable<PwaInstallState>(initialState)

let deferredPrompt: BeforeInstallPromptEvent | null = null
let initialized = false
let cleanupRuntime: (() => void) | null = null

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIosWeb(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone()
}

export function initPwaInstall(): () => void {
  if (typeof window === 'undefined') return () => undefined
  if (initialized) return () => undefined
  initialized = true

  const syncEnvironment = () => {
    const standalone = isStandalone()
    pwaInstallState.update((state) => ({
      ...state,
      standalone,
      ios: isIosWeb(),
      available: standalone ? false : state.available
    }))
  }

  const handleBeforeInstallPrompt = (event: Event) => {
    const installEvent = event as BeforeInstallPromptEvent
    installEvent.preventDefault()
    deferredPrompt = installEvent
    pwaInstallState.set({ standalone: false, available: true, ios: isIosWeb() })
  }

  const handleInstalled = () => {
    deferredPrompt = null
    pwaInstallState.set({ standalone: true, available: false, ios: false })
  }

  const displayMode = window.matchMedia('(display-mode: standalone)')
  syncEnvironment()
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleInstalled)
  displayMode.addEventListener('change', syncEnvironment)

  cleanupRuntime = () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.removeEventListener('appinstalled', handleInstalled)
    displayMode.removeEventListener('change', syncEnvironment)
    deferredPrompt = null
    initialized = false
    cleanupRuntime = null
  }

  return cleanupRuntime
}

export async function promptPwaInstall(): Promise<InstallOutcome> {
  const state = get(pwaInstallState)
  if (state.standalone) return 'unavailable'
  if (!deferredPrompt) return state.ios ? 'ios' : 'unavailable'

  const prompt = deferredPrompt
  deferredPrompt = null

  try {
    await prompt.prompt()
    const choice = await prompt.userChoice
    pwaInstallState.update((current) => ({ ...current, available: false }))
    return choice.outcome
  } catch {
    // beforeinstallprompt events are single-use. If the browser rejects the
    // prompt, keep the UI truthful instead of leaving a dead install button.
    pwaInstallState.update((current) => ({ ...current, available: false }))
    return 'unavailable'
  }
}
