# Feature Definition: Artwork Type as a Tag

This document outlines the requirements for the "Artwork Type as a Tag" feature based on the clarifying questions answered.

## Initial Feature Description

In the artwork table, the type_id does not need to be part of this table.
Instead use the tag:artwork_type for the artwork type.
Then we can drop the artwork_types table.

The tag:artwork_type should default to "unknown"

The advantage of using the tag:artwork_type is that it can be updated by the users from the normal tag editing.

## 1. Goals & High-Level Vision

* **Primary Goal:** To simplify the database schema and empower users to contribute and edit artwork types.
* **Primary Audience:** The change will benefit all users by allowing freer contributions and developers by simplifying the data model.
* **Migration Strategy:** The production database will be reset. The `database:reset:prod` script will be updated as necessary to reflect the new schema, removing the `artwork_types` table and the `type_id` column from the `artwork` table. No data migration is required.
* **Default Value:** If not provided on submission, the `artwork_type` tag will default to `"unknown"`.
* **Data Consistency:** To prevent inconsistencies (e.g., "Mural" vs. "mural"), the system will use frontend autocomplete suggestions and backend normalization (e.g., to lowercase). This functionality should already be in place for other tags.

## 2. Functional Requirements

* **Display:** The `artwork_type` will be displayed as a regular tag alongside other tags in the artwork details view.
* **Map Filtering:** The map's filter options will be dynamically populated with all unique `artwork_type` values from the database.
* **Permissions:** Any authenticated user can suggest an edit to the `artwork_type` tag, which will go into the standard moderation queue for approval.
* **Search:** The tag will be searchable using the `artwork_type:value` syntax on the main search page.
* **Mass Import:** All mass import scripts must be updated to map source data to the new `artwork_type` tag.

## 3. Non-Goals and Technical Considerations

* **Out of Scope:** This feature will not include a new, separate UI for managing `artwork_type` tags or an admin-only interface for canonical types. The existing tag management UI will be used.
* **Technical Risks:** The primary risks are ensuring all code paths that previously referenced `type_id` are updated to use the new tag system, and ensuring the database reset script functions correctly with the new schema.
* **Schema Deprecation:** The `type_id` property will be removed from the `ArtworkRecord` interface in `src/shared/types.ts`, and all related database functions and Zod schemas will be updated accordingly.
* **Test Impact:** Existing tests for artwork creation, retrieval, updating, and filtering will require updates to reflect the new data structure.
* **Database Indexing:** A new JSON index on `json_extract(tags, '$.artwork_type')` should be investigated after the initial implementation to ensure query performance.
