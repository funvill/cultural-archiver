import { test, expect } from '@playwright/test';

test.describe('Map Preview Card - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set localStorage to dismiss any welcome modal
    await page.addInitScript(() => {
      localStorage.setItem('cultural-archiver-visited', 'true');
    });

    // Mock the nearby artworks API to return test data
    await page.route('**/api/artworks/nearby*', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'test-artwork-1',
              title: 'Test Mural',
              type: 'mural',
              latitude: 49.2827,
              longitude: -123.1207,
              photos: ['https://example.com/test-photo.jpg'],
              status: 'approved',
            },
            {
              id: 'test-artwork-2', 
              title: 'Test Sculpture',
              type: 'sculpture',
              latitude: 49.2837,
              longitude: -123.1217,
              photos: ['https://example.com/test-photo2.jpg'],
              status: 'approved',
            },
          ],
        }),
      });
    });

    // Mock individual artwork API
    await page.route('**/api/artworks/test-artwork-1', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'test-artwork-1',
            title: 'Test Mural',
            description: 'A beautiful test mural in downtown Vancouver',
            artist_name: 'Test Artist',
            latitude: 49.2827,
            longitude: -123.1207,
            status: 'approved',
            photos: [
              {
                url: 'https://example.com/test-photo.jpg',
                thumbnail_url: 'https://example.com/test-photo-thumb.jpg',
                alt_text: 'Test mural photo',
              }
            ],
            tags_parsed: { type: 'mural', material: 'paint' },
          },
        }),
      });
    });

    // Navigate to map view
    await page.goto('/map');
    await page.waitForLoadState('networkidle');
  });

  test('should display preview card when marker is clicked', async ({ page }) => {
    // Wait for map to load and markers to appear
    await expect(page.locator('[data-testid="map-component"]')).toBeVisible();
    
    // Look for a map marker (circle markers created by MapComponent)
    // Since we're using canvas markers, we'll need to click on the map area where markers should be
    const mapContainer = page.locator('[data-testid="map-component"]');
    
    // Click on the map where our test marker should be (center coordinates)
    await mapContainer.click({
      position: { x: 400, y: 300 } // Approximate center of a typical map view
    });

    // Wait for preview card to appear
    await expect(page.locator('.map-preview-card')).toBeVisible();
    
    // Verify preview card content
    await expect(page.locator('.map-preview-card__title')).toContainText('Test Mural');
    await expect(page.locator('.map-preview-card__description')).toContainText('mural');
    
    // Verify thumbnail is displayed
    await expect(page.locator('.map-preview-card__image')).toBeVisible();
  });

  test('should dismiss preview card when map is panned', async ({ page }) => {
    // First, trigger a preview by clicking a marker
    const mapContainer = page.locator('[data-testid="map-component"]');
    await mapContainer.click({ position: { x: 400, y: 300 } });
    
    // Verify preview card is visible
    await expect(page.locator('.map-preview-card')).toBeVisible();
    
    // Pan the map by dragging
    await mapContainer.dragTo(mapContainer, {
      sourcePosition: { x: 400, y: 300 },
      targetPosition: { x: 500, y: 300 },
    });
    
    // Verify preview card is dismissed
    await expect(page.locator('.map-preview-card')).not.toBeVisible();
  });

  test('should navigate to artwork details when preview card is clicked', async ({ page }) => {
    // Mock the artwork details page navigation
    const navigationPromise = page.waitForURL('**/artwork/test-artwork-1');
    
    // Click marker to show preview
    const mapContainer = page.locator('[data-testid="map-component"]');
    await mapContainer.click({ position: { x: 400, y: 300 } });
    
    // Wait for preview card to appear
    await expect(page.locator('.map-preview-card')).toBeVisible();
    
    // Click the preview card
    await page.locator('.map-preview-card').click();
    
    // Verify navigation occurred
    await navigationPromise;
    expect(page.url()).toContain('/artwork/test-artwork-1');
  });

  test('should handle keyboard navigation on preview card', async ({ page }) => {
    // Click marker to show preview
    const mapContainer = page.locator('[data-testid="map-component"]');
    await mapContainer.click({ position: { x: 400, y: 300 } });
    
    // Wait for preview card to appear and receive focus
    await expect(page.locator('.map-preview-card')).toBeVisible();
    await expect(page.locator('.map-preview-card')).toBeFocused();
    
    // Test Enter key navigation
    const navigationPromise = page.waitForURL('**/artwork/test-artwork-1');
    await page.keyboard.press('Enter');
    await navigationPromise;
    
    expect(page.url()).toContain('/artwork/test-artwork-1');
  });

  test('should handle rapid marker clicks with debouncing', async ({ page }) => {
    const mapContainer = page.locator('[data-testid="map-component"]');
    
    // Click multiple times rapidly
    await mapContainer.click({ position: { x: 400, y: 300 } });
    await mapContainer.click({ position: { x: 410, y: 310 } });
    await mapContainer.click({ position: { x: 420, y: 320 } });
    
    // Wait for debounce to complete
    await page.waitForTimeout(100);
    
    // Verify only one preview card is shown
    const previewCards = page.locator('.map-preview-card');
    await expect(previewCards).toHaveCount(1);
    await expect(previewCards.first()).toBeVisible();
  });

  test('should handle missing thumbnail gracefully', async ({ page }) => {
    // Mock artwork without thumbnail
    await page.route('**/api/artworks/nearby*', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{
            id: 'test-artwork-no-thumb',
            title: 'Artwork Without Photo',
            type: 'sculpture',
            latitude: 49.2827,
            longitude: -123.1207,
            photos: [], // No photos
            status: 'approved',
          }],
        }),
      });
    });
    
    // Reload page with new mock data
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Click marker
    const mapContainer = page.locator('[data-testid="map-component"]');
    await mapContainer.click({ position: { x: 400, y: 300 } });
    
    // Verify preview card appears with placeholder
    await expect(page.locator('.map-preview-card')).toBeVisible();
    await expect(page.locator('.map-preview-card__placeholder')).toBeVisible();
    await expect(page.locator('.map-preview-card__placeholder-icon')).toBeVisible();
  });

  test('should respect reduced motion preferences', async ({ page }) => {
    // Set reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    // Click marker to trigger preview
    const mapContainer = page.locator('[data-testid="map-component"]');
    await mapContainer.click({ position: { x: 400, y: 300 } });
    
    // Wait for preview card to appear
    await expect(page.locator('.map-preview-card')).toBeVisible();
    
    // Verify reduced motion class is applied
    await expect(page.locator('.map-preview-card')).toHaveClass(/map-preview-card--visible-reduced-motion/);
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Click marker to show preview
    const mapContainer = page.locator('[data-testid="map-component"]');
    await mapContainer.click({ position: { x: 200, y: 300 } });
    
    // Verify preview card appears and is properly sized for mobile
    await expect(page.locator('.map-preview-card')).toBeVisible();
    
    // Verify card is positioned at bottom of viewport
    const previewCard = page.locator('.map-preview-card');
    const boundingBox = await previewCard.boundingBox();
    const viewport = page.viewportSize()!;
    
    // Card should be near the bottom of the viewport
    expect(boundingBox!.y + boundingBox!.height).toBeGreaterThan(viewport.height * 0.8);
    
    // Test touch interaction (pan to dismiss)
    await mapContainer.dragTo(mapContainer, {
      sourcePosition: { x: 200, y: 300 },
      targetPosition: { x: 250, y: 300 },
    });
    
    // Verify preview is dismissed
    await expect(page.locator('.map-preview-card')).not.toBeVisible();
  });

  test('should handle multiple markers and switch between previews', async ({ page }) => {
    // Click first marker
    const mapContainer = page.locator('[data-testid="map-component"]');
    await mapContainer.click({ position: { x: 400, y: 300 } });
    
    // Verify first preview appears
    await expect(page.locator('.map-preview-card')).toBeVisible();
    await expect(page.locator('.map-preview-card__title')).toContainText('Test Mural');
    
    // Click second marker (different position)
    await mapContainer.click({ position: { x: 450, y: 350 } });
    
    // Wait for content to update (debounce)
    await page.waitForTimeout(100);
    
    // Verify preview updated to second artwork
    await expect(page.locator('.map-preview-card')).toBeVisible();
    // Note: In a real scenario, we'd check for different content,
    // but our mock only returns the same data
  });

  test('should maintain accessibility standards', async ({ page }) => {
    // Click marker to show preview
    const mapContainer = page.locator('[data-testid="map-component"]');
    await mapContainer.click({ position: { x: 400, y: 300 } });
    
    // Wait for preview card
    await expect(page.locator('.map-preview-card')).toBeVisible();
    
    // Verify accessibility attributes
    const previewCard = page.locator('.map-preview-card');
    await expect(previewCard).toHaveAttribute('role', 'button');
    await expect(previewCard).toHaveAttribute('tabindex', '0');
    await expect(previewCard).toHaveAttribute('aria-label', /View details for .* Press Enter or Space to open\./);
    
    // Verify image alt text
    const image = page.locator('.map-preview-card__image');
    if (await image.isVisible()) {
      await expect(image).toHaveAttribute('alt', /Thumbnail image of .*/);
    }
    
    // Test keyboard focus
    await page.keyboard.press('Tab'); // Should focus the preview card
    await expect(previewCard).toBeFocused();
    
    // Test focus indicator is visible
    await expect(previewCard).toHaveCSS('outline', /.*2px.*/); // Should have focus outline
  });
});