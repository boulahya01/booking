import adapter from '@sveltejs/adapter-vercel'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    csrf: {
      trustedOrigins: [
        'http://localhost:5173',
        'https://uneem.site',
        'https://www.uneem.site'
      ]
    },
    csp: {
      directives: {
        'default-src': ['self'],
        'base-uri': ['self'],
        'object-src': ['none'],
        'form-action': ['self'],
        'frame-ancestors': ['none'],
        'script-src': ['self', 'unsafe-inline'],
        'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
        'img-src': ['self', 'data:', 'https:', 'blob:'],
        'font-src': ['self', 'https://fonts.gstatic.com'],
        'connect-src': [
          'self',
          'https://*.supabase.co',
          'wss://*.supabase.co',
          'http://localhost:*',
          'ws://localhost:*'
        ]
      }
    }
  }
}

export default config
