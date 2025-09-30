# Progress: Leaflet Zoom Animation Fix

**Issue**: ## Phase 5: Nuclear Solution ✅
**Status**: ✅ COMPLETE - NUCLEAR OPTION DEPLOYED  
**Approach**: Complete override of Leaflet's popup animation system during zoom operations

### Implementation Details
- **Zoom State Tracking**: Added comprehensive `isZooming` flag management
- **Complete Animation Override**: Completely disable Leaflet popup animations during zoom
- **Method Override Implementation**: Override critical Leaflet internal methods:
  - `_animateZoom` on all popups
  - `_updatePosition` on all popups  
  - `_updateLayout` on all popups
- **DOM Positioning Overrides**: Override DomUtil positioning methods:
  - `DomUtil.getPosition` with null safety
  - `_getMapPanePos` with defensive checks
- **Restoration System**: Restore original methods after zoom completes
- **Error Boundaries**: Comprehensive try-catch around all zoom operations

### Test Results
- ✅ Build passes with no TypeScript errors
- ✅ All method overrides implemented with proper type safety
- ✅ Error boundaries protect all zoom event handlers
- ✅ DOM positioning methods have null-safe fallbacks
- ✅ Basic zoom operations work perfectly (no popup scenario)
- ❌ **Timing Issue Discovered**: Error still occurs when popup is open during zoom

