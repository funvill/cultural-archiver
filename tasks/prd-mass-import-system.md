# PRD: Mass Import System for Public Data Sources

## Introduction/Overview

The Mass Import System enables automated ingestion of public art data from external sources such as government open data portals. This feature addresses the challenge of manually entering large volumes of publicly available artwork data by providing a library of tools that make generating import scripts efficient and reliable. The system prevents duplicate entries through intelligent artwork matching and ensures data consistency by treating imported data as user submissions through existing API endpoints.

**Problem Statement**: Manual data entry for thousands of public artworks is time-consuming and error-prone. Public data sources like Vancouver's Open Data contain rich artwork information that should be integrated into our platform while maintaining data integrity and avoiding duplicates.

**Goal**: Create a robust mass import system that can process public art datasets, intelligently handle duplicates, and maintain data quality through existing validation workflows.

## Goals

1. **Import Efficiency**: Enable processing of large public art datasets (1000+ artworks) with minimal manual intervention
2. **Data Quality**: Maintain high data integrity through duplicate detection and existing validation workflows
3. **Coverage Expansion**: Increase platform coverage by 300-500% through integration of major public art databases
4. **Time Reduction**: Reduce manual data entry time from weeks to hours for major datasets
5. **Maintainability**: Create reusable library functions that work across different data source formats
6. **Conflict Prevention**: Eliminate duplicate artwork entries through advanced fuzzy matching

## User Stories

1. **As a system administrator**, I want to import the Vancouver Public Art dataset so that our platform has comprehensive coverage of the city's official artwork collection.

2. **As a data manager**, I want to re-run import scripts on updated datasets so that new artworks are added without creating duplicates of existing entries.

3. **As a content moderator**, I want imported artworks to go through the same review process as user submissions so that data quality is maintained consistently.

4. **As a developer**, I want to use a standardized library to create import scripts so that I don't have to rebuild duplicate detection and API integration for each data source.

5. **As a platform maintainer**, I want detailed import logs and error reporting so that I can identify and resolve data quality issues efficiently.

## Functional Requirements

### Core Library Functions

1. **The system must provide a searchArtworks() function** that finds existing artworks within a configurable radius using advanced fuzzy matching on title, artist, and location data.

2. **The system must provide an addArtwork() function** that submits new artwork data through the existing `/api/logbook` endpoint using the mass-import user token.

3. **The system must provide an addLogbookEntry() function** that creates logbook entries for existing artworks through standard API endpoints.

4. **The system must provide an addPhotos() function** that downloads external images and processes them through the existing photo pipeline.

5. **The system must implement intelligent duplicate detection** using:
   - Geographic proximity matching (configurable radius, default 50 meters)
   - Fuzzy string matching on artwork titles (minimum 80% similarity)
   - Artist name matching when available
   - Combined scoring algorithm for final duplicate determination

### Data Processing

1. **The system must handle data conflicts** by logging conflicts and skipping problematic records, generating detailed reports for manual review.

2. **The system must assign all imported submissions** to the mass-import user (UUID: `00000000-0000-0000-0000-000000000002`, Email: `massimport@funvill.com`).

3. **The system must set imported artwork status** to "pending" for moderation review, following the same approval workflow as user submissions.

4. **The system must add data source attribution** to the description field of logbook entries in a standardized format: `[Import Source: {source_name} - {import_date}]`

5. **The system must process and store external images** by downloading, validating, and uploading them through the existing R2 photo processing pipeline during import.

### Import Script Management

1. **The system must provide CLI tools** that use the import library for creating and running individual data source import scripts.

2. **The system must support incremental imports** by only adding new records when the same data source is re-imported, using external reference tracking.

3. **The system must provide comprehensive logging** including success counts, skipped duplicates, errors, and processing time for each import run.

### Error Handling & Reporting

1. **The system must continue processing** when individual records fail, logging detailed error information and generating summary reports.

