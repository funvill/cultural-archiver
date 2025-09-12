
# PRD: Vancouver mass-import — link or create artist pages

## Purpose

This PRD covers two related behaviors:

- Global: Update the mass-import HTTP endpoint so that when an artwork is submitted (single or batch), the service checks for an existing artist by name; if found the artwork is linked to that artist, and if not found the artwork will be linked to a search page for that artist name (so users can continue discovery or manual resolution). This global behavior applies to all mass-imports.
- Vancouver special-case: For the Vancouver mass-import only, if the artist does not exist the importer should create the artist first (using data from `src\lib\mass-import\src\importers\public-art-artists.json`) and then create the artwork linked to the newly-created artist.

## High-level plan

- Update the mass-import HTTP endpoint behavior (single and batch submissions):
  - On each artwork submit, normalize the artist name and search for an existing artist.
  - If an existing artist is found, attach the artist id to the artwork before saving.
  - If no artist is found, attach a search page link for the normalized artist name to the artwork record (and surface that link in API response). Do not auto-create an artist for general imports.
- For the Vancouver mass-import runner: after normalization and failing to find an existing artist, create the artist first using the `src\lib\mass-import\src\importers\public-art-artists.json` dataset, then create the artwork linked to that new artist id.
- Ensure behavior is atomic per artwork (transaction): artist creation + artwork creation must succeed or roll back together for Vancouver flow.

## Checklist (requirements)

- [ ] Update mass-import HTTP endpoint to check for existing artist by name and link if present (applies to all imports).
- [ ] If artist not found for general imports, attach a search page link for that artist name instead of creating a new artist.
- [ ] Vancouver-specific: when artist not found, create an artist page using `src\lib\mass-import\src\importers\public-art-artists.json` then create artwork linked to the new artist.
- [ ] Populate created artist fields from the Vancouver JSON where present.
- [ ] Provide deterministic rules for matching (case, diacritics, whitespace, simple fuzzy fallback).
- [ ] Add unit + integration tests and a short QA plan.

## Success criteria

- All imported artworks are linked to an artist id (existing or newly created).
- No duplicate artist pages created for the same real-world person in >95% of imports (based on fuzzy-match threshold).
- Unit tests for the matching function and integration tests for import are present and passing.

## Contract (inputs/outputs)

- Input: artwork record submitted to the mass-import HTTP endpoint (single or batch). Minimal fields: title, artist_name, source_id, photos, location, notes, importer metadata.
- External input (Vancouver only): `src\lib\mass-import\src\importers\public-art-artists.json` (lookup dataset keyed by normalized artist name).
- Behavior / Output (per artwork):
  - If an existing artist is found: artwork saved with `artist_id` referencing existing artist. API response includes { success: true, artist_id }.
  - If no artist is found and importer is NOT Vancouver: artwork saved (or queued) with `artist_search_link` set to a search URL for the normalized artist name (for example `/search?artist=<urlencoded name>`). API response includes { success: true, artist_search_link }.
  - If importer is Vancouver and no artist is found: create artist using the Vancouver JSON, then save artwork with `artist_id` referencing the newly created artist. API response includes { success: true, artist_id }.
- Error modes: ambiguous matches (multiple close matches) should be flagged and optionally returned as { ambiguous: true, candidates: [...] }; malformed artist_name rows should be flagged; missing Vancouver JSON entry results in minimal artist creation (name + import_metadata) and a flag for enrichment.

Ensure API responses are consistent for batch submissions (per-row results included) and that operations are idempotent (use source_id or dedup keys).

## API: mass-import HTTP endpoint (behavior)

- Endpoint: POST /api/mass-import (or existing import endpoint)
- Request: accepts single artwork JSON or array of artworks. Each artwork may include an `importer` field (e.g., `vancouver-mass-import`) and a stable `source_id` to support idempotency.
- For each artwork in the request:
  1. normalize artist_name and attempt to find existing artist (exact → token → fuzzy as defined in Matching algorithm).
  2. If one existing artist is found (above threshold), set artwork.artist_id and save artwork.
  3. If multiple candidate artists exceed threshold, do not auto-assign; mark the row as ambiguous and return candidates for manual review.
  4. If no artist is found:
     - If importer === 'vancouver-mass-import': create artist from `src\lib\mass-import\src\importers\public-art-artists.json` (if present), then save artwork with new artist_id.
     - Otherwise: save or queue the artwork and set artwork.artist_search_link = `/search?artist=<urlencoded name>`; return that link in the API response for that artwork.

Responses must include per-row status to allow the caller to reconcile results and present the appropriate UI (link directly to the artist page when artist_id present, or to the search page when artist_search_link is present).

