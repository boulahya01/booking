import adapter from '@sveltejs/adapter-vercel'; // ← only change this line
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    csrf: {
      trustedOrigins: [
        'http://localhost:5173',
        'https://test-bookings-two.vercel.app',
        'https://uneem.site',
        'https://www.uneem.site'
      ]
    },
    csp: {
      directives: {
        'default-src': ['self'],
        'script-src': ['self', 'unsafe-inline', 'unsafe-eval'],
        'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
        'img-src': ['self', 'data:', 'https:', 'blob:'],
        'font-src': ['self', 'https://fonts.gstatic.com'],
        'connect-src': ['self', 'https:', 'http://localhost:*', 'wss://*.supabase.co'],
        'frame-ancestors': ['none']
      }
    }
  }
};

export default config;