import { test, expect } from '@playwright/test';

// Sample artwork ID for testing - using the format from migrations
const TEST_ARTWORK_ID = 'c0000000-1000-4000-8000-000000000101';

test.describe('Logbook Submission - Simple Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set localStorage to dismiss welcome modal
    await page.addInitScript(() => {
      localStorage.setItem('cultural-archiver-visited', 'true');
    });

    // Mock artwork API to return a valid artwork
    await page.route('**/api/artworks/**', async (route) => {
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
            photos: ['https://example.com/photo1.jpg']
          }
        })
      });
    });

    // Navigate to logbook submission page
    await page.goto(`/logbook/${TEST_ARTWORK_ID}`);
    await page.waitForLoadState('networkidle');
  });

  test('should load logbook submission page', async ({ page }) => {
    // Check the main component loads
    await expect(page.locator('[data-testid="logbook-submission-view"]')).toBeVisible();
    
    // Check the header
    await expect(page.locator('[data-testid="submission-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="log-visit-banner"]')).toBeVisible();
  });

  test('should display the main form when not on cooldown', async ({ page }) => {
    // Check main form is visible
    await expect(page.locator('[data-testid="main-form"]')).toBeVisible();
    
    // Check artwork info is shown
    await expect(page.locator('[data-testid="artwork-info"]')).toBeVisible();
    
    // Check photo upload section
    await expect(page.locator('[data-testid="photo-upload-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-input"]')).toBeVisible();
    
    // Check condition section
    await expect(page.locator('[data-testid="condition-section"]')).toBeVisible();
  });

  test('should handle photo upload interaction', async ({ page }) => {
    // Check if photo upload label is clickable (even though input is hidden)
    const photoLabel = page.locator('label[for="photo-upload"]');
    await expect(photoLabel).toBeVisible();
    await expect(photoLabel).toContainText('Choose Photo');
    
    // Verify file input exists but is hidden
    const fileInput = page.locator('#photo-upload');
    await expect(fileInput).toBeAttached();
    // Note: File input has class="hidden" so we don't test visibility
  });

  test('should allow condition selection', async ({ page }) => {
    // Test clicking on "Good" condition 
    const goodConditionLabel = page.locator('label').filter({ hasText: 'Good' }).first();
    await expect(goodConditionLabel).toBeVisible();
    await goodConditionLabel.click();
    
    // Test clicking on "Damaged" condition
    const damagedConditionLabel = page.locator('label').filter({ hasText: 'Damaged' }).first();
    await expect(damagedConditionLabel).toBeVisible();
    await damagedConditionLabel.click();
  });

  test('should show form buttons', async ({ page }) => {
    // Check cancel and submit buttons exist
    await expect(page.locator('[data-testid="cancel-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="submit-button"]')).toBeVisible();
    
    // Initially submit should be disabled (no photo uploaded)
    await expect(page.locator('[data-testid="submit-button"]')).toBeDisabled();
  });

  test('should handle cooldown state', async ({ page }) => {
    // Override the artwork API to simulate cooldown
    await page.route('**/api/artworks/**', async (route) => {
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
            userLogbookStatus: {
              onCooldown: true,
              cooldownUntil: new Date(Date.now() + 25 * 60 * 1000).toISOString() // 25 minutes from now
            }
          }
        })
      });
    });

    // Reload the page with cooldown data
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should show cooldown state instead of form
    await expect(page.locator('[data-testid="cooldown-state"]')).toBeVisible();
    await expect(page.locator('[data-testid="main-form"]')).not.toBeVisible();
  });
});