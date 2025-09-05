# Tasks: Artwork Variable Tagging System Implementation

## Relevant Files

- `src/shared/types.ts` - Add new tag schema interfaces and validation types
- `src/shared/tag-schema.ts` - **NEW** - Define predefined tag schema with validation rules
- `src/workers/lib/tag-validation.ts` - **NEW** - Server-side tag validation logic
- `src/workers/routes/artwork.ts` - Extend existing artwork editing endpoints for new tag system
- `src/workers/lib/artwork-edits.ts` - Modify existing edit service to handle structured tags
- `src/workers/middleware/validation.ts` - Add tag validation middleware
- `src/frontend/src/components/TagEditor.vue` - **NEW** - Replace TagChipEditor with structured tag editor
- `src/frontend/src/components/TagBadge.vue` - Update to support new tag display with categories
- `src/frontend/src/views/ArtworkDetailView.vue` - Integrate new tag editing system
- `src/frontend/src/services/tagSchema.ts` - **NEW** - Frontend tag schema and validation
- `migrations/006_structured_tag_schema.sql` - **NEW** - Database migration for new tag system
- `src/workers/test/tag-validation.test.ts` - **NEW** - Unit tests for tag validation
- `src/frontend/src/components/__tests__/TagEditor.test.ts` - **NEW** - Unit tests for tag editor component

### Notes

- The existing `TagChipEditor.vue` can be kept for backward compatibility but a new `TagEditor.vue` will provide the structured tag interface
- Current `artwork.tags` JSON field will be extended to support structured schema validation
- Existing `keywords` field remains separate for SEO/search functionality
- The tag schema is hardcoded in application code and updated with releases as specified
- Integration with existing artwork editing workflow and moderation system
- Full-text search already supports tag values through existing serialized tag data

## Tasks

- [x] 1.0 Tag Schema Definition and Validation Framework
  - [x] 1.1 Create `src/shared/tag-schema.ts` with predefined tag keys, data types, and validation rules
  - [x] 1.2 Define tag categories (Physical Properties, Historical Info, Location Details, Artwork Classification, Reference Data)
  - [x] 1.3 Implement validation functions for each data type (enum, text, number, date, yes/no, URL, Wikidata ID)
  - [x] 1.4 Add OpenStreetMap-compatible key mappings with "ca:" prefix for export
  - [x] 1.5 Create TypeScript interfaces for structured tags in `src/shared/types.ts`
  - [x] 1.6 Add tag schema versioning support for future updates

- [x] 2.0 Backend Tag Validation and Processing
  - [x] 2.1 Create `src/workers/lib/tag-validation.ts` with server-side validation logic
  - [x] 2.2 Implement strict validation for enum, date, number, and URL fields
  - [x] 2.3 Add flexible validation for text fields with basic sanitization
  - [x] 2.4 Create validation middleware in `src/workers/middleware/validation.ts` for tag submissions
  - [x] 2.5 Extend existing `ArtworkEditsService` to handle structured tag validation
  - [x] 2.6 Update artwork edit API endpoints to validate against tag schema
  - [x] 2.7 Add comprehensive error messages with field-specific guidance

- [x] 3.0 Database Schema Migration
  - [x] 3.1 Create migration `006_structured_tag_schema.sql` to extend artwork table structure
  - [x] 3.2 Add indexes for common tag keys that will be frequently searched
  - [x] 3.3 Migrate existing artwork.tags JSON data to new structured format
  - [x] 3.4 Preserve existing keywords field functionality for backward compatibility
  - [x] 3.5 Update database documentation in `docs/database.md` with new tag schema structure
  - [x] 3.6 Test migration with sample data and verify no data loss

