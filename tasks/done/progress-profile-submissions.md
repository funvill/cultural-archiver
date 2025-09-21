---
name: "Fix profile submissions fetch error"
created: 2025-Sep-19
updated: 2025-Sep-19
owner: AI Agent (Copilot)
source: .github/prompts/WithMem.prompt.md
---

# Progress: Fix profile submissions fetch error

Purpose: Resolve the 404 error on the profile page caused by a mismatch between frontend and backend endpoints, and document progress for seamless handoff.

## Tasks

- [X] Inspect frontend profile calls
  - Located `src/frontend/src/services/api.ts` and `src/frontend/src/views/ProfileView.vue`.
  - Found `getUserSubmissions()` calling `/user/submissions`.
- [X] Verify backend submissions route
  - Confirmed backend registers `GET /api/me/submissions` in `src/workers/index.ts`.
  - Handler provided by `getUserSubmissions` in user routes with proper middlewares.
- [X] Align frontend endpoint path
  - Updated `apiService.getUserSubmissions()` to call `/me/submissions`.
  - File: `src/frontend/src/services/api.ts`.
- [X] Run tests and build
  - Frontend tests: PASS (0 tests discovered, no failures).
  - Workers tests: PASS (0 tests discovered, no failures).
  - Frontend build: PASS (vue-tsc + vite build completed without errors).
- [ ] Manual verify in browser
  - Reload `http://localhost:5173/profile`. Expect submissions to load without the "Failed to fetch user submissions." error.
- [ ] Close task and archive notes

## Summary of Work Completed

Root cause was a path mismatch. Frontend used `/user/submissions` while backend exposes `/me/submissions`. Updated the frontend API service to use the correct route. Build and tests completed successfully. Browser verification pending.

## Validation Notes

- Token handling: The `ApiClient` automatically attaches and refreshes `X-User-Token`. No changes required.
- Error handling: No change. Profile page should now receive a 200 response and render submissions.

## Handoff Notes

- If you still see an error on the profile page, check the network tab for the exact request path. It should be `GET /api/me/submissions`.
- Ensure the dev servers are running via `npm run dev` in the project root to proxy frontend to backend.
- Server logs: `dev-server-logs.txt` may have context if backend errors occur.

## Files Touched

- `src/frontend/src/services/api.ts` — changed `/user/submissions` to `/me/submissions`.

