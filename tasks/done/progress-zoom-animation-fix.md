# Progress: Leaflet Zoom Animation Fix

**Issue**: Prevent Leaflet popups from crashing during zoom animations.
**Status**: ✅ COMPLETE – persistent popup & marker guards deployed.
**Approach**: Install one-time safety wrappers around Leaflet popup/marker internals and keep them active across all zoom cycles.

### Final Implementation
- **Persistent Guard Suite**: Added `installLeafletPopupGuards`, `installLeafletMarkerGuards`, `installLeafletDomUtilGuards`, and `installLeafletMapZoomGuard` that wrap `_animateZoom`, `_updatePosition`, `_updateLayout`, `_movePopup`, and map/DOM helpers exactly once with resilient fallbacks.
- **Cluster-Safe Marker Hooks**: Marker `_movePopup` now no-ops when `_popup` is missing, preventing the `setLatLng` crash triggered during marker-cluster recomposition.
- **Zoom Lifecycle Integration**: Guards are installed during map init and reasserted at `zoomstart` so the “super nuclear” cleanup cooperates with Leaflet internals without races.
- **Restoration Logic Simplified**: Zoom end logs when guards remain active instead of restoring unsafe originals, ensuring the hardened code stays resident.

### Verification
- `cd src/frontend && npx playwright test tests/e2e/zoom-popup-race.spec.ts --reporter=line`
  - Deterministic repro (mocked `/api/artworks/nearby`) passes with no uncaught `Cannot read properties of null (reading 'setLatLng')` errors, even while marker cluster popups are active during zoom.
- Manual zoom sweeps from fully zoomed-out states confirm the map and clusters remain stable with guards engaged.

### Key Files
- `src/frontend/src/components/MapComponent.vue`
- `src/frontend/tests/e2e/zoom-popup-race.spec.ts`

### Next Steps
- Optional: trim verbose `[ZOOM DEBUG]` logging once further QA is complete.
- Keep the Playwright race test in CI to prevent regressions.
