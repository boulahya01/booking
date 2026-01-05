import { createContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserProfile } from '../lib/auth'
import type { Profile } from '../types/database'
import type { User } from '@supabase/supabase-js'

export interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  isApproved: boolean
  authError?: string | null
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isApproved: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authInitializing, setAuthInitializing] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function init() {
      setAuthInitializing(true)
      setAuthError(null)

      try {
        // First, synchronously read any existing session from storage.
        const sessionRes = await supabase.auth.getSession()
        const session = sessionRes?.data?.session ?? null
        if (!mounted) return

        setUser(session?.user ?? null)

        if (session?.user) {
          // attempt to load profile for the stored session
          try {
            await loadProfile(session.user.id)
          } catch (err: any) {
            console.error('[AuthContext] loadProfile error during init:', err)
            setProfile(null)
            setAuthError(err?.message ?? 'Error loading profile')
          }
        } else {
          setProfile(null)
        }
      } catch (err: any) {
        console.error('[AuthContext] error during auth init:', err)
        setAuthError(err?.message ?? 'Auth initialization error')
      } finally {
        if (mounted) setAuthInitializing(false)
      }

      // Subscribe to future auth events (sign in/out, token refresh).
      const { data: { subscription } = { subscription: undefined } } = supabase.auth.onAuthStateChange((event, session) => {
        console.debug('onAuthStateChange', { event, session })
        if (!mounted) return

        setUser(session?.user ?? null)

        if (session?.user) {
          // fire-and-forget profile load for subsequent events; errors are surfaced in authError
          loadProfile(session.user.id).catch((err) => {
            console.error('[AuthContext] loadProfile error on auth event:', err)
            setProfile(null)
            setAuthError(err?.message ?? 'Error loading profile')
          })
        } else {
          setProfile(null)
        }
      })

      // cleanup function for subscription will be handled via mounted flag and returning below
      return () => {
        mounted = false
        try { subscription?.unsubscribe() } catch (e) {}
      }
    }

    const cleanupPromise = init()

    // ensure effect cleanup unsubscribes if component unmounts before init completes
    return () => {
      // mounted flag will prevent further state updates; subscription cleanup is inside init return
      mounted = false
      ;(async () => { const r = await cleanupPromise; if (typeof r === 'function') r() })()
    }
  }, [])

  async function loadProfile(userId: string) {
    try {
      setProfileLoading(true)
      setAuthError(null)
      console.log('[AuthContext] Loading profile for user:', userId)

      const profileData = await getUserProfile(userId)
      if (!profileData) {
        console.warn('[AuthContext] loadProfile: no profile found for user:', userId)
        setProfile(null)
      } else {
        console.log('[AuthContext] loadProfile success', { userId, role: profileData.role, status: profileData.status })
        setProfile(profileData)
      }
    } catch (err: any) {
      console.error('[AuthContext] Error loading profile:', err)
      setProfile(null)
      setAuthError(err?.message ?? 'Error loading profile')
    } finally {
      setProfileLoading(false)
      // authInitializing is driven by the INITIAL_SESSION event; ensure it's not left true
      setAuthInitializing(false)
    }
  }

  // keep legacy `loading` flag for consumers but compute from both flags
  useEffect(() => {
    setLoading(authInitializing || profileLoading)
  }, [authInitializing, profileLoading])

  const value: AuthContextType = {
    user,
    profile,
    loading,
    authError,
    // Admins and approved users can book
    isApproved: profile?.status === 'approved' || profile?.role === 'admin',
  }

  console.log('[AuthContext] Final state:', {
    userId: user?.id,
    profileRole: profile?.role,
    profileStatus: profile?.status,
    isApproved: value.isApproved,
  })

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
