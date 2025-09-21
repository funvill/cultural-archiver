import { test, expect } from '@playwright/test';

const artworkId = 'test-art-123';

test.describe('Logbook submission page', () => {
  test('shows banner and cooldown state when on cooldown', async ({ page }) => {
    // Intercept artwork details request and return a mocked response with cooldown
    await page.route('**/api/artworks/**', async route => {
      const res = {
        success: true,
        data: {
          id: artworkId,
          title: 'Mocked Artwork',
          artist_name: 'Mock Artist',
          type_name: 'sculpture',
          lat: 49.0,
          lon: -123.0,
          userLogbookStatus: {
            onCooldown: true,
            cooldownUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
        },
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
    });

    await page.goto(`/logbook/${artworkId}`);

    // Header and banner
    await expect(page.getByTestId('submission-header')).toBeVisible();
    await expect(page.getByText('Log a Visit')).toBeVisible();

    // Cooldown state should be visible
    await expect(page.getByTestId('cooldown-state')).toBeVisible();
    await expect(page.getByTestId('cooldown-state')).toContainText("Recent Visit Recorded");
  });

  test('allows photo upload and submission when not on cooldown', async ({ page }) => {
    // Mock artwork details without cooldown
    await page.route('**/api/artworks/**', async route => {
      const res = { success: true, data: { id: artworkId, title: 'Mocked Artwork', lat: 49.0, lon: -123.0 } };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
    });

    // Intercept submission POST to return a created response
    await page.route('**/api/submissions', async route => {
      const body = { id: 'sub-456', status: 'pending', message: 'Submission received for review.' };
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: body }) });
    });

    await page.goto(`/logbook/${artworkId}`);

    await expect(page.getByTestId('main-form')).toBeVisible();

  // Attach a file to the photo input (target by id to avoid ambiguous locators)
  const fileInput = page.locator('input#photo-upload');
  await fileInput.setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff]) });

    // Interact with the consent checkboxes so the parent component sees all consents accepted
    // ConsentSection inputs have ids: consent-cc0, consent-terms, consent-photo-rights
    await page.click('#consent-cc0');
    await page.click('#consent-terms');
    await page.click('#consent-photo-rights');

    // Wait for the submit button to become enabled (store.canSubmit + consents)
    await expect(page.getByTestId('submit-button')).toBeEnabled({ timeout: 2000 });

    // Click submit
    await page.getByTestId('submit-button').click();

  // Expect success toast (allow more time for UI update and navigation timer)
  await expect(page.locator('text=Logbook entry submitted for review!')).toBeVisible({ timeout: 10000 });
  });
});
