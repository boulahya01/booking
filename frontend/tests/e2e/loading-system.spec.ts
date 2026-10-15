import { expect, test } from '@playwright/test'

test('real async auth actions use local feedback and block duplicate submits', async ({ page }) => {
  let signupRequests = 0
  let releaseSignup: () => void = () => undefined
  const signupGate = new Promise<void>(resolve => { releaseSignup = resolve })

  await page.route('**/auth/v1/settings', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ external: { google: true } })
  }))

  await page.route('**/auth/v1/signup**', async (route) => {
    signupRequests += 1
    await signupGate
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'unexpected_failure', message: 'Database error saving new user' })
    })
  })

  await page.goto('/register', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email address', { exact: true }).fill('loading-check@example.com')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  await expect(page.getByText('ID approval required before booking')).toBeVisible()
  await page.getByLabel('Full name', { exact: true }).fill('Loading Check')
  await page.getByLabel('Username', { exact: true }).fill('loadingcheck')
  await page.getByLabel('Student ID (optional)', { exact: true }).fill('S987654321')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  await page.getByLabel('Password', { exact: true }).fill('Secure123!')
  await page.getByLabel('Confirm password', { exact: true }).fill('Secure123!')

  const submit = page.getByRole('button', { name: 'Create account', exact: true })
  await submit.click()

  await expect(submit).toHaveAttribute('aria-busy', 'true')
  await page.waitForTimeout(200)
  await expect(page.locator('.global-loading-bar')).toHaveCount(0)
  await expect(submit).toBeDisabled()
  await expect.poll(() => signupRequests).toBe(1)
  releaseSignup()
  await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveText('These details can’t be used. Review them or sign in.')
  await expect(page.locator('.global-loading-bar')).toHaveCount(0)
})
