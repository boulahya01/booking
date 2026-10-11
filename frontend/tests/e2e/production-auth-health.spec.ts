import { test, expect } from '@playwright/test'

// Opt-in, read-only check against a published deployment. Never signs in,
// creates accounts, sends email, or replaces the provider settings response.
test('published login reaches the intended Auth service and exposes Google', async ({ page }) => {
  test.skip(process.env.REQUIRE_LIVE_AUTH_CHECK !== '1', 'Live Auth verification is explicit.')
  let mutations = 0
  await page.route('**/*.supabase.co/**', route => {
    if (route.request().method() === 'GET') return route.continue()
    mutations++
    return route.abort()
  })
  const settingsResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/auth/v1/settings')
  await page.goto('/login')
  const response = await settingsResponse
  expect(response.status()).toBe(200)
  if (process.env.LIVE_SUPABASE_ORIGIN) {
    expect(new URL(response.url()).origin).toBe(process.env.LIVE_SUPABASE_ORIGIN)
  }
  expect((await response.json()).external.google).toBe(true)
  await expect(page.getByRole('button', { name: 'Continue with Google', exact: true })).toBeEnabled()
  await expect(page.getByLabel('Email address', { exact: true })).toBeEnabled()
  expect(mutations).toBe(0)
})
