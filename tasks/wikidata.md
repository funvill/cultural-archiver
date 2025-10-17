# Wikidata QID enrichment for Cultural Archiver

Goal

- Add external identifiers (Wikidata QIDs — Q###) for artworks and artists in the database so users can quickly navigate to canonical, external information about the same entities.

Scope

- Primary targets: `artwork` (artwork table) rows and `artist` records where present.
- Workflows for both manual curation and automated/reconciled matching at scale.

Why this helps

- Centralizes links to external knowledge graphs (Wikidata) and improves discoverability for users and downstream integrations.
- Enables fetching structured claims (dates, materials, location history) from Wikidata and linking to other datasets.

Useful references

- Finding a Wikidata ID: https://en.wikipedia.org/wiki/Wikipedia:Finding_a_Wikidata_ID
- Mix'n'Match (database of databases & reconciliation help): https://mix-n-match.toolforge.org/#/
- Wikidata API / SPARQL endpoint: https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service
- Entities/Properties of interest: P1549 (name in native language), P170 (creator), P180 (depicts), P195 (collection), P748 (republication), P214 (VIAF), P650 (LCCN), and other identifier properties listed on Wikidata.

High-level approaches (summary)

1) Manual lookup / curator workflow
   - Use the Wikipedia "Finding a Wikidata ID" guide and Mix'n'Match to manually find and store QIDs.
   - Best for ambiguous or high-value records.

2) Reconciliation via Mix'n'Match
   - Mix'n'Match provides datasets of external authority IDs mapped to Wikidata QIDs. Upload or search a CSV with your external identifiers (e.g., local accession numbers, museum IDs) and get back QIDs where available.
   - Good when your dataset has a stable external identifier (museum accession number, catalogue raisonné id, etc.).

3) SPARQL-based matching (fuzzy/structured queries)
   - Query Wikidata directly using SPARQL for matches by label, creator, creation date, and collection.
   - Useful when you can craft a specific, low-noise query and handle cases where many items share the same label.

4) Wikidata API + fuzzy string matching
   - Use the Wikidata search API (action=wbsearchentities) and combine results with fuzzy matching on labels, dates, and creator relationships.
   - Works well for automated passes with scoring and human review for low-confidence matches.

5) Reconciliation services (OpenRefine + Wikidata reconciliation)
   - Use OpenRefine with the Wikidata reconciliation service to match rows interactively and apply transformations; export matches and confidence scores.
   - Helpful for curators who want an interactive dedupe/merge experience.

6) Bulk imports & imports via sameAs mappings
   - For very high-confidence matches (e.g., exact museum accession -> Wikidata mapping), perform direct updates in the DB.
   - Keep careful audit trail and backup; follow migration and docs guidelines.

Heuristics and fields to use for matching

- Artwork: title, alternate titles, creation date (year or range), creator name(s), collection/museum name, accession/catalogue number, medium, location (city), inscriptions.
- Artist: full name (with variants), birth/death years, nationality, VIAF / ISNI / other external IDs if present in your data.

Matching scoring example (combined heuristics)

- exact accession number match (if accession stored in Wikidata) → score 100
- exact unique identifier match (VIAF/ISNI) → score 100
- exact label/title + exact creator QID + date within ±1 year → score 90
- label normalized (lower/trim punctuation) + creator fuzzy match + date range overlap → score 70
- label only fuzzy match → score 40 (requires human review)

Practical steps and scripts

Contract
- Input: artwork rows (id, title, date, creator name, accession, collection, other ids)
- Output: two new optional fields in DB: `wikidata_qid` (TEXT) and `wikidata_match_confidence` (INTEGER or TEXT with values like high/medium/low) on both artwork and artist tables.
- Error modes: ambiguous matches, network/API rate limits, label collisions.

No DB schema changes — use existing tag system

Per your requirement, do not modify the database schema. Instead store Wikidata QIDs and match metadata inside the existing structured tag system (the `tags` field already used across artworks and submissions). This keeps the database unchanged and leverages the established tag validation and export logic.

Recommended tag keys and shapes

- `wikidata` — primary QID value (string), store as `Q12345` (preferred) or full URL `https://www.wikidata.org/wiki/Q12345` if you prefer URLs.
- `wikidata_confidence` — confidence label (`high`/`medium`/`low`) or numeric score.
- `wikidata_source` — source of the match (`mixnmatch`, `openrefine`, `api`, `manual`).
- `wikidata_verified_at` — ISO timestamp when a curator verified the match (optional).

Example structured `tags` JSON for an artwork (stored in the `tags` column):

{
   "title": "The Starry Night",
   "artist": "Vincent van Gogh",
   "wikidata": "Q5582",
   "wikidata_confidence": "high",
   "wikidata_source": "wbsearchentities+sparql"
}

Why this fits the current system

- The repository already stores `tags` as a JSON structured tags object and the validation system accepts unknown tags and preserves them (see `src/shared/tag-schema.ts` and tag validation tests). Adding `wikidata` keys will be compatible with existing exports (OSM export and tag validation) and searchable via tag parsing.
- Using tags avoids schema migrations and keeps audit trails within the existing metadata model.

