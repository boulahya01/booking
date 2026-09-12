import { writable } from 'svelte/store'

export const WELCOME_STORAGE_KEY = 'unem:welcome-seen'

type EntryState = {
  ready: boolean
  welcomeSeen: boolean
}

export const entryState = writable<EntryState>({
  ready: false,
  welcomeSeen: false
})

export function initializeEntryState() {
  if (typeof window === 'undefined') return

  let welcomeSeen = false
  try {
    welcomeSeen = localStorage.getItem(WELCOME_STORAGE_KEY) === '1'
  } catch {
    // Storage may be unavailable in hardened/private browser contexts.
  }

  entryState.set({ ready: true, welcomeSeen })
}

export function markWelcomeSeen() {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(WELCOME_STORAGE_KEY, '1')
  } catch {
    // The in-memory state still prevents duplicate landing routing this session.
  }

  entryState.set({ ready: true, welcomeSeen: true })
}
