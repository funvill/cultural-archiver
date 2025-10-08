# Plan: Fix artworks with `Unknown Artist` by linking `artist_ids` (Milestone 2)

This document describes a safe, auditable plan to link artworks whose `tags` include a numeric `artist_ids` value (CSV like "90,144,145") to real `artists` UUIDs, and then add those links to the `artwork_artists` join table using simple, idempotent SQL statements (`INSERT OR IGNORE`).

Background
- Some artworks were imported with `artist = 'Unknown Artist'` but their `tags` JSON includes an `artist_ids` field containing numeric IDs. Those numeric IDs correspond to `artist_id` values recorded on artist records (either in `artists.artist_id` column or inside `artists.tags` as `"artist_id": 145`).
- We have a production DB backup at `_backup_database/database_production_2025-10-08-03-57-56.sql` — use a copy for discovery and staging testing.

Goals
- Produce a safe, auditable migration that inserts rows into `artwork_artists` linking artworks to artists based on `artist_ids`.
- Avoid complex SQL: use `INSERT OR IGNORE` statements or simple UPDATEs where necessary.
- Make the process reversible/traceable by creating an audit table to review choices before applying final inserts.

Assumptions
- `artwork` table name: `artwork` (contains `id`, `title`, `tags` JSON, etc.).
- `artists` table: `artists` with `id` (UUID primary key) and `name`. Some artists may also have a numeric `artist_id` column or a `tags` JSON containing `artist_id`.
- Linking table: `artwork_artists(artwork_id TEXT, artist_id TEXT, role TEXT, created_at)` with PRIMARY KEY (artwork_id, artist_id).
- `artist_ids` in artwork tags is a CSV string (may include spaces or be quoted). Examples: `"90,144,145"` or `"[90,144,145]"`.

High-level steps
1. Discovery (run on a copy of production DB)
   - Export artworks that include `artist_ids` for inspection.
   - SQL to run on `prod_copy.db`:

     SELECT id, title, json_extract(tags, '$.artist_ids') AS artist_ids_raw, tags
     FROM artwork
     WHERE json_extract(tags, '$.artist_ids') IS NOT NULL;

   - Save results to CSV for review and as input to the parser.

2. Add an audit table (migration)
   - Create a migration file (next sequential number) that adds `artist_id_link_updates`:

     CREATE TABLE IF NOT EXISTS artist_id_link_updates (
       artwork_id TEXT PRIMARY KEY,
       artist_ids_raw TEXT,
       chosen_artist_id INTEGER,
       chosen_artist_uuid TEXT,
       chosen_artist_name TEXT,
       old_artist_name TEXT,
       notes TEXT,
       created_at TEXT NOT NULL DEFAULT (datetime('now'))
     );

   - Purpose: record mapping decisions and allow review before adding links to `artwork_artists`.

3. Script to parse `artist_ids` and populate audit (Node)
   - Create `scripts/parse-artist-ids.js` that:
     - Connects to a copy of prod DB (e.g., `prod_copy.db`).
     - Runs the discovery query from step 1.
     - For each artwork row:
       - Normalize `artist_ids_raw` (strip brackets/quotes, split on `,`, trim whitespace).
       - For each numeric candidate (order: left-to-right or use last candidate fallback per prior notes):
         - Try SELECT id,name,status FROM artists WHERE artist_id = ? LIMIT 5;
         - If none, try SELECT id,name,status FROM artists WHERE json_extract(tags,'$.artist_id') = ? LIMIT 5;
         - If exactly one match => chosen_artist_uuid = id.
         - If multiple matches => prefer status='approved'; if still multiple, leave NULL and add `notes='ambiguous'`.
         - If none => chosen_artist_uuid remains NULL and note 'no-match'.
       - Insert or REPLACE a row in `artist_id_link_updates` with chosen data.

   - Use parameterized SQL and small batches to avoid lock contention.

4. Review & manual triage
   - Export `artist_id_link_updates` to CSV and review rows where `chosen_artist_uuid` is NULL or `notes` contains `ambiguous`.
   - For ambiguous cases, decide manual mapping or skip.
   - Verify a few samples by comparing to artist pages (e.g., numeric 145 -> the artist page you referenced).

