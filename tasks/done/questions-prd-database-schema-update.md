# Feature Definition: Database Schema Complete Replacement

This document outlines the requirements and clarifications for the "Database Schema Complete Replacement" feature based on the PRD and subsequent questions.

## Initial Feature Description

The project requires a complete database schema replacement to eliminate redundant tables, improve performance, and consolidate overlapping functionality. Since all production data is test data, a clean slate approach will be used, recreating the database from scratch rather than performing complex data migrations. The implementation will be a rapid, "one-night" effort broken into distinct sessions.

## 1. Goals and Justification

- **Primary Driver:** The most important driver is to consolidate redundant tables (`logbook`, `artwork_edits`, etc.) into a unified `submissions` table. This will simplify application logic and reduce overall code complexity.
- **Implementation Strategy:** The "one-night" implementation is chosen to fit the entire 6-8 hour process into a single developer's work session, leveraging the fact that no production user data needs to be migrated.
- **Validation Focus:** The mass-import scripts are the primary validation tool because they provide the quickest way to populate the new schema with a large, realistic dataset. This is the most effective way to validate the new structure and its performance, especially since the application is still in development with no public users and data comes from manual processes.
- **Benefit of Consolidation:** The most significant benefit of the unified `submissions` table is creating a single, consistent workflow for handling all user-generated content (new artwork, edits, photo uploads). This simplifies moderation, consent tracking, and API logic.
- **Developer-Friendly Plan:** The plan is structured as a "Junior Developer Checklist" to ensure it is broken down into clear, manageable, and sequential steps with explicit validation commands. This makes the complex task accessible to any developer, regardless of their prior experience with this specific codebase.

## 2. Technical Implementation and Schema Details

- **Embedded Consent:** Consent and request metadata (`consent_version`, `ip_address`, etc.) are embedded directly into the `submissions` table. This ensures every submission is explicitly tied to the exact terms agreed to at that moment, creating a robust, self-contained audit trail.
- **Consolidated User Activity:** The `user_activity` table replaces `rate_limiting` and `auth_sessions` to improve performance by querying a single table and to make it easier to expire old records via a single cleanup job.
- **Centralized Audit Log:** The new `audit_log` table was a recommended addition to address anticipated gaps in the old schema. It provides a centralized, consistent, and comprehensive record of all significant actions (e.g., submission approvals, role changes) for future auditing needs.
- **JSON Tags:** Storing `tags` as a JSON `TEXT` column was chosen to reduce the total number of tables/indexes and to simplify the mass-import process, as source JSON can be inserted directly.
- **JSON Indexing:** Performance indexes on JSON properties (e.g., `idx_artwork_tags_type`) were recommended to allow for efficient filtering of data within JSON objects, which would otherwise require slow, full-table scans.

## 3. Risks, Rollback, and Testing

- **Risk of Core Changes:** The "Medium Risk" assessment for TypeScript and service changes is an AI-generated suggestion based on the idea that failures in these core areas could cause a cascade of compilation or runtime errors across the entire application, as many components depend on them.
- **Rollback Trigger:** The rollback plan is intended for a scenario where a critical, hard-to-fix failure is discovered late in the process (e.g., during Session 4 or 5), making it safer to revert all changes and reschedule.
- **Successful Import Definition:** A "successful" data recreation means all records from the source file are imported into the new schema, with data correctly mapped to the new tables and fields, and without any import errors.
- **Testing Gap:** A significant gap in the PRD is the lack of detail regarding frontend changes. The plan needs a section outlining the necessary updates to the frontend application to support the new API and data structures, along with a corresponding testing strategy.
- **Benefit of Sessions:** The session-based approach creates logical checkpoints where progress can be validated and committed, reducing the risk of having to debug a massive, monolithic set of changes all at once.

## 4. Frontend and User Impact

- **Most Impacted Area:** The submission forms (`SubmitView.vue`) and their data handling logic will require the most significant rewrite to accommodate the new unified `submissions` endpoint and its data structure.
- **Artwork History:** The feature to display the history of an artwork will be removed from the frontend. The new schema will capture the history, but it will not be exposed to users.
- **Artist Pages:** As a minimum viable change, a simple, read-only artist page should be created to display information from the new `artists` table.
- **Error Handling:** The frontend should implement robust error handling to display a user-friendly maintenance message if it encounters unexpected API responses during the transition period.
- **Critical Frontend Test:** The most critical manual test after the backend deployment is a full, end-to-end test of submitting a new piece of artwork with a photo, ensuring it can be found on the map after approval, and viewing its detail page.
