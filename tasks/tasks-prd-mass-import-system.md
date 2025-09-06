# Task List: Mass Import System Implementation

Generated from: [tasks/prd-mass-import-system.md](./prd-mass-import-system.md)

## Relevant Files

- `src/shared/types.ts` - Core data types and interfaces
- `src/shared/tag-schema.ts` - Structured tag validation system
- `src/workers/routes/` - Existing API endpoints for reference
- `src/workers/lib/photos.ts` - Photo processing pipeline
- `tasks/prd-artwork-variable-tagging-system.md` - Tag system specification
- `tasks/public-art.json` - Vancouver Open Data sample

## Notes

This task list implements a comprehensive mass import system for automated public art data ingestion. The system integrates with the existing artwork variable tagging system and provides CLI tools for bulk data import with validation, dry-run capabilities, and attribution tracking.

Key technical considerations:

- Must integrate with existing API endpoints and database schema
- Requires structured tag validation using the 15 essential tags system
- Photo processing through R2 pipeline with automatic resizing
- Special mass-import user account for attribution
- Sequential processing to maintain data integrity

## Tasks

- [ ] 1.0 Core TypeScript Library Development
  - [ ] 1.1 Create `@cultural-archiver/mass-import` package structure
    - [ ] Initialize npm package with proper dependencies
    - [ ] Set up TypeScript configuration with shared types
    - [ ] Create basic library interface and exports
  - [ ] 1.2 Implement data validation and transformation
    - [ ] Create input data validation using Zod schemas
    - [ ] Implement coordinate validation (lat/lon bounds checking)
    - [ ] Add tag mapping and validation using `src/shared/tag-schema.ts`
    - [ ] Create photo URL validation and processing logic
  - [ ] 1.3 Build API integration layer
    - [ ] Create authenticated HTTP client for mass-import user
    - [ ] Implement submission endpoint integration (`POST /api/logbook`)
    - [ ] Add photo upload handling with R2 processing
    - [ ] Create error handling and retry logic with exponential backoff
  - [ ] 1.4 Add dry-run functionality
    - [ ] Implement validation-only mode without API calls
    - [ ] Create detailed validation reporting with error summaries
    - [ ] Add statistics tracking (valid/invalid entries, photo counts)
    - [ ] Generate human-readable dry-run reports

- [ ] 2.0 CLI Tool Implementation
  - [ ] 2.1 Create command-line interface structure
    - [ ] Set up CLI framework with argument parsing
    - [ ] Implement help system and command documentation
    - [ ] Add configuration file support for API endpoints and credentials
  - [ ] 2.2 Build core import commands
    - [ ] Implement `import` command with file input handling
    - [ ] Add `dry-run` command for validation-only processing
    - [ ] Create `validate` command for data structure checking
    - [ ] Add progress indicators and status reporting during import
  - [ ] 2.3 Implement bulk approval workflow
    - [ ] Create `bulk-approve` command for admin use
    - [ ] Add filtering options (by source, date, validation status)
    - [ ] Implement batch processing with configurable batch sizes
    - [ ] Add confirmation prompts and safety checks

- [ ] 3.0 Vancouver Open Data Integration
  - [ ] 3.1 Create Vancouver-specific data mapper
    - [ ] Implement field mapping from Vancouver schema to internal types
    - [ ] Add address parsing and geocoding validation
    - [ ] Create artist name extraction and formatting
    - [ ] Map Vancouver categories to structured tags
  - [ ] 3.2 Build Vancouver import script
    - [ ] Create data fetching from Vancouver Open Data API
    - [ ] Implement incremental import with change detection
    - [ ] Add photo URL processing and validation
    - [ ] Create attribution tag generation for Vancouver source
  - [ ] 3.3 Add Vancouver-specific validation
    - [ ] Implement Vancouver coordinate bounds checking
    - [ ] Add Vancouver-specific data quality rules
    - [ ] Create validation for required Vancouver fields
    - [ ] Add duplicate detection using coordinates and titles

- [ ] 4.0 Photo Processing Integration
  - [ ] 4.1 Integrate with existing R2 photo pipeline
    - [ ] Connect mass import to `src/workers/lib/photos.ts`
    - [ ] Implement batch photo processing for imports
    - [ ] Add photo validation (format, size, accessibility)
    - [ ] Create fallback handling for missing or invalid photos
  - [ ] 4.2 Add photo attribution and metadata
    - [ ] Implement photo source attribution in metadata
    - [ ] Add original URL preservation for reference
    - [ ] Create photo processing status tracking
    - [ ] Add error reporting for failed photo imports

- [ ] 5.0 Data Attribution and Tracking
  - [ ] 5.1 Implement source attribution system
    - [ ] Create data source tracking in import metadata
    - [ ] Add import batch identification and timestamps
    - [ ] Implement attribution tag generation (e.g., "source:vancouver-opendata")
    - [ ] Create import history tracking for audit purposes
  - [ ] 5.2 Build attribution display system
    - [ ] Add data source information to artwork records
    - [ ] Create attribution display in frontend components
    - [ ] Implement data provenance tracking
    - [ ] Add import metadata to API responses

- [ ] 6.0 Documentation and Testing
  - [ ] 6.1 Create comprehensive documentation
    - [ ] Write library API documentation with TypeScript examples
    - [ ] Create CLI tool usage guide with real-world examples
    - [ ] Document Vancouver import process and data mapping
    - [ ] Add troubleshooting guide for common import issues
  - [ ] 6.2 Implement testing suite
    - [ ] Create unit tests for data validation and transformation
    - [ ] Add integration tests for API communication
    - [ ] Create end-to-end tests with sample Vancouver data
    - [ ] Add performance tests for large dataset processing
  - [ ] 6.3 Add monitoring and logging
    - [ ] Implement structured logging throughout import process
    - [ ] Add metrics collection for import success rates
    - [ ] Create error reporting and alerting system
    - [ ] Add performance monitoring for import operations
