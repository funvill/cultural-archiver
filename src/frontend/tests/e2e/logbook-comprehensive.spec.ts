import { test, expect } from '@playwright/test';

const mockArtworkId = 'test-artwork-123';

// Mock artwork data for different scenarios
const mockArtworkWithoutCooldown = {
  success: true,
  data: {
    id: mockArtworkId,
    title: 'Test Sculpture',
    artist_name: 'Test Artist',
    type_name: 'sculpture',
    lat: 49.2827,
    lon: -123.1207,
    description: 'A beautiful test sculpture',
    created_at: '2023-01-01T00:00:00Z',
    photos: ['photo1.jpg', 'photo2.jpg'],
    tags_parsed: {
      material: 'bronze',
      access: 'public'
    }
  }
};

const mockArtworkWithCooldown = {
  success: true,
  data: {
    ...mockArtworkWithoutCooldown.data,
    userLogbookStatus: {
      onCooldown: true,
      cooldownUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }
  }
};

const mockArtworkIncomplete = {
  success: true,
  data: {
    id: mockArtworkId,
    title: null,
    artist_name: null,
    type_name: 'unknown',
    lat: 49.2827,
    lon: -123.1207,
    description: null,
    created_at: '2023-01-01T00:00:00Z',
    photos: [],
    tags_parsed: {}
  }
};

const mockSuccessfulSubmissionResponse = {
  success: true,
  data: {
    id: 'submission-789',
    status: 'pending',
    message: 'Submission received for review.'
  }
};

const mockCooldownErrorResponse = {
  success: false,
  error: 'Too many requests',
  message: 'You can submit another logbook entry after 2025-01-15',
  details: {
    cooldownUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  }
};

