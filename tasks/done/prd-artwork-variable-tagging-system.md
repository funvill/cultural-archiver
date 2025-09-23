# PRD: Artwork Variable Tagging System

## 1. Introduction/Overview

The Artwork Variable Tagging System allows users to enrich artworks with structured metadata through a standardized key-value tagging system. This feature replaces the current unstructured tags system with a validated, OpenStreetMap-compatible tagging framework that ensures data quality while maintaining flexibility for contributors.

**Problem Statement:** Currently, artwork metadata is limited to basic fields and unstructured keywords, making it difficult to provide rich, searchable, and exportable data for research and integration with external systems.

**Goal:** Enable contributors to add structured metadata to artworks through a validated tagging system that maintains data integrity while supporting diverse use cases from casual browsing to academic research.

## 2. Goals

1. **Data Quality:** Ensure 95%+ of tagged artworks contain valid, structured metadata through validation and user guidance
2. **User Adoption:** Achieve consistent tag usage across artwork submissions with intuitive interface design
3. **Export Compatibility:** Generate OpenStreetMap-compatible exports for integration with mapping and research systems
4. **Search Enhancement:** Enable precise filtering and discovery through structured tag-based queries
5. **Maintainability:** Create a sustainable system that moderators can manage without constant technical intervention

## 3. User Stories

**Contributors:**

- As a contributor, I want to add detailed information about an artwork's material, dimensions, and creation date so that future visitors can learn more about the piece
- As a contributor, I want the system to guide me through adding appropriate tags so I don't make mistakes or miss important details
- As a contributor, I want to see example tag values so I understand what information is expected

**Moderators:**

- As a moderator, I want to review artwork submissions with structured tags so I can quickly verify data accuracy
- As a moderator, I want validation rules to catch common errors automatically so I spend less time on basic corrections
- As a moderator, I want to understand what each tag means so I can provide accurate feedback to contributors

**Consumers/Researchers:**

- As a researcher, I want to export artwork data with standardized fields so I can analyze patterns across different locations and time periods
- As a developer, I want to search for artworks by specific tag combinations so I can build specialized applications
- As a mapping enthusiast, I want OpenStreetMap-compatible data so I can contribute to public mapping projects

## 4. Functional Requirements

### 4.1 Core Tagging System

1. Each artwork must support multiple key-value tags with predefined keys and validated values
2. The system must maintain core artwork fields (title, description, location, coordinates, photos, artist) as direct database columns
3. The system must move current unstructured tags to the new structured tagging system while preserving existing keywords field for SEO/search purposes
4. Tag keys must come from a predefined schema stored in application code and updated with releases

### 4.2 Tag Schema & Validation

1. The system must support multiple data types: enum, free text, number, date, yes/no, URL, and Wikidata ID
2. Validation must be type-specific: strict for dates/numbers/enums, flexible for text fields
3. Date validation must accept YYYY or YYYY-MM-DD formats
4. Number fields must assume metric units (meters for dimensions, etc.)
5. URL fields must validate proper URL format
6. Enum fields must match predefined allowed values exactly
7. Invalid submissions must be blocked until validation errors are resolved

### 4.3 User Interface

1. Tags must be organized in grouped categories (Physical Properties, Historical Info, Location Details, etc.) on artwork details page
2. The system must provide an "Edit Mode" toggle that makes all artwork fields editable simultaneously
3. Tag addition must use dropdown selector showing all available tags in alphabetical order
4. Input methods must automatically adapt based on tag type (text field, dropdown for enums, date picker, etc.)
5. Validation feedback must show red border and error message below invalid fields
6. Tag removal must be available through dedicated "Remove Tag" option in dropdown/context menu
7. Empty tag states must show example tags with "Try adding tags like these" guidance
8. The interface must display all tags with natural page scrolling (no pagination/truncation)
9. Mobile interface must adapt desktop design with larger touch targets and responsive layout

### 4.4 Search Integration

1. The system must support tag-based search with format "Tag:key" (e.g., "Tag:material")
2. The system must support value-specific search with format "Tag:key:value" (e.g., "Tag:material:bronze")
3. General text search must include tag values in results (searching "bronze" returns artworks with bronze material tags)
4. Search must use full-text search on serialized tag data for performance

### 4.5 User Permissions & Workflow

