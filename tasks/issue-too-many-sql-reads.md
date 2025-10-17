
Issue: excessive D1 row reads (28M/mo) — goal <= 5M/mo

This document summarizes what I found, where the heaviest queries run from in the codebase, options to reduce row reads, and a practical plan to resolve the issue. This is a hand-off for another developer to take through implementation and verification.

Current hotspots
- Total row reads: ~28M/month (reported)
- Top queries (source logs):
	1) submissions per-artwork (high-frequency)
		 SELECT * FROM submissions
		 WHERE submission_type = 'logbook_entry' AND artwork_id = ?
			 AND status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
		 - ~2.12k row reads per call, executed ~160,926 times/month

	2) nearby bounding-box / distance sort
		 SELECT a.*,..., ((? - a.lat)*(? - a.lat) + (? - a.lon)*(? - a.lon)) as distance_sq
		 FROM artwork a
		 WHERE a.status = 'approved' AND a.lat BETWEEN ? AND ? AND a.lon BETWEEN ? AND ?
		 ORDER BY distance_sq ASC LIMIT ?
		 - ~182 row reads per call, executed ~2,273 times/month

	3) full-text style search (JOINs + LIKE across many columns)
		 SELECT DISTINCT a.* FROM artwork a
		 LEFT JOIN submissions s ... LEFT JOIN artwork_artists aa ... LEFT JOIN artists ar ...
		 WHERE a.status = ? AND (a.title LIKE ? OR a.description LIKE ? OR ... s.notes LIKE ? OR ar.name LIKE ? ...)
		 ORDER BY relevance_score DESC, a.created_at DESC LIMIT ? OFFSET ?
		 - ~2.08M row reads total, executed 114 times/month

	4) count(*) for the same search (pagination count)
		 SELECT COUNT(DISTINCT a.id) as total FROM artwork a LEFT JOIN ... WHERE same search predicate
		 - ~2.07M row reads total, executed 66 times/month

Where these queries are called (high level)
- Query 1 (submissions by artwork) is implemented in:
	- `src/workers/lib/database.ts` (getLogbookEntriesForArtwork)
	- Frequently invoked by `src/workers/lib/search.ts` (searchArtworks) which previously called the per-artwork function inside a loop (N DB calls per search result page)
	- Also referenced in `src/workers/lib/database-patch.ts` and various routes (discovery, artists, submission-related code) via similar code paths.

- Query 2 (findNearbyArtworks) is in:
	- `src/workers/lib/database.ts` (findNearbyArtworks)
	- Called by `src/workers/routes/discovery.ts`, `src/workers/routes/submissions.ts` (duplicate detection), and duplicate detection utilities.

- Query 3 & 4 (search & count) are in:
	- `src/workers/lib/search.ts` — this builds the large LEFT JOIN + LIKE query and runs it, then runs the COUNT(...) query for pagination.

Immediate change applied
- I replaced a very hot pattern in `src/workers/lib/search.ts` where, for each artwork returned by the search, the code executed `getLogbookEntriesForArtwork(artwork.id)` (one DB query per artwork). I changed that to a single bulk query that fetches submissions for all artwork IDs returned on the page, groups them in memory, and uses that for recent_photo/photo_count aggregation.
- Expected impact: reduces number of executions of Query 1 originating from search traffic from O(N) per search to O(1) per search. This should eliminate a large portion of the 160k monthly executions of Query 1 (measure after deploy).

Options to further reduce row reads (ordered by recommended priority)

Quick wins (apply in next deployment)
- Add targeted indexes (very high ROI):
	- submissions: CREATE INDEX IF NOT EXISTS idx_submissions_artwork_status_type_created_at ON submissions(artwork_id, status, submission_type, created_at);
	- artwork: CREATE INDEX IF NOT EXISTS idx_artwork_status_lat_lon ON artwork(status, lat, lon);
	- artwork: CREATE INDEX IF NOT EXISTS idx_artwork_created_at ON artwork(created_at);
	- artwork_artists: CREATE INDEX IF NOT EXISTS idx_artwork_artists_artwork_id ON artwork_artists(artwork_id);
	- artists: CREATE INDEX IF NOT EXISTS idx_artists_id_status ON artists(id, status);
	- these will reduce table scans and dramatically cut row reads for the above queries.

- Select fewer columns: replace SELECT * / SELECT a.* with explicit columns (id, lat, lon, small fields) where route doesn't need full JSON fields like `tags` or `photos`.

- Bulk-fetch patterns: apply the same bulk-fetch strategy to other places that do per-artwork DB calls (artists listing, discovery/photo aggregation). Convert N queries to 1 query per page.

