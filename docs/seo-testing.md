SEO testing
===========

This document explains how to run the SEO-related tests for the project and the difference between the unit and integration tests used for metadata and sitemap verification.

Unit tests (fast, local)
------------------------

- Location: `src/frontend/src/test/seo.meta.unit.spec.ts`
- Purpose: Verifies that our composable (`useRouteMeta`) calls the head manager (`useHead`) with the expected title, description, canonical, and JSON-LD payloads.
- How to run:

  1. From the repository root run the frontend test task (this runs Vitest in the frontend workspace):

     ```powershell
     cd src/frontend; npm run test
     ```

  2. The unit test uses `vi.mock('@vueuse/head')` to intercept `useHead` calls so it does not rely on jsdom DOM mutation timing. Prefer unit tests for fast feedback.

Integration tests (requires a running dev server)
------------------------------------------------

- Location: `src/test/seo.meta.spec.ts` (project-level test folder)
- Purpose: Fetches rendered HTML from a running dev server to validate meta tags, OpenGraph tags, and JSON-LD output from server-rendered pages. These tests exercise the full app stack and can catch issues unit tests miss.
- How to run:

  1. Start the dev server in the project root. The project has a special dev command that writes logs to `dev-server-logs.txt`. Use the devout variant when you want logs:

     ```powershell
     npm run devout
     ```

  2. Wait for the server to be available (default dev server port used by integration tests is 8787). Then run the integration test(s):

     ```powershell
     npm run test
     ```

  3. If you prefer to run just the integration tests, run the test file directly with Vitest from the repo root or adapt the task to run only the test(s) you need.

Notes about sitemap host differences
----------------------------------

- Implementation detail: The sitemap index points to the API-hosted sitemap files by default (`https://api.publicartregistry.com`). This is intentional because the backend worker exposes sitemap endpoints on the API domain.
- Unit tests were updated to match this behavior. If you need the sitemap index to point at a different host in tests, pass a `sitemapHost` value to `generateSitemapIndex(baseUrl, sitemapHost)` in tests or update environment variables used by the route handler.

Debugging tips
--------------

- If a head/meta unit test fails, prefer mocking `@vueuse/head` (as the tests do) and assert the calls instead of inspecting `document.head` which can be flaky in jsdom.
- Use `npm run build:frontend` after making meta/head changes to validate the build-time behavior and catch any type errors via `vue-tsc`.

If you want, I can also add a small CI job sample that runs the SEO unit tests and optionally spins up the dev server for integration tests.
