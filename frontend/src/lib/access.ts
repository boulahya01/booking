import type { AccountState } from './types'

/** UI routing only. PostgreSQL independently enforces these capabilities. */
export function canBrowse(account: AccountState | null | undefined): boolean {
  return Boolean(account && account.access_status !== 'suspended' && account.restriction_reason !== 'email_confirmation_required')
}

export function canParticipate(account: AccountState | null | undefined): boolean {
  return Boolean(canBrowse(account) && account?.can_use_sports && account.identity_status === 'verified')
}

export function accountHome(account: AccountState | null | undefined): string {
  if (!canBrowse(account)) return '/pending-approval'
  return account?.role === 'admin' ? '/admin' : '/home'
}
