# PRD: Map & Cache Optimizations

This document captures recommended optimizations for the map marker / list-membership caching / telemetry feature. Each item includes a short contract (inputs/outputs/success), edge cases to consider, an implementation plan, and a rough effort & risk estimate.

## Summary prioritization

1. Debounce telemetry & cache persistence (localStorage writes)
2. BroadcastChannel multi-tab sync
3. Reduce DOM churn (update marker DOM / reuse markers)
4. Switch icon rendering to SVG templates or OffscreenCanvas worker
5. Coalesce / batch list-details fetches (client-side coalescing or server batch endpoint)
6. Persist large caches to IndexedDB (idb wrapper)
7. Server endpoint: artwork-in-system-lists (region or ids)
8. Observability: network counters/durations and E2E test

---

## 1) Debounce telemetry & cache persistence

Contract
- Inputs: transient telemetry increments (in-memory counters)
- Outputs: batched write to `localStorage` (key: `map:cacheTelemetry`) and a single `telemetryUpdate` emit
- Success: at most one write/emit per debounce interval (default 1000–2000ms), and counts preserved

Edge cases
- Page unload before debounce flushes (flush on `beforeunload`)
- Rapid high-volume updates (ensure counter increments remain precise)
- Multi-tab races (BroadcastChannel recommended)

Plan
- Replace direct localStorage writes with a debounced `persistTelemetry()` wrapper that schedules a flush.
- On flush: write to localStorage, emit `telemetryUpdate`, and update `window.__mapCacheTelemetry` for debug.
- Ensure immediate flush when calling `resetCacheTelemetry()` or `clearListCaches()`.
- Add `window.addEventListener('beforeunload', flushTelemetry)` to avoid losing final state.

Effort: 30–60 minutes. Risk: Low.

---

## 2) BroadcastChannel multi-tab sync

Contract
- Inputs: published events when telemetry / caches change
- Outputs: other tabs receive event and synchronize in-memory caches and telemetry snapshot
- Success: near-real-time sync across tabs; no stale UI when multi-tabs are open

Edge cases
- Non-supporting browsers (fallback to localStorage event or polling)
- Large payloads (> message size limits)
- Conflicting simultaneous updates (prefer last-writer-wins or small CRDT)

Plan
- Create a small `map-cache` BroadcastChannel.
- Publish messages with `type` field: `telemetry`, `clearCaches`, `listDetailsUpdate` (with listId), and `userListsUpdate`.
- In other tabs subscribe and apply updates to the corresponding caches and telemetry, then emit local telemetry events to update UI.
- Fallback: listen for `storage` events on localStorage keys for older browsers.

Effort: 1–2 hours. Risk: Low.

---

## 3) Reduce DOM churn: reuse markers & update in-place

Contract
- Inputs: changes to marker appearance (icon, size, classes) or small position updates
- Outputs: in-place DOM updates using `marker.getElement()` or `marker.setIcon()` only when necessary
- Success: fewer re-creations of L.Marker objects and reduced reflows

Edge cases
- MarkerCluster interactions (changing marker type may require re-clustering)
- Markers with different underlying types (CircleMarker vs Marker)

Plan
- Maintain a map: `artworkId -> L.Marker` for quick lookup.
- When artwork state changes, if a marker exists update its DOM element (`element.querySelector('.artwork-marker-inner')`) or call `marker.setIcon()` only if absolutely required.
- Batch add/remove operations for clusters using `markerClusterGroup.addLayers(layersArray)` and `removeLayers(layersArray)` to avoid repeated reflows.

Effort: 2–4 hours. Risk: Low–Medium.

---

## 4) Icon rendering: SVG templates or OffscreenCanvas worker

Contract
- Inputs: icon `kind` ('flag'|'star'|'question'), `size`, `fillColor`
- Outputs: SVG string or data-URI returned quickly without blocking main thread
- Success: faster icon creation and reduced main thread work when rendering many markers

