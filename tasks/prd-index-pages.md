# PRD: Index pages for Artwork and Artists

### Purpose

Create two index pages that list all artworks and all artists as card grids with pagination. These pages act like full result listings (not filtered search) and provide quick access to item detail pages.

### Scope

- Frontend routes: `/artwork` and `/artist` (artist detail pages are NOT required for initial delivery; see Implementation notes)
- Display: 30 card items per page by default, pagination controls at top and bottom, plus a page-size selector (10 / 30 / 50)
- Sorting: default by last updated (most recent first)
- Search: search bar at the top that navigates to the main search page
- Card click behaviour: artwork cards link to `/artwork/:id`; artist cards link to a filtered search results view for that artist (artist detail pages may be introduced later)

### Requirements checklist

- [ ] `/artwork` index page showing artworks (default 30 per page; user-selectable 10/30/50)
- [ ] `/artist` index page showing artists (default 30 per page)
- [ ] Pagination controls at top and bottom with next/previous and page number
- [ ] Page-size selector (10 / 30 / 50) visible near pagination controls
- [ ] Artwork cards clickable to detail pages; artist cards link to filtered search results
- [ ] Default sort by last updated (desc)
- [ ] Search bar at top that opens the search page (preserve entered query)
- [ ] Basic accessibility: keyboard navigable, semantic markup, alt text (improvements planned)
- [ ] Unit + visual tests for layout, pagination, and navigation

### User stories

- As a visitor, I can browse recent artworks in a paged grid so I can find items by recency.
- As a visitor, I can browse artists in a paged grid so I can explore creators.
- As a visitor, I can quickly search from the index page using the search bar.
- As a returning user, I can use pagination to navigate to later pages of results.


### UX / UI details

- Layout: responsive grid of cards (mobile: 1–2 columns; tablet: 2–3; desktop: 3–6 depending on screen width).
- Cards: thumbnail image (if available), title/name, short subtitle (artist for artwork, location or summary), and last-updated timestamp.
- Click behavior: clicking the card navigates to `/artwork/:id`; artist cards navigate to a filtered `/search?artist=<name>` results page for the moment (artist detail pages can be added in a later sprint).
- Pagination: numeric pages, previous/next arrows, and a compact display when there are many pages (e.g. 1 ... 5 6 7 ... 20). Controls appear above and below the grid.
- Search bar: visible at the top of each index page. Typing a query + submit navigates to `/search?q=...` and preserves the query in the search input.
- Page-size selector: a small dropdown near the pagination controls that allows choosing 10 / 30 / 50 items per page (default 30).
- Empty state: friendly message and CTA to submit new artwork or add artist data.

- Pagination URL style: use query parameters for paging and sizing (example: `/artwork?page=2&limit=30`).


### Data contract (frontend ↔ backend)

Request parameters (GET):

- page: integer (default 1)
- limit: integer (default 30, allowed 10/30/50 for UI; backend accepts other values but may cap to max 100)
- sort: string (default `updated_desc`)

Note: pagination and sizing are encoded in query params (e.g. `?page=2&limit=30`).

Artwork API response shape (JSON):
{
  total: number,
  page: number,
  limit: number,
  items: [
    {
      id: string,
      title: string,
      thumbnailUrl?: string,
      primaryArtist?: string,
      updatedAt: string,
      summary?: string
    }
  ]
}

Artist API response shape (JSON): similar structure with artist fields: id, name, avatarUrl, updatedAt, shortBio

Suggested backend strategy:

- Reuse the existing search endpoint with explicit type and pagination parameters. This avoids adding duplicate endpoints and keeps filtering consistent.

- Examples:

- GET /api/search?type=artwork&limit=30&page=1&sort=updated_desc
- GET /api/search?type=artist&limit=30&page=1&sort=updated_desc

If the search endpoint cannot be extended or performance requires it, add dedicated optimized index endpoints later.

### Sorting and consistency

- Use `updatedAt` (or `last_modified`) as the sort key. Ensure it's updated whenever a record or its related data (photos, tags) changes.
- Pagination must be stable between requests for the same dataset (avoid inconsistent order when ties exist — include `id` as a deterministic tiebreaker).

### Rendering & SEO

- For this feature we will not add special server-side rendering or pre-rendering for SEO in the initial delivery. Pages will be client-rendered and SEO improvements (pre-render or SSR of first page) may be added later if analytics show it is needed.

### Edge cases & constraints

