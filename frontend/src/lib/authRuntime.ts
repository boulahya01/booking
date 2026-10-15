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

  let cacheUserId: string | null = null
  let revision = 0
  let authEventRevision = 0
  let sessionReadRevision = 0
  let disposed = false
  let activeWork: { userId: string; promise: Promise<void> } | null = null
  let stopBootstrapLoading: (() => void) | null = null

  function stopProgress() {
    stopBootstrapLoading?.()
    stopBootstrapLoading = null
  }

  function setCacheIdentity(nextUserId: string | null) {
    if (cacheUserId === nextUserId) return
    // Invalidate old work before it can populate either the store or a cache.
    revision += 1
    activeWork = null
    stopProgress()
    clearRequestCache()
    cacheUserId = nextUserId
    const currentUser = get(authState).user
    if (currentUser && currentUser.id !== nextUserId) {
      authState.clear()
      if (nextUserId) authState.setLoading(true)
    }
  }

  function sessionUser(user: any): User {
    return { id: user.id, email: user.email ?? undefined }
  }

  function isCurrent(userId: string, requestRevision: number) {
    return !disposed && revision === requestRevision && cacheUserId === userId
  }

  async function applySession(session: any, requestRevision: number, force: boolean) {
    const userId = session.user.id
    const fallbackUser = sessionUser(session.user)
    try {
      restorePasswordRecovery(userId)
      const context = await getMySessionContext(force)
      if (!isCurrent(userId, requestRevision)) return
      if (!context) {
        authState.setBootstrapError(fallbackUser, 'profile_not_found')
        return
      }

      const { profile, account } = context
      // A response started near an identity transition must never authorize
      // a different account, even if the client switched tokens mid-request.
      if (profile.id !== userId || account.user_id !== userId) {
        throw new Error('session_identity_mismatch')
      }
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
      if (isCurrent(userId, requestRevision)) {
        const failure = classifyBootstrapError(error)
        const known = get(authState)
        if (failure === 'network_error' && known.user?.id === userId && known.account) {
          // Keep a previously confirmed same-user view usable during a transient
          // outage. Every booking mutation still checks current access on-server.
          authState.setRefreshError(true)
        } else authState.setBootstrapError(fallbackUser, failure)
      }
    }
  }

  function acceptSession(session: any, force = false, loginOwnsContext = false): Promise<void> {
    if (disposed) return Promise.resolve()
    const userId = session?.user?.id ?? null
    setCacheIdentity(userId)

    if (!userId) {
      revision += 1
      activeWork = null
      stopProgress()
      clearPasswordRecovery()
      authState.clear()
      return Promise.resolve()
    }

    markWelcomeSeen()
    restorePasswordRecovery(userId)
    // Email login already resolves context and chooses its return destination.
    // Still observe its identity above so no prior private cache survives.
    if (loginOwnsContext) return Promise.resolve()
    if (activeWork && activeWork.userId === userId && !force) return activeWork.promise

    const requestRevision = ++revision
    const currentAuth = get(authState)
    const blocking = currentAuth.user?.id !== userId || !currentAuth.account
    stopProgress()
    authState.setLoading(blocking)
    if (blocking) stopBootstrapLoading = beginLoading('bootstrap')

    const promise = applySession(session, requestRevision, force).finally(() => {
      if (!isCurrent(userId, requestRevision)) return
      activeWork = null
      authState.setLoading(false)
      stopProgress()
    })
    activeWork = { userId, promise }
    return promise
  }

  async function syncSession(force = false) {
    const readRevision = ++sessionReadRevision
    const eventRevision = authEventRevision
    const currentAuth = get(authState)
    if (!currentAuth.user || !currentAuth.account) authState.setLoading(true)
    try {
      const { data, error } = await supabase.auth.getSession()
      if (disposed || readRevision !== sessionReadRevision || eventRevision !== authEventRevision) return
      if (error) throw error
      await acceptSession(data?.session, force)
    } catch {
      if (!disposed && readRevision === sessionReadRevision && eventRevision === authEventRevision) {
        await acceptSession(null)
      }
    }
  }

  restorePasswordRecovery()
  const stopBootstrapRetry = registerAuthBootstrapRetry(() => syncSession(true))
  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    if (disposed) return
    if (event === 'SIGNED_OUT') {
      authEventRevision += 1
      void acceptSession(null)
      return
    }
    if (event === 'PASSWORD_RECOVERY' && session?.user) {
      authEventRevision += 1
      markPasswordRecovery(session)
      void acceptSession(session)
      return
    }
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
      authEventRevision += 1
      const loginOwnsContext = event === 'SIGNED_IN' && get(page).url.pathname === '/login' && get(authState).loading
      void acceptSession(session, false, loginOwnsContext)
    }
  })

  void syncSession()

  return () => {
    disposed = true
    revision += 1
    stopProgress()
    authListener.subscription.unsubscribe()
    stopBootstrapRetry()
  }
}