How to implement updates safely (script outline)

- Read artwork rows in batches where `tags` does not contain a `wikidata` key (or where you want to refresh matches).
- For each artwork record:
   - Parse `tags` JSON (safe fallback to `{}` if null/invalid).
   - Run reconciliation (accession/VIAF first, else Wikidata search + SPARQL refinement).
   - If best candidate >= threshold_high, set `tags.wikidata = "Q..."`, `tags.wikidata_confidence = "high"`, `tags.wikidata_source = "api"`.
   - If medium/low, append to a CSV for review: include artwork id, current tags, candidate QIDs, scores.
   - Write back the updated tags JSON to the `tags` column with an `updated_at` timestamp as appropriate.

Sample TypeScript pseudocode (DB update pattern)

```ts
// existing DB connection code
const row = /* query artwork row */;
const tags = safeJsonParse(row.tags || '{}');
tags.wikidata = bestQid; // e.g. 'Q5582'
tags.wikidata_confidence = 'high';
tags.wikidata_source = 'wbsearchentities+sparql';
const updatedTagsJson = JSON.stringify(tags);
// UPDATE artwork SET tags = ? WHERE id = ?
```

Notes on key naming

- I recommend `wikidata` (short, explicit) and `wikidata_confidence` rather than namespaced keys unless you want grouping (e.g., `external.wikidata`). If you prefer namespacing, use a single flat key such as `external_wikidata` to avoid dots in keys which can complicate some consumers.

-- add columns for wikidata
# Wikidata QID enrichment for Cultural Archiver

Goal

- Add external identifiers (Wikidata QIDs — Q###) for artworks and artists in the database so users can quickly navigate to canonical, external information about the same entities.

Scope

- Primary targets: `artwork` (artwork table) rows and `artist` records where present.
- Workflows for both manual curation and automated/reconciled matching at scale.

Why this helps

- Centralizes links to external knowledge graphs (Wikidata) and improves discoverability for users and downstream integrations.
- Enables fetching structured claims (dates, materials, location history) from Wikidata and linking to other datasets.

Useful references

- Finding a Wikidata ID: [https://en.wikipedia.org/wiki/Wikipedia:Finding_a_Wikidata_ID](https://en.wikipedia.org/wiki/Wikipedia:Finding_a_Wikidata_ID)
- Mix'n'Match (database of databases & reconciliation help): [https://mix-n-match.toolforge.org/#/](https://mix-n-match.toolforge.org/#/)
- Wikidata API / SPARQL endpoint: [https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service)
- Entities/Properties of interest: P1549 (name in native language), P170 (creator), P180 (depicts), P195 (collection), P748 (republication), P214 (VIAF), P650 (LCCN), and other identifier properties listed on Wikidata.

High-level approaches (summary)

1) Manual lookup / curator workflow
   - Use the Wikipedia "Finding a Wikidata ID" guide and Mix'n'Match to manually find and store QIDs.
   - Best for ambiguous or high-value records.

2) Reconciliation via Mix'n'Match
   - Mix'n'Match provides datasets of external authority IDs mapped to Wikidata QIDs. Upload or search a CSV with your external identifiers (e.g., local accession numbers, museum IDs) and get back QIDs where available.
   - Good when your dataset has a stable external identifier (museum accession number, catalogue raisonné id, etc.).

3) SPARQL-based matching (fuzzy/structured queries)
   - Query Wikidata directly using SPARQL for matches by label, creator, creation date, and collection.
   - Useful when you can craft a specific, low-noise query and handle cases where many items share the same label.

4) Wikidata API + fuzzy string matching
   - Use the Wikidata search API (action=wbsearchentities) and combine results with fuzzy matching on labels, dates, and creator relationships.
   - Works well for automated passes with scoring and human review for low-confidence matches.

5) Reconciliation services (OpenRefine + Wikidata reconciliation)
   - Use OpenRefine with the Wikidata reconciliation service to match rows interactively and apply transformations; export matches and confidence scores.
   - Helpful for curators who want an interactive dedupe/merge experience.

6) Bulk imports & imports via sameAs mappings
   - For very high-confidence matches (e.g., exact museum accession -> Wikidata mapping), perform direct updates in the DB.
   - Keep careful audit trail and backup; follow migration and docs guidelines.

Heuristics and fields to use for matching

- Artwork: title, alternate titles, creation date (year or range), creator name(s), collection/museum name, accession/catalogue number, medium, location (city), inscriptions.
- Artist: full name (with variants), birth/death years, nationality, VIAF / ISNI / other external IDs if present in your data.

Matching scoring example (combined heuristics)

- exact accession number match (if accession stored in Wikidata) → score 100
- exact unique identifier match (VIAF/ISNI) → score 100
- exact label/title + exact creator QID + date within ±1 year → score 90
- label normalized (lower/trim punctuation) + creator fuzzy match + date range overlap → score 70
- label only fuzzy match → score 40 (requires human review)

Practical steps and scripts

Contract

