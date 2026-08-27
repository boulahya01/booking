import { expect, test, type Page } from '@playwright/test';

const publicRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/help',
] as const;

const languages = [
  { value: 'en', dir: 'ltr' },
  { value: 'ar', dir: 'rtl' },
] as const;

const vercelShareUrl = process.env.PLAYWRIGHT_VERCEL_SHARE_URL;

async function primeProtectedPreview(page: Page) {
  if (!vercelShareUrl) return;

  const expectedOrigin = new URL(vercelShareUrl).origin;
  const response = await page.goto(vercelShareUrl, { waitUntil: 'domcontentloaded' });

  expect(response, 'Vercel share URL did not return a document response').not.toBeNull();
  await expect
    .poll(() => new URL(page.url()).origin, {
      message: 'Vercel share URL did not establish preview access',
      timeout: 15_000,
    })
    .toBe(expectedOrigin);
}

async function seedUi(page: Page, language: 'en' | 'ar') {
  await page.addInitScript(
    ({ language }) => {
      localStorage.setItem('language', language);
      localStorage.setItem('theme', 'dark');
    },
    { language },
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      })),
    )
    .toEqual(
      expect.objectContaining({
        documentWidth: await page.evaluate(() => document.documentElement.clientWidth),
      }),
    );
}

test.beforeEach(async ({ page }) => {
  await primeProtectedPreview(page);
});

for (const language of languages) {
  test.describe(`${language.value.toUpperCase()} public launch shell`, () => {
    for (const route of publicRoutes) {
      test(`${route} renders without fatal runtime/layout failures`, async ({ page }) => {
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));

        await seedUi(page, language.value);
        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });

        expect(response, `missing document response for ${route}`).not.toBeNull();
        expect(response!.status(), `${route} returned ${response!.status()}`).toBeLessThan(400);

        await expect(page.locator('body')).toBeVisible();
        await expect
          .poll(() => page.locator('html').getAttribute('lang'))
          .toBe(language.value);
        await expect
          .poll(() => page.locator('html').getAttribute('dir'))
          .toBe(language.dir);
        await expect
          .poll(() => page.locator('html').evaluate((node) => node.classList.contains('dark')))
          .toBe(true);

        await expectNoHorizontalOverflow(page);
        expect(pageErrors, `uncaught page errors on ${route}`).toEqual([]);
      });
    }
  });
}

test.describe('public auth authority negatives', () => {
  test('direct reset-password visit cannot create recovery authority', async ({ page }) => {
    await seedUi(page, 'en');
    const response = await page.goto('/reset-password', { waitUntil: 'domcontentloaded' });

    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);
    await expect(page.getByRole('heading', { name: 'Recovery link not valid' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Update password' })).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem('uneem:password-recovery')))
      .toBeNull();
  });

  test('malformed email-confirmation token fails closed', async ({ page }) => {
    await seedUi(page, 'en');
    const response = await page.goto('/verify-email?token_hash=uneem-invalid-token&type=email', {
      waitUntil: 'domcontentloaded',
    });

    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);
    await expect(page.getByRole('heading', { name: 'Link not confirmed' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe('/verify-email');
  });
});

test('PWA install metadata is reachable', async ({ page }) => {
  const manifestResponse = await page.request.get('/app.webmanifest');
  expect(manifestResponse.ok()).toBe(true);

  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe('UNEEM');
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192' }),
      expect.objectContaining({ sizes: '512x512' }),
      expect.objectContaining({ purpose: expect.stringContaining('maskable') }),
    ]),
  );

  const faviconResponse = await page.request.get('/favicon.ico', { maxRedirects: 0 });
  expect([200, 301, 302, 307, 308]).toContain(faviconResponse.status());
});