- Fewer than 30 items: show available items and hide or disable forward controls.
- No items: show empty state with CTA.
- Very large page numbers: cap pages to `ceil(total/limit)` and validate `page` param.
- Photos missing: show a neutral placeholder thumbnail.
- Performance: use indexed queries and limit fields returned (avoid full tag JSON unless needed).

### Accessibility

- Implement basic accessibility for MVP: cards focusable, clear link text, images with alt text, and keyboard-operable pagination controls. Label controls for screen readers.
- Focus management after pagination: no programmatic focus move — rely on browser default and native scrolling behaviors. A future accessibility pass may implement explicit focus handling.
- Plan a later pass to reach WCAG 2.1 AA conformance (color contrast, ARIA refinement, extended keyboard flows) as a follow-up task.

### Testing

- Unit tests (Vitest): render each index page, verify page-size selector, verify 10/30/50 behavior, verify pagination UI, and verify clicking a card navigates to details or search.
- Integration tests (playwright/Vitest): simulate API pages, test search bar navigation, and test empty state.
- Visual snapshot tests are not required for this feature (no visual snapshot gating in CI).

### Metrics & monitoring

- Track page views for `/artwork` and `/artist`.
- Track clicks on cards and use of pagination (next/prev) and search bar submits.
- Error monitoring: log frontend JS errors and API errors; do not create automated alerting for index page error rates in the initial rollout (errors are retained in logs for on-demand review).

### Performance, caching & rate limits

- Thumbnail images: serve optimized ~400px wide thumbnails for card displays (balance of quality and bandwidth).
- Image loading: lazy-load off-screen card images and prioritize (preload) above-the-fold thumbnails for the first viewport.
- Cache strategy: no CDN caching for index API responses in initial delivery (always fetch from origin). If performance needs arise, we can introduce a CDN caching layer with TTL and stale-while-revalidate.
- API rate limiting: follow standard public read-rate limits for search/index endpoints (e.g., 60 requests/min per client). Write operations remain more strictly limited.

### Rollout plan

- Deploy directly to production after passing staging QA (no feature flag). Ensure thorough staging and visual tests before merging.
- Because this will be enabled in production immediately, prioritize a short smoke-test checklist and quick rollback plan.

### Implementation notes / dev tasks

1. Create Vue pages: `src/frontend/src/views/ArtworkIndexView.vue` and `ArtistIndexView.vue` (or adapt existing search results component to act as full index). Artist index should link to filtered search results for the artist until dedicated artist detail pages are implemented.
2. Reuse card component (`Card` or `ArtworkCard`) and pagination component. If not present, create a `PaginatedGrid` wrapper.
3. Wire API calls to the search endpoint: `/api/search?type=artwork` and `/api/search?type=artist`, passing `limit`, `page`, and `sort` parameters. Respect backend caps.
4. Add UI for page-size selector (10/30/50) and persist selection in URL (e.g. `?limit=30`).
5. Add tests: unit + e2e + visual snapshots.
6. Add follow-up task to introduce artist detail pages (route, data model, and templates) in a later sprint.

### Acceptance criteria (how QA will verify)

- Visiting `/artwork` shows up to 30 artwork cards by default, sorted by last updated (most recent first). Changing the page-size selector updates the list (10 / 30 / 50).
- Visiting `/artist` shows up to 30 artist cards by default. Clicking an artist card opens a filtered `/search?artist=...` results page.
- Pagination controls appear above and below the grid and correctly navigate pages.
- Search bar at top navigates to `/search?q=...` preserving the query.
- Artwork cards navigate to their detail pages when clicked.
- Basic accessibility present: keyboard navigation, semantic markup, images with alt text.

---

Files to add/edit when implementing:

- Frontend: `src/frontend/src/views/ArtworkIndexView.vue`, `ArtistIndexView.vue`, possible `PaginatedGrid` component and unit tests under `src/frontend/src/test`.
- Backend (if endpoints missing): add handlers in `src/workers/routes/` for `/api/artwork` and `/api/artist` with pagination and sorting.

Requirements coverage mapping:

- `/artwork` and `/artist` pages: Specified above — Done (in PRD)
- 30 items per page with pagination top and bottom: Specified above — Done
- Page-size selector (10/30/50): Specified above — Done
- Cards clickable to details / search results: Specified above — Done
- Sorted by last updated: Specified above — Done
- Search bar leading to search page: Specified above — Done