- [x] 4.0 Frontend Tag Editor Component
  - [x] 4.1 Create `src/frontend/src/components/TagEditor.vue` with category-based organization
  - [x] 4.2 Implement dropdown selector for tag keys organized alphabetically
  - [x] 4.3 Add smart input detection (text field, dropdown for enums, date picker, etc.)
  - [x] 4.4 Create real-time validation with red border and error messages for invalid values
  - [x] 4.5 Add tag removal via dedicated "Remove Tag" option in context menu
  - [x] 4.6 Implement mobile-responsive design with larger touch targets
  - [x] 4.7 Add empty state guidance with example tags
  - [x] 4.8 Create keyboard navigation and accessibility support with ARIA labels

- [x] 5.0 Frontend Tag Display and Schema Service
  - [x] 5.1 Create `src/frontend/src/services/tagSchema.ts` for client-side schema access
  - [x] 5.2 Update `TagBadge.vue` to display tags organized by categories with collapsible sections
  - [x] 5.3 Add tag value formatting and display helpers for different data types
  - [x] 5.4 Implement tag click handlers for potential future filtering functionality
  - [x] 5.5 Add loading states and error handling for tag operations
  - [x] 5.6 Create consistent styling with existing Tailwind CSS design system

- [x] 6.0 Integration with Artwork Detail View
  - [x] 6.1 Replace tag editing section in `ArtworkDetailView.vue` with new `TagEditor.vue`
  - [x] 6.2 Update edit mode toggle to work with new structured tag system
  - [x] 6.3 Integrate with existing save/cancel functionality and unsaved changes detection
  - [x] 6.4 Add tag validation feedback during edit process
  - [x] 6.5 Update tag data mapping between frontend and API format
  - [x] 6.6 Ensure proper display of structured tags in read-only mode with category groupings

- [x] 7.0 Search Integration Enhancement
  - [x] 7.1 Extend existing search functionality to support "Tag:key" format searches
  - [x] 7.2 Implement "Tag:key:value" specific value searches
  - [x] 7.3 Ensure general text search includes structured tag values in results
  - [x] 7.4 Update search result display to highlight tag matches
  - [x] 7.5 Optimize full-text search indexing for new structured tag format
  - [x] 7.6 Add search suggestions that include common tag keys and values

- [x] 8.0 OpenStreetMap Export Functionality
  - [x] 8.1 Create export service to generate OpenStreetMap-compatible format with "ca:" prefixes
  - [x] 8.2 Map internal tag keys to appropriate OSM equivalents where possible
  - [x] 8.3 Add export API endpoint or extend existing endpoints to support structured tag export
  - [x] 8.4 Implement data validation for export format compatibility
  - [x] 8.5 Create export documentation and usage examples
  - [x] 8.6 Test export functionality with sample data to ensure OSM compatibility

- [x] 9.0 Moderation Interface Updates
  - [x] 9.1 Update moderation review interface to display structured tags with categories
  - [x] 9.2 Add tag-specific validation feedback in moderation queue
  - [x] 9.3 Create diff display for tag changes showing old vs new values by category
  - [x] 9.4 Add moderator tools for bulk tag corrections if needed
  - [x] 9.5 Update moderation documentation with new tag review process
  - [x] 9.6 Ensure existing moderation workflow compatibility with new tag system

- [x] 10.0 Testing and Quality Assurance
  - [x] 10.1 Create comprehensive unit tests for tag validation logic
  - [x] 10.2 Add integration tests for tag editing workflow
  - [x] 10.3 Test mobile interface functionality across different screen sizes
  - [x] 10.4 Validate accessibility compliance with screen readers and keyboard navigation
  - [x] 10.5 Performance test tag validation and search with large datasets
  - [x] 10.6 Test data migration process with production-like data volumes
  - [x] 10.7 Create end-to-end tests for complete tag editing and moderation workflow

- [x] 11.0 Documentation and Deployment
  - [x] 11.1 Update API documentation in `docs/api.md` with new tag endpoints
  - [x] 11.2 Create user guide for new tag system with examples and best practices
  - [x] 11.3 Document tag schema format and available keys for contributors
  - [x] 11.4 Update deployment scripts to handle database migration
  - [x] 11.5 Create rollback plan and procedures for tag system deployment
  - [x] 11.6 Monitor and log tag validation errors during initial rollout period
