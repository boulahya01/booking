import { writable, derived } from 'svelte/store'

export type UserStatus = 'pending' | 'approved' | 'rejected'

export type User = {
  id: string
  email?: string
  full_name?: string
  student_id?: string
  role?: 'admin' | 'user'
  status?: UserStatus
  created_at?: string
  updated_at?: string
}

type AuthState = {
  user: User | null
  loading: boolean
  error: string | null
}

const createAuthStore = () => {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    loading: false,
    error: null
  })

  return {
    subscribe,
    setUser: (userData: User) =>
      update((s) => ({ ...s, user: userData, error: null })),
    clear: () => set({ user: null, loading: false, error: null }),
    setLoading: (loading: boolean) => update((s) => ({ ...s, loading })),
    setError: (error: string) => update((s) => ({ ...s, error, loading: false }))
  }
}

export const authState = createAuthStore()

// Keep user as a derived store for backward compatibility
export const user = derived(authState, ($state) => $state.user)

export function setUser(userData: User) {
  authState.setUser(userData)
}

export function clearUser() {
  authState.clear()
}

// Has a valid session (regardless of approval status)
export const isAuthenticated = derived(
  authState,
  ($state) => !!$state.user
)

// Has full access (approved users only)
export const hasFullAccess = derived(
  authState,
  ($state) => !!$state.user && $state.user.status === 'approved'
)

export const isAdmin = derived(
  authState,
  ($state) => $state.user?.role === 'admin'
)

export const isPending = derived(
  authState,
  ($state) => $state.user?.status === 'pending'
)

export const isRejected = derived(
  authState,
  ($state) => $state.user?.status === 'rejected'
)
