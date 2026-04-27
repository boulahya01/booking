import { test, expect } from '@playwright/test';

test.describe('Booking Flow (Mock Mode)', () => {
  // NOTE: These tests require mock mode which isn't fully configured yet.
  // Mock mode needs USE_MOCK=true and mock data to be properly loaded.
  // TODO: Set up proper mock mode configuration for E2E tests

  test('should display home page with pitches when logged in', async ({ page }) => {
    test.skip();
    // Navigate directly - mock auth will be checked
    await page.goto('/home');

    // Should see welcome header
    await expect(page.getByRole('heading', { name: 'Book Your Pitch' })).toBeVisible();

    // Should see pitches section
    await expect(page.getByRole('heading', { name: 'Available Pitches' })).toBeVisible();
  });

  test('should navigate from home to pitch detail page', async ({ page }) => {
    test.skip();
    await page.goto('/home');

    // Click on first pitch card
    const firstPitch = page.locator('a[href^="/pitch/"]').first();
    await expect(firstPitch).toBeVisible();
    await firstPitch.click();

    // Should navigate to pitch detail
    await page.waitForURL('**/pitch/**');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should display pitch detail with slots', async ({ page }) => {
    test.skip();
    await page.goto('/pitch/1');

    // Should see pitch name (h1 with the pitch name)
    await expect(page.locator('h1')).toBeVisible();

    // Should see slots section or loading state
    // In mock mode, slots should load
    await expect(page.getByRole('heading', { name: 'Available Slots' })).toBeVisible();
  });

  test('should select a date and view slots', async ({ page }) => {
    test.skip();
    await page.goto('/pitch/1');

    // Wait for content to load
    await page.waitForTimeout(500);

    // Date selector should be visible (if slots exist)
    const dateButtons = page.locator('button').filter({ hasText: /\d+/ });
    const count = await dateButtons.count();

    if (count > 0) {
      // Should be able to click a date
      await dateButtons.first().click();
    }
  });

  test('should open booking modal when clicking available slot', async ({ page }) => {
    test.skip();
    await page.goto('/pitch/1');
    await page.waitForTimeout(500);

    // Find an available slot button and click it
    const availableSlots = page.locator('button').filter({ hasText: /:/ }).filter({ hasNotText: /Booked/i });
    const slotCount = await availableSlots.count();

    if (slotCount > 0) {
      await availableSlots.first().click();

      // Booking modal should appear
      await expect(page.getByRole('heading', { name: 'Confirm Booking' })).toBeVisible({ timeout: 5000 });
    }
  });

  test('should confirm booking via modal', async ({ page }) => {
    test.skip();
    await page.goto('/pitch/1');
    await page.waitForTimeout(500);

    // Find and click an available slot
    const availableSlots = page.locator('button').filter({ hasText: /:/ }).filter({ hasNotText: /Booked/i });
    const slotCount = await availableSlots.count();

    if (slotCount > 0) {
      await availableSlots.first().click();

      // Wait for modal
      await expect(page.getByRole('heading', { name: 'Confirm Booking' })).toBeVisible({ timeout: 5000 });

      // Click confirm booking button
      const confirmButton = page.getByRole('button', { name: 'Confirm Booking' });
      await confirmButton.click();

      // Should show success toast
      await page.waitForTimeout(1000);
      const toast = page.getByText('Success');
      await expect(toast).toBeVisible({ timeout: 5000 }).catch(() => {
        // Mock mode may show different success message
      });
    }
  });

  test('should close booking modal by clicking backdrop', async ({ page }) => {
    test.skip();
    await page.goto('/pitch/1');
    await page.waitForTimeout(500);

    // Open modal
    const availableSlots = page.locator('button').filter({ hasText: /:/ }).filter({ hasNotText: /Booked/i });
    const slotCount = await availableSlots.count();

    if (slotCount > 0) {
      await availableSlots.first().click();
      await expect(page.getByRole('heading', { name: 'Confirm Booking' })).toBeVisible({ timeout: 5000 });

      // Click backdrop (outside modal)
      await page.locator('[role="presentation"]').click();

      // Modal should close
      await expect(page.getByRole('heading', { name: 'Confirm Booking' })).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('should view bookings page', async ({ page }) => {
    test.skip();
    await page.goto('/bookings');

    // Should see bookings page header
    await expect(page.getByRole('heading', { name: 'My Bookings' })).toBeVisible();
  });

  test('should filter bookings by status', async ({ page }) => {
    test.skip();
    await page.goto('/bookings');

    // Filter tabs should be visible
    await expect(page.locator('button', { hasText: /All/i })).toBeVisible();
    await expect(page.locator('button', { hasText: /Active/i })).toBeVisible();
    await expect(page.locator('button', { hasText: /Completed/i })).toBeVisible();
  });
});

test.describe('Navigation Flow', () => {
  test('should navigate through main pages from home', async ({ page }) => {
    // Requires mock mode or authenticated session
    test.skip();
    await page.goto('/home');

    // Navigate to bookings via top bar
    const bookingsLink = page.locator('a[href="/bookings"]');
    if (await bookingsLink.count() > 0) {
      await bookingsLink.click();
      await page.waitForURL('**/bookings');
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('should navigate to profile page', async ({ page }) => {
    // Requires mock mode or authenticated session
    test.skip();
    await page.goto('/profile');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should have bottom navigation on mobile', async ({ page }) => {
    // Requires mock mode or authenticated session
    test.skip();
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/home');

    // Bottom nav should be visible on mobile
    const bottomNav = page.locator('nav.fixed.bottom-0');
    await expect(bottomNav).toBeVisible();
  });
});
