import { get } from 'svelte/store'
import { page } from '$app/stores'
import { classifyBootstrapError } from '$lib/accountResolver'
import { markWelcomeSeen } from '$lib/entryState'
import {
  clearPasswordRecovery,
  markPasswordRecovery,
  restorePasswordRecovery
} from '$lib/authRecovery'
import { supabase } from '$lib/supabaseClient'
import { authState, type User } from '$lib/stores/auth'
import { registerAuthBootstrapRetry } from '$lib/authBootstrap'
import { getMySessionContext } from '$lib/sessionApi'
import { clearRequestCache } from '$lib/requestCache'
import { beginLoading } from '$lib/stores/loading'

export function initAuthRuntime(): () => void {
  if (typeof window === 'undefined') return () => undefined

  let processingAuth = false
  let cacheUserId: string | null = null
  let unsubAuth: (() => void) | null = null
  let unsubEarlyRecovery: (() => void) | null = null

  function setCacheIdentity(nextUserId: string | null) {
    if (cacheUserId === nextUserId) return
    clearRequestCache()
    cacheUserId = nextUserId
  }

  function sessionUser(sessionUser: any): User {
    return {
      id: sessionUser.id,
      email: sessionUser.email ?? undefined
    }
  }

  restorePasswordRecovery()

  const { data: earlyRecoveryListener } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session?.user) {
      markPasswordRecovery(session)
    } else if (event === 'SIGNED_OUT') {
      clearPasswordRecovery()
      setCacheIdentity(null)
    }
  })
  unsubEarlyRecovery = () => earlyRecoveryListener.subscription.unsubscribe()

  async function applySession(session: any) {
    if (!session?.user) {
      setCacheIdentity(null)
      clearPasswordRecovery()
      authState.clear()
      return
    }

    markWelcomeSeen()
    setCacheIdentity(session.user.id)
    const fallbackUser = sessionUser(session.user)

    try {
      restorePasswordRecovery(session.user.id)

      const context = await getMySessionContext()
      if (cacheUserId !== session.user.id) return
      if (!context) {
        authState.setBootstrapError(fallbackUser, 'profile_not_found')
        return
      }

      const { profile, account } = context
      authState.setSessionContext({
        id: profile.id,
        email: session.user.email ?? undefined,
        username: profile.username,
        student_id: profile.student_id,
        full_name: profile.full_name,
        role: profile.role === 'admin' ? 'admin' : 'user',
        status: profile.status
      }, account)
    } catch (error) {
      if (cacheUserId === session.user.id) {
        authState.setBootstrapError(fallbackUser, classifyBootstrapError(error))
      }
    }
  }

  async function syncSession() {
    if (processingAuth) return
    const stopBootstrapLoading = beginLoading('bootstrap')
    processingAuth = true
    authState.setLoading(true)

    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      if (!data?.session) clearPasswordRecovery()
      await applySession(data?.session)
    } catch {
      setCacheIdentity(null)
      clearPasswordRecovery()
      authState.clear()
    } finally {
      processingAuth = false
      authState.setLoading(false)
      stopBootstrapLoading()
    }
  }

  const stopBootstrapRetry = registerAuthBootstrapRetry(syncSession)

  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      setCacheIdentity(null)
      clearPasswordRecovery()
      authState.clear()
      return
    }

    if (event === 'PASSWORD_RECOVERY' && session?.user) {
      markPasswordRecovery(session)
      markWelcomeSeen()
      if (!processingAuth) {
        processingAuth = true
        const stopBootstrapLoading = beginLoading('bootstrap')
        authState.setLoading(true)
        void applySession(session).finally(() => {
          processingAuth = false
          authState.setLoading(false)
          stopBootstrapLoading()
        })
      }
      return
    }

    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
      markWelcomeSeen()
      restorePasswordRecovery(session.user.id)

      const currentAuth = get(authState)
      if (event === 'SIGNED_IN' && get(page).url.pathname === '/login' && currentAuth.loading) return

      if (!processingAuth) {
        processingAuth = true
        const stopBootstrapLoading = beginLoading('bootstrap')
        authState.setLoading(currentAuth.user?.id !== session.user.id)
        void applySession(session).finally(() => {
          processingAuth = false
          authState.setLoading(false)
          stopBootstrapLoading()
        })
      }
    }
  })

  unsubAuth = () => authListener?.subscription?.unsubscribe()
  void syncSession()

  return () => {
    unsubAuth?.()
    unsubEarlyRecovery?.()
    stopBootstrapRetry()
  }
}
