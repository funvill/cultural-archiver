# BUG: Loved Chip Not Filled After Toggle (Backend Membership State)

## Problem Summary
- When a user clicks the "Loved" heart chip on the artwork details page, the UI does not show the filled (active) state after the API call completes.
- The backend `/api/artwork/:id/membership` endpoint always returns `loved: false` after toggling, even though the toggle API call succeeds.
- This results in the heart chip never appearing filled, even after a successful add-to-loved action.

## Investigation & Debugging
- Frontend optimistic UI works, but is immediately reverted after the backend response.
- Debug logs in the frontend confirm the backend always returns `{ loved: false, ... }` after toggling.
- Backend debug logging was added to `getArtworkMembership` in `src/workers/routes/artwork.ts` to log:
  - Incoming user/artwork IDs
  - Membership query results
  - Final membership object
- The backend membership query uses display names (e.g., 'Loved') and maps them to API keys ('loved').
- The toggle endpoint (`/api/artwork/:id/lists/:listType`) uses the correct display names and successfully inserts into the DB.
- However, after toggling, the membership query still returns `is_member: 0` for 'Loved'.
- No TypeScript errors remain; all code builds and tests pass except for one unrelated frontend test.

## Hypotheses
- The `lists` or `list_items` table may not be updating as expected, or the membership query is not matching the new row.
- There may be a transaction/commit delay, or the dev DB is not persisting changes between requests.
- The query may be using the wrong user ID, artwork ID, or list name.
- There could be a caching or state mismatch between the toggle and membership endpoints.

## Next Steps
1. **Directly Inspect DB State**
   - Query the `lists` and `list_items` tables after toggling to confirm the row is present for the user/artwork/list.
   - Check that the `owner_user_id`, `name`, and `is_system_list` fields match the membership query.
2. **Log All Query Inputs**
   - Log the exact values bound to the membership query: userToken, artworkId, and list name.
   - Log the output of the membership query immediately before mapping.
3. **Check for Caching/Transaction Issues**
   - Ensure the DB commit is complete before the membership query runs.
   - Try adding a short delay or forcing a DB sync if using an in-memory DB.
4. **Manual API Test**
   - Use a REST client to POST to `/api/artwork/:id/lists/loved` and then GET `/api/artwork/:id/membership` for the same user/artwork.
   - Confirm if the bug is reproducible outside the UI.
5. **Review DB Schema**
   - Double-check the schema in `/docs/database.md` to ensure the queries match the table structure.

## Owner
- Handoff by: GitHub Copilot (AI)
- Last attempted fix: 2025-09-27
- See `src/workers/routes/artwork.ts` for all backend logic and debug logs.

## Status
- **Unresolved**: Backend always returns `loved: false` after toggle, despite successful DB insert.
- **Blocked**: Needs DB state inspection and deeper backend debugging.

---

**Contact:** support@api.publicartregistry.com
