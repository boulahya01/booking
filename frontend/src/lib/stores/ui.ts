import { writable, derived } from 'svelte/store'

export type Theme = 'light' | 'dark' | 'auto'
export type Language = 'en' | 'ar'

export type Toast = {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

export type UIState = {
  theme: Theme
  language: Language
  toasts: Toast[]
  unreadNotifications: number
}

function createUIStore() {
  // Use deterministic defaults to avoid SSR hydration mismatches.
  // LocalStorage is read in +layout.svelte onMount.
  const { subscribe, set, update } = writable<UIState>({
    theme: 'auto',
    language: 'en',
    toasts: [],
    unreadNotifications: 0
  })

  return {
    subscribe,
    setTheme: (theme: Theme) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('theme', theme)
      }
      update((state) => ({
        ...state,
        theme
      }))
      // Apply theme to document
      if (typeof document !== 'undefined') {
        if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    },
    setLanguage: (language: Language) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('language', language)
      }
      update((state) => ({
        ...state,
        language
      }))
      // Apply language to document
      if (typeof document !== 'undefined') {
        document.documentElement.lang = language
        if (language === 'ar') {
          document.documentElement.dir = 'rtl'
        } else {
          document.documentElement.dir = 'ltr'
        }
      }
    },
    toggleTheme: () =>
      update((state) => {
        const themes: Theme[] = ['light', 'dark', 'auto']
        const currentIndex = themes.indexOf(state.theme)
        const nextTheme = themes[(currentIndex + 1) % themes.length]
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('theme', nextTheme)
        }
        return {
          ...state,
          theme: nextTheme
        }
      }),
    addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration = 4000) => {
      const id = Date.now().toString()
      const toast: Toast = { id, message, type, duration }
      update((state) => ({
        ...state,
        toasts: [...state.toasts, toast]
      }))
      if (duration > 0) {
        setTimeout(() => {
          uiState.removeToast(id)
        }, duration)
      }
      return id
    },
    removeToast: (id: string) =>
      update((state) => ({
        ...state,
        toasts: state.toasts.filter((t) => t.id !== id)
      })),
    setUnreadNotifications: (count: number) =>
      update((state) => ({
        ...state,
        unreadNotifications: count
      }))
  }
}

export const uiState = createUIStore()

export const theme = derived(uiState, ($state) => $state.theme)
export const language = derived(uiState, ($state) => $state.language)
export const toasts = derived(uiState, ($state) => $state.toasts)
export const unreadNotifications = derived(uiState, ($state) => $state.unreadNotifications)
