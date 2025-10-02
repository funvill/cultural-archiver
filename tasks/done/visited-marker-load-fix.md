# Fix: Visited markers not showing as visited on initial load

What I changed

- Updated `src/frontend/src/components/MapComponent.vue` to detect when an artwork's marker already exists in `artworkMarkers` and to update its icon if the marker's classification (visited/starred/unknown/normal) changes after initial render. This ensures markers reflect the user's lists (Visited) as soon as those lists are available, instead of waiting for the marker to be recreated (e.g., when panning).

Why this was happening

- The visited/starred sets are loaded asynchronously. Markers were being created before those sets were populated, so markers initially used the "normal" icon. They only changed appearance when the marker was recreated (for example, after panning or cluster rebuild).

How the fix works

- When updateArtworkMarkers runs it now checks for an existing marker for the artwork. If found, it computes the artwork's current marker type via `getMarkerType()` and, if different, calls `setIcon(...)` on the existing marker and updates the internal `_markerType` property.

Notes

- I used a local any-cast for marker instances to avoid TypeScript type complaints about custom properties (`_artworkId`, `_markerType`) and Leaflet runtime methods (e.g., `setIcon`). This is consistent with how other parts of the component attach custom properties to markers.
- I ran the frontend tests (Vitest) — the test run completed with many tests passing (120 tests passed). Some unrelated test warnings/errors about environment/mock functions remain from the existing test suite and are not introduced by this change.

Next steps (optional)

- Convert the custom marker properties into a typed wrapper interface for better type-safety.
- Add an explicit unit test that simulates loading visited lists after initial marker creation and asserts that existing markers update their icon.