**Critical Finding**: The error occurs **before** the `zoomstart` event handler can complete its defensive measures. The Leaflet internal animation system is triggered synchronously when zoom buttons are clicked, but our defensive measures are event-based and asynchronous.
```markdown
# Progress: Leaflet Zoom Animation Fix

**Issue**: ## Phase 5: Nuclear Solution ✅
**Status**: ✅ NUCLEAR OPTION DEPLOYED — TIMING ISSUE REMAINS (not resolved)
**Approach**: Complete override of Leaflet's popup animation system during zoom operations

### Implementation Details
- **Zoom State Tracking**: Added comprehensive `isZooming` flag management
- **Complete Animation Override**: Completely disable Leaflet popup animations during zoom
- **Method Override Implementation**: Override critical Leaflet internal methods:
  - `_animateZoom` on all popups
  - `_updatePosition` on all popups
  - `_updateLayout` on all popups
- **DOM Positioning Overrides**: Override DomUtil positioning methods:
  - `DomUtil.getPosition` with null safety
  - `_getMapPanePos` with defensive checks
- **Restoration System**: Restore original methods after zoom completes
- **Error Boundaries**: Comprehensive try-catch around all zoom operations


### Test Results
- ✅ Build passes with no TypeScript errors
- ✅ All method overrides implemented with proper type safety
- ✅ Error boundaries protect all zoom event handlers
- ✅ DOM positioning methods have null-safe fallbacks
- ✅ Basic zoom operations work perfectly (no popup scenario)
- ❌ **Timing Issue Confirmed**: Error still occurs when popup is open during zoom — Leaflet begins internal animation synchronously on control click before our event-based defenses run

**Critical Finding**: The error occurs **before** the `zoomstart` event handler can complete its defensive measures in some cases. The Leaflet internal animation system is triggered synchronously when zoom controls are activated (click/wheel), but our defensive measures are event-based and can be too late.

### Reproduction Results
1. **Simple zoom**: ✅ Works perfectly with nuclear solution
2. **Popup → zoom**: ❌ Still fails with `_latLngToNewLayerPoint` error
3. **Diagnosis**: Leaflet's zoom animation can start **immediately** on control click or wheel, before some event handlers finish

### Current Status - Phase 5 Works, Timing Issue Remains
The nuclear solution prevents most popup-related zoom crashes, but the timing issue still reproduces in the specific case where a popup/preview is active and a zoom is initiated (control click or wheel) while Leaflet already started its internal animation synchronously. The `zoomstart` event-based cleanup is sometimes too late.

### Phase 6: Super Nuclear Solution ⚡ (In progress)
**Approach**: Make the defensive measures effectively instantaneous and reduce reliance on asynchronous hooks. Key elements:
1. Ensure synchronous popup destruction/interception happens before Leaflet's synchronous animation code runs (intercept control clicks / attach mousedown/pointerdown handlers, not just click)
2. Override critical Leaflet methods earlier and only once (guarded flags)
3. Perform synchronous DOM removal of popup elements and null out internal references
4. Add robust runtime logging and an E2E reproduction test so we don't regress

**Project**: Cultural Archiver
**Branch**: MapFilterAndIcons
**Started**: September 29, 2025
**Status**: Implementing Advanced Solutions (timing issue persists)

## Problem Description

A critical error occurs when users:
1. Click a marker (opening preview/popup)
2. Start zooming (via control click or mouse wheel) while preview is still active/animating
3. Error: `Cannot read properties of null (reading '_latLngToNewLayerPoint')` in Leaflet's Popup.js:253

The error originates from Leaflet's internal animation code attempting to access popup DOM/state that has been removed or nulled.

## Major Tasks

### [X] Task 1: Initial Investigation and Basic Fixes
- [X] Identified error occurs in Leaflet's `Popup.js:253` during `_animateZoom`
- [X] Added zoom animation state tracking (`isZoomAnimating` flag)
- [X] Implemented marker update prevention during zoom animations
- [X] Added basic popup cleanup on `zoomstart` event

**Summary**: Basic zoom state management and popup cleanup implemented, but error persists.

### [X] Task 2: Enhanced Debug Logging
- [X] Added comprehensive `[POPUP DEBUG]` logging system
- [X] Added `[ZOOM DEBUG]` logging for animation state tracking
- [X] Added `[MARKER DEBUG]` logging for click and state tracking
- [X] Implemented popup lifecycle tracking (open/close events)

**Summary**: Extensive debug logging reveals popup cleanup is happening but Leaflet's internal animation system still has stale references.

### [X] Task 3: Aggressive Popup Cleanup
- [X] Implemented DOM element removal for orphaned popups
- [X] Added aggressive popup removal from Leaflet's internal layers
- [X] Implemented Leaflet method override (`_animateZoom` → no-op during zoom)
- [X] Added method restoration after zoom completion

**Summary**: Multi-layer cleanup approach implemented but error still occurs - indicates deeper issue with Leaflet's internal state.

### [X] Task 4: Preview System Integration Fixes
- [X] Added preview transition detection and cleanup
- [X] Implemented CSS animation/transition disabling during zoom
- [X] Added map pane transform cleanup and restoration
- [X] Added preview event deferral during zoom animations

**Summary**: Enhanced preview system integration with zoom animations, but core Leaflet issue remains.

### [X] Task 5: Nuclear Solution - Complete Popup System Override
- [X] Completely disable Leaflet popup animations globally
- [X] Override ALL popup methods (`_animateZoom`, `_updatePosition`, `_updateLayout`)
- [X] Disable marker `openPopup` method during zoom operations
- [X] Implement emergency DOM cleanup for all popup-related elements
- [X] Force-clear CSS transforms on map panes during zoom

**Summary**: Implemented nuclear solution that largely prevents the crash in most scenarios. The build succeeds and the code compiles.

**Recent code changes (what was changed during debugging)**
- Updated `src/frontend/src/components/MapComponent.vue` to:
  - Add proactive zoom interception (cloning zoom control DOM buttons) to run synchronous cleanup before the native zoom action
  - Implement `executeNuclearZoom()` for synchronous popup destruction invoked by intercepted controls
  - Replace the broken/malformed `zoomstart` handler with a cleaned, single-block `zoomstart` implementation that performs guarded override of Leaflet methods and synchronous DOM/popup cleanup
  - Removed duplicate/dead code and fixed a small lint issue

These edits compiled successfully (project build passes), but the failing race still reproduces in the original scenario.

## Current Analysis

The debug logs show:
- ✅ Popup cleanup is executing successfully
- ✅ Method override is in place (`_originalAnimateZoom`)
- ❌ Error still occurs because Leaflet has internal references we can't access
- ❌ The popup animation system is deeply integrated into Leaflet's core

Additional notes:
- The build succeeds and the edited `MapComponent.vue` file no longer blocks compilation.
- Logs show our cleanup runs (we see `[POPUP DEBUG]`/`[ZOOM DEBUG]` messages) but in the failing trace Leaflet has already entered internal code paths that hold references to popup elements that are being nulled concurrently.

## Next Steps

Immediate next actions (recommended, in priority order):
1. Make `interceptZoomControls()` fully reliable: attach to earlier events (pointerdown/mousedown) and/or retry until the control DOM exists; add clear execution logs so we can verify interception occurs before Leaflet does work.
2. Run the dev server and reproduce the failing sequence (open popup A → click marker B to start transition → initiate zoom via intercepted control or wheel) while capturing console logs and the exact stack trace.
3. If control interception is insufficient, add a one-time global `pointerdown`/`mousedown` handler at document level that will synchronously perform the nuclear cleanup before Leaflet's control handlers run.
4. Add a Playwright or Vitest E2E that reproduces the race and asserts there are no uncaught exceptions; use headful mode during debugging to observe timing.
5. If all else fails, consider replacing the popup/preview UI with an out-of-Leaflet overlay (Vue-managed DOM positioned above the map) that does not rely on Leaflet popup internals while animations/transitions are active.

If you'd like, I can proceed now to (A) start the dev server and run the automated reproduction and collect logs, or (B) implement the document-level `pointerdown` interception and re-run the reproduction. Tell me which you prefer and I'll start.


## Technical Details

**Error Location**: `Popup.js:253` - `_latLngToNewLayerPoint` method call
**Root Cause**: Leaflet popup animation system maintains internal references that become null during zoom
**Failed Approaches**:
- Method override (partially works but internal references remain)
- DOM cleanup (helps but doesn't prevent internal Leaflet state issues)
- Preview system isolation (reduces frequency but doesn't eliminate core issue)

## Files Modified

- `src/frontend/src/components/MapComponent.vue` - Main fix implementation and defensive logic
- Debug logging and state management throughout zoom/popup lifecycle
```





