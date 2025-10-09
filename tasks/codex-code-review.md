**High Priority**
- (Resolved) `src/workers/routes/debug-permissions.ts:17` + `src/workers/index.ts:1381`: endpoints now use `requireAdmin`, closing the anonymous access hole.
- (Resolved) `src/workers/routes/fix-schema.ts:14` + `src/workers/index.ts:1388`: fix-schema route also requires `requireAdmin`, preventing unauthorized schema changes.
- (Resolved) `src/frontend/src/services/api.ts:120` `151` `170` `219`: removed sensitive debug logging (token/headers) and hardened storage access.
- (Resolved) `src/workers/lib/errors.ts:108` `119` `131`: corrected constructor argument order so error codes/messages render properly.
- (Resolved) `src/workers/routes/auth.ts:443`: dev magic-link endpoint now only responds outside production.

**Duplication & Organization**
- `src/workers/routes/discovery.ts:109` `163` `594` `650` `703` `759` `872` `1142` and `src/workers/routes/discovery-new.ts:69` `330` repeat the same 'collect logbook photos + safeJsonParse' block; pull this into `lib/database` or helper service.
- `src/workers/routes/submissions.ts:1` and `src/workers/routes/submissions-new.ts:1` implement parallel submission pipelines with overlapping consent/photo logic; converge behind a unified service to avoid drift.
- `src/shared/types.ts:1`, `src/shared/types.d.ts:1`, and `src/shared/types.js:1` are three copies of the same model definitions; keep the `.ts` source and generate outputs at build time instead of committing artifacts.
- `src/frontend/src/services/api.ts:1` centralizes every endpoint in one 1.2k-line module with bespoke caching; split per domain (auth, lists, reviews, etc.) or generate clients to cut repetition.
- `src/frontend/src/components/MapComponent.vue:1` and `src/frontend/src/views/ReviewView.vue:1`/`SearchView.vue:1`/`StatusView.vue:1` are 900-2400 line monoliths; break UI, fetching, and state into composables/components.
- `src/frontend/src/stores/artworks.ts:743` redefines `calculateDistance` already provided in `src/frontend/src/composables/useGeolocation.ts:172`; consolidate shared geo math/utilities.
- `src/workers/lib/photos.ts:16` hardcodes `MAX_PHOTOS_PER_SUBMISSION` which also lives in `src/workers/types.ts:559`; rely on the shared constant to prevent mismatches.
- `src/frontend/src/stores/` contains several Pinia stores that individually wrap API calls with near-identical loading/error state management (e.g., `artworks.ts:31`, `search.ts:20`, `notifications.ts:19`). Centralize a store helper or adopt vue-query to cut repetition and keep UX consistent.
- `src/workers/routes/review.ts:428` `777` `1211` `1339` manually repeat the same reviewer permission check, audit logging, badge issuance, and photo-move logic; extract shared helpers/services so approval flows stay in sync.
- `src/lib/mass-import-system/lib/duplicate-detection.ts:1` duplicates the logic already present in `src/workers/lib/mass-import-duplicate-detection.ts:1`; align the standalone CLI with the worker service via a shared package instead of copy/paste branches.
- Console logging is scattered across both tiers (frontend examples: `src/frontend/src/components/AppShell.vue:257`, `src/frontend/src/components/ArtworkActionBar.vue:234`; backend examples: `src/workers/lib/social-media/cron.ts:28`, `src/workers/routes/discovery.ts:90`, `src/workers/routes/review.ts:460`). A new shared logger (`src/shared/logger.ts`) now exists—migrate remaining call sites to it.
- Pinia stores (`src/frontend/src/stores/*.ts`) each roll their own loading/error flags and manual `ref` state; consider a composable `useAsyncResource` or shared store factory to eliminate copy-paste logic and keep UX consistent.
- `src/frontend/src/composables/useApi.ts` duplicates retry/loading/error logic already centralized in `src/frontend/src/services/api.ts`; pick one abstraction (or replace with vue-query) so fixes propagate everywhere.

**Targets to Tackle**
- Extract a reusable `collectArtworkPhotos` helper covering submissions/logbook blending and reuse it from every discovery handler (`src/workers/routes/discovery.ts:109`, `163`, etc.).
- Collapse the legacy/new submission routes into a single orchestrator that hands off to `lib/submissions` variants (`src/workers/routes/submissions.ts:1`, `submissions-new.ts:1`).
- Modularize the API layer (`src/frontend/src/services/api.ts:1`) into domain clients and remove inline caching in favor of shared fetch utilities.
- Split `MapComponent` into map shell, clustering overlay, filter banner, and telemetry composables (`src/frontend/src/components/MapComponent.vue:1`).
- Replace the committed build artifacts (`src/shared/types.d.ts:1`, `src/shared/types.js:1`, `src/workers/dist/...`, `src/lib/mass-import-system/dist/...`) with build steps and `.gitignore` entries.
- Break `src/workers/routes/review.ts:1` into smaller feature modules (queue retrieval, approvals, badge side-effects) and back them with the same `lib/submissions` primitives to avoid drift between API endpoints and the moderation UI.
- Treat `src/lib/mass-import-system` as a workspace package that reuses the worker-side duplicate detection/tag validation helpers instead of maintaining parallel implementations.
- Roll out the new `shared/logger.ts` helpers across the codebase (workers + frontend) and add transports if deeper integrations (Sentry/DataDog) are needed.
- Extract a `shared/composables` package for cross-view concerns (toasts, announcer, infinite scroll, map filters) so that massive views/import trees shrink and code reuse becomes explicit.
- Formalize a frontend design system (Tailwind design tokens, Vuetify, or CSS variables layered on `src/frontend/src/style.css`) to enforce consistent spacing, typography, and theme handling across views.
- Introduce a sanctioned design system (Tailwind tokens, Vuetify, or design tokens in `src/frontend/src/style.css`) so typography/spacing/colors stop drifting between components and views.

