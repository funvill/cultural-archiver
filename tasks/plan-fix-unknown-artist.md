## Plan: Fix artworks with "Unknown Artist" by using `artist_name` in tags

 
### Goal
Populate the `artworks.artist` field for records where it is currently "Unknown Artist" using the `artist_name` value embedded in the `tags` JSON column.

 
### Overview
 
- Work entirely on a local/staging copy of the production dump first. Do not run any destructive updates directly on production.
- Create an audit table capturing artwork id, old_artist, extracted artist_name, and timestamp.
- Populate the audit table only for rows where an `artist_name` can be reliably extracted.
- Run a single transactional update that sets `artworks.artist` from the audit table.
- Keep the audit table after the update and export it to CSV for review; this allows easy rollback using the stored `old_artist` values.

 
### Assumptions
 
- The production dump is available at `_backup_database\database_production_2025-10-07_0439.sql` (already present in repo backups).
- `artworks` table has at least these columns: `id` (TEXT/UUID), `artist` (TEXT), `tags` (TEXT containing JSON).
- `tags` JSON appears in a few common shapes: a root object with `artist_name`, or an array of objects with `key`/`value` or `name`/`value` fields, or an array of strings containing `artist_name` references.
- Using SQLite (Cloudflare D1 compatible) JSON functions like `json_extract` and `json_each` is acceptable.

 
### Plan steps (high level)
 
1) Create a local test database from the production SQL dump.
2) Run discovery queries to count candidate rows and sample extractions.
3) Create the audit table and insert one row per artwork with the extracted artist_name.
4) Verify extracted values (counts and spot-check sample rows).
5) Run the transactional update in staging/local DB.
6) Export the audit table for human review and sign-off.
7) Option A (migration): Commit a migration SQL file into `src/workers/migrations/` and apply using the migration tooling.
   Option B (replace DB): Generate a new production DB file from the dump + migration and swap the DB used in production.
8) Monitor and rollback if needed.

 
### Discovery SQL (preview extraction)
Use this query to preview how artist_name is found in `tags` for artworks where `artist = 'Unknown Artist'`.

```sql
SELECT a.id,
       a.artist AS old_artist,
       json_extract(a.tags, '$.artist_name') AS root_artist_name,
       (SELECT json_extract(je.value, '$.value')
        FROM json_each(a.tags) je
        WHERE json_extract(je.value, '$.key') = 'artist_name'
           OR json_extract(je.value, '$.name') = 'artist_name'
        LIMIT 1) AS array_obj_artist_name,
       (SELECT je.value FROM json_each(a.tags) je WHERE je.value LIKE '%"artist_name"%' LIMIT 1) AS fallback_value
FROM artworks a
WHERE a.artist = 'Unknown Artist'
LIMIT 500;
```

 
### Audit + Update SQL (transactional)
Run this on your local/staging DB once you've validated the extraction logic. It creates an `artist_name_updates` audit table, inserts extracted values, and updates `artworks.artist` atomically.

```sql
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS artist_name_updates (
  artwork_id TEXT PRIMARY KEY,
  old_artist TEXT,
  extracted_artist TEXT,
  applied_at TEXT DEFAULT (datetime('now'))
);

INSERT OR REPLACE INTO artist_name_updates (artwork_id, old_artist, extracted_artist, applied_at)
SELECT a.id,
       a.artist,
       TRIM(COALESCE(
         json_extract(a.tags, '$.artist_name'),
         (SELECT json_extract(je.value, '$.value')
          FROM json_each(a.tags) je
          WHERE json_extract(je.value, '$.key') = 'artist_name'
             OR json_extract(je.value, '$.name') = 'artist_name'
          LIMIT 1),
         (SELECT je.value FROM json_each(a.tags) je WHERE je.value LIKE '%"artist_name"%' LIMIT 1)
       )) AS extracted_artist,
       datetime('now')
FROM artworks a
WHERE a.artist = 'Unknown Artist'
  AND TRIM(COALESCE(
         json_extract(a.tags, '$.artist_name'),
         (SELECT json_extract(je.value, '$.value')
          FROM json_each(a.tags) je
          WHERE json_extract(je.value, '$.key') = 'artist_name'
             OR json_extract(je.value, '$.name') = 'artist_name'
          LIMIT 1),
         (SELECT je.value FROM json_each(a.tags) je WHERE je.value LIKE '%"artist_name"%' LIMIT 1)
      )) IS NOT NULL;

-- Apply updates using audit table
UPDATE artworks
SET artist = (
  SELECT extracted_artist FROM artist_name_updates u WHERE u.artwork_id = artworks.id
)
WHERE id IN (SELECT artwork_id FROM artist_name_updates);

COMMIT;
```

 
### Rollback SQL (if needed)
If you need to revert the change, use the audit table to restore `old_artist` values:

