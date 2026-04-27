import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter(),
    csrf: {
      trustedOrigins: [process.env.VITE_APP_URL || 'http://localhost:5173']
    },
    csp: {
      directives: {
        'default-src': ['self'],
        'script-src': ['self', 'unsafe-inline', 'unsafe-eval'],
        'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
        'img-src': ['self', 'data:', 'https:', 'blob:'],
        'font-src': ['self', 'https://fonts.gstatic.com'],
        'connect-src': ['self', 'https:', 'http://localhost:*', 'wss://'],
        'frame-ancestors': ['none']
      }
    }
  }
};

export default config;
