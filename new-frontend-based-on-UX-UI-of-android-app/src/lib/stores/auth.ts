import { writable, derived } from 'svelte/store'

export type User = {
  id: string
  email?: string
  full_name?: string
  role?: string
}

export const user = writable<User | null>(null)
export const isAuthenticated = derived(user, ($user) => !!$user)
export const isAdmin = derived(user, ($user) => $user?.role === 'admin')

export function setUser(u: User | null) {
  user.set(u)
}

export function clearUser() {
  user.set(null)
}
