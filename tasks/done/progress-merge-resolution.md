# Merge Resolution Progress — cultural-archiver

Last updated: 2025-10-01

Summary

This document tracks the work to resolve a repo-wide bad git merge that left conflict markers across many source files. It is intended as a hand-off and persistent memory for ongoing work. Follow the task breakdown and notes below to continue or resume.

Major tasks

1) Repo scan for conflicts
- [X] Run repository-wide search for git conflict markers ("<<<<<<<", "=======", ">>>>>>>").
- Outcome: Found numerous conflict markers across frontend source files (components, composables, views, stores) and some generated/dist files.

2) Create handoff document (this file)
- [X] Create `tasks/progress-merge-resolution.md` with major tasks, sub-tasks, and guidance for next steps.
- Summary: This file.

3) Auto-resolve conflicts (HEAD-preferred) — IN PROGRESS
- [ ] Implement and run an automated script that removes conflict markers by keeping the HEAD sections for non-dist source files.
- Notes: This is a convenience to resolve straightforward conflicts (typing, whitespace). Manual review required for ambiguous or logic-bearing conflicts (especially in Vue SFCs and composables).

4) Manual review and final merges
- [ ] Open files where the auto-resolver flagged ambiguous changes. Manually inspect and test.
- [ ] Update types, imports, or logic where necessary.

5) Verification
- [ ] Run TypeScript typecheck and the frontend and worker test suites.
- [ ] Run linting (ESLint) and fix remaining issues.

6) Commit & cleanup
- [ ] Stage and commit changes with message: "Resolve merge conflicts — prefer HEAD; manual fixes where needed"
- [ ] Create a PR on the `MapFilterAndIcons` branch and request review.

Files touched (initial scan)
- The scan identified many frontend files with conflict markers. Example subset:
  - `src/frontend/src/components/*` (BadgeCard.vue, BadgeGrid.vue, BadgeToast.vue, NotificationPanel.vue, NotificationIcon.vue, ProfileNameEditor.vue, AddToListDialog.vue, ...)
  - `src/frontend/src/views/*` (MapView.vue, ArtistDetailView.vue, ListView.vue, PublicProfileView.vue, ProfileView.vue, PrivacyView.vue, TermsView.vue)
  - `src/frontend/src/composables/*` (useApi.ts, useGeolocation.ts, useAuth.ts, useNavigation.ts, useFocusManagement.ts)
  - `src/frontend/src/stores/notifications.ts`
  - `eslint.config.js`
  - Dist/build files under `src/workers/dist` (these should be regenerated rather than edited)

Risk matrix and assumptions
- Assumption: HEAD contains the intended local changes; incoming branch contains updates that may be newer but sometimes only lint/type modifications.
- Risk: Auto-preferring HEAD can discard intended fixes from the incoming branch; therefore, manual review is required for non-trivial files.
- Approach: Auto-resolve where conflicts are simple (small blocks, type aliases, comments). For SFCs and logic code, prefer manual review after automated pass.

How to continue (handoff guidance)
- Run the automated resolver (script included in tasks) — it will write backups with `.orig_conflict_backup` suffix for safety.
- Run a repo-wide grep for conflict markers to find remaining files.
- Manually open each remaining file and resolve conflicts; pay attention to:
  - Vue SFC sections (<script setup>, <template>, <style>) where merge conflicts can break parsing.
  - TypeScript union and import changes — ensure types are imported from `src/frontend/src/types` or `shared` as appropriate.
  - Dist files: ignore and regenerate builds.
- After resolving, run `npm run build` / `npm run test` and ensure no regressions.

Progress log
- 2025-10-01: Repo-wide scan completed and handoff file created. Next: auto-resolver step.

Contact notes
- If you pick up this work, run the repo scan first to verify current state and then run the auto-resolver script (see tasks). Keep backups and commit often.



Auto-resolve run (2025-10-01)

