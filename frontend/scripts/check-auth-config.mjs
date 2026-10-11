import { loadEnv } from 'vite'

// Vite embeds browser configuration during the build. A healthy page shell is
// insufficient if that configuration points to an unreachable Auth service.
if (process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview') {
  const env = { ...loadEnv('production', process.cwd(), ''), ...process.env }
  const origin = env.VITE_SUPABASE_URL?.trim()
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)?.trim()
  if (!origin || !key) throw new Error('Missing browser Auth configuration.')

  let verified = false
  for (let attempt = 0; attempt < 2 && !verified; attempt++) {
    try {
      const response = await fetch(`${origin}/auth/v1/settings`, {
        headers: { apikey: key }, signal: AbortSignal.timeout(10_000)
      })
      if (!response.ok) throw new Error('Auth settings unavailable.')
      const settings = await response.json()
      if (settings.external?.google !== true) throw new Error('Google sign-in unavailable.')
      verified = true
    } catch {
      if (attempt === 1) throw new Error('Deployment stopped: Auth must be reachable and Google sign-in enabled. Check the deployment browser configuration.')
    }
  }
  console.log('Deployment Auth health check passed; Google sign-in enabled.')
} else {
  console.log('Hosted Auth health gate skipped outside Vercel; local tests use fictional fixtures.')
}
