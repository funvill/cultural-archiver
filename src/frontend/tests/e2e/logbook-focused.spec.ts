import { test, expect } from '@playwright/test';

test.describe('Logbook Submission Tests', () => {
  const mockArtworkId = 'test-artwork-123';

  // Mock artwork data for different scenarios
  const mockArtworkWithoutCooldown = {
    success: true,
    data: {
      id: mockArtworkId,
      title: 'Test Artwork',
      artist: 'Test Artist',
      location: 'Test Location',
      latitude: 49.2827,
      longitude: -123.1207,
      photos: [
        {
          url: 'https://example.com/photo1.jpg',
          alt: 'Test photo',
          width: 800,
          height: 600
        }
      ],
      tags: ['test', 'artwork'],
      cooldownMinutes: 0,
      cooldownRemaining: 0,
      canSubmit: true,
      submissionCooldownEnd: null
    }
  };

  const mockArtworkWithCooldown = {
    success: true,
    data: {
      id: mockArtworkId,
      title: 'Test Artwork',
      artist: 'Test Artist',
      location: 'Test Location',
      latitude: 49.2827,
      longitude: -123.1207,
      photos: [
        {
          url: 'https://example.com/photo1.jpg',
          alt: 'Test photo',
          width: 800,
          height: 600
        }
      ],
      tags: ['test', 'artwork'],
      cooldownMinutes: 30,
      cooldownRemaining: 25,
      canSubmit: false,
      submissionCooldownEnd: new Date(Date.now() + 25 * 60 * 1000).toISOString()
    }
  };

  test.beforeEach(async ({ page }) => {
    // Dismiss welcome modal by setting localStorage (correct key)
    await page.addInitScript(() => {
      localStorage.setItem('cultural-archiver-visited', 'true');
    });
    
    await page.goto(`/logbook/${mockArtworkId}`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Cooldown Scenarios', () => {
    test.beforeEach(async ({ page }) => {
      // Mock artwork API call
      await page.route('**/api/artworks/**', async route => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(mockArtworkWithoutCooldown)
        });
      });
    });

    test('should display cooldown state when user is on cooldown', async ({ page }) => {
      // Override with cooldown data
      await page.route('**/api/artworks/**', async route => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(mockArtworkWithCooldown)
        });
      });

      await page.goto(`/logbook/${mockArtworkId}`);
      await page.waitForLoadState('networkidle');

      // Check cooldown state is displayed
      await expect(page.locator('[data-testid="cooldown-state"]')).toBeVisible();
      await expect(page.locator('text=25 minutes')).toBeVisible();
      
      // Ensure form is not visible
      await expect(page.locator('[data-testid="main-form"]')).not.toBeVisible();
    });

    test('should display logbook submission form when not on cooldown', async ({ page }) => {
      await page.goto(`/logbook/${mockArtworkId}`);
      await page.waitForLoadState('networkidle');

      // Check form is displayed
      await expect(page.locator('[data-testid="main-form"]')).toBeVisible();
      
      // Check form elements are present
      await expect(page.locator('input#photo-upload')).toBeVisible();
      await expect(page.locator('#consent-cc0')).toBeVisible();
      await expect(page.locator('#consent-terms')).toBeVisible();
      await expect(page.locator('#consent-photo-rights')).toBeVisible();
      
      // Ensure cooldown state is not visible
      await expect(page.locator('[data-testid="cooldown-state"]')).not.toBeVisible();
    });
  });

  test.describe('Form Validation', () => {
    test.beforeEach(async ({ page }) => {
      // Mock artwork API call
      await page.route('**/api/artworks/**', async route => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(mockArtworkWithoutCooldown)
        });
      });

      await page.goto(`/logbook/${mockArtworkId}`);
      await page.waitForLoadState('networkidle');
    });

    test('should require photo upload and consents before enabling submit', async ({ page }) => {
      // Submit button should be disabled initially
      const submitButton = page.locator('button[data-testid="submit-button"]');
      await expect(submitButton).toBeDisabled();

      // Add photo
      const fileInput = page.locator('input#photo-upload');
      await fileInput.setInputFiles({
        name: 'test.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0])
      });

      // Submit should still be disabled without consents
      await expect(submitButton).toBeDisabled();

      // Check all consents
      await page.click('label[for="consent-cc0"]');
      await page.click('label[for="consent-terms"]');
      await page.click('label[for="consent-photo-rights"]');

      // Now submit should be enabled
      await expect(submitButton).toBeEnabled();
    });

    test('should handle condition selection correctly', async ({ page }) => {
      // Select excellent condition
      await page.click('label[for="condition-excellent"]');
      
      // Verify selection
      await expect(page.locator('#condition-excellent')).toBeChecked();
      
      // Change to poor condition
      await page.click('label[for="condition-poor"]');
      
      // Verify new selection
      await expect(page.locator('#condition-poor')).toBeChecked();
      await expect(page.locator('#condition-excellent')).not.toBeChecked();
    });
  });

  test.describe('Photo Upload', () => {
    test.beforeEach(async ({ page }) => {
      // Mock artwork API call
      await page.route('**/api/artworks/**', async route => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(mockArtworkWithoutCooldown)
        });
      });

      await page.goto(`/logbook/${mockArtworkId}`);
      await page.waitForLoadState('networkidle');
    });

    test('should accept photo upload and show preview', async ({ page }) => {
      const fileInput = page.locator('input#photo-upload');
      
      // Upload a file
      await fileInput.setInputFiles({
        name: 'test.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0])
      });

      // Should show file name or preview indication
      await expect(page.locator('text=test.jpg').or(page.locator('[data-testid="photo-preview"]'))).toBeVisible();
    });
  });

  test.describe('Submission Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Mock artwork API call
      await page.route('**/api/artworks/**', async route => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(mockArtworkWithoutCooldown)
        });
      });

      await page.goto(`/logbook/${mockArtworkId}`);
      await page.waitForLoadState('networkidle');
    });

    test('should successfully submit logbook entry', async ({ page }) => {
      // Mock successful submission
      await page.route('**/api/logbook/**', async route => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: 'submission-123' }
          })
        });
      });

      // Fill form
      const fileInput = page.locator('input#photo-upload');
      await fileInput.setInputFiles({
        name: 'test.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0])
      });

      await page.click('label[for="condition-good"]');
      await page.fill('textarea[placeholder*="notes"]', 'Test submission notes');

      await page.click('label[for="consent-cc0"]');
      await page.click('label[for="consent-terms"]');
      await page.click('label[for="consent-photo-rights"]');

      // Submit
      await page.click('button[data-testid="submit-button"]');

      // Should show success state
      await expect(page.locator('text=Successfully submitted').or(page.locator('.bg-green-50'))).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      // Mock artwork API call
      await page.route('**/api/artworks/**', async route => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(mockArtworkWithoutCooldown)
        });
      });

      await page.goto(`/logbook/${mockArtworkId}`);
      await page.waitForLoadState('networkidle');
    });

    test('should handle network errors during submission', async ({ page }) => {
      // Mock network error
      await page.route('**/api/logbook/**', async route => {
        await route.abort('failed');
      });

      // Fill and submit form
      const fileInput = page.locator('input#photo-upload');
      await fileInput.setInputFiles({
        name: 'test.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0])
      });

      await page.click('label[for="condition-good"]');
      await page.click('label[for="consent-cc0"]');
      await page.click('label[for="consent-terms"]');
      await page.click('label[for="consent-photo-rights"]');

      await page.click('button[data-testid="submit-button"]');

      // Should show error message
      await expect(page.locator('.bg-red-50')).toBeVisible();
    });

    test('should handle cooldown errors during submission', async ({ page }) => {
      // Mock cooldown error
      await page.route('**/api/logbook/**', async route => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Cooldown active. Please wait 25 minutes before submitting again.',
            cooldownMinutes: 25
          })
        });
      });

      // Fill and submit form
      const fileInput = page.locator('input#photo-upload');
      await fileInput.setInputFiles({
        name: 'test.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0])
      });

      await page.click('label[for="condition-good"]');
      await page.click('label[for="consent-cc0"]');
      await page.click('label[for="consent-terms"]');
      await page.click('label[for="consent-photo-rights"]');

      await page.click('button[data-testid="submit-button"]');

      // Should show cooldown error message
      await expect(page.locator('.bg-red-50')).toBeVisible();
      await expect(page.locator('text=25 minutes')).toBeVisible();
    });

    test('should handle server errors during submission', async ({ page }) => {
      // Mock server error
      await page.route('**/api/logbook/**', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Internal server error occurred'
          })
        });
      });

      // Fill and submit form
      const fileInput = page.locator('input#photo-upload');
      await fileInput.setInputFiles({
        name: 'test.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0])
      });

      await page.click('label[for="condition-good"]');
      await page.click('label[for="consent-cc0"]');
      await page.click('label[for="consent-terms"]');
      await page.click('label[for="consent-photo-rights"]');

      await page.click('button[data-testid="submit-button"]');

      // Should show error message
      await expect(page.locator('.bg-red-50')).toBeVisible();
    });
  });
});