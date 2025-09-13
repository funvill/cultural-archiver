# PRD: Replace `artwork.type_id` with `artwork_type` Tag

**Author:**- **Risk:** Potentially slower query performance when filtering by artwork type due to the required JOIN on the `tags` table.
  - **Mitigation:** Ensure that the `tags` table is properly indexed on `artwork_id`, `label`, and `value` to allow for efficient queries.itHub Copilot
**Date:** 2025-09-11
**Status:** Ready for Implementation

## 1. Background

The current database schema uses a dedicated `artwork_types` table and a `type_id` foreign key in the `artwork` table to classify artworks. This approach is rigid and requires schema modifications to introduce new artwork types. For a community-driven, crowdsourced platform, this system is too restrictive. It prevents users from contributing to or correcting the categorization of art, which is a core goal of the project.

This proposal outlines the transition from the current relational model for artwork types to a more flexible, tag-based system.

## 2. Proposal

We will deprecate and remove the `artwork_types` table and the `type_id` column from the `artwork` table. The artwork's type will be stored as a record in the `tags` table. This aligns with the long-term goal of using a relational tagging system and moving away from the `artwork.tags` JSON field, which will be removed in a future step.

**Example:**
An artwork that was previously a "sculpture" via `type_id` will now have a new row in the `tags` table:
- `artwork_id`: {artwork-id}
- `label`: "artwork_type"
- `value`: "sculpture"

This change moves the management of artwork types into the primary relational tagging system, simplifying the overall architecture and centralizing metadata.

## 3. Goals and Objectives

* **Simplify Database Schema:** Eliminate the `artwork_types` table and its foreign key relationship, reducing database complexity.
* **Increase Flexibility:** Allow for the creation of new artwork types dynamically without requiring developer intervention or database migrations.
* **Empower Users:** Enable users to add, edit, and correct artwork types through the existing tag editing interface, fostering community ownership.
* **Standardize Metadata:** Treat the artwork type as another piece of descriptive metadata, consistent with how other attributes are managed via tags.

## 4. Scope and Requirements

### 4.1. Database Changes

A database migration script must be created to perform the following schema changes:
- Remove the `type_id` column from the `artwork` table.
- Drop the `artwork_types` table entirely.

**Note:** No data migration for existing artworks is required, as the database will be reset and all artworks will be re-imported using the updated mass import process.

### 4.2. Backend Changes

- Remove all code that references the `artwork_types` table or the `artwork.type_id` column.
- Update API endpoints and database service functions (`getArtwork`, `createArtwork`, `updateArtwork`, etc.) to read the artwork type by joining with the `tags` table where `label` = 'artwork_type'.
- Ensure that when a new artwork is created without a specified type, a record is added to the `tags` table with `label` = 'artwork_type' and `value` = 'unknown'.
- Update any data validation logic (e.g., Zod schemas) to reflect the new structure.

### 4.3. Frontend Changes

* Update all UI components that display or allow editing of the artwork type.
* The artwork type should now be presented as a normal, editable tag in the tag editing interface.
* To maintain data consistency, the input field for the `artwork_type` tag should provide autocomplete suggestions based on existing values in the database.

### 4.4. Mass Import Scripts

- Update the mass import scripts (e.g., `vancouver-public-art-config.json`, `osm-import.js`) to insert artwork type data into the `tags` table with `label` = 'artwork_type', instead of populating the old `type_id` or the `artwork.tags` JSON field.

## 5. Non-Goals

* This project does not include a major redesign of the tag editing user interface. The `artwork_type` tag will be managed through the existing UI.
* A separate administrative interface for managing a canonical list of artwork types is not in scope. The types will be managed organically by the community.

## 6. Risks and Mitigation

* **Risk:** Data inconsistency due to typos or variations in capitalization (e.g., "Sculpture" vs. "sculpture").
  * **Mitigation:**
    1. Implement frontend autocomplete suggestions to guide users toward existing types.
    2. Implement backend logic to normalize the tag value (e.g., by converting it to lowercase) upon submission.
* **Risk:** Potentially slower query performance when filtering by artwork type compared to an indexed foreign key.
  * **Mitigation:** Ensure that the `tags` JSON field is properly indexed to allow for efficient queries using `json_extract`. Given the expected scale of the application, this is a low risk.

## 7. Success Metrics

* The `artwork_types` table and `artwork.type_id` column are successfully removed from the database schema.
* All existing artwork records have their type correctly migrated to the `artwork_type` tag.
* Users can successfully view and edit the artwork type through the tag editing interface.
* Filtering artworks by type on the map page continues to function correctly.
* All automated tests pass after the changes are implemented.
