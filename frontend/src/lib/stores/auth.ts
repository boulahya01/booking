import { writable, derived } from 'svelte/store'
import { canParticipate } from '$lib/access'
import type { AccountState } from '$lib/types'
import type { AccountIdentity, ConnectedProvider } from '$lib/accountIdentity'

export type UserStatus = 'pending' | 'approved' | 'suspended'
export type BootstrapError = 'profile_not_found' | 'network_error' | 'database_error' | null

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
  identity: AccountIdentity | null
  loading: boolean
  error: string | null
  bootstrapError: BootstrapError
}

const createAuthStore = () => {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    account: null,
    identity: null,
    // The first client render must not assume "signed out" before Supabase has
    // restored the persisted session. Route guards wait for this to resolve.
    loading: true,
    error: null,
    bootstrapError: null
  })

  return {
    subscribe,
    setSessionContext: (userData: User, account: AccountState, identity?: AccountIdentity | null) =>
      set({ user: userData, account, identity: identity ?? null, loading: false, error: null, bootstrapError: null }),
    setUser: (userData: User) =>
      update((state) => ({ ...state, user: userData, loading: false, error: null, bootstrapError: null })),
    setAccount: (account: AccountState) =>
      update((state) => ({ ...state, account, loading: false, error: null, bootstrapError: null })),
    setIdentity: (identity: AccountIdentity) =>
      update((state) => ({ ...state, identity, loading: false, error: null, bootstrapError: null })),
    setBootstrapError: (error: BootstrapError) =>
      update((state) => ({ ...state, bootstrapError: error })),
    clear: () => set({ user: null, account: null, identity: null, loading: false, error: null, bootstrapError: null }),
    setLoading: (loading: boolean) => update((state) => ({ ...state, loading })),
    setError: (error: string) => update((state) => ({ ...state, error, loading: false }))
  }
}

export const authState = createAuthStore()

export const user = derived(authState, ($state) => $state.user)
export const accountState = derived(authState, ($state) => $state.account)
export const accountIdentity = derived(authState, ($state) => $state.identity)

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

export const hasPassword = derived(
  authState,
  ($state) => $state.identity?.hasPassword ?? false
)

export const connectedProviders = derived(
  authState,
  ($state) => $state.identity?.providers ?? []
)

export const canAddPassword = derived(
  authState,
  ($state) => $state.identity?.canAddPassword ?? false
)

export const bootstrapError = derived(
  authState,
  ($state) => $state.bootstrapError
)