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

test('PWA install metadata is reachable', async ({ request }) => {
  const manifestResponse = await request.get('/app.webmanifest');
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

  const faviconResponse = await request.get('/favicon.ico', { maxRedirects: 0 });
  expect([200, 301, 302, 307, 308]).toContain(faviconResponse.status());
});