Edge cases
- OffscreenCanvas support varies; must fallback to main-thread rendering
- Device pixel ratio handling across render paths

Plan
- Option A (fast): Replace canvas glyphs with inline SVG templates and CSS variables for color/size. No worker needed and SVG scales cleanly.
- Option B (more work): Use OffscreenCanvas in a WebWorker to create dataURIs. Fallback to SVG or main-thread canvas when unsupported.

Effort: SVG replacement ~2–4 hours; Worker approach ~1–2 days. Risk: Medium for worker approach.

---

## 5) Coalesce / batch list-details fetches

Contract
- Inputs: multiple list IDs that need details within a short time window (e.g., viewport batch)
- Outputs: fewer network requests, ideally one batch request returning details for multiple list IDs
- Success: fewer roundtrips and lower latency

Edge cases
- Server must support batch endpoint or client needs to coalesce multiple parallel requests
- Pagination limits for lists with many items

Plan
- Preferred: add server endpoint `POST /lists/details/batch` that accepts `ids[]` and returns mapping `id -> items` (or membership booleans per artwork).
- Client fallback: implement coalescing logic where requested list IDs within X ms are grouped and fetched sequentially or with limited concurrency, caching all results.

Effort: client-only coalescing ~2–4 hours; server+client full support ~1–2 days. Risk: Medium.

---

## 6) Persist large caches to IndexedDB

Contract
- Inputs: `listDetailsCache` map and user lists data
- Outputs: persisted store in IndexedDB (async), faster reads/writes for larger data, non-blocking IO
- Success: improved performance when caches are sizeable and avoid localStorage sync costs

Edge cases
- Need to handle async readiness and migration
- Browser storage quotas and errors

Plan
- Adopt the `idb` library (small wrapper) and create object stores for `listDetails` and `userLists`.
- Load a minimal index into memory on startup to support quick membership checks; fetch from IDB on cache miss.
- Keep existing localStorage keys for small items and telemetry for backwards compatibility while migrating.

Effort: 1–2 days. Risk: Medium.

---

## 7) Server-side endpoint: artwork-in-system-lists

Contract
- Inputs: artwork IDs or bounding box; Outputs: membership booleans for system lists (beenHere / wantToSee) per artwork
- Success: Single request returns membership for visible artworks, dramatically reducing list & list-details queries

Edge cases
- Authorization and privacy; ensure endpoint only returns system list membership and doesn't expose private lists
- Pagination for large result sets (but viewport scope will be small)

Plan
- Add backend route `/artworks/system-list-membership` that accepts `ids[]` and returns mapping `{ id: { beenHere: boolean, wantToSee: boolean } }`.
- Client calls this when markers are created/when viewport changes, caches the result for TTL window.

Effort: backend+client ~1–3 days. Risk: Medium–High (server changes + testing + rollout).

---

## 8) Observability & testing

- Instrument `apiService` to count requests and measure durations (cache vs network). Expose counters in dev UI.
- Add Playwright E2E test that opens the map, triggers membership checks, and asserts the modal shows the persisted telemetry.

Effort: 2–4 hours for instrumentation + 4–8 hours for E2E test depending on harness. Risk: Low.

---

## Implementation picks (recommendation)

If you want a short roadmap I'd implement in this order:
1. Debounce telemetry persistence + flush on unload (low risk, immediate benefit)
2. BroadcastChannel multi-tab sync (improves UX across tabs)
3. Reduce DOM churn and batch cluster add/remove (big performance boost on marker updates)
4. Switch icons to SVG templates (fast rendering and easier to style)
5. Coalesce list-details fetches or add server batch endpoint (network win)
6. Migrate large caches to IndexedDB when data size grows
7. Add E2E test and instrumentation to quantify wins

---

If you'd like, I can implement items 1 and 2 now: debounce telemetry persistence and add BroadcastChannel sync. Which do you prefer I start with? Or pick a different item from the list.
