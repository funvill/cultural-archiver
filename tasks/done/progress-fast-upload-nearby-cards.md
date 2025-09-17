---
name: Fix fast-upload nearby cards (thumbnail + title)
started: 2025-09-16
owner: Copilot
source: .github/prompts/WithMem.prompt.md
---

# Progress: Fast-Upload Nearby Cards Bugfix

Purpose: Track work to fix two issues on the fast-upload search results (nearby artworks cards):
- Incorrect thumbnail shows the user's uploaded preview on artworks with zero photos
- Title always displays "Untitled" even when a name/title is available in tags

## Major Tasks

- [X] Reproduce and locate bug
  - [X] Inspect fast-upload flow in `FastPhotoUploadView.vue`
  - [X] Trace redirect to `/search?mode=photo&source=fast-upload&lat=...&lng=...`
  - [X] Review `SearchView.vue` fast-upload branch rendering of nearby artworks
  - [X] Identify helpers controlling title and thumbnail
  - Summary: Found logic in `SearchView.vue`:
    - `getArtworkImage()` incorrectly fell back to the uploaded preview when `recent_photo` was missing, causing misleading thumbnails on nearby cards with zero photos.
    - `getArtworkTitle()` only looked for `tags.title` and otherwise returned "Untitled", ignoring `tags.name` and sensible fallback to humanized `type_name`.

- [X] Fix incorrect thumbnail logic
  - [X] Update `getArtworkImage()` to only return `artwork.recent_photo` when present; never use uploaded preview for artwork cards.
  - [X] Remove unused `firstUploadedPreview` computed.
  - Summary: Cards now show actual artwork photo or the designed "No photo" placeholder. Prevents the uploaded image from appearing on unrelated artworks.

- [X] Fix title extraction logic
  - [X] Update `getArtworkTitle()` to prefer `tags.title` then `tags.name`; fallback to humanized `type_name`.
  - Summary: Titles render correctly when provided in tags and otherwise show a readable type (e.g., "Street Art"), not always "Untitled".

- [X] Validate with tests and build
  - [X] `npm run test` → 42 files, 648 tests passed, 1 skipped (no regressions)
  - [X] `npm run build` → build succeeds with 0 errors
  - Summary: Changes compile cleanly and pass test suite.

- [ ] Handoff + verification in UI
  - [ ] Manual QA: Go through fast upload → ensure nearby card thumbnails never show the uploaded preview, and titles use `tags.title`/`tags.name`.
  - [ ] Confirm Artwork Detail page for the sample artwork still loads its actual image (if present) and correct title.
  - Summary: Pending manual QA in browser.

## Files Changed

- `src/frontend/src/views/SearchView.vue`
  - Adjusted `getArtworkTitle()` logic to use `tags.title` -> `tags.name` -> formatted `type_name`.
  - Simplified `getArtworkImage()` to never fall back to the uploaded preview.
  - Removed unused `firstUploadedPreview` computed.

## Notes / Context

- The misleading thumbnail came from a UX-oriented fallback that made sense for an empty list but conflicted with nearby artwork semantics.
- The title issue was due to incomplete tag parsing. We already parse JSON for `tags` in store; here we only pick keys.
- No backend changes required.

## Next Steps

- [ ] Ship to staging and verify visually with the same repro steps.
- [ ] If we want a friendlier empty state, consider showing a dedicated "No photo" placeholder image or badge (already present in template).
- [ ] Optional: Apply the same title helper to any other nearby/compact card views to keep consistency.

## Acceptance Criteria Checklist

- [X] Nearby artwork cards never display the just-uploaded photo as their thumbnail.
- [X] Titles prefer tags.title, then tags.name; otherwise show humanized type_name.
- [X] `npm run test` passes with 0 failures.
- [X] `npm run build` completes with 0 errors.
- [ ] Manual verification completed in UI.

---

2025-09-16 Update: Title propagation to Nearby cards

- Change Summary:
  - Added explicit title field to frontend `SearchResult` type.
  - Mapped `title` from API responses in the Pinia search store for both text and nearby searches. Preference order: API `artwork.title` → `tags.title` → `tags.name` → null.
  - Updated `SearchView.vue` helper to prefer `artwork.title` when available.
  - Updated reusable `ArtworkCard.vue` to also prefer `artwork.title`.
  - Ensured `ArtworkIndexView.vue` threads `title` into `SearchResult` mapping.

- Validation:
  - Type check: PASS (`npm run type-check`).
  - Tests: PASS (`npm run test` → 42 files, 648 tests passed, 1 skipped).
  - Build: PASS (`npm run build`).

- Notes:
  - Nearby cards in fast-upload flow should now display the actual artwork title when available, no longer showing generic type like "mural" unless no title/name exists in data.
  - Next, do a quick manual QA in the browser to verify real-world API data returns `title` for nearby results as expected.

---

2025-09-16 Update: Artist subtitle on cards

- Change Summary:
  - Added `artist_name` to frontend `SearchResult` type and threaded it through the Pinia search store mapping for both text and nearby searches.
  - UI updates:
    - `SearchView.vue` fast-upload Nearby cards now show `artist_name` as a subtitle when present.
    - `ArtworkCard.vue` renders `artist_name` under the title and avoids duplicating artist info from tags when `artist_name` exists.
    - `ArtworkIndexView.vue` mapping updated to provide `artist_name` consistently to the card.
  - Preserved prior fixes: thumbnail logic (no fallback to uploaded preview) and title preference (`artwork.title` → `tags.title` → `tags.name` → humanized `type_name`).

- Validation:
  - Type check: PASS (`npm run type-check`).
  - Tests: PASS (`npm run test` → 42 files, 648 tests passed, 1 skipped).
  - Build: PASS (`npm run build`).

- Notes:
  - This ensures Nearby and general card views have a consistent, richer display: correct title plus artist subtitle when known.
  - Follow-up: brief manual QA in the browser to visually confirm the fast-upload Nearby section shows expected artist names and that zero-photo artworks still show the placeholder (not the uploaded preview).
