# PRD: Fast Photo‑First "Add Artwork" Workflow

## 1. Overview

This feature replaces the current artwork submission flow with a **photo‑first, ultra-fast contribution workflow** optimized for casual, repeat, and drive‑by contributors. The user begins by uploading (or snapping) a photo; the system immediately attempts to derive location and surface potential existing artworks to prevent duplicates. The user either: (a) confirms a new artwork, or (b) attaches a logbook entry to an existing artwork. A single consent checkbox finalizes submission. Target friction: minimal; most valid submissions complete in under 20 seconds.

Primary goals:

- (B) Speed up contribution flow (time-to-submit) while also (A) reducing duplicate artworks.
- Build a similarity subsystem reusable for future mass-import deduplication.

## 2. Goals

\- G1: 80% of successful single-photo submissions complete in ≤ 20 seconds (from file selected to confirmation screen) on a normal broadband/mobile connection. \- G2: Reduce duplicate new artwork submissions by at least 30% versus baseline (measure: moderator-marked duplicates over total new submissions after release, 4-week comparison). \- G3: ≥ 90% of submissions include a valid GPS location (from EXIF, browser geolocation, or manual map pin) at initial submission. \- G4: Provide a reusable similarity scoring service (distance + fuzzy title + tag/type) with clear extensibility for mass import. \- G5: Zero increase in moderation time per submission (keep or reduce average review handling time).

## 3. User Stories

- US1: As an anonymous passerby, I want to snap a picture and submit it quickly so I can continue my activity without a long form.
- US2: As a contributor, I want the system to auto-detect location so I do not have to drag a map unless necessary.
- US3: As a contributor, I want to clearly see if what I photographed already exists to avoid creating a duplicate.
- US4: As a moderator, I want similarity signals (score + reasons) so I can judge potential duplicates quickly.
- US5: As a system integrator (mass import), I want the same similarity engine to flag probable duplicates at scale.
- US6: As legal/compliance, I need each submission to record which consent text version was accepted.

## 4. Functional Requirements (Numbered)

### Photo & EXIF

- FR1: The system shall allow uploading exactly 1 photo for initial submission (additional photos may be added later in other flows, out of scope here).
- FR2: The system shall accept “all and any” currently supported formats (reuse existing uploader acceptance list) without newly imposing limits beyond existing backend validation.
- FR3: The client shall parse EXIF immediately (orientation, GPS coordinates, timestamp, other fields) without waiting for server processing.
- FR4: The system shall NOT strip EXIF data; original binary including EXIF will be stored in R2 unchanged.
- FR5: The system may add additional metadata (e.g., internal IDs) without removing existing EXIF fields.

### Location Resolution

- FR6: Location priority order: (a) Photo EXIF, (b) Browser Geolocation, (c) Manual map select (assisted by IP-based approximate center), (d) IP fallback as soft guidance only.
- FR7: If no reliable location is obtained after EXIF + browser attempt (including timeout), user must pick a location on the map before proceeding (blocking requirement).
- FR8: Browser geolocation retry policy: up to 2 attempts total or 6s timeout (whichever first) before falling back to manual selection.
- FR9: Manual map selection precision: store latitude/longitude to 5 decimal places (≈1m).
- FR10: Default search radius for nearby artworks: 250m (configurable constant shared across frontend/backend). Backend may allow override by environment variable; frontend loads from shared constant.
- FR11: User may adjust radius via preset choices: 100m, 250m, 500m, 1000m (re-query triggers new result set).

### Nearby / Similar Artworks Listing

- FR12: The system shall display a list of candidate artworks after location is set (any source) before user chooses new vs. existing.
- FR13: Sorting order: composite relevance (distance ascending + similarity score). Distance remains primary for ties.
- FR14: Similarity scoring v1 components: distance normalization; title fuzzy match (if title provided); tag/type overlap (if any tag provided).
- FR15: Architecture: provide a pluggable similarity strategy interface enabling future signal additions (artist fuzzy, material, etc.).
- FR16: Similarity threshold behaviors: HIGH_THRESHOLD requires explicit confirmation; WARN_THRESHOLD adds “Possible duplicate” badge + highlight top 3.
- FR17: If no nearby artworks found within chosen radius, automatically transition UI state to “Creating new artwork” with message + option to widen radius.
- FR18: Failure of similarity service must degrade gracefully to distance-only (log warning, do not block flow).