1. All logged-in users must be able to add any available tags to artworks
2. Tag additions/edits must follow existing artwork edit workflow with moderator review
3. Moderators must review entire artwork submission including all tags
4. The system must maintain parallel operation with existing keywords field during transition

### 4.6 Data Export

1. The system must generate OpenStreetMap-compatible exports using prefixed format (ca:artist_name, ca:material) to avoid tag conflicts
2. Export functionality must be available through existing API endpoints

## 5. Non-Goals (Out of Scope)

- Free-form tagging without validation rules
- Complex relational metadata linking multiple artworks
- Real-time AI assistance or automated tag generation
- Multimedia tag storage (images remain URL references only)
- Community voting systems for tag approval
- Bulk tag operations or template systems
- Advanced tag management interfaces for end users
- Custom tag schema creation by users

## 6. Design Considerations

### 6.1 Tag Categories

Tags will be organized into logical groups:

- **Physical Properties:** material, height, width, weight, color
- **Historical Info:** start_date, end_date, artist_name, artist:wikidata
- **Location Details:** access, fee, opening_hours, location_type
- **Artwork Classification:** artwork_type, subject, style, technique
- **Reference Data:** image, website, wikipedia, wikidata

### 6.2 Mobile Considerations

- Use responsive design adapting desktop interface with larger touch targets
- Maintain full functionality on mobile devices
- Ensure dropdown selectors work well on touch interfaces
- Optimize form validation feedback for mobile screens

### 6.3 Visual Design

- Integrate with existing Tailwind CSS design system
- Use consistent form styling with current artwork editing interface
- Provide clear visual hierarchy between tag categories
- Ensure accessibility compliance with proper ARIA labels and keyboard navigation

## 7. Technical Considerations

### 7.1 Database Schema

- Extend existing artwork table to include core structured fields (artist_name, material, artwork_type)
- Preserve existing keywords field for SEO and backward compatibility
- Use full-text search indexing on serialized tag data for query performance
- Maintain existing artwork editing and moderation workflows

### 7.2 Validation Framework

- Implement client-side validation for immediate user feedback
- Server-side validation as final gate before database storage
- Validation rules defined in application code for consistency
- Error messages provide specific guidance for correction

### 7.3 Performance

- Index commonly searched tag fields for fast filtering
- Use full-text search capabilities for tag value queries
- Consider caching for frequently accessed tag schemas
- Optimize mobile performance with efficient form rendering

### 7.4 Integration Points

- Extend existing artwork editing API endpoints to handle structured tags
- Maintain compatibility with current submission and moderation workflows
- Integrate with existing search functionality
- Support current export formats with enhanced structured data

## 8. Success Metrics

### 8.1 User Engagement

- Time spent adding/editing tags per artwork submission
- Percentage of users who add tags when editing existing artworks
- Tag completion rate for new artwork submissions
- User retention after first tag editing experience

### 8.2 Data Quality

- Validation error rate (target: <5% of submissions)
- Tag completion rate (target: 80% of artworks have >3 structured tags)
- Moderator correction frequency for tag-related issues
- Export data validation success rate

### 8.3 System Performance

- Search query response times for tag-based searches
- Form loading and validation response times
- Mobile interface usability metrics
- API endpoint performance under load

## 9. Implementation Timeline

**Phase 1: Big Bang Deployment**

- Complete system replacement of current unstructured tags
- Parallel operation with existing keywords field
- Full moderator training on new tag system
- Comprehensive user documentation and help system

**Rollout Strategy:**

- Deploy to production with feature flag for controlled access
- Enable for moderators first for system validation
- Full public release after moderator approval
- Monitor metrics closely during first 30 days

## 10. Integration Specifications

Based on clarification with stakeholders, the following integration decisions have been made:

### 10.1 Data Migration Strategy

- **Complete data replacement** - All existing artwork.tags data can be lost during migration as we are still in development with sample data only
- **Clean slate approach** - Migration will reset all tag data to new structured format without backward compatibility concerns
- **Sample data refresh** - New sample data will be created using the structured tag schema

### 10.2 User Permissions

- **Uniform access** - All logged-in users can add/edit any tags using the same permissions as the current artwork editing system
- **No tiered permissions** - No distinction between basic and advanced tag types for different user levels
- **Existing workflow** - Uses the established edit proposal → moderation review → approval workflow

### 10.3 Rate Limiting

