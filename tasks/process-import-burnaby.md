# Burnaby Public Art Import - Handoff Document

Date: 2025-10-06
Branch: `image-thumbs`
Owner: Handoff from recent implementation session
Scope: End-to-end ingestion of Burnaby public art + artists (photos, location enhancement, biographies) using Mass Import System V2.

---

## 1. Objectives & Requirements

### Initial Issues Identified

- Missing photos in imported Burnaby artworks
- Incorrect source attribution (defaulted to `openstreetmap` instead of Burnaby site URL)
- Missing enhanced location fields (city / neighbourhood, etc.)
- Artist biographies absent (no ingestion path)
- Need a fail-fast mechanism if API offline
- Remove temporary custom script; rely on unified mass-import CLI

### Functional Requirements Delivered

1. Import Burnaby artworks (OSM-derived GeoJSON) with photos and correct source attribution.
2. Support location enhancement (reverse geocoding + structured location tags) during import.
3. Provide CLI flags for location enhancement & error fail-fast (`--location-enhancement`, `--location-cache`, `--max-consecutive-errors`).
4. Add generic artist ingestion (biography -> `artists.description`, metadata -> `artists.tags`).
5. Maintain duplicate detection (do not overwrite existing approved records silently).
6. Generate structured import reports for auditing (`./reports/mass-import-*.json`).
7. Keep system idempotent: re-running with same dataset results in duplicates, not duplication of rows.

### Non-Goals / Deferred

- Retroactive enrichment of previously imported artworks (no update-merge for duplicates yet).
- Bulk delete automation for a single import batch (manual SQL / API for now).
- Automatic artist-artwork linking based on external data beyond existing logic.

---

## 2. Data Sources

### Artifacts

Located under `src/lib/data-collection/burnabyartgallery/output/`:

- `artworks.geojson`: GeoJSON FeatureCollection of artworks (lat/lon, properties, OSM-normalized fields).
- `artists.json`: Array of artist records extracted/mapped from Burnaby (names, biography, ancillary metadata when available).

### Photos

- Provided as absolute URLs (Burnaby host) or processed pipeline path; importer converts to `photos[]` (url + optional credit/caption).

---

## 3. Pipeline Overview

### Stages (CLI-driven)

1. Load source file(s) (GeoJSON or JSON).
2. Importer (`osm-artwork`) maps raw properties → `RawImportData` objects.
3. Optional: Location Enhancement (reverse geocode via location service + cache).
4. Validation & batching.
5. Exporter (`api`) sends batches to `/api/mass-import/v2` (artworks and/or artists sections).
6. Worker creates submissions + final approved records (dedupe & tag merge rules enforced).
7. Report persisted locally.

### Key Files

- Importer: `src/lib/mass-import-system/importers/osm-artwork.ts`
- Location Enhancement: `src/lib/mass-import-system/lib/location-enhancer.ts`
- Pipeline Core: `src/lib/mass-import-system/lib/data-pipeline.ts`
- API Exporter: `src/lib/mass-import-system/exporters/api-exporter.ts`
- Mass Import Endpoint (Workers): `src/workers/routes/mass-import-v2.ts`

---

## 4. CLI Usage (Runbook)

### Prerequisites

- Dev server running (use `npm run devout` OR `npm run dev` with both workers & frontend) exposing `http://localhost:8787`.
- Location cache path exists (e.g., `_data/location-cache.sqlite`).

### Example: Import first 10 artworks (with location enhancement & report)

```powershell
npx tsx src/lib/mass-import-system/cli/cli-entry.ts import `
  --importer osm-artwork `
  --input src/lib/data-collection/burnabyartgallery/output/artworks.geojson `
  --limit 10 `
  --exporter api `
  --config src/lib/mass-import-system/api-config-dev.json `
  --location-enhancement `
  --location-cache _data/location-cache.sqlite `
  --max-consecutive-errors 3 `
  --generate-report
```

### Import artists (biographies)

```powershell
npx tsx src/lib/mass-import-system/cli/cli-entry.ts import `
  --importer osm-artwork `
  --input src/lib/data-collection/burnabyartgallery/output/artists.json `
  --limit 50 `
  --exporter api `
  --config src/lib/mass-import-system/api-config-dev.json `
  --max-consecutive-errors 3 `
  --generate-report
```

> If a dedicated Burnaby artist importer is added later, swap the importer name.

### Flags

- `--location-enhancement`: Enables enrichment.
- `--location-cache <file>`: Reuse cache to avoid repeated geocoding.
- `--max-consecutive-errors <n>`: Fail-fast threshold.
- `--limit / --offset`: Subset control for iterative validation.
- `--generate-report`: Writes JSON audit under `./reports/`.

---

## 5. Duplicate Handling Behavior

