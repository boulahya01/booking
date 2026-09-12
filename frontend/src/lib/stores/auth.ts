import { writable, derived } from 'svelte/store'
import { canParticipate } from '$lib/access'
import type { AccountState } from '$lib/types'
import type { BootstrapError } from '$lib/accountResolver'

export type UserStatus = 'pending' | 'approved' | 'suspended'

export type User = {
  id: string
  email?: string
  full_name?: string
  username?: string | null
  student_id?: string | null
  role?: 'admin' | 'user' | 'student'
  status?: UserStatus
  created_at?: string
  updated_at?: string
}

type AuthState = {
  user: User | null
  account: AccountState | null
  loading: boolean
  error: string | null
  bootstrapError: BootstrapError
}

const emptyState: AuthState = {
  user: null,
  account: null,
  loading: true,
  error: null,
  bootstrapError: null
}

const createAuthStore = () => {
  const { subscribe, set, update } = writable<AuthState>(emptyState)

  return {
    subscribe,
    setSessionContext: (userData: User, account: AccountState) =>
      set({ user: userData, account, loading: false, error: null, bootstrapError: null }),
    setBootstrapError: (userData: User, bootstrapError: Exclude<BootstrapError, null>) =>
      set({ user: userData, account: null, loading: false, error: null, bootstrapError }),
    setUser: (userData: User) =>
      update((state) => ({ ...state, user: userData, loading: false, error: null })),
    setAccount: (account: AccountState) =>
      update((state) => ({ ...state, account, loading: false, error: null, bootstrapError: null })),
    clear: () => set({ user: null, account: null, loading: false, error: null, bootstrapError: null }),
    setLoading: (loading: boolean) => update((state) => ({ ...state, loading })),
    setError: (error: string) => update((state) => ({ ...state, error, loading: false }))
  }
}

export const authState = createAuthStore()

export const user = derived(authState, ($state) => $state.user)
export const accountState = derived(authState, ($state) => $state.account)

export function setUser(userData: User) {
  authState.setUser(userData)
}

export function clearUser() {
  authState.clear()
}

export const isAuthenticated = derived(
  authState,
  ($state) => !!$state.user
)

export const hasFullAccess = derived(
  authState,
  ($state) => !!$state.user && canParticipate($state.account)
)

export const isAdmin = derived(
  authState,
  ($state) => $state.account?.role === 'admin' || $state.user?.role === 'admin'
)

export const isPending = derived(
  authState,
  ($state) => $state.account?.access_status === 'pending'
)

export const isSuspended = derived(
  authState,
  ($state) => $state.account?.access_status === 'suspended'
)

export const needsIdentityAction = derived(
  authState,
  ($state) => !!$state.account?.needs_identity_action
)