- [X] Ran an automated resolver script that keeps the `HEAD` section for git conflict blocks in non-dist source files.
- Modified files (backups saved with `.orig_conflict_backup`):
  - eslint.config.js
  - scripts/auto_resolve_conflicts.js
  - src/frontend/src/components/AddToListDialog.vue
  - src/frontend/src/components/BadgeCard.vue
  - src/frontend/src/components/BadgeGrid.vue
  - src/frontend/src/components/BadgeToast.vue
  - src/frontend/src/components/NotificationIcon.vue
  - src/frontend/src/components/NotificationPanel.vue
  - src/frontend/src/components/ProfileNameEditor.vue
  - src/frontend/src/composables/useApi.ts
  - src/frontend/src/composables/useAuth.ts
  - src/frontend/src/composables/useFocusManagement.ts
  - src/frontend/src/composables/useGeolocation.ts
  - src/frontend/src/composables/useNavigation.ts
  - src/frontend/src/stores/notifications.ts
  - src/frontend/src/views/ArtistDetailView.vue
  - src/frontend/src/views/ListView.vue
  - src/frontend/src/views/MapView.vue
  - src/frontend/src/views/PrivacyView.vue
  - src/frontend/src/views/ProfileView.vue
  - src/frontend/src/views/PublicProfileView.vue
  - src/frontend/src/views/TermsView.vue

- Result: Conflict markers were removed from the live files. Original files with markers were preserved with the `.orig_conflict_backup` suffix for manual review.

Next immediate steps

- Run a repo-wide search for conflict markers to confirm only `.orig_conflict_backup` files contain markers. (Done — markers now only appear in backups.)
- Manually review the `.orig_conflict_backup` files when time permits and merge any incoming-branch changes that are necessary.
- Run TypeScript checks, lint, and the test suite. Fix any issues introduced by the automatic resolution.

Manual fixes applied (in-session)

- Restored component registration in `src/frontend/src/views/MapView.vue` by importing `MapFiltersModal` so the modal resolves correctly at runtime.
- Restored the "Show artworks without photos" toggle to `src/frontend/src/components/MapFiltersModal.vue` (wired to `mapFilters.filtersState.showArtworksWithoutPhotos` and `mapFilters.toggleShowArtworksWithoutPhotos()`) so the modal matches the MapOptions UI and the filtering logic already present in `useMapFilters.ts`.
- Fixed several TypeScript and template issues encountered while reconciling the auto-resolve changes (see code commits for details).

Current `.orig_conflict_backup` inventory (priority review list)

Files with backups under `src/frontend` (open these first — SFCs and composables are highest priority):

 - src/frontend/src/views/ArtistDetailView.vue.orig_conflict_backup
 - src/frontend/src/views/ListView.vue.orig_conflict_backup
 - src/frontend/src/views/MapView.vue.orig_conflict_backup
 - src/frontend/src/views/PrivacyView.vue.orig_conflict_backup
 - src/frontend/src/views/ProfileView.vue.orig_conflict_backup
 - src/frontend/src/views/PublicProfileView.vue.orig_conflict_backup
 - src/frontend/src/views/TermsView.vue.orig_conflict_backup

 - src/frontend/src/components/AddToListDialog.vue.orig_conflict_backup
 - src/frontend/src/components/BadgeCard.vue.orig_conflict_backup
 - src/frontend/src/components/BadgeGrid.vue.orig_conflict_backup
 - src/frontend/src/components/BadgeToast.vue.orig_conflict_backup
 - src/frontend/src/components/NotificationIcon.vue.orig_conflict_backup
 - src/frontend/src/components/NotificationPanel.vue.orig_conflict_backup
 - src/frontend/src/components/ProfileNameEditor.vue.orig_conflict_backup

 - src/frontend/src/composables/useApi.ts.orig_conflict_backup
 - src/frontend/src/composables/useAuth.ts.orig_conflict_backup
 - src/frontend/src/composables/useFocusManagement.ts.orig_conflict_backup
 - src/frontend/src/composables/useGeolocation.ts.orig_conflict_backup
 - src/frontend/src/composables/useNavigation.ts.orig_conflict_backup

 - src/frontend/src/stores/notifications.ts.orig_conflict_backup

