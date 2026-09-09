import { canBrowse, accountHome } from './access'
import type { AccountState } from './types'

const key = 'uneem:match-invite'
const matchPath = /^\/(?:bookings|matches)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function rememberInvite(path: string): boolean {
  if (!matchPath.test(path)) return false
  try { sessionStorage.setItem(key, path) } catch { /* URL still carries the destination. */ }
  return true
}

export function afterSignIn(account: AccountState | null | undefined, requested?: string | null): string {
  if (!canBrowse(account)) return accountHome(account)
  let target = requested
  if (!target && typeof window !== 'undefined') {
    target = new URLSearchParams(window.location.search).get('next')
    try { target ||= sessionStorage.getItem(key) } catch { /* Storage is optional. */ }
  }
  return target && matchPath.test(target) ? target : accountHome(account)
}

export function clearArrivedInvite(path: string) {
  if (!matchPath.test(path)) return
  try { if (sessionStorage.getItem(key) === path) sessionStorage.removeItem(key) } catch { /* Storage is optional. */ }
}
