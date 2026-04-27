import { redirect } from '@sveltejs/kit'
import type { LayoutLoad } from './$types'

export const load: LayoutLoad = async ({ url, data }) => {
  // This runs on both server and client
  // Client-side auth check happens in +layout.svelte
  // For SSR, we can't check auth without cookies, so we let client handle it

  const pathname = url.pathname

  // Allow access to pending-approval without auth check
  // (users with pending/rejected status need to access it)
  if (pathname === '/pending-approval') {
    return
  }

  // All other app routes require at least a session
  // The actual status check happens client-side in +layout.svelte
  return {}
}
