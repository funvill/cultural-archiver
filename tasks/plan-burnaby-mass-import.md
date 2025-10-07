# Plan: Burnaby Mass Import

## Goal

When adding a new data source we should:

- Create a data-collection script that scrapes the source and produces canonical OSM-format GeoJSON files (FeatureCollection) and an accompanying `artists.json` lookup file.
- Use the mass-import system to import artworks and artists, merging or creating records as necessary.
- Produce detailed per-record logs so future re-runs can be inspected and resumed.
- Deduplicate content conservatively (prefer creating duplicates over merging unrelated artworks).

## Contract

Inputs:

- `artworks.geojson` — GeoJSON FeatureCollection in OSM-like shape; properties should include `title`, `artist` (string), `start_date`, `material`, `tags`, `sourceUrl`, `photos`.
- `artists.json` — array of artist objects or a lookup keyed by normalized name or source URL.

Outputs:

- Imported artworks and artists in the local database.
- `reports/mass-import-YYYYMMDD-HHMMSS.json` containing summary and detailed per-record actions.
- `logs/mass-import-YYYYMMDD-HHMMSS.log` with per-record decisions for audit/retry.

Success criteria:

- All artworks with valid coordinates are imported (or intentionally skipped) and recorded in the report.
- Per-record actions are sufficiently descriptive to allow a human to decide how to re-run or undo.

## High-level workflow

1. Data collection scripts produce `artworks.geojson` and `artists.json` in `src/lib/data-collection/<site>/output/`.
2. Mass-import CLI is invoked with `--importer osm-artwork` and `--config <importer-config.json>` (optional) and `--input <artworks.geojson>`.
3. The mass-import pipeline loads importer config; if `artistLookupPath` is provided it loads that `artists.json` and prepares an artist lookup.
4. For each artwork feature:
   - Validate coordinates and required fields.
   - Normalize artist string(s) and attempt to resolve against artist lookup (exact normalized name match, then alias match).
   - Run artwork dedupe heuristic (spatial proximity + title similarity + artist match). If a confident match is found, attempt a merge update; otherwise treat as new artwork (but log potential matches as warnings).
   - For artist handling: if artist is found in lookup, attach artistId; if not found and `createMissingArtists` is enabled, create a new artist record (and record the creation in the report).
   - Record action (created/updated/merged/skipped/duplicate) in per-record log.
5. Export processed items via configured exporter (api/console/json).
6. Save a structured report and a verbose log file.

## Detailed decisions & heuristics

### Artist normalization

- Normalize names to `First Last` (reverse `Last, First`), remove excessive whitespace, and collapse multiple artist separators (`and`, `&`) into an array of names.
- Use a canonical lowercase key: strip punctuation and diacritics where possible and collapse whitespace for lookup.
- The artist lookup should support keys by normalized name and source URL (if the data-collection script provides a canonical artist URL).

### Artwork deduplication policy

- Conservative merging: only merge when confidence >= 0.85 (score from a combined heuristic). If confidence < 0.85, create a new artwork and record candidate matches in the log.
- Heuristic components:
  - Spatial: haversine distance <= 10 meters → +0.6 confidence; <= 50 m → +0.3; <= 100 m → +0.1.
  - Title similarity: normalized Levenshtein / token overlap → up to +0.3.
  - Artist match: exact normalized artist name match → +0.2 per matched artist.
  - External ID / permalink match → immediate exact match (confidence = 1.0).
- If artwork coordinates are missing: do not auto-merge; create artwork and mark `skippedCoordinateMerge=true` in log.
- If metadata already contains the string being merged (e.g., identical description text, or artist already present in the existing record), skip updating that field and mark `fieldAlreadyPresent` in the log.

### Artist merging policy

- If an existing artist is matched by normalized name or canonical `source_url`, merge new fields that are not present in the existing record.
- For conflicting fields (e.g., different birth date), add both values to `notes` and do not overwrite unless the incoming source is higher trust (configurable per source).
- Keep a history of artist record merges in the import report (old values, new values, merged_by).

## Logging / report schema

- Top-level report fields:
  - `metadata`: { startedAt, finishedAt, importer, sourceFile, totalFound, totalProcessed }
  - `summary`: { created: n, updated: n, merged: n, skipped: n, duplicates: n, errors: n }
  - `records`: [ { importId, sourceUrl, action, confidence, matchedId?, matchedReason, changes: { field: { old, new } }, notes: [] } ]

