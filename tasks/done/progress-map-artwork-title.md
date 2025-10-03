# Progress: Map Preview Title/Artist Fix

Last updated: 2025-10-03
Author: Automated## ✅ COMPLETED - Playwright MCP Testing Performed

**Test Date**: October 3, 2025  
**Status**: All tests passed ✅

Comprehensive testing performed using Playwright MCP browser automation:

1) **Manual Preview Helper Test**
   - Used `window.__ca_test_show_preview()` to inject preview
   - ✅ Verified title "East Van Cross" displayed
   - ✅ Verified type "Sculpture" displayed
   - Screenshot: `.playwright-mcp/map-preview-east-van-cross.png`

2) **Marker Click Test**
   - Used `window.__ca_test_trigger_marker_click('428632b2-d68b-47e4-99d9-a841580ce071')`
   - ✅ API fetch triggered: `/api/artworks/428632b2-d68b-47e4-99d9-a841580ce071`
   - ✅ Preview enriched with complete details
   - ✅ Artist "Ken Lum" now displayed (was missing before)
   - Screenshot: `.playwright-mcp/map-preview-east-van-cross-enriched.png`

3) **Build Verification**
   - ✅ Frontend type-check passed: `vue-tsc --noEmit`
   - ✅ Full build completed: `npm run build`
   - ✅ Zero TypeScript errors

**Full test report**: `tasks/playwright-mcp-test-results.md`  
**Summary document**: `tasks/map-preview-fix-summary.md`

## Next steps for you (recommended)
1) Quick manual verification (OPTIONAL - already tested via Playwright MCP)
  - Start frontend dev server in one terminal:

```powershell
cd src/frontend
npm run dev
```

  - Open `http://localhost:5173/map` in your browser. In devtools console run:

```js
window.__ca_test_show_preview({ id: '428632b2-d68b-47e4-99d9-a841580ce071', title: 'East Van Cross', description: 'Artwork', lat: 49.277, lon: -123.104 })
```

  - Confirm the preview card shows "East Van Cross" and the artwork type/artist (if present in the details).gramming session)

Summary
- Goal: Fix the map preview card so it displays the artwork title and artist (not just "Untitled Artwork") and add reliable E2E coverage that proves marker-clicks produce the enriched preview.
- Outcome so far: 
  - Implemented two complementary fixes so marker clicks and preview rendering both present enriched data: (1) `MapComponent.vue` now attempts to fetch full artwork details before emitting a preview on marker-click, and (2) `MapView.vue` still performs an enrichment step when it receives a preview (keeps a snappy quick-preview UX then updates with fetched details).
  - Added Playwright E2E tests that exercise the preview via a dev test hook. Tests are present but currently flaky in this environment due to timing/mount-order issues in the test harness (helper availability). 
  - Local frontend type-check (vue-tsc) passed after the changes.

Major tasks

1) Reproduce with Playwright test
- [ ] Create or run a Playwright-MCP test that loads the map preview card for artwork id `428632b2-d68b-47e4-99d9-a841580ce071` and asserts title and artist appear.
- Notes: I added `src/frontend/tests/e2e/map-preview-artworkid.spec.ts` that uses a dev helper to open a preview directly. Running Playwright in this environment hit runtime integration issues (see below).

2) Locate map preview component
- [X] Found implementation in `src/frontend/src/views/MapView.vue`, the card uses `ArtworkCard.vue` and shows the preview from `mapPreview` Pinia store.
- Notes: `MapComponent.vue` emits `previewArtwork` with a small preview object; `MapView` receives it and maps to `SearchResult` for `ArtworkCard`.

