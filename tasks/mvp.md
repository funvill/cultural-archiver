# MVP

## [x] Phase 0 - Set up project and resources

- Done. See tasks\done\prd-phase0.md, and tasks\done\tasks-phase0.md

## Phase 1 — Core MVP (submission + map + moderation)

### [x] Step 1 — Finalize DB for MVP

Done. See tasks\done\prd-mvp-database-migration.md and tasks\done\tasks-prd-mvp-database-migration.md

- Migrations: ensure the three tables match decisions
  - artwork (id, lat, lon, type, created_at, status, tags JSON)
  - logbook (id, artwork_id, user_token, note, photos JSON[], status, created_at)
  - tags (id, artwork_id, logbook_id, label, value, created_at) (keep even if you also use JSON, for future flexibility)
- Indexes: (lat,lon) for spatial queries; status on both artwork and logbook.
- Statuses: pending|approved|rejected (logbook), pending|approved|removed (artwork).

AC: Running migrations creates/updates schema; sample inserts/reads succeed.

### [x] Step 2 — Worker API endpoints (Cloudflare Workers)

Implement minimal, typed JSON APIs:

- POST /api/logbook — create submission
  - Body: { lat, lon, note?, type?, photos: up to 3 } (enforce ≤ 15 MB each; server will also keep originals and generate 800px copies)
  - Effects: store in R2 (originals/ + thumbs/), write EXIF comment with permalink, keep EXIF GPS; create logbook.pending
- GET /api/artworks/nearby?lat&lon&radius=500&limit=… — approved artworks only
- GET /api/artworks/:id — artwork + newest-first photos/logbook timeline
- GET /api/me/submissions — user’s pending+approved (use UUID cookie)
- POST /api/auth/magic-link → sends link to email; POST /api/auth/consume → binds email to token (passkeys deferred)
- Reviewer (invite-only):
  - POST /api/review/approve → attach/merge to artwork or create new artwork, flip statuses, prune if needed
  - POST /api/review/reject → delete submission + originals/derivatives

AC: All routes return typed responses; errors are consistent; rate limits applied.

### [x] Step 3 — Image handling

- Client: resize to 800px long edge before upload (serve this size); allow up to 3 photos.
- Server: keep originals in R2; convert to a “known good” format for thumbs/ (start with JPEG ~q0.82; detect transparency → PNG).
- EXIF: retain EXIF (including GPS); add permalink in EXIF comment on both versions.
- Validation: MIME sniffing, size checks, safe filenames/keys.

AC: Uploads succeed on mobile; R2 shows originals+thumbs; metadata stored.

### [x] Step 4 — Rate limiting & abuse protection

- KV counters: /nearby 60 req/hour per IP; /submit 10/day per token+IP.
- Age gate & consent (checkboxes): “I am 18+”, CC0 for metadata, public-commons consent, FoP tip.
- NSFW/illegal content: allow on scope but remove if unlawful to host; takedown removes entire record pending review.

AC: Limits enforced with friendly errors; consent must be checked to submit.

### [ ] Step 5 — Frontend screens (Vue + Tailwind + shadcn/ui)

- Mobile first. 90% of customers will use mobile only.
- App shell: Top app bar. The logo and the site title “Cultural Archiver” should be left aligned. Then a series of buttons that get collapsed to a overflow menu if the screen resolution is too small. Each button should have an icon. Buttons: + Add, Login/Logout, (i) About, (?) Help, Profile, etc...
- Page: Main
  - The screen contains a map. Map (Leaflet + OSM tiles): geolocate, load approved pins within ≤500m; pin tap → map card (title, type, hero photo, “More info” button).
- Page: Submit or + Add
  - The user is shown their location and a list of existing artworks around that location. The user can click one of these to add a log book entry to one of these artbooks or they can add a new artwork.
  - User can upload a 3 photos max
    - Check the photos for location information, update the list of existing artworks if the locaiton information is different.
  - optional note (≤1000 chars); optional type; shows location;
  - consent checkboxes;
  - Getting the user to select an existing art work or getting an accret location for new artwork is important.
- Page: Artwork Details:
  - gallery newest first, location, type, optional fields (title/artist/year/material) when present
  - link “Add a logbook entry” that preselects the artwork on the "Submit or + Add" page
- Page: Profile: list user’s pending + approved; no rejected visibility.
- Reviewer: simple queue → open → approve/reject (no field edits in MVP).

AC: Keyboard/contrast meets WCAG AA; mobile works; happy path takes < 60s.

### [ ] Step 6 — QA checklist (manual)

- Fresh user → submit single photo only (no note/type).
- Existing artwork → add logbook entry; verify merge flow vs new artwork creation.
- Profile shows pending immediately; not visible on public map until approval.
- Reviewer approves → appears on map & detail; rejects → disappears & prunes R2.
- Rate limits kicked in when exceeded; helpful messages.
- Slow network/mobile test (throttled).

AC: All pass on iOS Safari + Android Chrome + desktop Chrome/Firefox.

### [ ] Step 7 — Pilot in Vancouver

- Seed 5–10 test artworks.
- Invite 2–3 trusted reviewers.
- Dogfood with ~10 volunteers for a week; collect bugs/UX issues; hotfix.

## Phase 1.5 — Moderation quality (nice-to-have once Phase 1 is live)

- Duplicate flagging: pHash (WASM lib) + distance ≤100 m → “Possible duplicate” list for reviewers.
- Merge tool: pick canonical artwork; move submissions; unify tags.
- Basic search: type filter; simple text search (title/artist/tags).

## Phase 2 — Commons integration (minimum)

- Field alignment for OSM/Wikidata; admin scripts to export approved records to JSON/CSV (already allowed in MVP) and prep for:
  - OSM: create/augment tourism=artwork nodes with tags.
  - Wikidata: create items or link via wikidata=Q….
  - Wikimedia Commons: photo upload with chosen license (per file).
- Public dumps: enable NDJSON/CSV download (approved only) from R2.

## Phase 3 — Public map enrichment

- Clustering on zoomed-out views.
- Filters: type, “has photo”, year range.
- Timeline toggle: view photos by year.

## Phase 4 — Community & growth

- Nicknames (opt-in display) and simple contribution count.
- Reviewer invites UI.
- Help page with photo guidance & FoP details (you approved this content earlier).
- Light announcements & partnership outreach.

## What to do right now

- Create a phase-1-mvp branch; add API route stubs and TypeScript types.
- Build Submit + Map + Detail + Profile skeletons; wire to API.
- Implement image pipeline (client resize + server convert + EXIF comment).
- Add rate limiting + consent checkboxes + age gate.
- Ship Reviewer queue (approve/reject).
- Run the QA checklist and launch the Vancouver pilot.

Your Phase 0 PRD and task list already set the foundation for speed on these next steps; keep the same acceptance-criteria style for each MVP story.
