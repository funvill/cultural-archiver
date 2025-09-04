# Task List: Backup and Data Dump System Implementation

## Relevant Files

- `src/workers/lib/backup.ts` - Core backup system logic for database and R2 photo collection
- `src/workers/lib/backup.test.ts` - Unit tests for backup functionality
- `src/workers/lib/data-dump.ts` - Data dump generation logic with data filtering and JSON export
- `src/workers/lib/data-dump.test.ts` - Unit tests for data dump functionality  
- `src/workers/routes/admin.ts` - Extend existing admin routes with data dump endpoint
- `src/workers/routes/admin.test.ts` - Unit tests for admin data dump endpoint
- `src/workers/lib/archive.ts` - ZIP archive creation utilities for both backup and data dump
- `src/workers/lib/archive.test.ts` - Unit tests for archive creation
- `src/shared/types.ts` - Add interfaces for backup/data dump request/response types
- `scripts/backup.ts` - NPM script entry point for `npm run backup` command
- `package.json` - Add backup npm script and any required dependencies
- `src/frontend/src/views/AdminView.vue` - Add data dump generation UI to existing admin interface
- `src/frontend/src/services/admin.ts` - Add data dump API calls to existing admin service
- `src/frontend/src/services/admin.test.ts` - Unit tests for admin service data dump methods

### Notes

- Leverage existing admin authentication middleware in `src/workers/middleware/auth.ts` (requireAdmin)
- Use existing database utilities in `src/workers/lib/database.ts` for data retrieval
- Build on existing R2 photo utilities in `src/workers/lib/photos.ts` for photo access
- Follow existing API patterns in `src/workers/routes/admin.ts` for endpoint consistency
- Use existing error handling patterns from `src/workers/lib/errors.ts`
- Run tests with `npm test` in respective directories (frontend, workers, or root)
- Document the features in the `/docs/` folder following existing documentation patterns

## Tasks

- [x] 1.0 Create Archive Utilities Library
  - [x] 1.1 Create `src/workers/lib/archive.ts` with ZIP creation functionality using Web Streams API
  - [x] 1.2 Implement `createZipArchive(files: ArchiveFile[])` function that accepts file list with content and paths
  - [x] 1.3 Add `addFileToArchive(path: string, content: ArrayBuffer | string)` helper for individual files
  - [x] 1.4 Implement `addFolderToArchive(folderPath: string, files: ArchiveFile[])` for organizing files in ZIP structure
  - [x] 1.5 Add error handling for memory limits and file size constraints during ZIP creation
  - [x] 1.6 Create comprehensive unit tests in `src/workers/lib/archive.test.ts` covering ZIP creation and error scenarios

- [x] 2.0 Implement Backup System Infrastructure  
  - [x] 2.1 Create `src/workers/lib/backup.ts` with complete system backup logic
  - [x] 2.2 Implement `generateDatabaseDump(db: D1Database)` to export complete SQL dump with all tables and data
  - [x] 2.3 Add `collectR2Photos(env: WorkerEnv)` to retrieve all photos (originals and thumbnails) from R2 bucket
  - [x] 2.4 Create `generateBackupMetadata()` to include timestamp, database info, and backup content summary
  - [x] 2.5 Implement `createBackupArchive(databaseDump, photos, metadata)` to combine all components into timestamped ZIP
  - [x] 2.6 Add comprehensive error logging and recovery for partial backup failures
  - [x] 2.7 Create unit tests in `src/workers/lib/backup.test.ts` with mocked D1 and R2 services

- [x] 3.0 Implement Data Dump System Infrastructure
  - [x] 3.1 Create `src/workers/lib/data-dump.ts` with public data export logic
  - [x] 3.2 Implement `filterApprovedArtwork(db: D1Database)` to extract only approved artwork with public fields
  - [x] 3.3 Add `sanitizeUserData(data)` function using field blacklist to exclude sensitive information (emails, IPs, tokens)
  - [x] 3.4 Create `exportArtworkAsJSON()`, `exportCreatorsAsJSON()`, and `exportTagsAsJSON()` for separate JSON files
  - [x] 3.5 Implement `collectThumbnailPhotos(env: WorkerEnv, approvedArtwork)` to gather only 800px thumbnails
  - [x] 3.6 Add `generateCC0License()` and `generateDataDumpReadme()` for legal compliance and documentation
  - [x] 3.7 Create `createDataDumpArchive()` to combine JSON files, photos, and documentation into timestamped ZIP
  - [x] 3.8 Create unit tests in `src/workers/lib/data-dump.test.ts` with data sanitization validation

- [x] 4.0 Create Admin API Endpoint for Data Dump Generation
  - [x] 4.1 Add `POST /api/admin/data-dump/generate` endpoint to existing `src/workers/routes/admin.ts`
  - [x] 4.2 Integrate `requireAdmin` middleware to ensure only administrators can trigger data dump generation
  - [x] 4.3 Implement async data dump generation with proper error handling and status responses
  - [x] 4.4 Add data dump upload to R2 bucket with public access configuration for download
  - [x] 4.5 Create `GET /api/admin/data-dumps` endpoint to list previously generated data dumps with download links
  - [x] 4.6 Add audit logging for data dump generation using existing admin audit system
  - [x] 4.7 Update `src/workers/routes/admin.test.ts` with comprehensive tests for new data dump endpoints

- [x] 5.0 Add NPM Script for Backup Command
  - [x] 5.1 Create `scripts/backup.ts` as entry point for backup command with CLI argument parsing
  - [x] 5.2 Implement environment detection to connect to correct Cloudflare resources (D1, R2)
  - [x] 5.3 Add backup execution logic that calls backup library and saves ZIP locally with timestamp filename
  - [x] 5.4 Implement progress logging and error handling for CLI feedback during backup process
  - [x] 5.5 Add `backup` script to root `package.json` that executes `npx tsx scripts/backup.ts`
  - [x] 5.6 Update `.env.example` with any additional environment variables needed for backup script
  - [x] 5.7 Test backup script execution and verify generated backup archive contains expected content

- [x] 6.0 Integrate Data Dump UI into Admin Interface
  - [x] 6.1 Add "Generate Data Dump" button to existing admin panel in `src/frontend/src/views/AdminView.vue`
  - [x] 6.2 Implement data dump generation trigger with loading state and progress feedback
  - [x] 6.3 Add data dump history section showing previously generated dumps with download links
  - [x] 6.4 Update `src/frontend/src/services/admin.ts` with `generateDataDump()` and `getDataDumps()` API methods
  - [x] 6.5 Add proper error handling and user notifications for data dump generation success/failure
  - [x] 6.6 Ensure admin interface updates are consistent with existing design patterns and accessibility standards
  - [x] 6.7 Update `src/frontend/src/services/admin.test.ts` with tests for new data dump service methods

- [x] 7.0 Add Comprehensive Testing and Documentation
  - [x] 7.1 Run complete test suite to ensure all backup and data dump functionality works correctly
  - [x] 7.2 Create integration tests that verify end-to-end backup and data dump workflows
  - [x] 7.3 Add documentation in `docs/backup-data-dump.md` covering setup, usage, and troubleshooting
  - [x] 7.4 Document backup command usage and data dump API endpoints in existing API documentation
  - [x] 7.5 Update README.md with new npm scripts and admin interface features
  - [x] 7.6 Verify generated archives meet all PRD requirements (file structure, content, licensing)
  - [x] 7.7 Test backup restoration process to validate backup integrity and completeness