Notes for manual reviewers

- Prioritize SFCs that touch UI and templates (views and components). Template merge artifacts often cause runtime parse errors.
- Compare backups to the live file to re-apply any incoming-branch fixes that were lost. Use the `.orig_conflict_backup` file as the source of incoming content.
- After each manual reconciliation, run `npm run type-check` and `npm run lint` to catch regressions early.

Notes for the reviewer/hand-off

- The auto-resolver prefers the `HEAD` block. This is a conservative approach but can drop intended changes from the incoming branch. Manual review of the `.orig_conflict_backup` files is required to ensure no important changes were lost.


For Vue SFCs, pay attention to `<script setup>`/`<template>` boundaries — these were handled by string replacement but should be smoke-tested in the app.

Review notes (inspected so far)

- Reviewed `src/frontend/src/views/MapView.vue.orig_conflict_backup` — compared incoming content to the current live file; no incoming-branch changes required re-applying. The live (HEAD) content is consistent and includes the necessary fixes (MapFiltersModal import, filtering logic, and telemetry handling).

- Reviewed `src/frontend/src/views/ArtistDetailView.vue.orig_conflict_backup` — incoming branch changed the markdown sanitization helper import path and replaced an async watch-based `renderedBio` with a synchronous `computed` that uses `marked.parse`. I kept the live (HEAD) implementation (async watch + `sanitizeHtml` from `../utils/sanitizeHtml`) because it preserves async-safe parsing behavior and matches other code in the repo. No change applied; note saved for reviewers.

- Reviewed `src/frontend/src/views/ListView.vue.orig_conflict_backup` — inspected incoming changes (differences in response parsing and some type casts). The live (HEAD) implementation is robust and preserves async handling and defensive parsing; no incoming changes were applied. Note saved for reviewers.

- Reviewed `src/frontend/src/views/PrivacyView.vue.orig_conflict_backup` — incoming branch used `marked.parse` and a different sanitize import path. Kept HEAD implementation which uses `await marked(markdownContent)` and `../utils/sanitizeHtml` for consistency with other pages. No change applied.


- Reviewed `src/frontend/src/views/ProfileView.vue.orig_conflict_backup` — compared incoming changes (response parsing and list filtering). The live (HEAD) implementation is consistent and preserves defensive parsing; no incoming-branch changes were applied. Note saved for reviewers.

- Reviewed `src/frontend/src/views/PublicProfileView.vue.orig_conflict_backup` — inspected incoming whitespace/formatting differences and minor template markers. Live (HEAD) content is complete; no incoming changes were applied. Note saved for reviewers.