### New Artwork Creation

- FR19: Required fields for new artwork: Title (mandatory); Description optional; all tags optional.
- FR20: Optional tag selection allowed (full tagging UI) but not required.
- FR21: No forced artist or advanced taxonomy fields in this flow.
- FR22: New artwork created with status = pending review.

### Existing Artwork Logbook Entry

- FR23: Selecting existing artwork requires only photo (already uploaded) + optional Note.
- FR24: Logbook entry status = pending review.

### Consent & Versioning

- FR25: Single consent checkbox (covers license + rights + display + data usage) with internal VERSION_ID constant.
- FR26: Submission payload stores consent text version ID.

### Submission & UI Flow

- FR27: Single scrolling page with progressive reveal sections; prior sections collapse to summary chips.
- FR28: Fast path: EXIF GPS + existing artwork + (optional) note → only consent checkbox required beyond selection.
- FR29: Success screen presents confirmation + View + Add Another options (view allowed even if pending).
- FR30: Duplicate submission prevention via button disable + spinner.

### Error & Edge Handling

- FR31: Upload network failure: auto retry once then show inline error + Retry button.
- FR32: Geolocation denial: show map picker + message + Retry location link.
- FR33: Multi-photo GPS conflict handling deferred (documented future dependency).
- FR34: Similarity service error: degrade to distance-only and log event.
- FR35: Missing required fields triggers single modal summary listing unmet requirements.

### Data & Storage

- FR36: Original image with full EXIF stored in R2; existing 800px thumbnail reused; no new sizes in v1.
- FR37: No EXIF stripping or additional privacy redaction in v1.
- FR38: Latitude/longitude stored per schema; manual pins normalized to 5 decimals.
- FR39: Consent version stored with submission records.

### Instrumentation & Logging

- FR40: Minimal instrumentation only (standard backend request/error logs).
- FR41: Note: success metrics may need later instrumentation (see Open Questions).

### Reuse & Components

- FR42: Reuse existing photo uploader, map component, consent UI, shared types.
- FR43: Similarity scoring library placed in shared/backend for reuse by mass import.
- FR44: Default radius constant defined in shared module; server may override via `ARTWORK_SEARCH_RADIUS_DEFAULT` env.

### Moderation Flags

- FR45: No automatic moderation flags added for IP/manual location in v1.

### Rate Limiting

- FR46: Use existing global submission rate limits only.

### Security & Integrity

- FR47: No additional EXIF sanitization; trust model unchanged v1.
- FR48: Idempotency token not implemented; rely on UI disable.
- FR49: All inputs pass existing backend validation & review pipeline.

## 5. Non-Goals (Out of Scope)

- Bulk/multi-photo initial uploads.
- Editing existing artwork metadata in this flow.
- Adding multiple logbook entries in a single submission.
- Advanced tagging taxonomy or recommendation engine.
- Artist name normalization or fuzzy artist matching (future similarity extension).
- Internationalization (i18n) of user-facing strings.
- Additional thumbnail sizes or WebP variants.
- Real-time analytics dashboards.
- Enhanced privacy features (EXIF stripping, coordinate obfuscation prior to approval).

## 6. Design Considerations

- Mobile-first layout; primary controls above the fold after upload.
- Progressive reveal reduces cognitive load; earlier sections collapse to summary chips (e.g., “Location: Lat 49.28, -123.12 (EXIF)”).
- Similarity list: show top 5 by relevance; badge duplicates with score tooltip (e.g., “Similarity 0.82 (Title + Distance)”).
- Confirmation guard only appears if creating new artwork with HIGH_THRESHOLD similar candidate present.
- Map interaction defaults to center from best known source (EXIF > Browser > IP centroid fallback).