Medium-term (next 1–2 sprints)
- Full-text search via SQLite FTS5 (or external search engine):
	- Create an FTS5 virtual table for searchable concatenation of (title, description, tags, artist.name, submission.notes). Use MATCH instead of LIKE.
	- Maintain it via triggers (on artwork, artists, submissions) or a periodic sync.
	- This addresses Query 3 & 4 directly and avoids expensive LIKE + JOIN scans.

- Cache frequent queries with short TTLs (Cloudflare Workers KV or in-memory LRU per instance):
	- Nearby map queries (same bbox/zoom), search queries with identical parameters, counts for searches.

Longer term / architecture (if reads continue to be a problem)
- Offload search to an external system (Meili, Algolia, Elastic) for large-scale full-text search and relevance scoring. Cloudflare D1 continues as source-of-truth for records but search queries are handled externally.

Concrete plan (step-by-step) — handoff tasks for developer

Phase 0 — prep (testing + backups)
1. Create a development snapshot of the D1/SQLite DB (backup dump) to test index changes and query plans.
2. Add query logging/tracing if not present to measure before/after effects.

Phase 1 — quick wins (1–3 days)
1. Add the migration SQL to create the indexes listed above. Put it under `src/workers/migrations/` (next migration number) and test locally.
2. Deploy migration to staging and measure change in row reads / query plans.
3. Deploy the bulk-fetch change I made (already in `src/workers/lib/search.ts`) to staging — run a few representative searches and verify number of submissions queries executed (should be 1 instead of N).
4. Replace other per-artwork fetches in these routes with bulk patterns:
	 - `src/workers/routes/discovery.ts` (photo aggregation / minimal mode)
	 - `src/workers/routes/artists.ts` (avoid correlated subqueries per artwork; instead precompute recent_photo & photo_count for the list of artwork IDs)

Phase 2 — search improvements & caching (1–3 sprints)
1. Prototype an FTS5 virtual table for artwork search in a branch. Provide a migration for creating the FTS table and triggers (or a sync job).
2. Switch `src/workers/lib/search.ts` to query FTS and join with artwork for status filters; keep count logic efficient (use FTS docids + join to count filtered IDs).
3. Add short-ttl caching for expensive or repeated queries (searches, nearby map pins).

Phase 3 — monitoring & rollout
1. Deploy to production behind a feature flag (if possible) or during a low-traffic window.
2. Monitor D1 row reads, query logs, and any latency changes for a few days.
3. Rollback or iterate if regressions occur.

Validation and tests
- Write unit/integration tests (fast) for:
	- search result shape after applying the bulk-fetch change
	- discovery/minimal endpoint still returns expected fields
	- artists route aggregated photo_count/recent_photo logic if refactored
- Add a small benchmark script that hits the search endpoint and counts the number of submissions queries executed (or measure via DB query logging) — validate before/after.

Risks & notes
- Indexes increase write cost on inserts/updates — monitor write latency and decide which composite indexes are necessary.
- FTS5 requires maintenance (triggers or sync) and changes to deployment/migrations; test thoroughly.
- Avoid changing API payloads — prefer internal optimizations that maintain current JSON shapes.

Suggested immediate action items for next developer
1. Create migration SQL file with indexes listed above and run it on staging/dev DB.
2. Deploy the branch containing the `src/workers/lib/search.ts` bulk-fetch change to staging and run representative search/discovery requests; verify row reads drop.
3. Replace other per-artwork correlated-subqueries (artists route) with bulk queries (I'll document example SQL if you want).
4. If search read counts remain dominant after the above, schedule a sprint to implement FTS5 or an external search engine.

Appendix — example SQL snippets
- Index migration example (SQLite/D1 compatible):

	-- submissions composite index
	CREATE INDEX IF NOT EXISTS idx_submissions_artwork_status_type_created_at ON submissions(artwork_id, status, submission_type, created_at);

	-- artwork indexes
	CREATE INDEX IF NOT EXISTS idx_artwork_status_lat_lon ON artwork(status, lat, lon);
	CREATE INDEX IF NOT EXISTS idx_artwork_created_at ON artwork(created_at);

	-- junction/join indexes
	CREATE INDEX IF NOT EXISTS idx_artwork_artists_artwork_id ON artwork_artists(artwork_id);
	CREATE INDEX IF NOT EXISTS idx_artists_id_status ON artists(id, status);

If you'd like, I can: create the migration file for these indexes, refactor `artists.ts` correlated subqueries to a bulk query pattern, and prototype an FTS5 migration. Tell me which to pick next and I will implement it.

— End of hand-off
