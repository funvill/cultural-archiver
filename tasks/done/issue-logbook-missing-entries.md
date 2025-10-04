# GitHub Issue: Logbook entries not created for approved artwork edits in production

## Summary

When artwork edits are approved via the moderation queue in production, the edit is applied to the artwork record but a corresponding `logbook` entry is not always created. Unit tests and local/test runs show the fix works (logbook entry created), but production still shows missing entries in the Community Journal.

## Environment

- Repository: cultural-archiver
- Branch: copilot/fix-35
- Production API: https://api.publicartregistry.com/api
- User used for repro: 6c970b24-f64a-49d9-8c5f-8ae23cc2af47 (reviewer)
- Date recorded: 2025-09-05

## What we are seeing

- Approving artwork edits via `/review/artwork-edits/:editId/approve` updates the artwork (title changed), and the moderation UI reports "Artwork edit approved successfully".
- The artwork details endpoint (`GET /api/artworks/:id`) returns the updated artwork but the `logbook_entries` array does not contain a new entry for the approved edit.
- Frontend shows "Showing 1 journal entries. All entries loaded." despite multiple approvals.
- Unit tests (vitest) pass verifying that the logbook entry is created in the test environment.

## What we expect to see

- Every approved artwork edit results in a logbook entry—visible from `GET /api/artworks/:id` under `logbook_entries` and displayed in the Community Journal.
- Logbook note should include which fields were applied vs. unapplied and user attribution.

## Steps to reproduce

1. Login as reviewer (token: `6c970b24-f64a-49d9-8c5f-8ae23cc2af47`) on production UI `https://api.publicartregistry.com`.
2. Navigate to an artwork details page (example artwork id: `79e3ab63-2d75-401e-98f8-9c3aa6d001f7`).
3. Submit an artwork edit (change title or description). This creates an artwork edit submission.
4. Go to `/review` → `Artwork Edits` tab, find the pending edit, click `Approve`.
5. Observe moderation UI success and artwork title updated.
6. Call `GET https://api.publicartregistry.com/api/artworks/<id>` and inspect `data.logbook_entries` — no new entry for the approval.

(Optionally reproduce programmatically with Playwright scripts used by our MCP run.)

## Logs & Evidence

- Frontend console logs show:
  - "Artwork edit approved successfully"
  - "Artwork data refreshed after approval"
- Backend test output: specific unit test `should create logbook entry even when no fields are applied` passes locally and in CI.
- Current production response for artwork shows only the original logbook entry (from yesterday) and not the approvals performed during testing.

## Likely causes / hypotheses

- Database transaction around applying edits and creating the logbook entry is being rolled back in production (e.g. constraints, exception, or commit not happening).
- Silent error during logbook insert in production (error swallowed or not logged at sufficient level).
- Race condition where the artwork update commits but the logbook insert fails or executes in a separate transaction not committed.
- Production D1 database or schema difference (constraints / column names / triggers) preventing insertion.
- Environment/config difference (e.g. env.LOG_LEVEL, D1 behaviour, permissions) between test and production.

## Plan to test and fix

1. Add targeted debug logging (warn/error) around logbook creation in `src/workers/lib/artwork-edits.ts`:
   - Log payload sent to DB, query result, and catch+log any exception with full stack in production logs.
2. Add instrumentation to log the DB transaction lifecycle (begin/commit/rollback) in production (or return errors to caller when present).
3. Verify D1 schema in production: run a quick schema check to ensure `logbook` table exists and columns match expected types and NOT NULL constraints.
4. Re-run E2E reproduction on production (Playwright MCP): submit edit → approve in review UI → inspect `GET /api/artworks/:id` and DB `logbook` table directly.
5. If errors logged show constraint violations, update migration to fix schema and run migration in production after maintenance window.
6. If silent exception found, fix code path to surface errors and ensure logbook insert is executed outside/inside the proper transaction as intended.
7. Add integration test that mirrors the failing production flow (end-to-end, using a real D1 instance or a staging D1 replica) to assert logbook entry is created after approval.
8. Deploy change to staging first, run automated tests and Playwright flow, then deploy to production.

## How to test the fix (detailed)

- Unit / Integration:
  - Run the existing vitest that checks logbook creation: `npx vitest run -t "should create logbook entry even when no fields are applied"` (already green)
- Staging / Production validation (manual + automated):
  1. On staging/prod, submit an artwork edit and approve it.
  2. Confirm the moderation UI shows success.
  3. Call `GET /api/artworks/:id` and assert `logbook_entries[0].note` contains expected note and timestamp within last 1 minute.
  4. Query DB directly (D1) `SELECT * FROM logbook WHERE artwork_id = '<id>' ORDER BY created_at DESC LIMIT 5` and assert the latest record matches the approved edit.
  5. Check backend logs for explicit success message from logbook insert, or any error.

## Rollback / mitigation plan

- If a migration is required and causes issues, rollback migration and re-deploy previous worker to restore known-good behaviour.

## What success looks like

- After approval of an artwork edit (test flow), `GET /api/artworks/:id` contains a new `logbook_entries` item describing the approval within 1 minute.
- The Community Journal UI shows the newly created entry immediately (or within expected cache/refresh window).
- No silent exceptions; backend logs clearly show the logbook insert succeeded (or, if not, show actionable error).
- Integration and E2E tests cover the scenario and remain green.

## Suggested issue labels

- bug
- production
- backend
- database
- needs-investigation

## Assignee / Next steps

- Assign to backend owner or on-call (suggest: @funvill or repo maintainer).
- Prioritize to P1 if production user-facing history is critical.

---

(If you want I can also open this as a real GitHub issue using GitHub issue management tools. Confirm if you want me to create it directly on the repo.)