2. **The system must validate all imported data** against existing schema requirements before submission to API endpoints.

3. **The system must provide retry mechanisms** for transient failures (network issues, temporary API unavailability) with configurable retry counts.

## Non-Goals (Out of Scope)

1. **Real-time synchronization**: The system will not provide real-time updates from external data sources
2. **Direct database access**: Import scripts will not bypass existing API validation and security layers
3. **Automatic approval**: Imported artworks will not be auto-approved, maintaining existing moderation workflows
4. **Data source management UI**: No web interface for managing import scripts or data sources
5. **Bi-directional sync**: The system will not export data back to external sources
6. **Custom data transformations**: Complex data transformations beyond basic field mapping are not included

## Design Considerations

### Library Architecture

- **Language**: TypeScript for type safety and consistency with existing codebase
- **Package Structure**: Separate npm package (`@cultural-archiver/mass-import`) that can be imported by individual scripts
- **Configuration**: JSON-based configuration files for each data source mapping field relationships and import parameters

### CLI Tool Design

- Command structure: `ca-import --source vancouver-public-art --config ./config.json --dry-run`
- Progress indicators and real-time logging during import execution
- Summary reports saved to `./import-reports/` directory with timestamps

### Data Source Integration

- Support for common formats: JSON, CSV, GeoJSON
- Configurable field mappings for different data source schemas
- HTTP client with proper error handling and rate limiting for external API calls

## Technical Considerations

### Dependencies

- **Existing API endpoints**: Must integrate with current `/api/logbook` submission system
- **Authentication**: Requires mass-import user token to be configured in environment
- **Photo processing**: Depends on existing R2 upload and thumbnail generation pipeline
- **Database**: Uses existing spatial indexing for duplicate detection queries

### Performance

- **Batch processing**: Process imports in configurable batches (default 50 records) to prevent API rate limiting
- **Concurrent requests**: Limit concurrent API calls to prevent overwhelming the system
- **Memory management**: Stream processing for large datasets to prevent memory issues

### Security

- **Input validation**: All external data must be validated and sanitized before API submission
- **Rate limiting**: Respect existing API rate limits and implement backoff strategies
- **File security**: Downloaded images must be validated for type and size before processing

## Success Metrics

1. **Import Throughput**: Successfully process 1000+ artwork records per hour
2. **Duplicate Prevention**: Achieve <2% duplicate artwork creation rate
3. **Data Quality**: Maintain >95% successful import rate for well-formatted datasets
4. **Coverage Increase**: Increase total platform artworks by 300-500% within 6 months of deployment
5. **Error Recovery**: Handle and report errors for >99% of problematic records without stopping entire import
6. **Processing Reliability**: Complete full dataset imports without system crashes or data corruption

## Implementation Phases

### Phase 1: Core Library Development

- Implement basic library functions (search, add artwork, add logbook entry)
- Create duplicate detection algorithm with fuzzy matching
- Build CLI tool foundation with basic import workflow

### Phase 2: Enhanced Features

- Add photo downloading and processing
- Implement comprehensive error handling and reporting
- Create configuration system for different data sources

### Phase 3: Production Integration

- Deploy mass-import user account
- Create Vancouver Public Art import script as proof of concept
- Establish monitoring and logging infrastructure

## Open Questions

1. **Batch Size Optimization**: What is the optimal batch size for API submissions to balance throughput with system stability?

2. **Fuzzy Matching Thresholds**: Should similarity thresholds for duplicate detection be configurable per data source, or use global defaults?

3. **Failed Import Recovery**: Should the system support resuming failed imports from the last successful record, or always restart from the beginning?

4. **Scheduling Integration**: Should the system integrate with task scheduling systems (cron, Cloudflare Cron Triggers) or remain a manual CLI tool?

5. **Data Source Versioning**: How should the system handle when external data sources change their schema or field names?

6. **Import Validation**: Should there be a dry-run mode that shows what would be imported without making actual changes?
