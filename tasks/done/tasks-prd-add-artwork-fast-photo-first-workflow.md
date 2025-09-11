# Tasks: Fast Photo-First Add Artwork Workflow

## Relevant Files

- `src/frontend/src/components/PhotoUpload.vue` (or new) - Photo uploader integration / EXIF parse UI.
- `src/frontend/src/components/AddArtworkFastForm.vue` - New progressive single-page submission component (to be created).
- `src/frontend/src/components/NearbyArtworkList.vue` - List + similarity badges (new or adapt existing discovery list component).
- `src/frontend/src/components/ConsentCheckbox.vue` - Reusable consent with version constant (new if not existing).
- `src/frontend/src/services/api/artwork.ts` - Extend for new submission endpoints / similarity query.
- `src/frontend/src/stores/artworkSubmission.ts` - New Pinia store managing transient submission state.
- `src/shared/geo.ts` - Add default radius constant & helper normalization (new if not present).
- `src/shared/similarity.ts` - Shared similarity type definitions / signal interface.
- `src/shared/consent.ts` - Export consent version constant.
- `src/workers/routes/discovery.ts` - Extend to accept title/tags for enhanced similarity or create dedicated route.
- `src/workers/routes/submissions.ts` - Endpoint for new fast artwork submission (create/update as needed).
- `src/workers/lib/similarity/index.ts` - Similarity scoring implementation (new).
- `src/workers/lib/exif.ts` - (If exists) otherwise add EXIF validation helpers.
- `src/workers/migrations/` - New migration adding consent_version column (artwork + logbook entries) if not present.
- `src/workers/test/` - New tests for similarity, submission flow, consent version persistence.
- `src/frontend/tests/` - Component and integration tests for fast flow.
- `docs/frontend-architecture.md` - Update with new submission flow description.
- `docs/api.md` - Document new/extended endpoints (similarity, submission payload changes).

### Notes

- Follow existing naming conventions and TypeScript strictness.
- Place unit tests alongside implementation where current repo pattern does so, else in existing test directories.
- Keep similarity engine deterministic for testability (inject weights / thresholds).

## Tasks (Phase 1: Parent Tasks Only)

- [ ] 1.0 Design & Constants Setup
  - Define shared radius constant, consent version constant, similarity weight & threshold constants (WARN/HIGH) in shared modules.

- [ ] 2.0 Database & Migration
  - Add `consent_version` field(s) to artwork and logbook submission storage (migration + type updates).

- [ ] 3.0 Backend Similarity Service
  - Implement pluggable similarity scoring (distance, title fuzzy, tag overlap) with structured signal output + graceful degradation.

- [ ] 4.0 Backend Submission Endpoint Enhancements
  - Add/extend endpoint to accept fast-flow payload (new artwork vs. logbook), enforce pending status, store consent version.

- [ ] 5.0 Location Resolution Pipeline (Frontend)
  - Implement client EXIF parse, geolocation fallback, IP-assisted map centering, manual pin enforcement when needed.

- [ ] 6.0 Frontend Progressive Submission UI
  - Build single-page component with collapsible sections (Upload, Location & Nearby, Select/Create, Details, Consent, Submit).

- [ ] 7.0 Nearby & Similarity UI Integration
  - Fetch nearby artworks + similarity metadata; show badges, confirmation guard for high similarity.

- [ ] 8.0 New Artwork Creation Flow
  - Implement minimal required fields (Title only required) + optional tags; submit path.

- [ ] 9.0 Existing Artwork Logbook Flow
  - Implement selection → note (optional) → submit path.

- [ ] 10.0 Consent Version Tracking
  - Persist version in submissions; surface in moderation tooling or API fetch (read path).

- [ ] 11.0 Error & Edge Case Handling
  - Upload retry, geolocation denial, similarity failure fallback, validation summary modal.

- [ ] 12.0 Testing & Quality
  - Unit tests (similarity signals, location fallback logic) + integration tests (submission endpoints) + component tests (fast path, duplicate guard).

- [ ] 13.0 Documentation Updates
  - Update API docs, frontend architecture doc, add similarity spec notes.

- [ ] 14.0 Threshold Calibration & Configuration
  - Provide initial default thresholds & TODO note for empirical calibration (dev flag/log output).

- [ ] 15.0 QA & Launch Checklist
  - Verify acceptance criteria, run migration, manual smoke tests for fast path & no-location fallback.

## Next Step

Await confirmation to expand each parent task into detailed sub-tasks (Phase 2) per `generate-tasks.md` guidelines.
