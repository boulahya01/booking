import { writable, derived } from 'svelte/store'
import type { AccountState } from '$lib/types'

export type UserStatus = 'pending' | 'approved' | 'suspended'

export type User = {
  id: string
  email?: string
  full_name?: string
  student_id?: string | null
  role?: 'admin' | 'user'
  status?: UserStatus
  created_at?: string
  updated_at?: string
}

type AuthState = {
  user: User | null
  account: AccountState | null
  loading: boolean
  error: string | null
}

const createAuthStore = () => {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    account: null,
    // The first client render must not assume "signed out" before Supabase has
    // restored the persisted session. Route guards wait for this to resolve.
    loading: true,
    error: null
  })

  return {
    subscribe,
    setSessionContext: (userData: User, account: AccountState) =>
      set({ user: userData, account, loading: false, error: null }),
    setUser: (userData: User) =>
      update((state) => ({ ...state, user: userData, loading: false, error: null })),
    setAccount: (account: AccountState) =>
      update((state) => ({ ...state, account, loading: false, error: null })),
    clear: () => set({ user: null, account: null, loading: false, error: null }),
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
  ($state) => !!$state.user && !!$state.account?.can_use_sports
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