- Input: artwork rows (id, title, date, creator name, accession, collection, other ids)

- Output: two new optional fields in DB: `wikidata_qid` (TEXT) and `wikidata_match_confidence` (INTEGER or TEXT with values like high/medium/low) on both artwork and artist tables.

- Error modes: ambiguous matches, network/API rate limits, label collisions.

DB changes (minimal)

- Add columns to `artwork` table:
  - `wikidata_qid TEXT NULL` — store QIDs like "Q42".
  - `wikidata_confidence TEXT NULL` — store "high"/"medium"/"low" or numeric score.

- Add columns to `artist` table (or equivalent store):
  - `wikidata_qid TEXT NULL`
  - `wikidata_confidence TEXT NULL`

Migration SQL example (SQLite/D1 compatible)

-- add columns for wikidata
BEGIN TRANSACTION;
ALTER TABLE artwork ADD COLUMN wikidata_qid TEXT;
ALTER TABLE artwork ADD COLUMN wikidata_confidence TEXT;
ALTER TABLE artist ADD COLUMN wikidata_qid TEXT;
ALTER TABLE artist ADD COLUMN wikidata_confidence TEXT;
COMMIT;

(If your schema doesn't have `artist` as a top-level table, adapt to the relevant table or JSON field.)

Automation script outline (TypeScript, small worker/CLI)

- Read rows in batches from the DB (e.g., where wikidata_qid IS NULL)
- For each row, build a candidate query set:
  - If accession or external id exists, try Mix'n'Match or SPARQL + property filters
  - Else, call Wikidata search API, then refine using SPARQL triple checks (e.g., ensure P170 matches creator or P361 collection)
- Score candidates and either write QID for high-confidence matches or emit to CSV for manual review for medium/low.
- Respect rate limits; cache queries locally.

Sample pseudocode (high-level)

- fetch batch rows
- for row in batch:
  - if accession -> try exact mapping via Mix'n'Match or SPARQL for property Pxxx
  - else call wbsearchentities with label and language
  - for each candidate Q:
    - run SPARQL to test if candidate has matching creator/collection/date
    - compute score
  - if best.score >= threshold_high -> update DB
  - elif best.score >= threshold_medium -> write to review CSV
  - else -> skip/mark as no-match

Wikidata API examples

- Search by label (wbsearchentities):

  GET [https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Vincent%20van%20Gogh&language=en&format=json](https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Vincent%20van%20Gogh&language=en&format=json)

- SPARQL example to find an artwork by title and creator
  SELECT ?item WHERE {
    ?item rdfs:label "The Starry Night"@en.
    ?item wdt:P170 ?creator.
    ?creator rdfs:label "Vincent van Gogh"@en.
  }

Mix'n'Match workflow

- Prepare a CSV with your external IDs and labels.
- Use Mix'n'Match to search and reconcile.
- Download matched QIDs and import.

OpenRefine workflow

- Load the dataset into OpenRefine.
- Use the Wikidata reconciliation service for interactive matching.
- Export reconciled QIDs and apply to DB.

Rate limiting and caching

- Cache API results (local file or small table) and avoid repeated queries.
- Observe the Wikidata API etiquette and back off on throttling.

Verification & QA

- Sample-based verification: randomly sample 1% (or min 200) of matched records across confidence bands and have a human verify.
- Create a "review" table or CSV for all medium/low confidence matches.
- Keep an audit log: (source_id, candidate_qid, score, timestamp, query parameters, user who verified)

Rollout plan

1) Add schema fields (migration)
2) Implement a small run-once script that attempts high-confidence matches (accession/viaf) and writes QIDs with confidence=high
3) Run OpenRefine or Mix'n'Match for medium confidence matches and curate
4) Integrate automated server-side reconciliation endpoint (optional) to suggest QIDs during curator edits
5) Monitor and maintain: re-run matches periodically; update when records change

Risks and mitigations

- False positives: mitigate via conservative thresholds and curator review for medium/low scores.
- Data drift: store the audit trail and timestamp; re-run reconciliation on changed records.
- API limits: cache, batch, and throttle.

Next steps (concrete)

- Add migration SQL to `src/workers/migrations/000X_add_wikidata_columns.sql` (pick next sequence number).
- Implement a TypeScript script `scripts/reconcile-wikidata.ts` to run batch queries and produce CSVs of suggestions.
- Use OpenRefine for a curator pass and bulk import matched QIDs via `scripts/import-wikidata-matches.ts`.

Small sample SPARQL queries and example scripts will be provided if you want to proceed with an implementation.

Quality gates

- Run the script against a small sample first; verify updates only for high-confidence matches.
- Write unit tests for matching scoring logic.

Status of tasks

- Research methods: completed
- Draft report: in-progress (this document fulfills the draft)
- Implementation steps: not-started (listed above)
- Testing plan: not-started (outlined above)

If you'd like, I can now:

- Add the migration SQL file mentioned and a minimal TypeScript reconciliation script.
- Create an OpenRefine recipe example and CSV exporter.

Tell me which of those next steps you'd like me to implement now.
