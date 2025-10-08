# Quick trial: mass-importer (json exporter)

This short guide shows how to run a small trial import using the mass-import CLI and the JSON exporter. Using the JSON exporter avoids loading native DB modules (e.g., better-sqlite3) so it's ideal for quick validation of mappings, artist lookup resolution, and report generation.

When to use

- You want to validate importer mapping and artist resolution without altering any local DB.
- You want a reproducible `processed-art.json` to review and optionally apply later.

Example (PowerShell)

Run a 10-record trial from an OSM GeoJSON input using the `osm-artwork` importer and produce `processed-art.json` plus a JSON report in `./reports/`:

```powershell
npx tsx src/lib/mass-import-system/cli/cli-entry.ts import \
  --importer osm-artwork \
  --exporter json \
  --input src/lib/data-collection/burnabyartgallery/output/artworks.geojson \
  --config tmp-burnaby-osm-config.json \
  --output processed-art.json \
  --generate-report \
  --limit 10 --offset 0
```

Notes and tips

- `artistLookupPath` is supported in the importer config. If you include `artistLookupPath` in your config, the importer will attempt to load the lookup file and resolve artist names.
- If you run into a native module error (e.g., `better-sqlite3` binary mismatch), prefer the JSON exporter for trials. The pipeline will not attempt location enhancement unless explicitly enabled via `locationEnhancement.enabled = true` in the processing options (this was made opt-in to avoid accidental native module loads during trials).
- To perform a full import into the local DB (not recommended for an initial trial), either:
  - Rebuild the native modules locally: `npm rebuild better-sqlite3 --update-binary` (Windows build toolchain may be required), or
  - Use a Docker container with the Node version matching the compiled binary.

Next steps

- After reviewing `processed-art.json` and the generated report in `./reports/`, you can either:
  - Import the processed JSON into the DB using the DB exporter in a matching environment, or
  - Send the processed JSON to an API importer if you have a server endpoint that accepts bulk data.

Contact

If you want, I can add a short test to validate `artistLookupPath` loading or add a script that imports `processed-art.json` into the DB in a controlled way.
