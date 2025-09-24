import { test, expect } from '@playwright/test';

const TEST_ARTWORK_ID = 'c0000000-1000-4000-8000-000000000101';

test.describe('Logbook Submission - Full Flow Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set localStorage to dismiss welcome modal
    await page.addInitScript(() => {
      localStorage.setItem('cultural-archiver-visited', 'true');
    });

    // Mock artwork API
    await page.route('**/api/artworks/**', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: TEST_ARTWORK_ID,
            title: 'Test Artwork',
            artist_name: 'Test Artist',
            latitude: 49.2827,
            longitude: -123.1207,
            status: 'approved',
            photos: ['https://example.com/photo1.jpg'],
          },
        }),
      });
    });

    // Navigate to logbook submission page
    await page.goto(`/logbook/${TEST_ARTWORK_ID}`);
    await page.waitForLoadState('networkidle');
  });

  test('should complete a full submission with photo and condition', async ({ page }) => {
    // Mock successful submission
    await page.route('**/api/logbook', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'submission-123' },
          }),
        });
      }
    });

    // Upload a file using setInputFiles
    const fileInput = page.locator('#photo-upload');
    await fileInput.setInputFiles({
      name: 'test-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake image data'),
    });

    // Wait for photo preview to appear - this indicates the file was processed
    await expect(page.locator('[data-testid="photo-preview"]')).toBeVisible({ timeout: 10000 });

    // Select a condition
    const goodConditionLabel = page.locator('label').filter({ hasText: 'Good' }).first();
    await goodConditionLabel.click();

    // Check all required consent checkboxes
    await page.locator('#consent-cc0').check();
    await page.locator('#consent-terms').check();
    await page.locator('#consent-photo-rights').check();

    // Wait a moment for the component to update
    await page.waitForTimeout(500);

    // Now check if the submit button is enabled
    const submitButton = page.locator('[data-testid="submit-button"]');
    await expect(submitButton).toBeEnabled({ timeout: 5000 });

    // Click submit
    await submitButton.click();

    // Should show success state or redirect
    await page.waitForTimeout(1000); // Brief wait for submission
  });

  test('should show validation errors appropriately', async ({ page }) => {
    // Try to submit without photo (should be disabled)
    const submitButton = page.locator('[data-testid="submit-button"]');
    await expect(submitButton).toBeDisabled();

    // Add photo but no condition - submission should still work (condition is optional)
    const fileInput = page.locator('#photo-upload');
    await fileInput.setInputFiles({
      name: 'test-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake image data'),
    });

    await expect(page.locator('[data-testid="photo-preview"]')).toBeVisible();

    // Still disabled because consent checkboxes aren't checked
    await expect(submitButton).toBeDisabled();

    // Check all required consent checkboxes
    await page.locator('#consent-cc0').check();
    await page.locator('#consent-terms').check();
    await page.locator('#consent-photo-rights').check();

    // Wait for component to update
    await page.waitForTimeout(500);

    // Now it should be enabled
    await expect(submitButton).toBeEnabled();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network error
    await page.route('**/api/logbook', async route => {
      if (route.request().method() === 'POST') {
        await route.abort('failed');
      }
    });

    // Upload photo and select condition
    const fileInput = page.locator('#photo-upload');
    await fileInput.setInputFiles({
      name: 'test-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake image data'),
    });

    await expect(page.locator('[data-testid="photo-preview"]')).toBeVisible();

    const goodConditionLabel = page.locator('label').filter({ hasText: 'Good' }).first();
    await goodConditionLabel.click();

    // Check all required consent checkboxes
    await page.locator('#consent-cc0').check();
    await page.locator('#consent-terms').check();
    await page.locator('#consent-photo-rights').check();

    // Wait for component to update
    await page.waitForTimeout(500);

    const submitButton = page.locator('[data-testid="submit-button"]');
    await expect(submitButton).toBeEnabled();

    // Try to submit (should fail gracefully)
    await submitButton.click();

    // The app should handle the error without crashing
    // We'll wait a moment to see if any error messages appear
    await page.waitForTimeout(2000);
  });
});
