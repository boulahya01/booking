import { test, expect } from '@playwright/test'

test('Google delegates authentication to Supabase PKCE without layout shift', async ({ page }) => {
  let release!: () => void
  let reads = 0

  await page.route('**/auth/v1/settings', async (route) => {
    reads++
    await new Promise<void>((resolve) => {
      release = resolve
    })
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ external: { google: true, facebook: true } })
    })
  })

  let authUrl: URL | undefined
  await page.route('**/auth/v1/authorize?**', async (route) => {
    authUrl = new URL(route.request().url())
    await route.fulfill({ contentType: 'text/html', body: '<h1>Provider authorization boundary</h1>' })
  })

  await page.goto('/login')

  const button = page.getByRole('button', { name: 'Continue with Google', exact: true })
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(button).toBeDisabled()
  await expect(page.getByRole('button', { name: /Facebook/i })).toHaveCount(0)

  const email = page.getByLabel('Email address', { exact: true })
  const y = (await email.boundingBox())!.y

  await expect.poll(() => typeof release).toBe('function')
  release()

  await expect(button).toBeEnabled()
  expect(Math.abs((await email.boundingBox())!.y - y)).toBeLessThan(1)
  expect(reads).toBe(1)

  await page.screenshot({ path: test.info().outputPath('login-google.png'), fullPage: true })
  await button.click()

  await expect(page.getByRole('heading', { name: 'Provider authorization boundary' })).toBeVisible()
  expect(authUrl!.searchParams.get('provider')).toBe('google')
  expect(authUrl!.searchParams.get('redirect_to')).toBe(
    new URL('/verify-email', test.info().project.use.baseURL).href
  )
  expect(authUrl!.searchParams.get('code_challenge_method')).toBe('s256')
  expect(authUrl!.searchParams.get('code_challenge')).toBeTruthy()
})

test('unavailable Google provider leaves email sign-in usable', async ({ page }) => {
  await page.route('**/auth/v1/settings', (route) => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.goto('/login')

  await expect(page.getByRole('button', { name: /Continue with Google/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Facebook/i })).toHaveCount(0)
  await expect(page.getByLabel('Email address', { exact: true })).toBeEnabled()

  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('Enter your password.', { exact: true })).toBeVisible()
})