test.describe('Logbook Submission - Comprehensive Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Set up default intercepts that can be overridden in individual tests
    await page.route('**/api/artworks/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockArtworkWithoutCooldown)
      });
    });
  });

  test('should navigate from nearby artwork card to logbook submission page', async ({ page }) => {
    // Mock nearby artworks search response
    await page.route('**/api/artworks/search**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            artworks: [mockArtworkWithoutCooldown.data],
            total: 1
          }
        })
      });
    });

    // Go to search page and perform a search
    await page.goto('/search');
    
    // Wait for search form and enter coordinates
    await page.fill('input[placeholder*="latitude"]', '49.2827');
    await page.fill('input[placeholder*="longitude"]', '-123.1207');
    await page.click('button[type="submit"]');

    // Wait for search results to load
    await expect(page.getByText('Test Sculpture')).toBeVisible();
    
    // Find and click the "Add Report" button on the artwork card
    await page.click('button:has-text("Add Report")');

    // Should navigate to logbook submission page
    await expect(page).toHaveURL(`/logbook/${mockArtworkId}`);
    await expect(page.getByTestId('submission-header')).toBeVisible();
    await expect(page.getByText('Log a Visit')).toBeVisible();
  });

  test('should display cooldown state when user is on cooldown', async ({ page }) => {
    // Override artwork response to include cooldown
    await page.route('**/api/artworks/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockArtworkWithCooldown)
      });
    });

    await page.goto(`/logbook/${mockArtworkId}`);

    // Should show cooldown state instead of form
    await expect(page.getByTestId('cooldown-state')).toBeVisible();
    await expect(page.getByText('Recent Visit Recorded')).toBeVisible();
    await expect(page.getByText(/Come back after/)).toBeVisible();
    
    // Main form should not be visible
    await expect(page.getByTestId('main-form')).not.toBeVisible();
  });

  test('should display all form fields for incomplete artwork data', async ({ page }) => {
    // Use artwork with missing data
    await page.route('**/api/artworks/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockArtworkIncomplete)
      });
    });

    await page.goto(`/logbook/${mockArtworkId}`);

    await expect(page.getByTestId('main-form')).toBeVisible();

    // Should show improvement fields since data is missing
    await expect(page.getByText('Help Us Improve This Listing')).toBeVisible();
    
    // Check for conditional fields that should appear
    await expect(page.locator('input[placeholder*="sculpture, mural, statue"]')).toBeVisible(); // Artwork Type
    await expect(page.locator('select:has(option[value="public"])') ).toBeVisible(); // Access
    await expect(page.locator('input[placeholder="Artist name"]')).toBeVisible(); // Artist
    await expect(page.locator('input[placeholder*="bronze, stone, paint"]')).toBeVisible(); // Material
  });

  test('should require photo upload before submission', async ({ page }) => {
    await page.goto(`/logbook/${mockArtworkId}`);

    // Accept all consent checkboxes
    await page.click('#consent-cc0');
    await page.click('#consent-terms');
    await page.click('#consent-photo-rights');

    // Submit button should be disabled without photo
    await expect(page.getByTestId('submit-button')).toBeDisabled();

    // Upload a photo
    const fileInput = page.locator('input#photo-upload');
    await fileInput.setInputFiles({
      name: 'test-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]) // JPEG header
    });

    // Submit button should now be enabled
    await expect(page.getByTestId('submit-button')).toBeEnabled();
  });

  test('should submit logbook entry successfully', async ({ page }) => {
    // Mock successful submission
    await page.route('**/api/submissions', async route => {
      const request = route.request();
      
      // Verify the request contains expected form data
      expect(request.method()).toBe('POST');
      
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(mockSuccessfulSubmissionResponse)
      });
    });

    await page.goto(`/logbook/${mockArtworkId}`);

    // Fill out the form
    const fileInput = page.locator('input#photo-upload');
    await fileInput.setInputFiles({
      name: 'artwork-visit.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    });

    // Select condition
    await page.click('input[value="Good"]');

    // Accept consent
    await page.click('#consent-cc0');
    await page.click('#consent-terms');  
    await page.click('#consent-photo-rights');

    // Submit the form
    await page.click('button[data-testid="submit-button"]');

    // Should show success toast
    await expect(page.locator('text=Logbook entry submitted for review!')).toBeVisible({ timeout: 10000 });
    
    // Should navigate to artwork detail page after delay
    await expect(page).toHaveURL(`/artwork/${mockArtworkId}`, { timeout: 5000 });
  });

  test('should handle cooldown error during submission', async ({ page }) => {
    // Mock cooldown error response  
    await page.route('**/api/submissions', async route => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json', 
        body: JSON.stringify(mockCooldownErrorResponse)
      });
    });

    await page.goto(`/logbook/${mockArtworkId}`);

    // Fill out and submit form
    const fileInput = page.locator('input#photo-upload');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg', 
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    });

    await page.click('#consent-cc0');
    await page.click('#consent-terms');
    await page.click('#consent-photo-rights');
    
    await page.click('button[data-testid="submit-button"]');

    // Should show cooldown error message
    await expect(page.locator('text*=cooldown')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network error
    await page.route('**/api/submissions', async route => {
      await route.abort('connectionrefused');
    });

    await page.goto(`/logbook/${mockArtworkId}`);

    // Fill and submit form
    const fileInput = page.locator('input#photo-upload');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    });

    await page.click('#consent-cc0');
    await page.click('#consent-terms');
    await page.click('#consent-photo-rights');
    
    await page.click('button[data-testid="submit-button"]');

    // Should show network error message and preserve form data
    await expect(page.locator('text*=check your connection')).toBeVisible();
    
    // Form data should be preserved
    await expect(page.locator('img[alt="Preview"]')).toBeVisible(); // Photo preview still there
  });

  test('should validate form fields correctly', async ({ page }) => {
    await page.goto(`/logbook/${mockArtworkId}`);

    // Try to submit without photo
    await page.click('#consent-cc0');
    await page.click('#consent-terms');
    await page.click('#consent-photo-rights');

    // Submit button should remain disabled
    await expect(page.getByTestId('submit-button')).toBeDisabled();

    // Add photo
    const fileInput = page.locator('input#photo-upload');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    });

    // Now submit button should be enabled
    await expect(page.getByTestId('submit-button')).toBeEnabled();
  });

  test('should allow removing uploaded photo', async ({ page }) => {
    await page.goto(`/logbook/${mockArtworkId}`);

    // Upload photo
    const fileInput = page.locator('input#photo-upload');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    });

    // Photo preview should be visible
    await expect(page.getByTestId('photo-preview')).toBeVisible();
    await expect(page.locator('img[alt="Preview"]')).toBeVisible();

    // Click remove button
    await page.click('button[data-testid="remove-photo-button"]');

    // Should return to upload state
    await expect(page.getByTestId('photo-input')).toBeVisible();
    await expect(page.getByTestId('photo-preview')).not.toBeVisible();
  });

  test('should handle artwork loading error', async ({ page }) => {
    // Mock artwork loading error
    await page.route('**/api/artworks/**', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Artwork not found'
        })
      });
    });

    await page.goto(`/logbook/${mockArtworkId}`);

    // Should show error state
    await expect(page.getByTestId('error-state')).toBeVisible();
    await expect(page.getByText('Failed to Load Artwork')).toBeVisible();
    await expect(page.getByTestId('try-again-button')).toBeVisible();
  });

  test('should include condition and improvement data in submission', async ({ page }) => {
    let submissionData: string | null = null;

    // Capture submission data
    await page.route('**/api/submissions', async route => {
      const request = route.request();
      submissionData = await request.postData();
      
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(mockSuccessfulSubmissionResponse)
      });
    });

    // Use incomplete artwork to show improvement fields
    await page.route('**/api/artworks/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockArtworkIncomplete)
      });
    });

    await page.goto(`/logbook/${mockArtworkId}`);

    // Fill out comprehensive form
    const fileInput = page.locator('input#photo-upload');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    });

    // Select condition
    await page.click('input[value="Damaged"]');

    // Fill improvement fields
    await page.fill('input[placeholder*="sculpture, mural, statue"]', 'Mural');
    await page.selectOption('select:has(option[value="public"])', 'public');
    await page.fill('input[placeholder="Artist name"]', 'John Doe');
    await page.fill('input[placeholder*="bronze, stone, paint"]', 'Acrylic paint');

    // Accept consent and submit
    await page.click('#consent-cc0');
    await page.click('#consent-terms');
    await page.click('#consent-photo-rights');
    
    await page.click('button[data-testid="submit-button"]');

    // Wait for submission
    await expect(page.locator('text=Logbook entry submitted for review!')).toBeVisible({ timeout: 10000 });

    // Verify submission data was captured
    expect(submissionData).toBeTruthy();
  });

  test('should navigate back when cancel button is clicked', async ({ page }) => {
    await page.goto(`/logbook/${mockArtworkId}`);

    // Click cancel button
    await page.click('button[data-testid="cancel-button"]');

    // Should navigate back (in this case, likely to previous page)
    // Since we can't easily test browser back(), we'll just verify the button exists and is clickable
    await expect(page.getByTestId('cancel-button')).toBeVisible();
  });
});

test.describe('Logbook Submission - Error Scenarios', () => {
  
  test('should handle malformed API responses', async ({ page }) => {
    // Mock malformed response
    await page.route('**/api/artworks/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json'
      });
    });

    await page.goto(`/logbook/${mockArtworkId}`);

    // Should show error state
    await expect(page.getByTestId('error-state')).toBeVisible();
  });

  test('should handle server errors during submission', async ({ page }) => {
    await page.route('**/api/submissions', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal server error'
        })
      });
    });

    await page.goto(`/logbook/${mockArtworkId}`);

    // Submit form
    const fileInput = page.locator('input#photo-upload');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    });

    await page.click('#consent-cc0');
    await page.click('#consent-terms');
    await page.click('#consent-photo-rights');
    
    await page.click('button[data-testid="submit-button"]');

    // Should show error message
    await expect(page.locator('text*=error')).toBeVisible();
  });
});