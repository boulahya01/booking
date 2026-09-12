import { expect, test } from '@playwright/test'

const welcomeKey = 'unem:welcome-seen'
const landingPaintKey = 'unem:test:landing-painted'

async function setWelcome(page: import('@playwright/test').Page, seen: boolean) {
  // Seed same-origin storage from a public route. Avoid addInitScript here:
  // a persistent init script would run on every navigation and overwrite the
  // state that the landing page itself is supposed to change.
  await page.goto('/help', { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ key, value, paintKey }) => {
    if (value) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
    sessionStorage.removeItem(paintKey)
  }, { key: welcomeKey, value: seen, paintKey: landingPaintKey })
}

async function watchForLandingPaint(page: import('@playwright/test').Page) {
  await page.addInitScript(({ paintKey }) => {
    const observe = () => {
      const scan = () => {
        if (location.pathname === '/' && document.body?.textContent?.includes('Book. Play. Meet.')) {
          sessionStorage.setItem(paintKey, '1')
        }
      }

      scan()
      const observer = new MutationObserver(scan)
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', observe, { once: true })
    } else {
      observe()
    }
  }, { paintKey: landingPaintKey })
}

test.beforeEach(async ({ page }) => {
  await page.route('**/auth/v1/settings', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ external: { google: true } })
  }))
})

test('first browser visit keeps the public landing page', async ({ page }) => {
  await setWelcome(page, false)
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Book. Play. Meet.' })).toBeVisible()
})

test('returning signed-out browser visit skips landing and opens login', async ({ page }) => {
  await setWelcome(page, true)
  await watchForLandingPaint(page)
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), landingPaintKey)).toBeNull()
})

test('using a landing auth action marks the device as returning', async ({ page }) => {
  await setWelcome(page, false)
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await page.getByLabel('Book. Play. Meet.').getByRole('link', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), welcomeKey)).toBe('1')

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
})

test('fresh installed-app launch resolves to the public landing', async ({ page }) => {
  await setWelcome(page, false)
  await page.goto('/launch', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Book. Play. Meet.' })).toBeVisible()
})

test('returning signed-out installed-app launch resolves to login', async ({ page }) => {
  await setWelcome(page, true)
  await page.goto('/launch', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveURL(/\/login(?:\?|$)/)
})

test('signed-out users cannot remain on the account bootstrap error screen', async ({ page }) => {
  await setWelcome(page, true)
  await page.goto('/auth-error', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveURL(/\/login(?:\?|$)/)
})

test('PWA manifest launches through /launch', async ({ page }) => {
  const response = await page.request.get('/app.webmanifest')
  expect(response.ok()).toBe(true)
  const manifest = await response.json()

  expect(manifest.name).toBe('UNEM Sports')
  expect(manifest.start_url).toBe('/launch')
  expect(manifest.scope).toBe('/')
})
