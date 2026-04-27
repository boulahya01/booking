import type { Handle } from '@sveltejs/kit'
import { USE_MOCK } from '$lib/mock'
import { init } from 'svelte-i18n'

// Initialize i18n for server-side rendering
init({
  fallbackLocale: 'en',
  initialLocale: 'en'
})

const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/logout', '/pending-approval', '/profile']
const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/verify-email']
const PROFILE_ROUTES = ['/pending-approval', '/profile'] // Routes accessible by pending/rejected users

function hasSupabaseSession(cookies: any): boolean {
  const all: Array<{ name: string }> = cookies.getAll()
  return all.some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))
}

export const handle: Handle = async ({ event, resolve }) => {
  const pathname = event.url.pathname

  if (pathname.startsWith('/_app') || pathname.startsWith('/api')) {
    return resolve(event)
  }

  if (USE_MOCK) {
    return resolve(event)
  }

  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r))
  const hasSession = hasSupabaseSession(event.cookies)

  if (!hasSession && !isPublic) {
    return new Response(null, { status: 302, headers: { Location: '/login' } })
  }

  if (hasSession && isAuthRoute) {
    return new Response(null, { status: 302, headers: { Location: '/home' } })
  }

  return resolve(event)
}