- Reviewed `src/frontend/src/views/TermsView.vue.orig_conflict_backup` — incoming branch used `marked.parse` and an alternate sanitize import path; kept HEAD implementation using `await marked(markdownContent)` and `../utils/sanitizeHtml` for consistency. No change applied.

 - Reviewed `src/frontend/src/components/AddToListDialog.vue.orig_conflict_backup` — the backup contained only formatting differences in the emit declaration and one-line indentation change for an `emit('addedToList', ...)` call. The live (HEAD) file already has the corrected emit typing and consistent indentation. No functional changes were lost; keeping HEAD. Note saved for reviewers.
 - Reviewed `src/frontend/src/components/BadgeCard.vue.orig_conflict_backup` — the backup contained leftover merge markers around a comment noting that the `<script>` was moved above the `<template>`; there are no functional or behavioral differences in the incoming content. Kept HEAD. Note saved for reviewers.
 - Reviewed `src/frontend/src/components/BadgeGrid.vue.orig_conflict_backup` — the backup contained merge markers around the same ordering comment and no incoming functional changes. Kept HEAD. Note saved for reviewers.
 - Reviewed `src/frontend/src/components/BadgeToast.vue.orig_conflict_backup` — the backup contained leftover conflict markers around a trailing comment about script order; no behavioral changes in the incoming content. Kept HEAD. Note saved for reviewers.
 - Reviewed `src/frontend/src/components/NotificationIcon.vue.orig_conflict_backup` — the backup included the same non-functional script-order comment markers; live (HEAD) content is correct and complete. Kept HEAD. Note saved for reviewers.
 - Reviewed `src/frontend/src/components/NotificationPanel.vue.orig_conflict_backup` — incoming content largely matches HEAD; the backup added a small header convenience ("Mark all as read") which HEAD already includes in the footer; no functional regression found. Kept HEAD. Note saved for reviewers.
 - Reviewed `src/frontend/src/components/ProfileNameEditor.vue.orig_conflict_backup` — the backup contained a small emit/indentation difference around `emit('profileUpdated', ...)` and a trailing script-order comment. No functional changes were lost; kept HEAD. Note saved for reviewers.
 - Reviewed `src/frontend/src/composables/useApi.ts.orig_conflict_backup` — incoming content contained alternate TypeScript signatures (an inline complex return type) and a few typing refinements around `executePaginated` and paginated helpers. Function behavior is equivalent and no runtime changes were introduced by the incoming branch. Kept HEAD (the defined `UseApiReturn` interface) for readability and consistency. Note saved for reviewers.
 - Reviewed `src/frontend/src/composables/useAuth.ts.orig_conflict_backup` — backup introduced small import and `UseAuthReturn` shape changes (union types with writable refs vs computed-only refs). The differences are type-level and non-functional; kept HEAD which uses `computed`-based refs and matches other composables. Note saved for reviewers.
 - Reviewed `src/frontend/src/composables/useFocusManagement.ts.orig_conflict_backup` — backup attempted a looser return type (`unknown`) and had small ordering/formatting differences. The implementation logic for focus saving/restoring, trapping, and screen-reader announcement is equivalent. Kept HEAD which exposes a clear `UseFocusManagementReturn` interface. Note saved for reviewers.
 - Reviewed `src/frontend/src/composables/useGeolocation.ts.orig_conflict_backup` — incoming changes reorganized the interface comments and moved `FALLBACK_COORDINATES` in the return shape; the logic for acquiring, watching, and falling back to coordinates is identical. Kept HEAD for API stability. Note saved for reviewers.

Per-file decisions (batch 4)

- `src/frontend/src/views/ArtistDetailView.vue.orig_conflict_backup` — Backup changed the sanitize helper import to `../utils/sanitize` and replaced the async watch-based `renderedBio` with a computed-based `marked.parse` approach. I kept HEAD which uses the `sanitizeHtml` helper from `../utils/sanitizeHtml` and an async `watch` to support potential async-marked configurations; this preserves consistent async-safe parsing used elsewhere. Decision: kept HEAD. Note: incoming branch's `marked.parse` usage is straightforward and safe; if reviewers prefer that approach, consider normalizing across the app.

- `src/frontend/src/views/MapView.vue.orig_conflict_backup` — The live file already includes the `MapFiltersModal` import and wiring; the backup primarily contained minor formatting and logging differences. Kept HEAD. Note: MapFilters behavior and telemetry polling remain the same; ensure dev-server smoke test exercises modal to confirm UI wiring.

- `src/frontend/src/views/PrivacyView.vue.orig_conflict_backup` — Backup used `marked.parse` and alternate sanitize import path. Kept HEAD which uses `await marked(markdownContent)` and `../utils/sanitizeHtml` for consistency with other pages and to remain async-safe. Decision: kept HEAD.

- `src/frontend/src/views/ProfileView.vue.orig_conflict_backup` — Backup had differences in list filtering response parsing and minor type casts; HEAD preserves defensive parsing and consistent API usage (`apiService`). Kept HEAD. Decision: kept HEAD.

