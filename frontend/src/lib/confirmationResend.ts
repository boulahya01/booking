const STORAGE_KEY = 'uneem:email-confirmation-resend'
const DEFAULT_COOLDOWN_SECONDS = 60

export type ConfirmationResendState = {
  email: string
  resendAfter: number
}

function browserStorage(): Storage | null {
  return typeof window !== 'undefined' ? window.localStorage : null
}

export function rememberConfirmationSend(email: string, seconds = DEFAULT_COOLDOWN_SECONDS): void {
  const normalizedEmail = email.trim().toLowerCase()
  const storage = browserStorage()
  if (!storage || !normalizedEmail) return

  const state: ConfirmationResendState = {
    email: normalizedEmail,
    resendAfter: Date.now() + Math.max(1, seconds) * 1000
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function confirmationResendSeconds(email: string): number {
  const normalizedEmail = email.trim().toLowerCase()
  const storage = browserStorage()
  if (!storage || !normalizedEmail) return 0

  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return 0

  try {
    const state = JSON.parse(raw) as ConfirmationResendState
    if (state?.email !== normalizedEmail || !Number.isFinite(state?.resendAfter)) return 0

    const remaining = Math.ceil((state.resendAfter - Date.now()) / 1000)
    if (remaining <= 0) {
      storage.removeItem(STORAGE_KEY)
      return 0
    }

    return remaining
  } catch {
    storage.removeItem(STORAGE_KEY)
    return 0
  }
}

export function formatConfirmationCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}