5. Create final migration with `INSERT OR IGNORE` statements
   - Once audit rows are approved, create a migration file containing statements like:

     -- Insert links determined by audit table
     INSERT OR IGNORE INTO artwork_artists (artwork_id, artist_id, role, created_at)
     VALUES ('<artwork_uuid>', '<artist_uuid>', 'primary', datetime('now'));

   - Keep the SQL intentionally simple. One INSERT per audit mapping.
   - Example for the artwork you referenced (replace artist UUID with the matched UUID):

     INSERT OR IGNORE INTO artwork_artists (artwork_id, artist_id, role, created_at)
     VALUES ('712120c9-1d18-4f77-a072-d3f4984a281c','25e38c05-2eef-42fc-a080-37cfda7969c1','primary', datetime('now'));

   - Do NOT rely on complex joins in this migration; the audit table is the source of truth for which rows to insert.

6. Test on staging
   - Apply audit + insert migrations to a staging copy (prod_copy.db or a clone).
   - Verify joined rows:

     SELECT aa.artwork_id, aa.artist_id, a.name
     FROM artwork_artists aa
     JOIN artists a ON aa.artist_id = a.id
     WHERE aa.artwork_id = '<artwork_uuid>';

   - Run UI smoke checks and a few automated tests if necessary.

7. Deploy to production
   - Create a fresh prod backup before applying migration.
   - Run migrations with your usual non-interactive tooling (CI=true for Wrangler if used).
   - Post-deploy: verify counts, spot-check known artwork(s), and keep the audit table for records.

Deterministic choice rules (summary)
- Prefer exact match against `artists.artist_id` column first.
- Else prefer `json_extract(artists.tags, '$.artist_id')`.
- If single match -> choose.
- If multiple -> prefer `status='approved'`. If still multiple -> mark ambiguous for manual review.
- If none -> record as `no-match` and skip linking.

Quick verification queries
- Count artworks with `artist_ids`:
  SELECT count(*) FROM artwork WHERE json_extract(tags, '$.artist_ids') IS NOT NULL;
- Find a single artwork's mapped artist (after migration):
  SELECT aa.artwork_id, aa.artist_id, a.name FROM artwork_artists aa JOIN artists a ON aa.artist_id = a.id WHERE aa.artwork_id = '<artwork_uuid>';

Suggested filenames and migration hygiene
- Create migration `src/workers/migrations/00NN_add_artist_id_link_updates.sql` to create the audit table.
- After audit review, create `src/workers/migrations/00NN+1_insert_artwork_artist_links.sql` containing `INSERT OR IGNORE` statements.
- Keep audit table so changes are traceable; drop only if you decide it's unnecessary later.

Try-it commands (run on your local machine against a copy of production DB)
```bash
# make a copy of the prod backup sqlite file
cp _backup_database/database_production_2025-10-08-03-57-56.sql prod_copy.db

# run discovery and save samples
sqlite3 prod_copy.db "SELECT id, title, json_extract(tags, '$.artist_ids') AS artist_ids_raw FROM artwork WHERE json_extract(tags, '$.artist_ids') IS NOT NULL;" > artwork_artist_ids_samples.txt
```

Deliverables
- This plan file (`tasks/plan-fix-unknown-artist-milestone-2.md`).
- Recommended artifacts to create next: `src/workers/migrations/00NN_add_artist_id_link_updates.sql` and `scripts/parse-artist-ids.js` and then `00NN+1_insert_artwork_artist_links.sql`.

Notes
- The approach prioritizes safety and traceability. The audit table allows manual review before any data is inserted into `artwork_artists`.
- Avoid automatic changes for ambiguous or unmatched rows.
- Keep the `INSERT OR IGNORE` style so re-running the migration is safe.

If you want, I can now:
- generate the audit migration file template, or
- create the `scripts/parse-artist-ids.js` script and run discovery against a copied DB to produce the audit rows.
