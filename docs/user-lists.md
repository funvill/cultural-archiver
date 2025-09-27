# User Lists

This document describes the MVP implementation of user-managed lists: named collections of artworks that users can create, manage, and share.

## Purpose

Allow users to save, organize and share collections of artworks (for travel planning, personal collections, research, etc.). Lists are lightweight, ordered collections with stable, shareable links.

## Goals

- Make it simple to save artworks to named lists from artwork pages.
- Provide stable URLs and filters so lists can be used in Search and Map views.
- Surface lists on the user's profile and allow basic management (create, add/remove, delete).

## Key concepts

- Owner: the user who created the list.
- Visibility: lists are unlisted by default (public to anyone with the link). The MVP does not index lists.
- Reserved lists: every user gets a few special lists ("Want to see", "Have seen", "Loved", and a system-managed read-only "Validated").
- Limits: lists are capped at 1,000 items to protect UI and backend performance.

## User stories (high level)

1. Logged-in users can create named lists (max 255 characters).
2. Owners can add/remove artworks to/from their lists through the artwork detail UI.
3. Visitors with a list URL can view it.
4. Lists can be used as filters in Search and Map views via a stable query parameter.

## Data model

Suggested tables (SQLite / D1 friendly):

- lists
  - id (UUID)
  - owner_user_id (UUID)
  - name (TEXT, maxlength 255)
  - visibility (TEXT, default 'unlisted')
  - is_readonly (BOOLEAN, default false)
  - created_at (DATETIME)
  - updated_at (DATETIME)

- list_items
  - id (UUID)
  - list_id (FK -> lists.id)
  - artwork_id (FK -> artworks.id)
  - added_by_user_id (UUID) -- nullable for system additions
  - created_at (DATETIME)
  - UNIQUE(list_id, artwork_id)

Notes:

- Use TEXT for JSON-like fields and REAL for lat/lon if needed elsewhere. Keep D1/SQLite compatibility in mind.

- Enforce the 1,000 item limit at the application layer and return a clear error when exceeded.

## API endpoints (MVP)

These are suggested endpoints and should be implemented on the API worker at `/routes`.

- POST /api/lists
  - Create a new list. Body: { name: string }
  - Auth required. Validate name length <= 255.
  - Response: 201 Created with list metadata.

- GET /api/lists/:id
  - Fetch list metadata and items (paginated). Public access for unlisted lists.
  - Query params: page, pageSize (default pageSize e.g. 50)

- GET /api/users/:userId/lists
  - Return lists owned by a user. Auth required if requesting private lists.

- POST /api/lists/:id/items
  - Add an artwork to a list. Body: { artworkId: UUID }
  - Only owner (or admins) can add. No-op if already present. Validate list size limit.
  - Response: 200 OK or 409 Conflict / 400 Bad Request when appropriate.

- DELETE /api/lists/:id/items
  - Remove one or more artworks. Body: { artworkIds: [UUID] }
  - Only owner (or admins) can remove.

- DELETE /api/lists/:id
  - Delete the list. Only owner (or admins) may delete. Reserved lists cannot be deleted.

Notes on errors and status codes:

- 400 Bad Request: invalid input (name too long, missing artworkId, etc.)

- 403 Forbidden: attempt to modify another user's list, or delete a reserved list

- 404 Not Found: unknown list

- 409 Conflict: list is full or duplicate add attempt (duplicate adds should be no-op but may return 200)

### Example API requests

- Create a list (authenticated):

  POST /api/lists

  Body: { "name": "NY trip 2025" }

  Response: 201 Created

- Add an artwork to a list (authenticated owner):

  POST /api/lists/:id/items

  Request body (JSON):

  ```json
  { "artworkId": "ARTWORK_UUID" }
  ```

  Response: 200 OK (or 409 if list is full)

- Get list with pagination (public):

  GET /api/lists/:id?page=1&pageSize=50

  Response: 200 OK

  ```json
  {
    "id": "...",
    "name": "NY trip 2025",
    "items": [ { "artworkId": "...", "addedAt": "..." }, ... ],
    "page": 1,
    "pageSize": 50,
    "totalItems": 123
  }
  ```

Notes on pagination:

- Default pageSize should be 50 for list pages and map filters. The API must return totalItems to support client-side pagination controls.
- Map requests that filter by list should accept page/pageSize but may also accept a special `all=true` for server-side cached popular lists (implement cautiously).

## URL patterns and filters

- Public list page: /lists/{listId}
- Search filter param: ?list={listId}
- Search query token: list:{listId}
- Map view accepts the same ?list={listId} parameter and limits pins to the list membership

When the map or search is filtered by a list, the UI should show a non-dismissible message or badge indicating the active filter.

## UI flows

- Add from artwork detail
  - A bookmark/menu button opens a dialog to select an existing list or create a new one.
  - Creating a reserved list (e.g. "Want to see") should create that reserved list for the user the first time they add to it.

- List view
  - Responsive grid of artworks with pagination (page size ~50).
  - Owners see controls to remove artworks (single and bulk removal).
  - No renaming in MVP; lists are deleted to remove them.

- Map filter
  - Map shows a small message when filtered. Pins limited to artworks in the list.

## Permissions

- Only list owner (or admins) may add/remove items and delete the list.
- Reserved lists ("Want to see", "Have seen", "Loved") are created on demand and cannot be deleted.
- The "Validated" list is system-managed, private, and read-only: users cannot add/remove items manually and it cannot be deleted.

## Edge cases and error handling

- Duplicate add: no-op; API may return 200 OK.
- Attempt to modify another user's list: 403 Forbidden.
- Deleting reserved list: 403 Forbidden.
- Navigating to deleted/unknown list: return 404 and show an appropriate UI.
- If an artwork is later deleted from the system, it should render in lists as "Artwork no longer available".

## Limits and performance

- Max items per list: 1,000. Enforce at API level.
- Paginate list items (default page size 50) for list pages and map filters.
- Consider caching popular lists for map rendering.

## Telemetry

- Events to track: list_created, list_deleted, list_item_added, list_item_removed, list_viewed
- Useful metrics: average items per list, distribution of list sizes, number of public sharings

## Acceptance criteria

1. A logged-in user can create a list with a name (<=255 chars) and see it in their profile.
2. The user can add and remove artworks to/from their lists via the artwork detail UI.
3. List pages are publicly accessible and list membership can be used as a search and map filter via a stable parameter.
4. Reserved lists exist for every user and behave as described (non-deletable; "Validated" is read-only).
5. The system enforces a 1,000-item limit per list and returns clear errors when exceeded.

## Future enhancements

- Rename lists
- Private lists and share tokens
- Item reordering and notes
- Import/export (CSV/JSON)
- Social features: follow public lists, like, comments

## Implementation notes

- Follow existing project patterns for routes and D1 usage. Place endpoints under `src/workers/routes` and shared types under `src/shared`.
- Use UUIDs and Zod schemas for validation consistent with the codebase.
- Add migrations to `src/workers/migrations` if adding new tables; name files with the next sequential number.
- When possible, add tests (workers tests with Miniflare) for the API endpoints: create, add item, remove item, get list, delete.

---

Document curated from `tasks/prd-user-lists.md`.
