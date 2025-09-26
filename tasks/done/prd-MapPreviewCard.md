# MapPreviewCard — Product Requirements Document

## Purpose

When a user clicks a marker on the map a compact preview should appear pinned to the bottom of the screen. The preview (MapPreviewCard) gives enough information for the user to decide whether to open the full Artwork Details page. This enables rapid discovery by letting users click many markers while keeping context on the map.

## Goals

- Allow users to explore map markers quickly without navigating away from the map.
- Provide an uncluttered, consistent preview UI with title, clipped description, and thumbnail.
- Support touch and mouse interactions; accessible and performant for many markers.

## Overview / behavior

- Trigger: click (or tap) on an artwork marker. If an existing preview is open it should update to the newly clicked artwork. The preview is anchored to the bottom of the viewport and overlays map content.
- Dismissal: user may dismiss the preview by panning the map. Any pan gesture dismisses the card immediately. There is no separate close affordance. Tapping the map outside the card does not dismiss the card unless that tap results in a map movement (pan) or the user taps another marker.
- Navigation: tapping anywhere on the MapPreviewCard opens the Artwork Details page for that artwork.
- Only one MapPreviewCard is visible at a time.

### Popup animation

- When the card appears it should include a small "pop" animation with a moderate shake to draw attention. The shake should be short (about 200–300ms) and moderate in intensity; it must be disabled when the user prefers reduced motion, in which case use a simple slide/fade instead.

Placement & layout
------------------
The preview should be horizontally centered and pinned to the bottom safe area. The compact layout (desktop and mobile) should follow this grid:

| Title                |                 |
| Description Line one | Thumbnail image |
| Description line two |                 |


Visual details
--------------
- Card width: viewport width minus 32px horizontal padding, max-width 980px.
- Card height: single-row compact (approx 88–120px depending on thumbnail aspect ratio). Thumbnails should be square 72x72 or 80x80 depending on density.
- Background: theme surface color with a subtle elevation shadow and 8px border radius.
- Spacing / typography: Title uses a medium-weight type, clipped to a single line with an ellipsis. Description is clipped to two lines with an ellipsis. Use system fonts to match app style.
- Thumbnail: always placed on the right (consistent across screen sizes). Use an optimized 200px max side thumbnail served by the photos CDN. If no thumbnail, show a placeholder image or icon.
	- Loading strategy: load a small lightweight thumbnail (100–200px) first, then progressively fetch higher-resolution images as needed (for details view).


Data contract / API
-------------------
MapPreviewCard should accept a small object from the map marker click handler. Contract:

- id: string (artwork id)
- title: string
- description: string
- thumbnailUrl?: string (optional)
- lat: number
- lon: number

Example TypeScript interface:

```ts
interface MapPreview { id: string; title: string; description: string; thumbnailUrl?: string; lat: number; lon: number }
```

Client-side behavior & interactions
-----------------------------------
- Debounce rapid clicks: if a user clicks many markers quickly, update the card to the last click after an 80ms debounce to avoid spamming UI updates.
- Prefetch: when a preview opens, prefetch the artwork details route and larger images in low-priority network/background to speed navigation.
- Analytics: emit an event "map_preview_open" with artwork id and source "map" when the card appears, and "map_preview_navigate" when user taps to visit details. Do NOT emit a specific dismiss event.

Tap / outside interactions
-------------------------
- Tapping the map outside the card should have no effect unless the action also triggers a map movement (pan) or the tap hits another marker. This reduces accidental dismissals while preserving expected interactions when users intentionally interact with the map.

Accessibility
-------------
- The MapPreviewCard must be keyboard focusable. When opened, focus should move to the card. Provide a visible focus ring for the primary interactive area.
- Dismissal via keyboard is NOT supported; keyboard users should navigate away or open the details page to close the preview.
- Support Enter/Space to open the Artwork Details page. Provide aria-labels and alt text for thumbnails.
- Ensure the card respects reduced-motion preferences; animations (including the shake) must be disabled when prefers-reduced-motion is set.

Edge cases
----------
- No description: show "No description" or hide the description area gracefully.
- No thumbnail: show a placeholder thumbnail icon and ensure layout doesn't shift.
- Long title: clip to one line with ellipsis; provide full title in the details page.
- Multiple markers at same location: clicking any marker opens preview for that artwork; if cluster expands, preview should follow selected artwork.

User stories
------------
- As an explorer, I want to click map markers and quickly scan previews so I can find artworks of interest without leaving the map.
- As a mobile user, I want to tap previews to open details. Panning the map should dismiss the preview; swipe-to-dismiss is not required.
- As an accessibility user, I want to open and navigate the preview with keyboard and screen reader so I can discover artworks without visual pointing.

