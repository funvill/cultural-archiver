# Plan: Add "Submissions" system list and map UI behavior

## Status: ✅ COMPLETED

## Goal

Add a new special system list called "Submissions". This list contains all of the artworks that a user has created a submission for. Artworks are automatically added to this list when a user submits a new submission.

## Requirements

- Create a `Submissions` entry in the project's system list constants.
- Ensure the backend will auto-create the system list if missing (the lists route already auto-creates system lists from the shared constants).
- When a user creates a submission that references an artwork (e.g., submitting a logbook entry tied to an artwork), the artwork should be added to the user's `Submissions` system list. The addition should be recorded with `added_by_user_id` set to the submitting user's token (user_token) so the user's ownership of the submission is tracked.
- When a moderator approves a new_artwork submission, the created artwork should be added to the user's `Submissions` system list.
- On the frontend map, artworks that are in the `Submissions` list for the current user should show a checkbox (same as `Visited`) but with a green background instead of gray.

## Implementation steps

1. ✅ Add `SUBMISSIONS: 'Submissions'` to `SPECIAL_LIST_NAMES` in `src/shared/types.ts`.
2. ✅ Confirm `src/workers/routes/lists.ts` reads `SPECIAL_LIST_NAMES` and auto-creates system lists (it already does). No further change required for creation.
3. ✅ Update submission handlers to automatically add artworks to Submissions list:
   - ✅ `src/workers/routes/submissions.ts` - Logbook entries that reference existing artwork
   - ✅ `src/workers/routes/submissions-new.ts` - Unified submission handler for logbook entries
   - ✅ `src/workers/routes/review.ts` - New artwork approval flow (both create_new and link_existing actions)
   - Uses `INSERT OR IGNORE` for idempotent insertion
   - Sets `added_by_user_id` to the submitting user's token (user_token)
   - Non-blocking try/catch ensures submission creation isn't affected by list errors
4. ✅ Update frontend map rendering:
   - ✅ `src/frontend/src/composables/useUserLists.ts` - Added submissionsArtworks computed and extended list operations
   - ✅ `src/frontend/src/utils/iconAtlas.ts` - Added green submissions icon with checkmark
   - ✅ `src/frontend/src/components/MapComponent.vue` - Added submissions flag to WebGL cluster data
   - ✅ `src/frontend/src/components/MapWebGLLayer.vue` - Added green background color [16, 185, 129] for submissions markers
5. ✅ Validation:
   - ✅ Workers tests: 663 passed, 1 skipped (all passing)
   - ✅ Frontend build: Completed successfully in 11.67s

## Edge cases and notes

- ✅ A submission may not reference an artwork — handled, only submissions with artwork_id trigger list addition.
- ✅ A user may submit multiple submissions for the same artwork — handled via `INSERT OR IGNORE` for idempotent insertion.
- ✅ System list additions use `user_token` for `added_by_user_id` to track submitter ownership.
- ✅ Database migrations not required (reusing existing `is_system_list` mechanism).
- ✅ New artwork submissions: Auto-add happens during moderator approval when artwork is created.
- ✅ Linked existing artwork: Auto-add happens during moderator approval when linking to existing artwork.

## Follow-ups

- Add a small UI affordance on the user's profile page listing artworks with submissions.
- Allow users to toggle the submission flag on an artwork from map or artwork detail view.

## Acceptance criteria

- ✅ `SPECIAL_LIST_NAMES` includes `Submissions`.
- ✅ Backend auto-creates `Submissions` system list if missing.
- ✅ When a submission references an artwork, that artwork appears in the user's `Submissions` list.
- ✅ When a moderator approves a new_artwork submission, the created artwork appears in the submitter's `Submissions` list.
- ✅ When a moderator links a submission to an existing artwork, that artwork appears in the submitter's `Submissions` list.
- ✅ Map shows a checkbox for artworks in `Submissions` with a green background.

## Implementation Summary

### Backend Changes

1. **Type Definitions** (`src/shared/types.ts`):
   - Added `SUBMISSIONS: 'Submissions'` to `SPECIAL_LIST_NAMES` constant

2. **Submission Handlers**:
   - **`src/workers/routes/submissions.ts`** (lines ~217-238): Auto-add for logbook entries referencing existing artwork
   - **`src/workers/routes/submissions-new.ts`** (lines ~191-220): Auto-add for unified submission handler logbook entries
   - **`src/workers/routes/review.ts`** (lines ~507-541, ~617-651): Auto-add during moderator approval for both create_new and link_existing actions

   Pattern used:

   ```typescript
   // Get or create Submissions system list
   const existingList = await db.prepare(
     'SELECT id FROM lists WHERE owner_user_id = ? AND name = ? AND is_system_list = 1'
   ).bind(userToken, 'Submissions').first();
   
   // Insert artwork into list (idempotent)
   await db.prepare(
     'INSERT OR IGNORE INTO list_items (id, list_id, artwork_id, added_by_user_id, created_at) VALUES (?, ?, ?, ?, datetime("now"))'
   ).bind(crypto.randomUUID(), listId, artworkId, userToken).run();
   ```

### Frontend Changes

1. **User Lists Composable** (`src/frontend/src/composables/useUserLists.ts`):
   - Added `submissionsArtworks` computed property (lines ~76-86)
   - Extended `isArtworkInList`, `addToList`, `removeFromList` to handle 'submissions' type
   - Added 'submissions': 'Submissions' to listNames mapping

2. **Icon Atlas** (`src/frontend/src/utils/iconAtlas.ts`):
   - Added green submissions icon with checkmark (line ~219)
   - Uses green-500 color (#10B981) for circle fill

3. **Map Components**:
   - **`MapComponent.vue`** (line ~297): Added submissions flag to WebGL cluster point properties
   - **`MapWebGLLayer.vue`** (lines ~156, ~368, ~382):
     - Added green-500 color [16, 185, 129] in getFillColor for submissions markers
     - Included submissions in marker data filter and icon names array

### Test Results

- **Workers Tests**: 47 test files, 663 tests passed, 1 skipped
- **Frontend Build**: Successfully completed in 11.67s
- All TypeScript type checking passed