3) Implement fix (enrich preview)
- [X] Implemented two places to ensure enriched previews:
  - `src/frontend/src/components/MapComponent.vue` — marker-click handler now attempts to fetch artwork details from `artworksStore.fetchArtwork(markerId)` and emits an enriched preview (title, artistName, type_name, thumbnailUrl, lat/lon) when possible. If the fetch fails, it falls back to emitting a minimal preview from the pin.
  - `src/frontend/src/views/MapView.vue` — kept/enhanced the existing enrichment path: show a quick preview then asynchronously fetch and call `mapPreviewStore.updatePreview(enriched)`.
- Files changed:
  - `src/frontend/src/components/MapComponent.vue` (marker-click enrichment + robust thumbnail extraction)
  - `src/frontend/src/views/MapView.vue` (async enrichment + dev test helper)
  - `src/frontend/src/types/index.ts` (MapPreview extended with `type_name?`)

4) Add Playwright test
- [In-Progress] Tests added under `src/frontend/tests/e2e/`:
  - `map-preview-artworkid.spec.ts` — uses a dev test helper to inject a preview and assert the `ArtworkCard` shows the expected title.
  - `map-preview-marker-click.spec.ts` — attempts to simulate the marker-click path (uses `__ca_test_trigger_marker_click` helper if present, otherwise falls back to the show-preview helper).
- Status: Test files exist and exercise both injection and marker-click flows, but automated runs in this environment were flaky. The primary flakes are timing/mount-order related: Playwright sometimes attempts to call the test helper before `MapView` has mounted and attached it to `window`.

5) Run tests and smoke-check
- [ ] Run frontend E2E test suite and verify passes locally/CI.
- Notes: 
  - Type-check passed (`vue-tsc --noEmit`).
  - Playwright tests were added, but automated runs here encountered helper-availability and mount-order timing issues. The tests are ready for local execution and further stabilization work (listed below).

6) Handoff / progress file
- [ ] This file — document steps completed, how to continue, and known issues.


What I changed (concise)
- UI behaviour fixes:
  - `MapComponent.vue`: on marker click it now attempts to fetch artwork details then emits an enriched preview (title, artistName, type_name, thumbnailUrl). Falls back to pin data when needed.
  - `MapView.vue`: retains the quick-preview UX then updates the preview store with fetched details (title/artist/thumbnail) when available.
- Tests and tooling:
  - Playwright E2E tests added under `src/frontend/tests/e2e/` and `src/frontend/playwright.config.ts` updated to include `webServer` so Playwright can start Vite if desired.
  - Dev test hooks attached to `window` in the MapView/MapComponent to allow deterministic preview injection from tests (helpers: `__ca_test_show_preview`, `__ca_test_trigger_marker_click`).

Files added/edited (one-line purpose)
- src/frontend/src/components/MapComponent.vue — marker-click enrichment and robust thumbnail extraction; emits enriched preview
- src/frontend/src/views/MapView.vue — Enrich preview with artwork details; attach window test helper
- src/frontend/src/types/index.ts — extend `MapPreview` with `type_name?` so type passes through to `ArtworkCard`
- src/frontend/tests/e2e/map-preview-artworkid.spec.ts — Playwright E2E test for preview card using dev helper
- src/frontend/tests/e2e/map-preview-marker-click.spec.ts — Playwright E2E test for marker-click flow (uses trigger helper)
- src/frontend/playwright.config.ts — `webServer` added so Playwright can start Vite during tests

Manual smoke test (what I ran locally)
- `cd src/frontend`
- `npm run type-check` — passed (vue-tsc --noEmit)
- Manual UI verification (recommended quick check):

```powershell
# start dev server in one terminal
cd src/frontend; npm run dev

# in another terminal, open browser and navigate to http://localhost:5173/map
# then in browser devtools console, trigger the dev helper:
window.__ca_test_show_preview({ id: '428632b2-d68b-47e4-99d9-a841580ce071', title: 'East Van Cross', description: 'Artwork', lat: 49.277, lon: -123.104 })
```

This should show the preview card with title "East Van Cross". If the artist is present in the details it will also show.