```sql
BEGIN TRANSACTION;
UPDATE artworks
SET artist = (SELECT old_artist FROM artist_name_updates u WHERE u.artwork_id = artworks.id)
WHERE id IN (SELECT artwork_id FROM artist_name_updates);
COMMIT;
```

 
### PowerShell local test/run steps (Windows)
 
- Ensure `sqlite3` is installed and on PATH. If not, download a Windows build and add it to PATH.
- Work on a copy of the production dump. The repo already contains `_backup_database\database_production_2025-10-07_0439.sql`.

```powershell
# Paths (adjust if you keep dumps elsewhere)
$dump = Join-Path $PSScriptRoot "_backup_database\database_production_2025-10-07_0439.sql"
$localDb = Join-Path $PSScriptRoot "prod_copy.db"

# Recreate local DB from dump
if (Test-Path $localDb) { Remove-Item $localDb }
sqlite3 $localDb ".read '$dump'"

# Run discovery (save sample to file)
sqlite3 $localDb -header -column "SELECT id, artist, json_extract(tags, '$$.artist_name') FROM artworks WHERE artist = 'Unknown Artist' LIMIT 50;" | Out-File discovery-sample.txt

# Run the migration SQL (you can save the SQL above as scripts/sql/update_artist_from_tags.sql)
sqlite3 $localDb ".read 'scripts/sql/update_artist_from_tags.sql'"

# Quick checks
sqlite3 $localDb "SELECT count(*) FROM artist_name_updates;"
sqlite3 $localDb "SELECT artwork_id, old_artist, extracted_artist FROM artist_name_updates LIMIT 20;"

# Export audit table for reviewer
sqlite3 $localDb -csv "SELECT * FROM artist_name_updates;" > artist_name_updates.csv
```

 
### Validation checklist
--------------------
 
- Number of rows in `artist_name_updates` matches expected candidate count.
- Randomly spot-check 20 artworks from the audit table: confirm the front-end and database now show the extracted artist correctly.
- Confirm no rows were updated where `extracted_artist` is empty or only whitespace.
- Run `npm run build:frontend` / smoke test if you have a staging environment to ensure no rendering regressions.

 
### Deployment options
------------------
 
- Migration file: Create a migration in `src/workers/migrations/000X_update_artist_from_tags.sql` (choose next sequence number) and apply using your migration commands (`npm run database:migration:prod` or the project's normal process). This makes the change auditable and reversible via the rollback SQL.
- Database replacement: If you prefer replacing the production DB entirely, apply the script to the dumped SQL locally, build a new DB file, verify, then swap. This is riskier but acceptable in pre-release environments.

 
### Follow-ups / improvements
-------------------------
- Extend extraction to handle more tag shapes if you discover new patterns during discovery. Add extra parsing rules to the INSERT SELECT logic.
- Add a lightweight script in `scripts/` to run discovery, run the update, and export the audit CSV. This can help reviewers run the process locally without manual sqlite3 calls.
- Add a small unit test in the workers test suite to validate extraction logic on example `tags` JSON shapes.

Requirements coverage
---------------------
- Backup and local testing: Done (instructions provided).  
- Discovery + sample: Done (discovery SQL included).  
- Atomic update + audit: Done (transactional SQL included).  
- Rollback: Done (rollback SQL included).  
- Deployment guidance: Done (migration vs replace options).  

Contact
-------
If you'd like, I can create the migration SQL file in `src/workers/migrations/` with the next sequential number and a small Node/TS script to run the discovery + update steps. Tell me whether you prefer a migration file or DB replacement and I will proceed.

### Milestone 2 — link by `artist_ids` and update artwork artist

 
#### Problem
Some artworks have `artist = 'Unknown Artist'` but include a `tags` entry `artist_ids` containing a comma-separated list of numeric artist ids (for example: `"90,144,145"`). Those numeric ids correspond to `artist_id` values stored on artist records (for example an artist page may have a tag `"artist_id":145` or a dedicated column `artist_id`). We need to:

- Parse `artist_ids` from artwork tags.
- Find the primary/most relevant artist record for the artwork using the numeric ids (prefer the last id in the list if that matches your front-end convention; otherwise prefer the highest confidence match).
- Link the artwork to the artist (insert into join table if your schema uses a separate artwork_artists table) and set `artworks.artist` to the artist's canonical name.

 
#### Discovery SQL
Preview rows that have `artist_ids` in tags and show the parsed id list and candidate artist records.

```sql
SELECT a.id AS artwork_id,
          a.artist,
          json_extract(a.tags, '$.artist_ids') AS artist_ids_raw,
          -- split CSV: pick first/last candidate (SQLite doesn't have split, but we can find patterns)
          -- try last id using reverse-like logic (simple helper expression)
          TRIM(substr(json_extract(a.tags, '$.artist_ids'), instr(json_extract(a.tags, '$.artist_ids'), ',') + 1)) AS last_candidate -- fallback simple pick
FROM artworks a
WHERE a.artist = 'Unknown Artist'
   AND json_extract(a.tags, '$.artist_ids') IS NOT NULL
LIMIT 200;
```

Note: the above is a lightweight preview. In practice we'll use `json_each` on a replaced string or a small script to robustly split on commas and trim values.

 
#### Linking + Update approach
 
1) Create an audit table `artist_id_link_updates` capturing artwork_id, artist_ids_raw, chosen_artist_id, chosen_artist_uuid, chosen_artist_name, old_artist.
2) For each artwork with `artist_ids`:
    - split the CSV into numeric ids (90,144,145)
    - for each numeric id, search the `artists` table for a tag or column matching that numeric id. Two common storage places:
       - `artists.tags` JSON containing `"artist_id": 145`
       - `artists.artist_id` numeric/text column (if present)
    - choose which artist to link:
       - If exactly one match across the list, choose that.
       - If multiple matches, prefer the last id in the list (or highest match confidence). Document the rule and spot-check.