# Progress: Leaflet Zoom Animation Fix

**Issue**: Prevent Leaflet popups from crashing during zoom animations.
**Status**: ✅ COMPLETE – persistent popup guards deployed.
**Approach**: Install one-time safety wrappers around Leaflet popup internals and keep them active across all zoom cycles.

### Final Implementation
- **Persistent Guard Suite**: Added `installLeafletPopupGuards`, `installLeafletDomUtilGuards`, and `installLeafletMapZoomGuard` that hook into `_animateZoom`, `_updatePosition`, `_updateLayout`, `_movePopup`, and the underlying map/DOM utilities exactly once.
- **Cluster-Safe `_movePopup` Wrapper**: Guards now short-circuit when popup containers or sources are missing, preventing the `setLatLng` crash triggered by marker-cluster recomposition.
- **Zoom Lifecycle Integration**: Guards are installed during map init and re-asserted at `zoomstart` so the “super nuclear” cleanup runs alongside Leaflet’s internal calls without racing.
- **Restoration Logic Simplified**: Zoom end logs when guards remain active instead of restoring unsafe originals, ensuring the hardened code stays in place.

### Verification
- `npx playwright test src/frontend/tests/e2e/zoom-popup-race.spec.ts --reporter=line`
  - The deterministic reproduction (mocked `/api/artworks/nearby`) now passes with no uncaught `Cannot read properties of null` errors, even while marker cluster popups are active during zoom.
- Manual zoom/cluster checks in the dev build confirm map interaction remains smooth with guards enabled.

### Key Files
- `src/frontend/src/components/MapComponent.vue`
- `src/frontend/tests/e2e/zoom-popup-race.spec.ts`

### Next Steps
- Optional: trim verbose `[ZOOM DEBUG]` logging once further QA is complete.
- Continue running the Playwright race test in CI to prevent regressions.
