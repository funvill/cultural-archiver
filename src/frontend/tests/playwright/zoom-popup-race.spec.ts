import { test, expect } from '@playwright/test';

// This test expects the dev server to be running at http://localhost:5173
// It will open the MapView, click a marker to open a popup, then trigger another marker click
// and attempt to click the zoom control while the preview/popup transition is active.

test('reproduce popup -> zoom race', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', msg => {
    logs.push(`[console:${msg.type()}] ${msg.text()}`);
    console.log(`[console:${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    logs.push(`[pageerror] ${err.message}`);
    console.error('[pageerror]', err);
  });

  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');

  // Wait for map container to appear
  await page.waitForSelector('.leaflet-container', { timeout: 10000 });

  // Find markers - look for artwork marker circles or marker elements
  const markerSelector = '.artwork-circle-marker, .leaflet-marker-icon, .artwork-normal-marker';
  await page.waitForSelector(markerSelector, { timeout: 10000 });

  // Click first marker
  const markers = await page.$$(markerSelector);
  if (markers.length < 2) {
    throw new Error('Not enough markers found for reproduction');
  }

  // Click marker A
  await markers[0].click();
  // Small wait for popup/preview to appear
  await page.waitForTimeout(200);

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
  await page.waitForTimeout(1000);

  // Assert no uncaught page errors
  const pageErrors = logs.filter(l => l.includes('[pageerror]'));
  expect(pageErrors).toEqual([]);
});