- **Submission-based counting** - An entire tag submission (multiple changed tags) counts as one edit toward the existing 500 edits/day limit
- **Grouped operations** - Prevents gaming the system by making many small tag changes instead of comprehensive edits

### 10.4 Error Handling

- **Strict validation** - Block entire artwork submission if any tag is invalid to ensure data quality
- **All-or-nothing approach** - Users must fix all validation errors before submission can proceed
- **Clear error messaging** - Provide specific guidance for each validation failure

### 10.5 Search Integration

- **Transparent integration** - Tagged artworks appear normally in search results with no visual differences
- **Metadata enhancement** - Tags serve as additional searchable metadata without changing result presentation
- **Existing search patterns** - Leverage current full-text search capabilities with enhanced tag-based queries

### 10.6 Mobile & Export Compatibility

- **Full responsive design** - Complete desktop functionality available on mobile devices with responsive interface
- **OpenStreetMap focus** - Initially support only OpenStreetMap-compatible export format as specified
- **Future extensibility** - Architecture allows for additional export formats in future releases

### 10.7 Performance Strategy

- **Database-first approach** - No special caching beyond existing database performance and full-text search indexing
- **Simple implementation** - Avoid premature optimization complexity during initial development

### 10.8 Scope Reduction Decisions

To ensure successful delivery, the following scope limitations have been established:

**Minimum Viable Tag Schema:** 15 essential tags across all categories to validate the concept while keeping implementation manageable

**Category Implementation:** All categories implemented simultaneously to avoid user confusion and provide complete structured data from launch

**Validation Approach:** Strict enum validation for known values, flexible validation for text fields - balances data quality with usability

**User Interface:** Advanced interface with auto-complete, suggestions, and inline help based on OpenStreetMap documentation to educate users on proper tagging

**Search Features:** Basic "Tag:key" and "Tag:key:value" search formats plus integration with existing full-text search

**Export Functionality:** Simple JSON export of structured tag data initially, with OpenStreetMap format planned for future release

**Testing Priority:** Focus on manual testing and basic unit tests for initial release, with automated testing expansion in subsequent iterations

## 11. Open Questions

1. **Tag Schema Evolution:** How frequently should we review and update the predefined tag schema based on user feedback?
2. **Analytics Integration:** Should we track specific tag usage patterns to identify popular vs. underused tags?
3. **External Integration:** Future integration with Wikidata API for auto-completion of artist and subject fields?

## 12. Example Tag Schema (15 Essential Tags)

| Key            | Format | Example Values                                 | Category            | OpenStreetMap Help Reference  |
| -------------- | ------ | ---------------------------------------------- | ------------------- | ----------------------------- |
| `tourism`      | enum   | `artwork`                                      | Classification      | Required base tag             |
| `artwork_type` | enum   | `statue`, `mural`, `sculpture`, `installation` | Classification      | Type of artwork               |
| `name`         | text   | `Angel of Victory`, `Untitled`                 | Classification      | Official artwork name         |
| `artist_name`  | text   | `Jane Doe`, `Unknown`, `Community Project`     | Historical Info     | Creator information           |
| `material`     | text   | `bronze`, `concrete`, `paint on wall`          | Physical Properties | Primary construction material |
| `height`       | number | `2.4`, `15.5`                                  | Physical Properties | Height in meters              |
| `start_date`   | date   | `1998`, `2011-07`, `2011-07-15`                | Historical Info     | Creation/installation date    |
| `access`       | enum   | `yes`, `private`, `customers`, `no`            | Location Details    | Public accessibility          |
| `fee`          | yes/no | `no`, `yes`                                    | Location Details    | Admission fee required        |
| `subject`      | text   | `historical figure`, `abstract`, `nature`      | Classification      | Artwork theme/subject         |
| `style`        | text   | `modern`, `classical`, `street art`            | Classification      | Artistic style                |
| `condition`    | enum   | `excellent`, `good`, `fair`, `poor`            | Physical Properties | Current state                 |
| `website`      | URL    | `https://example.org/artwork-info`             | Reference Data      | Related website               |
| `wikipedia`    | text   | `en:Article_Name`                              | Reference Data      | Wikipedia article             |
| `description`  | text   | `Large bronze statue commemorating...`         | Classification      | Detailed description          |

## 13. Smoke Test Specification

