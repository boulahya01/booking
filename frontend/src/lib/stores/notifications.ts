import { get, writable } from 'svelte/store'
import { supabase } from '$lib/supabaseClient'
import { authState } from './auth'
import { language, uiState } from './ui'

export type Announcement = {
  id: string
  title_en: string
  title_ar: string
  body_en: string
  body_ar: string
  published_at: string
  expires_at: string | null
}

type NotificationState = {
  items: Announcement[]
  loading: boolean
  refreshing: boolean
  error: boolean
}

const empty = (): NotificationState => ({ items: [], loading: true, refreshing: false, error: false })
export const notifications = writable<NotificationState>(empty())
let activeUserId: string | null = null
let generation = 0
let lastFetch = 0
let pending: Promise<void> | null = null
let controller: AbortController | null = null
const hidden = new Set<string>()
const dismissing = new Set<string>()

function publish(items: Announcement[], error = false) {
  notifications.set({ items, error, loading: false, refreshing: false })
  uiState.setUnreadNotifications(items.length)
}

function reset(userId: string | null) {
  generation += 1
  controller?.abort()
  controller = null
  pending = null
  activeUserId = userId
  lastFetch = 0
  hidden.clear()
  dismissing.clear()
  notifications.set({ ...empty(), loading: Boolean(userId) })
  uiState.setUnreadNotifications(0)
}

/** Session-scoped, deduplicated refresh. Never shared through SSR requests. */
export function refreshNotifications(force = false): Promise<void> {
  const userId = activeUserId
  if (!userId) return Promise.resolve()
  if (pending) return pending
  if (!force && Date.now() - lastFetch < 45_000) return Promise.resolve()
  const requestGeneration = generation
  const abort = new AbortController()
  controller = abort
  notifications.update((state) => ({ ...state, refreshing: true, error: false }))

  const request = (async () => {
    try {
      const now = new Date().toISOString()
      const [announcements, dismissals] = await Promise.all([
        supabase.from('announcements')
          .select('id,title_en,title_ar,body_en,body_ar,published_at,expires_at')
          .eq('is_active', true).lte('published_at', now)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order('published_at', { ascending: false }).abortSignal(abort.signal),
        supabase.from('announcement_dismissals').select('announcement_id')
          .eq('user_id', userId).abortSignal(abort.signal)
      ])
      if (requestGeneration !== generation) return
      if (announcements.error) throw announcements.error
      if (dismissals.error) throw dismissals.error
      const acknowledged = new Set((dismissals.data || []).map((row) => row.announcement_id))
      publish((announcements.data || []).filter((item) => !acknowledged.has(item.id) && !hidden.has(item.id)))
    } catch {
      if (requestGeneration !== generation) return
      publish(get(notifications).items, true)
    } finally {
      if (requestGeneration === generation) {
        lastFetch = Date.now()
        pending = null
        controller = null
      }
    }
  })()
  pending = request
  return request
}

/** Hide immediately, persist to the existing RLS-protected table, restore on failure. */
export async function dismissNotification(id: string): Promise<boolean> {
  const userId = activeUserId
  const item = get(notifications).items.find((entry) => entry.id === id)
  if (!userId || !item || dismissing.has(id)) return false
  const requestGeneration = generation
  dismissing.add(id)
  hidden.add(id)
  publish(get(notifications).items.filter((entry) => entry.id !== id))
  try {
    const { error } = await supabase.from('announcement_dismissals').insert({ user_id: userId, announcement_id: id })
    if (error && error.code !== '23505') throw error
    return true
  } catch {
    if (requestGeneration === generation) {
      hidden.delete(id)
      const items = get(notifications).items.filter((entry) => entry.id !== id)
      publish([...items, item].sort((a, b) => b.published_at.localeCompare(a.published_at)))
      uiState.addToast(get(language) === 'ar' ? 'تعذر إخفاء التحديث. حاول مجدداً.' : 'Couldn’t dismiss this update. Try again.', 'error')
    }
    return false
  } finally {
    if (requestGeneration === generation) dismissing.delete(id)
  }
}

/** Mounted once by the app layout, so badges work before opening Notifications. */
export function startNotifications(): () => void {
  let initialTimer: ReturnType<typeof setTimeout> | undefined
  const unsubscribe = authState.subscribe((state) => {
    if (state.loading) return
    const nextId = state.account?.can_use_sports || state.account?.role === 'admin' ? state.user?.id ?? null : null
    if (nextId === activeUserId) return
    reset(nextId)
    clearTimeout(initialTimer)
    // Give the destination screen's primary data requests a head start.
    if (nextId) initialTimer = setTimeout(() => void refreshNotifications(), 250)
  })
  const wake = () => { if (document.visibilityState === 'visible') void refreshNotifications() }
  const online = () => { if (document.visibilityState === 'visible') void refreshNotifications(true) }
  const interval = setInterval(wake, 60_000)
  document.addEventListener('visibilitychange', wake)
  window.addEventListener('focus', wake)
  window.addEventListener('online', online)
  return () => {
    unsubscribe()
    clearTimeout(initialTimer)
    clearInterval(interval)
    document.removeEventListener('visibilitychange', wake)
    window.removeEventListener('focus', wake)
    window.removeEventListener('online', online)
    reset(null)
  }
}