## Data shapes (suggested)

- Artwork import row (partial):
  - artist_name: string
  - title: string
  - source_id: string
  - photos: string[]

- Artist record (minimal fields created):
  - id: string (UUID or prefixed stable id)
  - name: string
  - biography?: string
  - birth_year?: number
  - death_year?: number
  - external_sources?: { source: string; id?: string }[]
  - source: string (e.g., "vancouver-mass-import" or tasks/public-artists.json)
  - created_at: ISO timestamp

## Matching algorithm (recommended)

1. Normalize input artist_name: trim, collapse internal whitespace, convert to lower-case, remove diacritics (NFKD), remove common punctuation.
2. Exact match pass: query artists where normalized_name == normalized_input.
3. Tokenized subset match: split into tokens, check for contained tokens (for small differences like middle initials).
4. Fallback fuzzy match: use a normalized Levenshtein or trigram similarity with a tuned threshold (example: similarity >= 0.85 for automatic link, 0.70-0.85 for human review). Prefer exact and token matches before fuzzy.
5. If multiple matches exceed threshold, treat as ambiguous and flag for manual review; do NOT auto-create a new artist.

## Rules for creation

- Creation only occurs when no existing artist passes the automatic-link thresholds and the import row contains a non-empty `artist_name`.
- Populate artist fields from `src\lib\mass-import\src\importers\public-art-artists.json` by keying on the normalized artist name. If the json has extra metadata (bio, birth/death), include it.
- Add an `import_metadata` block on the artist record: { importer: 'vancouver-mass-import', source_row_id, imported_at }.

## Edge cases

- Empty or numeric-only `artist_name`: skip linking and create a placeholder artist with `name: 'Unknown'` or attach `artist_id=null` and flag row.
- Multiple artists with same name: flag artwork for manual review. Do not auto-assign.
- Slightly different names (typos vs. different people): fuzzy threshold avoids most false merges; ambiguous scores route to human review.
- Missing JSON entry for a new artist: create artist with limited fields (name + import_metadata) and mark artist page as needing enrichment.

## Tests

- Unit tests for:
  - normalizeName(name) (cases, diacritics, punctuation)
  - matching function: exact, token, fuzzy scoring
  - creation path reading `src\lib\mass-import\src\importers\public-art-artists.json`
- Integration tests:
  - full import of a 10-row sample file with mixes of existing artists, new artists present in JSON, and ambiguous names. Use an in-memory/dev DB and assert final artist counts and links.

## QA plan

- Run `npm run test` (all unit tests) — must pass.
- Run integration import on dev using sample Vancouver dataset (10-50 rows). Inspect created artist pages and flagged ambiguous rows.
- Verify that newly-created artists include fields from `src\lib\mass-import\src\importers\public-art-artists.json`.

## Deployment and rollout

- Implement feature behind a feature-flag `massImportArtistLinking`.
- Gradual rollout: enable for dev → staging → production after validation. Monitor newly-created artist counts and ambiguous flags.

## Monitoring & metrics

- Metric: imported_artworks_total
- Metric: imported_artworks_linked_to_existing_artist
- Metric: imported_artworks_created_new_artist
- Metric: imported_artworks_flagged_ambiguous
- Alert if ambiguous ratio > 5% or newly-created-artist ratio spikes unexpectedly.

## Security & privacy

- Treat `src\lib\mass-import\src\importers\public-art-artists.json` as trusted dataset; avoid importing private PII from other sources. Store only public metadata.

## Operational notes

- Use the existing artist creation APIs/DB patterns. Maintain referential integrity between artwork and artist tables.
- Use transactions to ensure artwork and artist creation/linking are atomic per row.

## Acceptance checklist (before merge)

- [ ] Implementation behind feature-flag.
- [ ] Unit tests added and passing.
- [ ] Integration test for sample Vancouver import passing.
- [ ] Documentation updated: `docs/development.md` and `docs/database.md` if schema changes.
- [ ] Migration plan if artist table schema changes.

## Who to contact

- Owner: import feature engineer (assign in PR)
- Reviewers: backend lead, data steward for Vancouver dataset

## Notes / assumptions

- Assumed `src\lib\mass-import\src\importers\public-art-artists.json` contains canonical metadata keyed by artist name; if keys differ, a small adapter will be needed to map dataset keys to artist fields.
- Assumed project uses UUIDs for entity ids; if not, adapt id generation to the project's pattern.

## Next steps

1. Implement normalize + matching functions and unit tests.
2. Implement import flow changes behind the feature flag.
3. Run integration tests against dev DB and iterate thresholds.
4. Enable in staging and validate metrics before production rollout.