**Third-Party Help**
- Use `openapi-typescript-codegen` or `orval` to emit typed clients for the Hono routes, replacing the manual client in `src/frontend/src/services/api.ts`.
- Adopt `@tanstack/vue-query` for data fetching/caching to retire bespoke caches in the Pinia stores and API layer.
- Consider `drizzle-orm` or `kysely` with Cloudflare D1 adapters to express SQL logic once and derive Zod schemas, reducing boilerplate across `src/workers/lib/database.ts`.
- Lean on the existing `supercluster` dependency (`src/frontend/src/composables/useSupercluster.ts:1`) instead of maintaining a parallel grid clustering implementation.
- Pair `vee-validate` (with its Zod resolver) on the frontend forms to reuse the backend's schemas and drop hand-rolled validation/watchers.
- Evaluate `zod-to-json-schema` (or `zod-openapi`) to generate OpenAPI specs directly from existing validation middleware, enabling shared clients without re-describing schemas.
- Pull in a structured logging package (`pino`, `consola`, or `@vercel/og/logger`) that supports browser + worker targets; configure transport hooks for Cloudflare Workers and optionally forward browser logs to Sentry/DataDog only when opt-in.
- Vue Query can replace bespoke `ref` state machines in stores; pair with `immer` or `tiny-invariant` for immutable updates and guardrails.
- Consider `@pinia/plugin-persistedstate` (or `pinia-shared-state`) to replace one-off `localStorage` reads for theme/auth persistence and keep SSR compatibility.

**Potential Pitfalls**
- Keeping `dist` bundles in source (`src/workers/dist`, `src/lib/mass-import-system/dist`) risks stale code shipping; move to release artifacts only.
- Mixing `.ts` sources with `.js` imports (e.g., `src/workers/routes/submissions-new.ts` importing `../lib/submissions.js`) can break type safety and duplicate logic.
- `src/workers/lib/bundled-pages.js:1` is generated content tracked in git; prefer dynamic bundling during build to avoid editing giant blobs.
- Persisting tokens in `localStorage` in combination with debug logging (`src/frontend/src/services/api.ts:120`) magnifies XSS blast radius; plan for HttpOnly cookies or encrypted storage.
- The codebase is littered with production `console.*` statements (emoji-laden logs across `src/workers/routes` and frontend); gate behind a logger that strips output in production.
- `withErrorHandling` in `src/workers/lib/errors.ts:174` wraps unexpected errors in `InternalServerError`, but because that subclass is currently broken (see High Priority), every thrown error returns the wrong code/message tuple; fix the class before trusting telemetry.
- Root `package.json` carries two versions of `better-sqlite3` (dependencies `^11.3.0`, devDependencies `^12.2.0`), bloating installs and risking ABI mismatches; consolidate to a single version and hoist workers/lib/tooling to share it.
- Development helpers like `src/workers/routes/auth.ts:443` must be covered by environment-gated tests; otherwise a regression (like the inverted production check) can silently ship.
- Direct `localStorage` access in module scope (`src/frontend/src/main.ts`) will break under SSR or test environments; guard with `typeof window !== 'undefined'` checks or move into lifecycle hooks.

**Testing & Tooling**
- Backend acceptance tests in `src/workers/test/` exercise mass-import and similarity flows, but there are no coverage hooks around the public review queue (`src/workers/routes/review.ts`) or the schema-fix/dev endpoints. Add integration tests to pin expected authorization failures once the endpoints are locked down.
- Frontend vitest suite covers utilities and templates, yet there is no automated coverage for `MapComponent` interactions or the 1k-line `ReviewView`. Consider Vue Testing Library plus Cypress-style component tests to guard against regressions as you extract composables.
- Add a lint rule or custom ESLint plugin to reject committed `console.log`/emoji usage and ensure that only the centralized logger is used in production builds.
- Wire the workers package into CI (Wrangler's `miniflare` test harness or Cloudflare Pages integration) so route-level tests exercise the same bindings/kv mocks you use in production, catching missing binding regressions earlier.
- Add regression tests for environment-gated helpers (`src/workers/routes/auth.ts:443`, `src/workers/routes/debug-permissions.ts:17`) to assert the endpoints fail fast outside development; prevent inverted guards from landing unnoticed.
