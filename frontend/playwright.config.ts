import { defineConfig, devices } from '@playwright/test';

const remoteBaseURL = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, '');
const baseURL = remoteBaseURL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'android-pixel-5',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: remoteBaseURL
    ? undefined
    : {
        command: 'npm run dev -- --port 5173',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        stdout: 'pipe',
      },
});
