# Tasks: Artwork Editing System Implementation

## Relevant Files

- `src/workers/routes/artwork.ts` - New API route handlers for artwork editing functionality ✅
- `src/workers/routes/artwork.test.ts` - Unit tests for artwork editing API endpoints ✅
- `src/workers/lib/artwork-edits.ts` - Database operations for artwork edits ✅
- `src/workers/lib/artwork-edits.test.ts` - Unit tests for artwork edit database operations ✅
- `src/workers/routes/review.ts` - Extend existing moderation queue to handle artwork edits
- `src/workers/routes/review.test.ts` - Add tests for artwork edit moderation functionality
- `src/frontend/src/views/ArtworkDetailView.vue` - Add inline editing interface to existing artwork detail page
- `src/frontend/src/views/__tests__/ArtworkDetailView.test.ts` - Update existing tests for edit functionality
- `src/frontend/src/components/ArtworkEditForm.vue` - New component for inline editing form
- `src/frontend/src/components/__tests__/ArtworkEditForm.test.ts` - Unit tests for edit form component
- `src/frontend/src/components/TagChipEditor.vue` - New component for editable tag chips
- `src/frontend/src/components/__tests__/TagChipEditor.test.ts` - Unit tests for tag chip editor
- `src/frontend/src/services/artworkService.ts` - Extend existing service for edit API calls
- `src/frontend/src/services/__tests__/artworkService.test.ts` - Update tests for new edit service methods
- `src/shared/types.ts` - Add artwork edit types and interfaces ✅
- `src/workers/index.ts` - Integrate artwork edit routes with main worker routing ✅
- `migrations/003_create_artwork_edits_table.sql` - Database migration for artwork edits table ✅
- `migrations/tests/test_artwork_edits.test.ts` - Migration test functions ✅
- `docs/database.md` - Updated database schema documentation ✅

### Notes

- The existing `ArtworkDetailView.vue` already has a solid structure with TagBadge, PhotoCarousel, and other components
- The existing moderation system in `src/workers/routes/review.ts` provides a foundation to extend for artwork edits
- The existing authentication middleware and user token system can be leveraged for edit permissions
- Tag editing can build upon the existing `TagBadge.vue` component pattern
- Database design uses flexible key-value structure for future extensibility

## Tasks

- [x] 1.0 Database Schema and Migration
  - [x] 1.1 Create migration file `003_create_artwork_edits_table.sql` with flexible key-value schema
  - [x] 1.2 Define table structure with edit_id, artwork_id, user_token, field_name, field_value_old, field_value_new
  - [x] 1.3 Add status, moderator_notes, reviewed_at, reviewed_by fields for moderation tracking
  - [x] 1.4 Add indexes on artwork_id, user_token, status, and submitted_at for query performance
  - [x] 1.5 Test migration with sample data and verify constraints work correctly
  - [x] 1.6 Update database schema documentation in docs/database.md

- [x] 2.0 Backend API Implementation
  - [x] 2.1 Create `src/workers/lib/artwork-edits.ts` with database operations for artwork edits
  - [x] 2.2 Implement `submitArtworkEdit()` function to store edit proposals in key-value format
  - [x] 2.3 Implement `getUserPendingEdits()` function to check user's pending edits for artwork
  - [x] 2.4 Implement `getArtworkEditById()` function for moderation queue integration
  - [x] 2.5 Create `src/workers/routes/artwork.ts` with edit submission and status endpoints
  - [x] 2.6 Add `POST /api/artwork/{id}/edit` endpoint with field validation and rate limiting
  - [x] 2.7 Add `GET /api/artwork/{id}/pending-edits` endpoint for user pending edit status
  - [x] 2.8 Integrate artwork edit routes with main worker routing configuration
  - [x] 2.9 Add comprehensive error handling for invalid artwork IDs and malformed requests

- [x] 3.0 Frontend Edit Interface Implementation ✅ (Complete as of commit 4ace215)
  - [x] 3.1 Extend `ArtworkDetailView.vue` to show "Edit" button for logged-in users
  - [x] 3.2 Add edit mode state management with reactive form fields
  - [x] 3.3 Transform title, description, creators, and tags into editable inputs in edit mode
  - [x] 3.4 Keep location, photos, and internal fields disabled (grayed out) in edit mode
  - [x] 3.5 Add prominent "Save" and "Cancel" buttons with confirmation dialog for cancel
  - [x] 3.6 Implement save functionality to call artwork edit API endpoint
  - [x] 3.7 Show success message "Your changes have been submitted for review" after save
  - [x] 3.8 Display pending edit status when user has submitted changes for artwork
  - [x] 3.9 Add loading states and error handling for edit operations
  - [x] 3.10 Ensure edit interface works consistently on mobile and desktop

