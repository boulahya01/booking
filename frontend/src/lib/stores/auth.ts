import { writable, derived } from 'svelte/store'

export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

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
    // The first client render must not assume "signed out" before Supabase has
    // restored the persisted session. Route guards wait for this to resolve.
    loading: true,
    error: null
  })

  return {
    subscribe,
    setUser: (userData: User) =>
      update((state) => ({ ...state, user: userData, loading: false, error: null })),
    clear: () => set({ user: null, loading: false, error: null }),
    setLoading: (loading: boolean) => update((state) => ({ ...state, loading })),
    setError: (error: string) => update((state) => ({ ...state, error, loading: false }))
  }
}

export const authState = createAuthStore()

export const user = derived(authState, ($state) => $state.user)

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