- Per-record `action` values: `created`, `updated`, `merged`, `skipped`, `duplicate`, `error`.
- `matchedReason` includes which heuristic matched and what score components contributed.
- Keep a flat, line-oriented `logs/mass-import-YYYYMMDD-HHMMSS.log` that mirrors the report records for quick grepping.

## Configuration & CLI

Importer config (`<importer>-config.json`) supports:

- `artistLookupPath` (optional): string path to `artists.json` for lookup/enrichment.
- `createMissingArtists` (boolean): whether to auto-create artists not found in lookup.
- `mergeConfidenceThreshold`: number (0-1), default `0.85`.
- `spatialThresholds`: { high: 10, medium: 50, low: 100 }.
- `dedupePreferences`: { preferCreateOnLowConfidence: true }.

Example `burnaby-osm-config.json`:

```json
{
  "preset": "general",
  "includeFeatureTypes": ["artwork", "monument", "sculpture"],
  "tagMappings": { "artwork_type": "artwork_type", "material": "material" },
  "descriptionFields": ["description", "inscription", "notes"],
  "artistFields": ["artist_name", "artist", "created_by"],
  "artistLookupPath": "src/lib/data-collection/burnabyartgallery/output/artists.json",
  "createMissingArtists": true,
  "mergeConfidenceThreshold": 0.85
}
```

## Files & placement

- `src/lib/data-collection/<site>/output/artworks.geojson` (OSM-style GeoJSON)
- `src/lib/data-collection/<site>/output/artists.json` (array or lookup object)
- `src/lib/mass-import-system/importers/` — keep the `osm-artwork` importer as the canonical importer for GeoJSON
- `tasks/plan-burnaby-mass-import.md` (this file)

## Documentation updates

- Update `src/lib/data-collection/readme.md` to require collectors to output OSM-style GeoJSON + optional `artists.json` and show the expected properties.
- Update `src/lib/mass-import-system/README.md` to document `--config` importer config keys (especially `artistLookupPath`, `createMissingArtists`, and `mergeConfidenceThreshold`) and show example config and CLI commands.

## Shared library refactor

Candidates to extract into `src/lib/shared` or `src/lib/common`:

- fetch/retry/rate-limit wrapper
- HTML parsing helpers (normalize whitespace, extract dt/dd pairs)
- name normalization utilities
- photo URL helpers (absolute conversion, query-strip)
- logging/report helpers and the report schema types

## Acceptance criteria

- A Burnaby collection script produces `artworks.geojson` + `artists.json` that can be ingested by the mass-import CLI with the config above.
- The mass-import pipeline produces a detailed report and log that shows per-record action and allows rerunning the import deterministically.
- Duplicate artworks are not silently merged; only high-confidence merges are performed.

## Next steps (short-term)

1. Update `src/lib/data-collection/readme.md` and `src/lib/mass-import-system/README.md` (docs task).
2. Optionally implement `artistLookupPath` support in `osm-artwork` importer if you want enrichment from `artists.json` (small code change in `osm-artwork.ts`).
3. Run a small trial import with `--limit=10` and inspect the generated report & logs.
4. Iterate heuristics based on trial results.

## Handoff: What to do next (for the person taking over)

Purpose: hand off the remaining import work and a reproducible path to complete the Burnaby import. This section contains exact steps, the current blocker, suggested workarounds, and a small checklist.

Current status (state captured on 2025-10-06):
- Collector outputs produced and available at:
  - `src/lib/data-collection/burnabyartgallery/output/artworks.geojson` (OSM-style GeoJSON)
  - `src/lib/data-collection/burnabyartgallery/output/artists.json` (artist lookup)
- I implemented importer support for `artistLookupPath` in `src/lib/mass-import-system/importers/osm-artwork.ts`. The importer now attempts to load the lookup from the configured path or several common fallback locations.
- A small trial import was executed in this workspace using `npx tsx` to run the CLI. The importer successfully loaded the artist lookup and transformed records. The run failed during export because the runtime environment could not load the native `better-sqlite3` module (NODE_MODULE_VERSION mismatch).

Blocker encountered
- Error observed when exporting to the built-in SQLite exporter (native module):

  Error: The module '\\?\C:\...\node_modules\better-sqlite3\build\Release\better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 115. This version of Node.js requires NODE_MODULE_VERSION 137. Please try re-compiling or re-installing the module (for instance, using `npm rebuild` or `npm install`).