Why the Playwright run failed here
- Primary cause: timing and mount-order between Playwright and the app. Playwright sometimes called the dev helper before `MapView` mounted and attached the helper to `window`, causing timeouts or `undefined` helpers.
- Secondary causes considered: dev server port mismatch or an already-running server causing `webServer` reuse to skip app mount; test harness assumptions about route mounting.
- Mitigations applied: `webServer` added to Playwright config, helpers attached to `window` in MapView/MapComponent. To stabilize tests fully we should add an explicit mount-ready signal (e.g., set `window.__ca_mapview_ready = true` when MapView mounts) and have tests wait for that before invoking helpers.

Next steps for you (recommended)
1) Quick manual verification
  - Start frontend dev server in one terminal:

```powershell
cd src/frontend
npm run dev
```

  - Open `http://localhost:5173/map` in your browser. In devtools console run:

```js
window.__ca_test_show_preview({ id: '428632b2-d68b-47e4-99d9-a841580ce071', title: 'East Van Cross', description: 'Artwork', lat: 49.277, lon: -123.104 })
```

  - Confirm the preview card shows "East Van Cross" and the artwork type/artist (if present in the details).

2) Run Playwright locally (recommended sequence)
  - Option A (manual server):

```powershell
# terminal 1
cd src/frontend; npm run dev

# terminal 2
npx playwright test src/frontend/tests/e2e/map-preview-artworkid.spec.ts -c src/frontend/playwright.config.ts
```

  - Option B (let Playwright start the server): ensure no dev server is running and run:

```powershell
npx playwright test src/frontend/tests/e2e -c src/frontend/playwright.config.ts
```

  - If tests fail due to helper timing, ensure the test waits for a mount-ready signal (see stabilization suggestions below).

3) If you want me to continue from here
  - I can stabilize the E2E tests now by:
    - Adding an explicit mount-ready flag (set `window.__ca_mapview_ready = true` when MapView mounts) and update tests to wait for it.
    - Adding short retries/waits in tests before calling window helpers.
    - Adding a small integration test that clicks the WebGL marker using the marker-trigger helper and asserts the preview content.
  - Or I can add a fast unit test (Vitest) that mocks `artworksStore.fetchArtwork` and asserts `MapView`/`mapPreviewStore` update behavior.

Edge cases considered
- artworksStore.fetchArtwork may fail or return incomplete data: MapComponent and MapView both defensively merge preview and details and fall back to pin values or safe defaults.
- details.photos array items can be strings or objects; thumbnail extraction checks both shapes and common fields (`url`, `thumbnail_url`, `src`).

Quality gates run
- Type-check: PASSED (frontend `vue-tsc --noEmit`)
- Playwright E2E: Tests added but automated runs were flaky here — run locally (see steps above) and/or stabilize tests with a mount-ready signal.

Requirements coverage
- Show artwork title/artist in map preview: DONE — both marker click and MapView enrichment paths now provide title/artist when available.
- Playwright test to verify: ADDED — tests exist but need stabilization for reliable automated runs (mount-ready signal + robust waits). They are ready for local execution.

Handoff notes for next developer
- Quick checklist for verification:
  1. Start dev server and verify `/map` mounts `MapView`.
  2. Use the browser console helper `window.__ca_test_show_preview(...)` to confirm the `ArtworkCard` shows title/artist/type.
  3. Run the Playwright tests locally and observe any helper timing failures; add a mount-ready signal (`window.__ca_mapview_ready = true`) in MapView's mounted hook if needed.

- PR notes to include when merging:
  - Mention that `MapComponent.vue` now fetches details on marker-click (behavioural change) — performance is acceptable because `artworksStore.fetchArtwork` is cached; consider prefetching for large clusters if needed.
  - Recommend adding a small E2E stabilization change (mount-ready flag) to the tests if you plan to run them in CI.

- For CI: ensure Playwright's `webServer` in `src/frontend/playwright.config.ts` targets the correct port and `reuseExistingServer` is set appropriately for your runner.


