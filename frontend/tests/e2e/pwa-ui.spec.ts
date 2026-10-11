import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/auth/v1/settings', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ external: { google: true } }) }))
})

test('a fresh device uses light mode even when the OS prefers dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Continue with Google', exact: true })).toBeEnabled()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f5f5f7')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('theme'))).toBe('light')
})

test('an explicitly saved dark preference is retained', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.goto('/login')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101113')
})

test('update notice stays above the form and can be dismissed without reloading', async ({ page }) => {
  await page.addInitScript(() => {
    const waiting = { postMessage() { (window as any).updateRequests = ((window as any).updateRequests || 0) + 1 } }
    const registration = Object.assign(new EventTarget(), { waiting, installing: null, update: async () => undefined })
    const runtime = Object.assign(new EventTarget(), { controller: {}, ready: Promise.resolve(registration), register: async () => registration })
    Object.defineProperty(navigator, 'serviceWorker', { value: runtime })
  })
  await page.goto('/login')
  const notice = page.getByRole('status', { name: 'UNEEM update ready' })
  await expect(notice).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Google', exact: true })).toBeEnabled()
  const banner = (await notice.boundingBox())!
  const email = (await page.getByLabel('Email address', { exact: true }).boundingBox())!
  expect(banner.y + banner.height).toBeLessThan(email.y)
  expect(await notice.evaluate(node => getComputedStyle(node).position)).toBe('static')
  const emailField = page.getByLabel('Email address', { exact: true })
  await emailField.fill('student@example.com')
  await notice.getByRole('button', { name: 'Later', exact: true }).click()
  await expect(notice).toHaveCount(0)
  await expect(emailField).toHaveValue('student@example.com')
  expect(await page.evaluate(() => (window as any).updateRequests || 0)).toBe(0)
})

test('optional first install uses one native prompt and disappears when installed', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Continue with Google', exact: true })).toBeEnabled()
  await page.evaluate(() => {
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: async () => { (window as any).installRequests = ((window as any).installRequests || 0) + 1 },
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' })
    })
    window.dispatchEvent(event)
  })
  const card = page.getByRole('region', { name: 'UNEEM on your home screen' })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Install app', exact: true }).click()
  expect(await page.evaluate(() => (window as any).installRequests)).toBe(1)
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
  await expect(card).toHaveCount(0)
  await expect(page.getByLabel('Email address', { exact: true })).toBeEnabled()
})

test('iPhone install shows clear instructions without invoking a native prompt', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1' }))
  await page.goto('/login')
  const card = page.getByRole('region', { name: 'UNEEM on your home screen' })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Install app', exact: true }).click()
  await expect(card.getByText('Open this site in Safari and tap Share.', { exact: true })).toBeVisible()
  await expect(card.getByText('Choose “Add to Home Screen”, then Add.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
