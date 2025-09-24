import { test, expect } from '@playwright/test';

test.describe('Notification panel', () => {
  test('unread notifications appear first and header mark-all works', async ({ page }) => {
    // Intercept API calls and return deterministic mock data so test doesn't require backend
    await page.route('**/api/notifications*', async route => {
      const body = {
        success: true,
        data: {
          notifications: [
            // Unread (newest)
            {
              id: 'n-unread-1',
              title: 'Unread First',
              message: 'First unread',
              type: 'system',
              metadata: null,
              created_at: new Date().toISOString(),
              is_dismissed: false,
              user_token: 'test-user',
              type_key: null,
              related_id: null,
            },
            // Read
            {
              id: 'n-read-1',
              title: 'Read One',
              message: 'Already read',
              type: 'system',
              metadata: null,
              created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
              is_dismissed: true,
              user_token: 'test-user',
              type_key: null,
              related_id: null,
            },
          ],
          total: 2,
        },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });

    await page.route('**/api/notifications/unread_count*', async route => {
      const body = { success: true, data: { unread_count: 1 } };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });

    // Navigate to the app
    await page.goto('/');

    // Ensure the bell is visible
    const bell = page.locator('button[aria-label^="Notifications"]');
    await expect(bell).toBeVisible();

    // Click to open the notification panel
    await bell.click();

    // Wait for the panel to render
    const headerButton = page.locator('button[aria-label="Mark all notifications as read"]');
    await expect(headerButton).toBeVisible();

    // Locate the list items and assert the first one is unread (has the unread indicator)
    const items = page.locator('.divide-y > div');
    const firstUnread = items.nth(0).locator('[aria-label="Unread"]');
    await expect(firstUnread).toBeVisible();

    // Click the header mark-all button
    await headerButton.click();

    // After marking all read, unread indicators should be gone in the panel
    await expect(page.locator('[aria-label="Unread"]').first()).toHaveCount(0);
  });
});
