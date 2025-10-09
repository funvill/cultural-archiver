**High Priority**
- `src/workers/routes/debug-permissions.ts:17` + `src/workers/index.ts:1381`: exposes a dev-only permissions dump to any bearer of an anonymous token; gate with `requireAdmin` or remove from production builds.
- `src/workers/routes/fix-schema.ts:14` + `src/workers/index.ts:1388`: schema-migration endpoint runs destructive ALTER/UPDATE calls behind only `ensureUserToken`; this must be admin-only or executed manually during ops.
- `src/frontend/src/services/api.ts:120` `151` `170` `219`: verbose debug logging prints bearer tokens and headers to the console, leaking credentials into browser logs and analytics; strip these before release.

**Duplication & Organization**
- `src/workers/routes/discovery.ts:109` `163` `594` `650` `703` `759` `872` `1142` and `src/workers/routes/discovery-new.ts:69` `330` repeat the same 'collect logbook photos + safeJsonParse' block; pull this into `lib/database` or helper service.
- `src/workers/routes/submissions.ts:1` and `src/workers/routes/submissions-new.ts:1` implement parallel submission pipelines with overlapping consent/photo logic; converge behind a unified service to avoid drift.
- `src/shared/types.ts:1`, `src/shared/types.d.ts:1`, and `src/shared/types.js:1` are three copies of the same model definitions; keep the `.ts` source and generate outputs at build time instead of committing artifacts.
- `src/frontend/src/services/api.ts:1` centralizes every endpoint in one 1.2k-line module with bespoke caching; split per domain (auth, lists, reviews, etc.) or generate clients to cut repetition.
- `src/frontend/src/components/MapComponent.vue:1` and `src/frontend/src/views/ReviewView.vue:1`/`SearchView.vue:1`/`StatusView.vue:1` are 900-2400 line monoliths; break UI, fetching, and state into composables/components.
- `src/frontend/src/stores/artworks.ts:743` redefines `calculateDistance` already provided in `src/frontend/src/composables/useGeolocation.ts:172`; consolidate shared geo math/utilities.
- `src/workers/lib/photos.ts:16` hardcodes `MAX_PHOTOS_PER_SUBMISSION` which also lives in `src/workers/types.ts:559`; rely on the shared constant to prevent mismatches.

**Targets to Tackle**
- Extract a reusable `collectArtworkPhotos` helper covering submissions/logbook blending and reuse it from every discovery handler (`src/workers/routes/discovery.ts:109`, `163`, etc.).
- Collapse the legacy/new submission routes into a single orchestrator that hands off to `lib/submissions` variants (`src/workers/routes/submissions.ts:1`, `submissions-new.ts:1`).
- Modularize the API layer (`src/frontend/src/services/api.ts:1`) into domain clients and remove inline caching in favor of shared fetch utilities.
- Split `MapComponent` into map shell, clustering overlay, filter banner, and telemetry composables (`src/frontend/src/components/MapComponent.vue:1`).
- Replace the committed build artifacts (`src/shared/types.d.ts:1`, `src/shared/types.js:1`, `src/workers/dist/...`, `src/lib/mass-import-system/dist/...`) with build steps and `.gitignore` entries.

**Third-Party Help**
- Use `openapi-typescript-codegen` or `orval` to emit typed clients for the Hono routes, replacing the manual client in `src/frontend/src/services/api.ts`.
- Adopt `@tanstack/vue-query` for data fetching/caching to retire bespoke caches in the Pinia stores and API layer.
- Consider `drizzle-orm` or `kysely` with Cloudflare D1 adapters to express SQL logic once and derive Zod schemas, reducing boilerplate across `src/workers/lib/database.ts`.
- Lean on the existing `supercluster` dependency (`src/frontend/src/composables/useSupercluster.ts:1`) instead of maintaining a parallel grid clustering implementation.
- Pair `vee-validate` (with its Zod resolver) on the frontend forms to reuse the backend's schemas and drop hand-rolled validation/watchers.

**Potential Pitfalls**
- Keeping `dist` bundles in source (`src/workers/dist`, `src/lib/mass-import-system/dist`) risks stale code shipping; move to release artifacts only.
- Mixing `.ts` sources with `.js` imports (e.g., `src/workers/routes/submissions-new.ts` importing `../lib/submissions.js`) can break type safety and duplicate logic.
- `src/workers/lib/bundled-pages.js:1` is generated content tracked in git; prefer dynamic bundling during build to avoid editing giant blobs.
- Persisting tokens in `localStorage` in combination with debug logging (`src/frontend/src/services/api.ts:120`) magnifies XSS blast radius; plan for HttpOnly cookies or encrypted storage.
- The codebase is littered with production `console.*` statements (emoji-laden logs across `src/workers/routes` and frontend); gate behind a logger that strips output in production.
