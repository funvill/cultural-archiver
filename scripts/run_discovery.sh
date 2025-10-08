#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/run_discovery.sh /path/to/dump.sql /path/to/output_dir
dump=${1:-_backup_database/database_production_2025-10-07_0439.sql}
outdir=${2:-reports/discovery}

mkdir -p "$outdir"
localdb="$outdir/prod_copy.db"

if [ -f "$localdb" ]; then
  echo "Removing existing $localdb"
  rm -f "$localdb"
fi

echo "Creating local DB from dump: $dump -> $localdb"
sqlite3 "$localdb" ".read '$dump'"


echo "Listing tables"
sqlite3 "$localdb" ".tables" > "$outdir/tables.txt"

echo "Detecting artwork table name (artwork or artworks)"
TABLE=$(sqlite3 "$localdb" "SELECT name FROM sqlite_schema WHERE type='table' AND lower(name) IN ('artwork','artworks') LIMIT 1;" | tr -d '\r' || true)
if [ -z "$TABLE" ]; then
  echo "No artwork/artworks table found. Check $outdir/tables.txt"
  TABLE=artwork
else
  echo "Using table: $TABLE"
fi

echo "Saving artwork schema (if exists)"
sqlite3 "$localdb" "SELECT sql FROM sqlite_schema WHERE type='table' AND lower(name)=lower('$TABLE') LIMIT 1;" > "$outdir/artwork_create.sql" || true

echo "Counting artworks with non-empty tags"
sqlite3 "$localdb" "SELECT count(*) FROM $TABLE WHERE tags IS NOT NULL AND trim(tags) != '';" > "$outdir/artworks_with_tags_count.txt" || true

echo "Sample artworks where artist = 'Unknown Artist'"
sqlite3 -header -column "$localdb" "SELECT id, artist, substr(tags,1,300) AS tags_preview FROM $TABLE WHERE artist = 'Unknown Artist' LIMIT 100;" > "$outdir/unknown_artist_samples.txt" || true

echo "Discovery: artist_name extraction preview (first 500)"
sqlite3 -header -column "$localdb" "SELECT a.id, a.artist AS old_artist, json_extract(a.tags, '$$.artist_name') AS root_artist_name, (SELECT json_extract(je.value, '$$.value') FROM json_each(a.tags) je WHERE json_extract(je.value, '$$.key') = 'artist_name' OR json_extract(je.value, '$$.name') = 'artist_name' LIMIT 1) AS array_obj_artist_name, (SELECT je.value FROM json_each(a.tags) je WHERE je.value LIKE '%\"artist_name\"%' LIMIT 1) AS fallback_value FROM $TABLE a WHERE a.artist = 'Unknown Artist' LIMIT 500;" > "$outdir/artist_name_discovery.csv" || true

echo "Discovery: artwork rows with artist_ids in tags"
sqlite3 -header -column "$localdb" "SELECT id, json_extract(tags, '$$.artist_ids') AS artist_ids_raw FROM $TABLE WHERE json_extract(tags, '$$.artist_ids') IS NOT NULL LIMIT 200;" > "$outdir/artist_ids_samples.csv" || true

echo "Discovery finished. Output in $outdir"
