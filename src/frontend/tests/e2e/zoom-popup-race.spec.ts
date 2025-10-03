import { test, expect } from '@playwright/test';

// This E2E test expects the dev server to be running at http://localhost:5173
// It will open the MapView, click a marker to open a popup, then trigger another marker click
// and attempt to click the zoom control while the preview/popup transition is active.

test('reproduce popup -> zoom race', async ({ page }) => {
  const logs: string[] = [];

  await page.route('**/api/artworks/nearby**', async route => {
    const url = route.request().url();
    console.log(`[PLAYWRIGHT MOCK] responding with fake nearby data for ${url}`);
    const fakeResponse = {
      success: true,
      data: {
        artworks: [
          {
            id: 'marker-a',
            lat: 49.2827,
            lon: -123.1207,
            type_name: 'mural',
            recent_photo: null,
          },
          {
            id: 'marker-b',
            lat: 49.2837,
            lon: -123.1217,
            type_name: 'sculpture',
            recent_photo: null,
          },
        ],
        total: 2,
        search_center: { lat: 49.2827, lon: -123.1207 },
        search_radius: 1500,
      },
      timestamp: new Date().toISOString(),
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fakeResponse),
    });
  });
  page.on('console', msg => {
    logs.push(`[console:${msg.type()}] ${msg.text()}`);
    console.log(`[console:${msg.type()}] ${msg.text()}`);
  });
  await page.addInitScript(() => {
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Dismiss onboarding overlays that block the map if they appear
  try {
    await page.getByRole('button', { name: 'Close welcome dialog' }).click({ timeout: 2000 });
  } catch {
    // ignore when onboarding dialog is already dismissed
  }

  try {
    await page.getByRole('button', { name: 'Dismiss development warning' }).click({ timeout: 2000 });
  } catch {
    // ignore when banner is not present
  }

  // Wait for map container to appear
  await page.waitForSelector('.leaflet-container', { timeout: 15000 });

  // Seed the map with deterministic test artworks via the Pinia store
  await page.evaluate(async () => {
    const { useArtworksStore } = await import('/src/stores/artworks.ts');
    const store = useArtworksStore();
    store.setArtworks([
      { id: 'marker-a', latitude: 49.2827, longitude: -123.1207, type: 'mural', photos: [] },
      { id: 'marker-b', latitude: 49.2837, longitude: -123.1217, type: 'sculpture', photos: [] },
      { id: 'marker-c', latitude: 49.2847, longitude: -123.1197, type: 'installation', photos: [] },
    ]);
  });

  // Ensure markers have been rendered on the map before interacting
  await page.waitForFunction(() => {
    return document.querySelectorAll('.artwork-circle-marker, .leaflet-marker-icon, .artwork-normal-marker, .marker-cluster').length >= 2;
  }, { timeout: 20000 });

  // Find markers - look for artwork marker circles or marker elements
  const markerSelector = '.artwork-circle-marker, .leaflet-marker-icon, .artwork-normal-marker, .marker-cluster';
  await page.waitForSelector(markerSelector, { timeout: 15000 });

  // Click first marker
  const markers = await page.$$(markerSelector);
  if (markers.length < 2) {
    throw new Error('Not enough markers found for reproduction');
  }

  // Click marker A
  await markers[0].click();
  // Small wait for popup/preview to appear
  await page.waitForTimeout(250);

  // Click marker B to start transition
  await markers[1].click();

  // While transition is happening, try to trigger zoom via control
  const zoomIn = await page.$('.leaflet-control-zoom-in');
  if (zoomIn) {
    // trigger click quickly
    await zoomIn.click();
  } else {
    // fallback: use wheel event to zoom
    await page.mouse.wheel(0, -100);
  }

  // Wait a moment for any errors to surface
  await page.waitForTimeout(1500);

  // Assert no uncaught page errors
  const pageErrors = logs.filter(l => l.includes('[pageerror]'));
  expect(pageErrors).toEqual([]);

  const criticalErrors = logs.filter(l =>
    l.includes('Global JavaScript error') ||
    l.includes("Cannot read properties of null (reading '_latLngToNewLayerPoint')") ||
    l.includes('_latLngToNewLayerPoint')
  );
  expect(criticalErrors).toEqual([]);
});
