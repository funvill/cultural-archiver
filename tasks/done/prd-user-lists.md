# User Lists — Product Requirements Document

## Purpose

Allow users to create, manage, and share named collections of artworks. Lists make it easy to save, organize, and share discoveries (for travel planning, personal collections, research, etc.).

## Goals

- Make it simple and fast for users to save artworks to named lists from artwork pages.
- Provide stable, shareable links to lists that can be used in the Search and Map views as filters.
- Surface a user's lists on their profile and make common operations (create, rename, delete, add/remove artworks) available.

## User stories

1. As a logged-in user I can create a named list so I can group artworks (e.g. "NY trip 2025").
2. As a list owner I can add an artwork to any of my lists from the artwork detail page.
3. As a list owner I can remove an artwork from my list.
4. As a user I can view all my lists from my profile and open a list to see its artworks.
5. As a visitor with a list URL I can view that list (lists are public by default).
6. As a user I can filter Search and Map views to only show artworks from a specific list using a stable URL parameter (e.g. list:{listId}).

## Functional requirements

- Create list: logged-in users can create lists with a name (max 255 chars). Each list is owned by a user.
- Add artwork: list owners can add an artwork to a list they own. Duplicate additions of the same artwork to the same list are no-ops.
- Remove artwork: list owners can remove artworks from lists they own.
- Delete list: list owners can delete their lists. Deleting a list removes its associations but does not delete artworks.
- Visibility: Lists are unlisted by default (anyone with the direct link can view). They are not publicly discoverable or indexed by search engines in the MVP.
- Limits: each list can contain up to 1,000 artworks to avoid unbounded growth and UI performance issues.
- Item Order: Items within a list are ordered chronologically by the date they were added (newest first). No custom sorting or re-ordering is available in the MVP.

### Special lists

- The system provides several reserved lists per user:
  - "Want to see" (user-managed, cannot be deleted)
  - "Have seen" (user-managed, cannot be deleted)
  - "Loved" (user-managed, cannot be deleted)
  - "Validated" (system-managed, **private**, contains artworks the user has contributed photos/submissions to; users cannot add/remove items manually and it cannot be deleted)

### UI flows

- Add from artwork detail: a bookmark/menu button opens a dialog to select existing lists or create a new one. This is the only method for list creation in the MVP.
- List view: shows artworks in a responsive grid. For list owners, it provides controls to remove artworks (including bulk removal). List renaming is not supported in the MVP.
- Map filter: a non-dismissible message in the corner of the map indicates when it is filtered by a list.

### API / URL filters

- Public list page: `/lists/{listId}` (accessible to anyone with the link)
- Search filter: ?list={listId} or search query token `list:{listId}` that filters results to artworks in the list
- Map filter: map view accepts the same parameter and limits displayed pins to list membership

## Data model suggestions

- lists table
  - id (UUID)
  - owner_user_id (UUID)
  - name (TEXT, maxlength 255)
  - `is_public` (BOOLEAN, default true) -> `visibility` (TEXT, default 'unlisted')
  - is_readonly (BOOLEAN, default false) // for system lists like "Validated"
  - created_at, updated_at

- list_items table
  - id (UUID)
  - list_id (FK -> lists.id)
  - artwork_id (FK -> artworks.id)
  - added_by_user_id (UUID) // null for system additions
  - created_at
  - UNIQUE(list_id, artwork_id)

## API endpoints (suggested)

- POST /api/lists — create a list (body: {name})
- GET /api/lists/:id — get list metadata and items (pagination)
- GET /api/users/:userId/lists — list user-owned lists
- POST /api/lists/:id/items — add artwork to list (body: {artworkId})
- DELETE /api/lists/:id/items — remove one or more artworks from a list (body: {artworkIds: [...]})
- DELETE /api/lists/:id — delete list (owner only; block for reserved lists)
- PUT /api/lists/:id — (Future) update list metadata (e.g., name, visibility)

## Permissions and constraints

- Only the list owner (or admins) may add/remove items and delete the list.
- Reserved lists ("Want to see", "Have seen", "Loved") are created for a user the first time they attempt to add an artwork to one. They cannot be deleted.
- The "Validated" list is private and only visible to its owner.
- Enforce list size limits at the API level. If a list is full, this should be indicated in the UI.
- Upon account deletion, user-owned lists are transferred to a system-wide "archive" account.

## Edge cases and error handling

- Adding the same artwork twice is a no-op.
- Attempt to modify another user's list: return 403 Forbidden.
- Deleting a reserved list: return 403 Forbidden.
- Navigating to a deleted/unknown list URL: return a 404 Not Found page.
- API/DB failures: return a detailed error page.
- Offline behavior is not defined in the MVP; UI elements for list management should be disabled when offline.

## Non-functional requirements

- Performance: fetch list pages and map filters quickly; paginate list items (page size e.g. 50).
- Scalability: lists are bounded by the per-list limit; consider caching popular lists for map rendering.
- Security: verify ownership on write operations. No rate limiting will be implemented in the MVP.
- Data Integrity: When an artwork is deleted from the system, it should appear as "Artwork no longer available" in lists.

## Acceptance criteria

1. A logged-in user can create a list with a name (<=255 chars) and see it on their profile.
2. The user can add and remove artworks to/from their lists via the artwork detail page UI.
3. List pages are publicly accessible and list membership can be used as a search and map filter via a stable parameter.
4. Reserved lists exist for every user and behave as described (non-deletable; "Validated" is read-only).
5. The system enforces a 1,000-item limit per list and returns clear errors when exceeded.

## Telemetry and metrics

- Track events: list_created, list_deleted, list_item_added, list_item_removed, list_viewed.
- Metric: average number of items per list, distribution of list sizes.
- The list page will display the total count of items in the list.

## Future enhancements (non-blocking)

- Allow list renaming.
- Allow private lists and shareable access tokens.
- Allow reordering list items and adding notes per item.
- Allow importing/exporting lists (CSV, JSON).
- Social features: follow public lists, like, comment.
- Search engine indexing of public lists.
- Offline support.

## Notes

Keep implementation small and iterative. Start with basic create/read/add/remove/delete flows and reserved lists. Add private lists and sharing controls in a later iteration.