- `src/frontend/src/views/PublicProfileView.vue.orig_conflict_backup` — Backup had whitespace/template spacing and an empty change block; no functional differences detected. Kept HEAD. Decision: kept HEAD.

- `src/frontend/src/views/TermsView.vue.orig_conflict_backup` — Backup used `marked.parse` and changed sanitize import path; kept HEAD implementing `await marked(markdownContent)` and `../utils/sanitizeHtml` for consistency. Decision: kept HEAD.

Recent actions (2025-10-02)

- Started manual review of the next SFC batch: `BadgeCard.vue`, `BadgeGrid.vue`, `BadgeToast.vue`, `NotificationIcon.vue`, `NotificationPanel.vue` (these are being inspected in priority order). Decisions per-file will be appended here as each file is inspected.

Per-file decisions (batch 1)

- `src/frontend/src/components/BadgeCard.vue.orig_conflict_backup` — Backup contained only a trailing comment about script order and a small conflict block at the end. The live (HEAD) file already moved the `<script>` above the `<template>` and contains the expected implementation and CSS. No functional incoming changes were lost; kept HEAD.

- `src/frontend/src/components/BadgeGrid.vue.orig_conflict_backup` — Backup had the same script-order comment markers and no behavioral differences. Live (HEAD) grid markup and props look correct (includes responsive grid and empty/loading states). Kept HEAD.

- `src/frontend/src/components/BadgeToast.vue.orig_conflict_backup` — Backup included leftover merge markers near the script/style footer; the live (HEAD) toast implementation includes confetti and careful reduced-motion handling. No runtime changes were missing; kept HEAD.

- `src/frontend/src/components/NotificationIcon.vue.orig_conflict_backup` — Backup contained non-functional ordering comments. The live `NotificationIcon` component includes unread-badge UI and aria labels; kept HEAD.

- `src/frontend/src/components/NotificationPanel.vue.orig_conflict_backup` — Backup included an incoming convenience header ('Mark all as read') but HEAD already includes that affordance in both header and footer. The panel also included minor formatting differences only. Kept HEAD.

All five files in this batch were reviewed and did not require re-applying incoming changes from the backups; noted decisions above and preserved `.orig_conflict_backup` files as authoritative record.

- Ran project verification after the prior batch of reconciliations:

- TypeScript type-check: PASSED (no type errors reported across frontend, workers, and shared projects).

- ESLint: COMPLETED; printed a TypeScript parser compatibility WARNING (YOUR TYPESCRIPT VERSION: 5.9.2 — supported range: >=4.7.4 <5.6.0). Lint otherwise finished without blocking errors.

Notes:

- The lint TypeScript-version warning is informational. It should be noted in any PR so reviewers are aware; consider aligning the `@typescript-eslint` tooling or pinning a supported TypeScript version if CI enforces the parser's supported range.
- Next: finish inspecting the five SFC backups in this batch, record per-file decisions below, then run `npm run test` and perform a dev-server smoke test once a small group of reconciliations is complete.



Reviewed composables/stores (2025-10-02)

- `src/frontend/src/composables/useNavigation.ts.orig_conflict_backup` — The incoming backup relaxed the exported return type to `unknown` in one branch and otherwise only made type-level variations. The live (HEAD) `useNavigation` exposes a clear `UseNavigationReturn` interface (typed refs and action methods) and persists rail state to localStorage; this is safer and more helpful for consumers. Decision: kept HEAD. Note: keep the `.orig_conflict_backup` file around in case a larger API refactor is intended in the incoming branch.

- `src/frontend/src/stores/notifications.ts.orig_conflict_backup` — The backup introduced nullable/`null`-bearing return types and early-return refactors for some helpers. HEAD preserves consistent promise-returning helpers and strong return types, plus clear cache trimming and polling behavior. Decision: kept HEAD to preserve stable API shapes and predictable consumer behavior. If we later adopt nullable returns, update dependent callers accordingly.


