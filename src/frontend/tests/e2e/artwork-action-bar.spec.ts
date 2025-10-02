import { test, expect } from '@playwright/test';

const artworkId = 'test-artwork-123';

test.describe('Artwork Action Bar', () => {
  test.beforeEach(async ({ page }) => {
    // Mock artwork details API
    await page.route('**/api/artworks/**', async route => {
      const res = {
        success: true,
        data: {
          id: artworkId,
          title: 'Test Artwork',
          artist_name: 'Test Artist',
          type_name: 'sculpture',
          lat: 49.2827,
          lon: -123.1207,
          description: 'A test artwork for action bar testing',
          photos: [{ url: 'test-photo.jpg', caption: 'Test photo' }],
          tags: ['test', 'sculpture'],
          status: 'approved',
        },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(res),
      });
    });

    // Mock membership API for authenticated users
    await page.route('**/api/artwork/*/membership', async route => {
      const res = {
        success: true,
        data: {
          loved: false,
          beenHere: false,
          wantToSee: false,
          inAnyList: false,
        },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(res),
      });
    });

    // Mock counts API
    await page.route('**/api/artwork/*/counts', async route => {
      const res = {
        success: true,
        data: {
          loved: 42,
          beenHere: 127,
          wantToSee: 89,
          totalUsers: 200,
        },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(res),
      });
    });

    // Navigate to artwork details page
    await page.goto(`/artwork/${artworkId}`);
  });

  test('displays action bar with all chips', async ({ page }) => {
    // Wait for action bar to be visible
    await expect(page.locator('[data-testid="artwork-action-bar"]')).toBeVisible();
    
    // Check that all expected chips are present
    await expect(page.locator('[data-testid="chip-loved"]')).toBeVisible();
    await expect(page.locator('[data-testid="chip-beenHere"]')).toBeVisible();
    await expect(page.locator('[data-testid="chip-wantToSee"]')).toBeVisible();
    await expect(page.locator('[data-testid="chip-bookmark"]')).toBeVisible();
    await expect(page.locator('[data-testid="chip-share"]')).toBeVisible();
    await expect(page.locator('[data-testid="chip-addLog"]')).toBeVisible();
    await expect(page.locator('[data-testid="chip-edit"]')).toBeVisible();
  });

  test('displays public counts on chips', async ({ page }) => {
    // Wait for action bar to load
    await expect(page.locator('[data-testid="artwork-action-bar"]')).toBeVisible();
    
    // Check that counts are displayed
    await expect(page.locator('[data-testid="chip-loved"]')).toContainText('42');
    await expect(page.locator('[data-testid="chip-beenHere"]')).toContainText('127');
    await expect(page.locator('[data-testid="chip-wantToSee"]')).toContainText('89');
  });

  test('shows appropriate chip states for unauthenticated users', async ({ page }) => {
    // Ensure we're not authenticated by clearing any existing auth
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Reload to ensure unauthenticated state
    await page.reload();
    
    // Wait for action bar
    await expect(page.locator('[data-testid="artwork-action-bar"]')).toBeVisible();
    
    // All chips should be in inactive state for unauthenticated users
    await expect(page.locator('[data-testid="chip-loved"]')).not.toHaveClass(/active/);
    await expect(page.locator('[data-testid="chip-beenHere"]')).not.toHaveClass(/active/);
    await expect(page.locator('[data-testid="chip-wantToSee"]')).not.toHaveClass(/active/);
  });

  test('triggers login prompt when unauthenticated user clicks action', async ({ page }) => {
    // Clear authentication
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    
    // Wait for action bar
    await expect(page.locator('[data-testid="artwork-action-bar"]')).toBeVisible();
    
    // Click on loved chip
    await page.locator('[data-testid="chip-loved"]').click();
    
    // Should trigger auth required event/modal
    // Note: The actual login modal implementation depends on the app's auth system
    // For now, we can check that no optimistic update occurred
    await expect(page.locator('[data-testid="chip-loved"]')).not.toHaveClass(/active/);
  });

  test('handles authenticated user interactions', async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('user-token', 'test-token-123');
    });
    
    // Mock successful list toggle API
    await page.route('**/api/artwork/*/lists/*', async route => {
      const res = {
        success: true,
        data: {
          message: 'Artwork added to loved list',
          action: 'add',
          listType: 'loved',
        },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(res),
      });
    });
    
    // Mock updated membership state after action
    await page.route('**/api/artwork/*/membership', async route => {
      const res = {
        success: true,
        data: {
          loved: true, // Now loved after action
          beenHere: false,
          wantToSee: false,
          inAnyList: true,
        },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(res),
      });
    });
    
    await page.reload();
    await expect(page.locator('[data-testid="artwork-action-bar"]')).toBeVisible();
    
    // Click loved chip
    await page.locator('[data-testid="chip-loved"]').click();
    
    // Should show optimistic update (immediate visual feedback)
    // Then confirm the state after API response
    await expect(page.locator('[data-testid="chip-loved"]')).toHaveClass(/active/);
  });

  test('opens add-to-list modal when bookmark chip is clicked', async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('user-token', 'test-token-123');
    });
    
    // Mock user lists API
    await page.route('**/api/lists**', async route => {
      const res = {
        success: true,
        data: {
          lists: [
            { id: 'list-1', name: 'My Favorites', itemCount: 5 },
            { id: 'list-2', name: 'Want to Visit', itemCount: 12 },
          ],
        },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(res),
      });
    });
    
    await page.reload();
    await expect(page.locator('[data-testid="artwork-action-bar"]')).toBeVisible();
    
    // Click bookmark chip to open add-to-list modal
    await page.locator('[data-testid="chip-bookmark"]').click();
    
    // Should open the add-to-list dialog
    await expect(page.locator('[data-testid="add-to-list-dialog"]')).toBeVisible();
  });

  test('handles share functionality', async ({ page }) => {
    await expect(page.locator('[data-testid="artwork-action-bar"]')).toBeVisible();
    
    // Mock navigator.share for testing Web Share API
    await page.addInitScript(() => {
      // @ts-ignore
      window.navigator.share = async (data) => {
        console.log('Web Share API called with:', data);
        return Promise.resolve();
      };
    });
    
    // Click share chip
    await page.locator('[data-testid="chip-share"]').click();
    
    // Should trigger share functionality
    // The exact behavior depends on browser support for Web Share API
    // At minimum, it should not throw an error
    await page.waitForTimeout(500);
  });

  test('respects keyboard navigation', async ({ page }) => {
    await expect(page.locator('[data-testid="artwork-action-bar"]')).toBeVisible();
    
    // Tab to first chip
    await page.keyboard.press('Tab');
    
    // Should focus on first chip
    await expect(page.locator('[data-testid="chip-loved"]')).toBeFocused();
    
    // Tab to next chip
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="chip-beenHere"]')).toBeFocused();
    
    // Enter should activate the chip
    await page.keyboard.press('Enter');
    
    // Should trigger the action (same as click)
  });

  test('displays proper ARIA labels', async ({ page }) => {
    await expect(page.locator('[data-testid="artwork-action-bar"]')).toBeVisible();
    
    // Check ARIA labels are present and descriptive
    const lovedChip = page.locator('[data-testid="chip-loved"]');
    await expect(lovedChip).toHaveAttribute('aria-label');
    
    const ariaLabel = await lovedChip.getAttribute('aria-label');
    expect(ariaLabel).toContain('Loved');
    expect(ariaLabel).toMatch(/(Add to|Remove from)/);
  });

  test('handles API errors gracefully', async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('user-token', 'test-token-123');
    });
    
    // Mock API failure
    await page.route('**/api/artwork/*/lists/*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Server error' }),
      });
    });
    
    await page.reload();
    await expect(page.locator('[data-testid="artwork-action-bar"]')).toBeVisible();
    
    // Click loved chip
    await page.locator('[data-testid="chip-loved"]').click();
    
    // Should show optimistic update first, then revert on error
    // And show error message (toast or similar)
    await page.waitForTimeout(1000);
    
    // Chip should revert to original state
    await expect(page.locator('[data-testid="chip-loved"]')).not.toHaveClass(/active/);
  });
});