3) Insert a row into the join table if your schema uses `artwork_artists(artwork_id, artist_uuid)` or similar. If no join table exists, consider creating one to represent many-to-many relationships.
4) Update `artworks.artist` with the `artists.name` (canonical) for the chosen artist.

 
#### Transactional SQL sketch (pseudo-SQL; adapt to exact schema)
This example assumes:
 
- `artists` table has `id` (UUID primary key), `name` (TEXT), and either `artist_id` column (INTEGER) or `tags` JSON with `artist_id`.
- There is a join table `artwork_artists(artwork_id TEXT, artist_id TEXT)`; if not present, the script will create one.

```sql
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS artist_id_link_updates (
   artwork_id TEXT PRIMARY KEY,
   artist_ids_raw TEXT,
   chosen_artist_id INTEGER,
   chosen_artist_uuid TEXT,
   chosen_artist_name TEXT,
   old_artist TEXT,
   applied_at TEXT DEFAULT (datetime('now'))
);

-- This requires a small helper: we can expand rows by splitting CSV using a simple JS/TS helper or using recursive CTE.
-- For clarity, run a small script that:
--  1) reads artworks with artist_ids
--  2) splits artist_ids into numeric ids
--  3) queries artists table for matches
--  4) inserts into artist_id_link_updates the chosen match

-- Apply updates based on audit table
-- create join table if needed
CREATE TABLE IF NOT EXISTS artwork_artists (
   artwork_id TEXT,
   artist_uuid TEXT,
   PRIMARY KEY (artwork_id, artist_uuid)
);

-- Insert join rows and update artworks
INSERT OR REPLACE INTO artwork_artists (artwork_id, artist_uuid)
SELECT artwork_id, chosen_artist_uuid FROM artist_id_link_updates u WHERE u.chosen_artist_uuid IS NOT NULL;

UPDATE artworks
SET artist = (
   SELECT chosen_artist_name FROM artist_id_link_updates u WHERE u.artwork_id = artworks.id
)
WHERE id IN (SELECT artwork_id FROM artist_id_link_updates);

COMMIT;
```

 
#### PowerShell helper recommendation
Because splitting CSV and matching numeric IDs against artist tags is easier in a scripting language, I recommend a small PowerShell or Node script that:

1) Reads the local DB.
2) For each artwork where `json_extract(tags,'$.artist_ids') IS NOT NULL`:
    - Parse the CSV into integers.
    - For each id, try to find an artist record where `artist_id` column = id, or where `json_extract(artists.tags, '$.artist_id') = id`.
    - Choose the match using your chosen rule (exact single match, else last id match).
    - Insert into `artist_id_link_updates` and optionally into `artwork_artists`.
3) After the script populates the audit table, run the SQL to apply updates and exports for review.

Example PowerShell pseudo-steps

```powershell
$localDb = "prod_copy.db"
# Query artworks with artist_ids
$artworks = sqlite3 $localDb "SELECT id, json_extract(tags, '$.artist_ids') FROM artworks WHERE json_extract(tags, '$.artist_ids') IS NOT NULL;"
foreach ($row in $artworks) {
   # parse CSV, lookup artists in artists table, decide chosen artist
   # insert row into artist_id_link_updates using sqlite3 parameterized INSERT
}
# When audit table is ready, apply updates using the SQL shown earlier
```

 
#### Validation and rollback
 
