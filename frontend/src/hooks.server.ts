import type { Handle } from '@sveltejs/kit'
import { init } from 'svelte-i18n'

init({
  fallbackLocale: 'en',
  initialLocale: 'en'
})

// V1 stored the browser session with the standard Supabase JS client but the
// server hook tried to infer authentication by checking only whether an
// auth-looking cookie name existed. That could redirect valid returning users
// before the browser restored its real session, and cookie presence was never a
// trustworthy authorization check in the first place.
//
// Until V2 moves to @supabase/ssr with verified cookie-backed sessions, server
// hooks do not make authentication decisions. The app layout waits for the
// browser session to resolve, while Supabase RLS remains the data-security
// boundary.
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event)

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  return response
}