## 7. Technical Considerations

- Cloudflare Worker backend: add endpoint for similarity scoring & nearby query (may extend existing discovery endpoint with optional title + tags param for enriched scoring).
- Spatial filtering uses existing ±0.0045 deg window; scoring runs on filtered subset.
- Similarity weights (initial suggestion): distance_weight 0.5, title_weight 0.35, tag_weight 0.15 (tunable constants).
- Title fuzzy: implement Jaro-Winkler (fast, small code); fallback to simple normalized Levenshtein if needed.
- Provide interface: `interface SimilaritySignal { type: 'distance'|'title'|'tags'; raw: number; weighted: number; }` plus aggregate.
- Return similarity metadata to frontend for debugging (dev mode) and possibly suppressed in production, configurable.
- Consent version constant: export from `src/shared/consent.ts` e.g., `export const CONSENT_VERSION = '2025-09-08.v1';`.
- Backend must persist consent version with submission (new column or JSON metadata field on artwork/logbook record). Migration likely required (not in this PRD’s scope but referenced).

## 8. Success Metrics

Primary (needs instrumentation plan—see Open Questions):

- Duplicate rate reduction ≥30%.
- Median submission time ≤20s (from initial file select to backend accept).

Secondary:

- ≥90% geo success on first submission path.
- Moderator duplicate rejections trend downward after launch.

## 9. Open Questions

1. Instrumentation Gap: Without per-step event logging we cannot reliably measure submission time or drop-off—should minimal event timing be reinstated? (Recommended.)
2. Consent Version Persistence: Confirm schema change location (artwork table vs. separate consent log). Migration ticket needed.
3. Fuzzy Title Normalization: Should we canonicalize (remove punctuation, stop words) for better matching? Baseline assumption: yes (simple normalization pipeline).
4. Similarity Threshold Values: Need empirical calibration after test dataset pass (proposed defaults: WARN_THRESHOLD=0.65, HIGH_THRESHOLD=0.80).
5. Future i18n: Should strings be wrapped now to avoid refactor later? Currently out of scope.

## 10. Risks & Mitigations

- Risk: Lack of analytics → Hard to prove success. Mitigation: add lightweight event timings later behind flag.
- Risk: False positive similarity blocking creation. Mitigation: Two-level threshold and explicit confirmation override.
- Risk: EXIF spoofing. Mitigation: Moderation review + potential future heuristic (e.g., cross-check with IP region).
- Risk: Performance drag if similarity grows heavy. Mitigation: Strict spatial pre-filter + cap N (e.g., 50) candidates.

## 11. Acceptance Criteria (Condensed)

- AC1: Single-photo upload triggers immediate EXIF parse and shows location or fallback map within 6s worst case when browser geolocation used.
- AC2: If EXIF present and existing nearby artwork selected, user can submit with only consent checkbox after no more than 2 additional interactions.
- AC3: Creating new artwork with high similarity candidate requires explicit confirmation checkbox.
- AC4: Consent version stored with each submission and retrievable via moderation tooling (or API inspect endpoint).
- AC5: Similarity API returns structured breakdown of signals (distance/title/tags) in dev mode.
- AC6: Manual map pin required if all automated methods fail; cannot submit without location.
- AC7: System gracefully degrades (distance-only) if similarity scoring throws error; submission still possible.

## 12. Future Extensions (Not Required Now)

- Multi-photo capture & coordinate conflict resolution modal.
- Artist fuzzy match + canonical artist registry integration.
- Automatic tag inference (material/type) from ML or heuristics.
- Draft saving (localStorage) for partial submissions (explicitly excluded now).
- i18n layer & consent text localization.
- Enhanced privacy mode (blur coordinates until approved).

---

Prepared for implementation. Await resolution of Open Questions (esp. instrumentation & threshold calibration) before final development kickoff.