- [x] 4.0 Moderation Queue Integration ✅ (Complete as of commit TBD)
  - [x] 4.1 Extend `src/workers/routes/review.ts` to handle artwork edit submissions
  - [x] 4.2 Update moderation queue queries to include artwork edits alongside new submissions
  - [x] 4.3 Implement diff view generation showing before/after comparison for each field
  - [x] 4.4 Add approve/reject functionality for artwork edits with all-or-nothing logic
  - [x] 4.5 Enable moderator feedback text input for rejection reasons
  - [x] 4.6 Track moderator decisions with audit trail (moderator ID, timestamp, action)
  - [x] 4.7 Apply approved changes to original artwork record atomically
  - [x] 4.8 Update existing `ReviewView.vue` to display artwork edits with appropriate UI
  - [x] 4.9 Add visual indicators to distinguish new submissions from edit requests in queue

- [ ] 5.0 Tag Chip Editor Component
  - [ ] 5.1 Create `TagChipEditor.vue` component extending existing TagBadge functionality
  - [ ] 5.2 Implement add tag functionality with input field and "Add" button
  - [ ] 5.3 Implement remove tag functionality with X button on each chip
  - [ ] 5.4 Add validation for duplicate tags and empty tag values
  - [ ] 5.5 Support comma-separated tag input with automatic chip conversion
  - [ ] 5.6 Maintain consistent styling with existing TagBadge component design
  - [ ] 5.7 Add keyboard navigation support (Enter to add, Backspace to remove)
  - [ ] 5.8 Implement proper accessibility with ARIA labels and screen reader support
  - [ ] 5.9 Integrate TagChipEditor into ArtworkDetailView edit mode for tags field

- [ ] 6.0 Logbook Integration
  - [ ] 6.1 Extend logbook entry creation logic to handle approved artwork edits
  - [ ] 6.2 Generate logbook entries with format "Artwork details updated on [date] by [user_token]"
  - [ ] 6.3 Include specific field names that were modified in logbook entry
  - [ ] 6.4 Store before/after values in logbook entry for transparency
  - [ ] 6.5 Ensure logbook entries appear in chronological order on artwork detail page
  - [ ] 6.6 Add logbook entry type distinction between new submissions and edits
  - [ ] 6.7 Test logbook integration with both single and multiple field edits

- [x] 7.0 Authentication and Rate Limiting ✅ (Complete - already implemented)
  - [x] 7.1 Integrate artwork edit endpoints with existing authentication middleware
  - [x] 7.2 Implement rate limiting of 500 edits per 24-hour period per user token
  - [x] 7.3 Add user permission checks to ensure only logged-in users can edit
  - [x] 7.4 Handle authentication errors with appropriate 401 Unauthorized responses  
  - [x] 7.5 Add rate limit exceeded handling with clear error messages
  - [x] 7.6 Ensure edit operations respect existing user token validation patterns
  - [x] 7.7 Test authentication edge cases (expired tokens, invalid tokens, etc.)

- [x] 8.0 Testing and Quality Assurance ✅ (Backend testing complete - 371 tests passing)
  - [x] 8.1 Write comprehensive unit tests for `artwork-edits.ts` database operations
  - [x] 8.2 Write unit tests for artwork edit API endpoints with mock database
  - [ ] 8.3 Write unit tests for `ArtworkEditForm.vue` component functionality
  - [ ] 8.4 Write unit tests for `TagChipEditor.vue` component interactions
  - [ ] 8.5 Update existing `ArtworkDetailView.test.ts` to cover edit mode functionality
  - [x] 8.6 Write integration tests for end-to-end edit workflow (submit -> moderate -> approve)
  - [x] 8.7 Test moderation queue integration with mixed submission types
  - [x] 8.8 Test rate limiting and authentication error scenarios
  - [ ] 8.9 Perform accessibility testing for all new UI components
  - [ ] 8.10 Test mobile responsiveness of edit interface across devices
  - [ ] 8.11 Load test edit API endpoints under realistic usage scenarios
  - [x] 8.12 Verify all new functionality passes existing linting and type checking
