import { writable } from 'svelte/store'

export type InstallChoice = {
  outcome: 'accepted' | 'dismissed'
  platform: string
}

export interface DeferredInstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<InstallChoice>
}

type PwaInstallState = {
  prompt: DeferredInstallPrompt | null
  engaged: boolean
  installed: boolean
  dismissedUntil: number
}

const initialState: PwaInstallState = {
  prompt: null,
  engaged: false,
  installed: false,
  dismissedUntil: 0
}

function createPwaInstallStore() {
  const { subscribe, update, set } = writable<PwaInstallState>(initialState)

  return {
    subscribe,
    setPrompt: (prompt: DeferredInstallPrompt | null) =>
      update((state) => ({ ...state, prompt })),
    setEngaged: (engaged: boolean) =>
      update((state) => ({ ...state, engaged })),
    setInstalled: (installed: boolean) =>
      update((state) => ({ ...state, installed, prompt: installed ? null : state.prompt })),
    setDismissedUntil: (dismissedUntil: number) =>
      update((state) => ({ ...state, dismissedUntil })),
    reset: () => set(initialState)
  }
}

export const pwaInstall = createPwaInstallStore()