Acceptance criteria
-------------------
Functional:
- Clicking a marker opens MapPreviewCard and populates title, clipped description (max 2 lines), and thumbnail.
- Clicking the card navigates to the artwork details page with correct id.
- The card is dismissible via pan gestures on the map. Tapping outside the card alone does not dismiss it unless that tap causes a map movement or hits another marker. The map should NOT be auto-recentered when opening the preview — do not pan the map to keep the marker visible above the card.
- Only one card may be visible at once.
- Analytics events are emitted when preview is shown and when user navigates to details.

Performance:
- Opening the card should appear within 120ms of click on mid-tier device (mobile class); thumbnail images should use cached/low-res progressive images to avoid jank.
- Dismissal by pan must not block or cancel the user's pan gesture — the map should continue moving as the user's gesture intended.

Accessibility:
- Card receives focus when opened and is operable with keyboard for navigation; dismissal via keyboard is not supported. Primary action has descriptive aria labels.

QA / Test cases
---------------
Manual:
- Open map, click a marker — verify card opens with title, clipped description and thumbnail.
- Click the card — verify it navigates to details and the route receives the artwork id.
- Confirm pan the map dismisses the card and the map continues moving.
- Rapidly click multiple markers — verify last click's artwork shows after short debounce with no UI overlap.
- Keyboard: open a marker via keyboard, focus moves to card, Enter opens details (Escape does not dismiss).

Automated tests (suggested):
- Unit: render MapPreviewCard with / without thumbnail and with long title/description and assert clipping/truncation.
- Integration: map marker click produces MapPreviewCard and prefetch call to details endpoint.
- E2E (Playwright): simulate clicking multiple markers and asserting card updates; test navigation to details page; test pan-dismiss on mobile emulation.

Rollout & metrics
-----------------
- Release behind a feature flag so we can monitor adoption and errors.
- Key metrics: preview open rate (map clicks that open preview), preview-to-navigation conversion rate, time-to-open, JS errors, and perceived performance (TTI).

Implementation notes / suggestions
--------------------------------
- Implement as a reusable Vue 3 component (MapPreviewCard.vue) in `src/frontend/src/components/` using `<script setup lang="ts">` and Composition API.
- Use Pinia or local reactive state to store the current preview object and whether it's open; map click handler dispatches preview updates.
- Use CSS transitions for slide-up/slide-down and implement the moderate shake on pop (200–300ms) but respect reduced-motion.
- Prefetch by calling the router's prefetch or fetching minimal details via the API with low priority.
- Use the existing thumbnail generation pipeline (photo processing docs) to request appropriately sized thumbnails following the lightweight then progressive loading strategy.

Handoff checklist (developer / QA)

- [ ] Implement `MapPreviewCard.vue` under `src/frontend/src/components/` with the layout described and thumbnail on the right.
- [ ] MapView should dispatch preview object {id, title, description, thumbnailUrl, lat, lon} on marker click.
- [ ] Implement pan-to-dismiss handling (dismiss on any pan) without blocking the map's pan gesture.
- [ ] Implement keyboard focus move to the card on open; do NOT implement keyboard dismissal.
- [ ] Implement the pop + moderate shake animation (200–300ms) and honor prefers-reduced-motion.
- [ ] Implement lightweight thumbnail load (100–200px) with progressive higher-res load on details open.
- [ ] Add unit tests for rendering, truncation, and thumbnail fallback.
- [ ] Add integration tests for marker -> preview flow and prefetch behavior.
- [ ] Add Playwright E2E tests for pan-dismiss, click-to-navigate, and mobile emulation.
- [ ] Feature-flag the rollout and ensure telemetry events `map_preview_open` and `map_preview_navigate` are emitted.

Handoff notes:

- Priority: build core behavior first (map click -> preview -> navigation + pan-dismiss + basic styling), then iterate on tests and rollout.
- Accessibility: ensure focus management, ARIA labels, and that reduced-motion disables the shake.
- QA: test on mobile and desktop, with and without thumbnails, and with rapid marker clicks.

Security & privacy
------------------
- No new sensitive data is required. Prefetch calls should respect user's privacy settings and avoid overfetching large images for low-bandwidth users.

Completion checklist
--------------------
- [ ] Component implemented and styled for desktop + mobile
- [ ] Unit + integration + E2E tests added and passing
- [ ] Feature flag added and rollout plan executed
- [ ] Analytics events hooked up and dashboard updated

---
Last updated: 2025-09-25