Why this matters
- The native SQLite exporter depends on `better-sqlite3`. If its binary isn't built for the current Node.js, attempts to run the exporter will throw the above error and the import will abort. Rebuilding native modules requires either:
  - Rebuilding in-place (`npm rebuild better-sqlite3 --update-binary`) in the current environment, or
  - Running the import in an environment with a Node.js version that matches the existing compiled binary, or
  - Using a non-native exporter (see workarounds below) and importing results into the DB with a separate step.

Recommended options (pick one)

Short-term / Low-risk (recommended for quick progress):
- Use the `json` or `console` exporter to produce processed JSON output (no native modules needed). Example command to run the trial that was used here:

```powershell
npx tsx src/lib/mass-import-system/cli/cli-entry.ts import \
  --importer osm-artwork \
  --generate-report \
  --input src/lib/data-collection/burnabyartgallery/output/artworks.geojson \
  --output processed-art.json \
  --exporter json \
  --config tmp-burnaby-osm-config.json \
  --limit 10 --offset 0
```

- This will: validate input, map records, attempt to resolve artists via `artistLookupPath`, transform records, and write a `processed-art.json` and a report under `./reports/` without touching native DB modules. A separate step (or person) can then take `processed-art.json` and insert into the DB using a safe environment or via an API.

Full import to local DB (if you want to finish the DB import directly):
- Option A (rebuild native modules):
  1. From repo root run: `npm ci` (or `npm install`) to ensure dependencies are present.
  2. Rebuild the native module for the current Node: `npm rebuild better-sqlite3 --update-binary`.
  3. Re-run the CLI import without `--exporter json` and pick the intended exporter (the CLI will then be able to load `better-sqlite3`).

- Option B (use matching Node version):
  - Use nvm / nvm-windows or a Docker container that runs the Node version which the binary was built for. Then `npm ci` and re-run the import.

Notes and troubleshooting tips
- If you prefer not to rebuild locally, the `json` exporter + manual DB import is safest.
- If rebuild fails with permissions or build toolchain errors on Windows, use a Docker image matching the repo's expected Node version and run the import there.
- When re-running, pass `--generate-report` so you get the structured `reports/mass-import-YYYYMMDD-HHMMSS.json` file for audit and iteration.

Files changed / touched by previous work (important for the person picking this up)
- `src/lib/mass-import-system/importers/osm-artwork.ts` — added support for `artistLookupPath` and artist lookup loading logic.
- `src/lib/data-collection/readme.md` — added Output formats guidance.
- `src/lib/mass-import-system/README.md` — updated earlier to document formats and a recommended workflow.
- `tmp-burnaby-osm-config.json` — example importer config used for testing (created in repo root).

Acceptance criteria for handoff
- A follow-up run either:
  - Produces `processed-art.json` and a `reports/mass-import-*.json` file containing transformed records and per-record actions (short-term), or
  - Completes the import into the local database with no native module errors and the `reports/*.json` file shows created/updated counts (full completion).

Handoff checklist (concrete tasks for the next person)
1. Pull this branch (`image-thumbs`) and confirm the collector outputs exist at `src/lib/data-collection/burnabyartgallery/output/`.
2. If you want a quick trial, run the `npx tsx` command above with `--exporter json` and inspect `processed-art.json` and the report in `./reports/`.
3. Decide whether to import into DB directly. If yes, choose Option A or B from "Full import to local DB" and perform the rebuild or run in a matching Node environment.
4. If importing into DB, ensure you have a recent backup and understand that the environment is allowed to be re-seeded (per project notes). Use the `--dry-run` or exporter dry-run options if available.
5. If you change dedupe/merge heuristics, run with `--limit=10` and inspect the report to ensure behavior matches expectations before a full run.

Contacts & context
- This plan was prepared by automation and updated during local runs on 2025-10-06. See logs in the repository root (`dev-server-logs.txt`, `production-server-logs.txt`) for earlier debugging context.

If you'd like, I can now revert the temporary config, add a short README under `src/lib/mass-import-system/docs/` showing the exact commands and examples, or open a PR with the changes I already made. Tell me which handoff extras you want and I'll add them to the plan.

---

Created by automation; edit details as you like.
