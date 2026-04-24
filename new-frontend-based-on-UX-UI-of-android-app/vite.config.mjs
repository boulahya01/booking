import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

/** @type {import('vite').UserConfig} */
export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: true,
    port: 5173
  }
});
