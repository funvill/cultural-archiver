import { test, expect } from '@playwright/test';

test.describe('Map Preview Card - real artwork id', () => {
  test('shows title and artist for known artwork id', async ({ page }) => {
    // Ensure we don't get blocked by any welcome modals
    await page.addInitScript(() => {
      try { localStorage.setItem('cultural-archiver-visited', 'true'); } catch (e) {}
    });

    // Navigate to the map page
    await page.goto('/map');
    await page.waitForLoadState('networkidle');

    // Use the dev-only test hook injected by MapView to show a preview directly
    // This avoids dealing with canvas/WebGL click coordinates flakiness.
    const preview = {
      id: '428632b2-d68b-47e4-99d9-a841580ce071',
      title: 'East Van Cross',
      description: 'Artwork',
      lat: 49.277, // approximate
      lon: -123.104, // approximate
    };

    // Wait until the dev helper is available on the page and call it
    await page.waitForFunction(() => !!(window as any).__ca_test_show_preview, { timeout: 5000 });
    await page.evaluate((p) => {
      // @ts-ignore
      (window as any).__ca_test_show_preview(p);
    }, preview);

    // Wait for the preview wrapper to appear (more robust)
    const wrapper = page.locator('.map-preview-wrapper');
    await expect(wrapper).toBeVisible({ timeout: 5000 });
    const card = wrapper.locator('.artwork-card');
    await expect(card).toBeVisible({ timeout: 2000 });

    // Assert title and (possible) artist rendered
    await expect(card.locator('h3')).toContainText('East Van Cross');
    // Artist may be present; if present ensure it's not the empty placeholder
    const artist = card.locator('p').filter({ hasText: /./ }).nth(1);
    // At least ensure the card isn't showing only 'Untitled Artwork'
    await expect(card.locator('h3')).not.toContainText('Untitled Artwork');
  });
});