### 13.1 Test Environment Setup

**Prerequisites:**

- Development environment with latest code deployed
- Database migrated to include structured tag schema
- Test user account with standard editing permissions
- Sample artwork record available for editing

### 13.2 Core Functionality Tests

**Test 1: Basic Tag Addition**

1. Navigate to any artwork detail page
2. Click "Edit" button to enter edit mode
3. Locate the structured tags section (should show category-organized interface)
4. Add a new tag:
   - Select `artwork_type` from dropdown
   - Choose `statue` from enum values
   - Verify auto-complete suggestions appear
5. Add another tag:
   - Select `material`
   - Enter `bronze` as free text
   - Verify no validation errors
6. Click "Save Changes"
7. **Expected:** Changes submitted for moderation, success message displayed

**Test 2: Validation Testing**

1. Enter edit mode on an artwork
2. Add invalid data to test validation:
   - Select `height` tag
   - Enter `not-a-number` as value
   - Verify red border and error message appear
   - Try to save - should be blocked
3. Fix the validation error:
   - Change height to `3.2`
   - Verify error clears
4. Add invalid enum value:
   - Select `access` tag
   - Try entering `maybe` (not in allowed values)
   - Verify validation prevents this
5. **Expected:** All validation errors prevent submission until fixed

**Test 3: OpenStreetMap Help Integration**

1. In edit mode, click on help icon/link for any tag
2. **Expected:** Help text appears explaining the tag based on OSM documentation
3. Verify help text provides:
   - Clear explanation of what the tag represents
   - Examples of valid values
   - Links to OpenStreetMap wiki if applicable

**Test 4: Search Functionality**

1. Create/edit an artwork with tags: `artwork_type=mural`, `material=paint`
2. Wait for moderation approval (or approve if moderator)
3. Test tag-based searches:
   - Search for `Tag:artwork_type` - should find the artwork
   - Search for `Tag:material:paint` - should find the artwork
   - Search for `mural` - should find the artwork (general text search)
4. **Expected:** All search formats return the tagged artwork

**Test 5: Category Organization Display**

1. View artwork detail page with multiple tags
2. **Expected:** Tags displayed in organized categories:
   - Physical Properties (material, height, condition)
   - Classification (artwork_type, name, subject, style, description)
   - Historical Info (artist_name, start_date)
   - Location Details (access, fee)
   - Reference Data (website, wikipedia)
3. Verify collapsible/expandable category sections work properly

**Test 6: Mobile Responsiveness**

1. Access artwork detail page on mobile device/browser
2. Enter edit mode
3. **Expected:**
   - All tag editing functionality available
   - Touch-friendly interface with larger tap targets
   - Category organization maintained
   - Validation messages clearly visible

**Test 7: Data Export**

1. Create artwork with complete tag set (all 15 tags)
2. Access export functionality
3. **Expected:**
   - JSON export includes all structured tag data
   - Export format is clean and readable
   - Tag categories preserved in export structure

### 13.3 Integration Tests

**Test 8: Moderation Workflow**

1. Submit artwork with new tags
2. Access moderation interface
3. **Expected:**
   - Tags display clearly in moderation queue
   - Diff view shows old vs new tag values
   - Moderator can approve/reject tag changes
   - Tag validation errors flagged for moderator attention

**Test 9: Rate Limiting**

1. Submit multiple tag edit requests rapidly
2. **Expected:**
   - Each complete tag submission counts as one edit toward daily limit
   - Rate limiting messages appear appropriately
   - System prevents abuse while allowing legitimate editing

### 13.4 Success Criteria

**Must Pass:**

- All 15 tag types can be added and validated correctly
- Validation prevents invalid data submission
- Search finds tagged artworks using all supported formats
- Mobile interface is fully functional
- Integration with existing artwork editing workflow seamless

**Performance Benchmarks:**

- Tag validation completes in <200ms
- Search with tag filters returns results in <500ms
- Edit form loads with existing tags in <300ms

**Data Quality Checks:**

- 100% of test submissions pass validation when data is correct
- 100% of invalid test data is rejected with clear error messages
- Export format produces valid, parseable JSON

---

_This PRD represents the complete specification for implementing the Artwork Variable Tagging System as a replacement for the current unstructured tagging approach, maintaining backward compatibility while enabling rich, structured metadata collection and export._