- Export `artist_id_link_updates` to CSV and review chosen matches before applying them in production.
- Rollback is identical to the first migration: use the `old_artist` column in the audit table to restore artists.

 
#### Notes and edge cases
 
- Some artwork `artist_ids` may reference artists that no longer exist — insert a warning into the audit table and skip.
- Where multiple artist ids match multiple artist records, pick a deterministic rule and document it (e.g., prefer last id, or prefer artist with `is_primary = 1` if that flag exists).
- Consider creating or reusing a join table `artwork_artists` to model many-to-many relationships rather than stuffing a single `artworks.artist` field.

## Local discovery commands (PowerShell)

If you want to run discovery on a local copy of the production dump, these PowerShell steps are copy-paste ready. They assume you're in the repository root and the dump path is `_backup_database\database_production_2025-10-07_0439.sql`.

1) (Optional) Install sqlite3 locally (simple, no admin):

```powershell
# create local tools folder
$dest = "$PWD\tools\sqlite"
New-Item -ItemType Directory -Path $dest -Force

# Download a precompiled sqlite3 zip (adjust URL/version if required)
$zipUrl = "https://www.sqlite.org/2025/sqlite-tools-win32-x86-3420000.zip"
$zipFile = "$env:TEMP\sqlite-tools.zip"
Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile
Expand-Archive -Path $zipFile -DestinationPath $dest -Force

# Add to PATH for current session
$env:Path = "$dest;$env:Path"
sqlite3 --version
```

2) Create a local DB from the dump and save schema listing:

```powershell
$dump = "$PWD\_backup_database\database_production_2025-10-07_0439.sql"
$db = "$PWD\prod_copy.db"
if (Test-Path $db) { Remove-Item $db }
sqlite3 $db ".read '$dump'"
sqlite3 $db ".tables" > tables.txt
Get-Content tables.txt | Select-Object -First 200
```

3) Discovery queries (save outputs):

```powershell
# artwork CREATE statement (if exists)
sqlite3 $db "SELECT sql FROM sqlite_schema WHERE type='table' AND lower(name)='artwork' LIMIT 1;" > artwork_create.sql

# artwork columns
sqlite3 $db "PRAGMA table_info('artwork');" > artwork_columns.txt

# artworks with non-empty tags
sqlite3 $db "SELECT count(*) FROM artwork WHERE tags IS NOT NULL AND trim(tags) != '';" > artwork_with_tags_count.txt

# artworks whose tags text contains 'artist' (quick text search)
sqlite3 $db "SELECT count(*) FROM artwork WHERE tags LIKE '%artist%';" > artwork_tags_containing_artist_count.txt

# sample rows (id, first 200 chars of tags) where tags mention artist
sqlite3 $db "SELECT id, substr(tags,1,200) FROM artwork WHERE tags LIKE '%artist%' LIMIT 50;" > artwork_artist_samples.txt

# count artworks with JSON key artist_ids
sqlite3 $db "SELECT count(*) FROM artwork WHERE json_extract(tags, '$.artist_ids') IS NOT NULL;" > artwork_has_artist_ids_count.txt
sqlite3 $db "SELECT id, json_extract(tags, '$.artist_ids') FROM artwork WHERE json_extract(tags, '$.artist_ids') IS NOT NULL LIMIT 50;" > artwork_artist_ids_samples.txt
```

Notes:
- The official sqlite3 builds include the JSON1 extension required for `json_extract` and `json_each`. If `json_extract` errors, your sqlite build may not include JSON1.
- If the `artwork` table is missing, check `tables.txt` and the migration SQL files in `src/workers/migrations` to determine where artwork rows live in this dump.

## Example quick checks to run after discovery

- Open `artwork_columns.txt` to confirm the presence of `tags` and `artist` columns.
- Inspect `artwork_artist_samples.txt` to verify how `artist_name` and `artist_ids` are represented in the `tags` JSON (this is critical to tune the extraction SQL).

## Next steps (after you run discovery)

1. Paste or attach up to ~200 lines from `artwork_artist_samples.txt` and `artwork_artist_ids_samples.txt` here; I will use them to craft exact extraction SQL and a small Node script to populate `artist_id_link_updates`.
2. I will create `scripts/parse-artist-ids.js` (Node) that reads `prod_copy.db`, splits CSV `artist_ids`, looks up matching `artists` by numeric id in `artists.tags` or `artist_id` column, and populates `artist_id_link_updates` with deterministic choice rules.
3. After audit review, we'll run the transactional SQL to insert into `artwork_artists` (if desired) and update `artworks.artist`, then export audit CSV.

If you'd like, I can create the Node script now and add unit tests; tell me and I'll mark that todo `in-progress` and create the files.