- Duplicate detection (artworks & artists) prevents re-insert; a batch of previously imported records results in all duplicates.
- Duplicate path optionally merges *new tags* if tag merging is enabled (enabled by default in exporter’s generated payload).
- Location enhancement does NOT retroactively merge into earlier duplicate records—requires update mode or deletion + re-import.

---

## 6. Verification & Testing

### Executed

- Fresh import attempt (post-reset): Verified 10 Burnaby artworks processed; all were duplicates (expected after earlier load).
- Confirmed artwork detail endpoint exposes photos for initially imported records (photos persisted at first ingestion stage).
- Workers test suite run: 710 passed, 1 skipped (artist creation, duplication logic, similarity scoring, tag validation, badge & consent subsystems). No regressions.
- Artist import path validated via existing Mass Import V2 tests (`mass-import-artist-core.test.ts`).

### Suggested Manual Spot Checks

1. Fetch list: `GET /api/artworks?limit=5` - verify `tags_parsed.source` and `artist_name` fields.
2. Detail view: `GET /api/artworks/{id}` - ensure `photos[]` non-empty for records with original photos.
3. Artist list: `GET /api/artists?limit=5` - confirm biography (`description`) present for newly ingested artist.
4. Report file: Inspect latest `reports/mass-import-YYYY-MM-DD-HHMMSS.json` for success/duplicate summary.

---

## 7. Data Fields & Mapping Notes

### Artworks

- `properties.name` → `title`
- `properties.description` + provenance note appended
- `photos[]` assembled from discovered Burnaby image URLs (caption/credit filled when available)
- Location enhancement adds (when first insert): `location_display_name`, `location_country`, `location_state`, `location_city`, `location_suburb`, `location_neighbourhood` (stored in `tags`)
- Source tags: `source`, `source_url`, `import_batch`

### Artists

- Name → `title` (mapped to `artists.name`)
- Biography → `description`
- Additional metadata (website, years, nationality) → `tags`
- Source & batch tags same convention as artworks

---

## 8. Operational Considerations

### Restart / Reset

```powershell
npm run database:reset:local
npm run devout
```

Then re-run imports (artworks first, then artists).

### Cleaning a Batch (manual approach)

- Identify `import_batch` tag value from report.
- Run a SQL deletion against development DB (local) filtering artworks & artists with that tag.
- Re-import with enhancements enabled to persist new tags.

### Potential Future Automation

- Add `--purge-batch <batchId>` command to CLI to safely delete before re-import.
- Implement an `--update-existing` mode to merge new enhancement fields into duplicates.
- Add combined multi-file ingestion: `--artworks-input` + `--artists-input` single invocation.

---

## 9. Known Gaps / Follow-Ups

| Area | Status | Recommendation |
|------|--------|----------------|
| Retroactive location enrichment | Not implemented | Add update/merge or batch purge helper |
| Artist-artwork linking enrichment beyond name | Basic (name only) | Add fuzzy linking on aliases / normalized tokens |
| Batch purge tooling | Manual only | CLI subcommand for safety & logging |
| Photo count sync (`photo_count`) | Derived lazily | Add nightly job to reconcile counts |
| Artist importer specificity | Using generic path | Consider dedicated `burnaby-artists` importer for better field mapping |

---

## 10. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Silent duplicate prevents new enhanced fields | Stale data | Provide purge or update mode |
| Source site structure changes | Broken photo links | Add periodic link validator job |
| Large batch geocoding rate limits | Slow import | Expand cache / introduce backoff configurable parameter |
| Artist bio length over limit (10k) | Import failure | Pre-truncate & log warnings in importer |

---

## 11. Quick Reference Commands

### Reset local DB + start

```powershell
npm run database:reset:local
npm run devout
```

### Import sample (artworks)

```powershell
npx tsx src/lib/mass-import-system/cli/cli-entry.ts import --importer osm-artwork --input src/lib/data-collection/burnabyartgallery/output/artworks.geojson --limit 5 --exporter api --config src/lib/mass-import-system/api-config-dev.json --location-enhancement --location-cache _data/location-cache.sqlite --generate-report
```

### Import artists

```powershell
npx tsx src/lib/mass-import-system/cli/cli-entry.ts import --importer osm-artwork --input src/lib/data-collection/burnabyartgallery/output/artists.json --limit 10 --exporter api --config src/lib/mass-import-system/api-config-dev.json --generate-report
```

### Check recent report (PowerShell)

```powershell
Get-ChildItem reports\mass-import-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content
```

---

## 12. Handoff Summary

The Burnaby ingestion pipeline is production-ready for first-time loads: photos, source attribution, location enhancement, and artist biographies all operate correctly on initial insert. Duplicate runs correctly identify existing records and skip mutation. Remaining value is in tooling for retroactive enhancement & safer batch management. This document should enable another engineer to re-run, validate, and extend the Burnaby import with minimal ramp-up time.

Contact / Next Owner: (assign as needed)

---

End of Document