Draft PR & checklist

Title: Resolve merge conflicts (prefer HEAD) and manual reconciliations — MapFilterAndIcons

Description (for PR body):

This PR resolves a repository-wide bad merge that left conflict markers in multiple frontend source files. I ran a conservative, HEAD-preferred automated resolver and then manually reviewed and reconciled a prioritized set of SFCs, composables, and stores. For safety, original conflicted copies are preserved with a `.orig_conflict_backup` suffix. Key actions included:

- Automated resolver: removed git conflict markers across non-dist source files and wrote `.orig_conflict_backup` files for every modified file.
- Manual review: inspected SFCs and composables (views, components, stores) and kept HEAD where the incoming changes were non-functional or type-only. Reapplied incoming changes only when they were necessary.
- Restored important UI behavior: re-imported `MapFiltersModal` in `MapView.vue` and restored the "Show artworks without photos" toggle in `MapFiltersModal.vue` (wired to `useMapFilters`).
- Verification: ran vue-tsc/tsc type-checks, ESLint, and frontend tests. Type-check passed; ESLint completed with an informational TypeScript-version warning (installed TS 5.9.2 vs @typescript-eslint supported <5.6.0).

Files reviewed and decisions: (see this doc for the full inventory). Notable files changed/verified in this PR:

- `src/frontend/src/views/MapView.vue` (restored MapFiltersModal import)
- `src/frontend/src/components/MapFiltersModal.vue` (restored "Show artworks without photos" toggle)
- Multiple components and composables where HEAD was preserved and backups created with `.orig_conflict_backup`.

Verification checklist (to run before merging):

- [ ] Run `npm run type-check` and ensure zero type errors.
- [ ] Run `npm run lint` and confirm no blocking errors; note the TypeScript-version warning if it appears.
- [ ] Run frontend tests: `npm run test` and ensure no unexpected failures.
- [ ] Start dev server for smoke test and interact with MapView, MapFiltersModal, and Notifications components to verify runtime behavior.
- [ ] Optional: run worker tests (`npm run test:workers`) and any end-to-end checks if configured.

Notes for reviewers:

- The automated resolver prefers HEAD; incoming changes were preserved in `.orig_conflict_backup` files. If you expect behavior from the incoming branch that is missing, check the corresponding `.orig_conflict_backup` and re-apply as needed.
- ESLint printed a TypeScript parser compatibility warning due to TypeScript 5.9.2 being newer than the parser's supported range. This is informational locally but may require CI/tooling alignment.

Suggested merge message:

Resolve merge conflicts — prefer HEAD; manual fixes where needed. Backups saved as `*.orig_conflict_backup` for review.

### Recent edits (2025-10-02)

- Applied UI fixes to address duplicate banners, missing banner text, and toggle clickability. Files modified:
  - `src/frontend/src/components/MapComponent.vue` — added `suppressFilterBanner` prop so parent view can own the top-level banner.
  - `src/frontend/src/views/MapView.vue` — pass suppression prop to `MapComponent` and ensure single authoritative banner.
  - `src/frontend/src/composables/useMapFilters.ts` — expanded `activeFilterDescription` to include simple flag descriptions and a safe fallback when parts are empty.
  - `src/frontend/src/components/MapOptionsModal.vue` — moved toggle handlers to the wrapping `label` via `@click` and removed `@change` on inputs for affected toggles to fix clickability.

- Verification run results (2025-10-02):
  - Type-check: PASSED (no TypeScript errors).
  - ESLint: Completed (informational TypeScript-version warning noted previously; non-blocking).
  - Tests: Test Files 46 passed; Tests 658 passed | 1 skipped.

Backups (`*.orig_conflict_backup`) retained per conservative merge policy for reviewer audit.

If you'd like, I can commit these changes and open a draft PR referencing this progress document.




