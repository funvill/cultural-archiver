# PRD: Mass Import System for Public Data Sources

## Executive Summary

The Mass Import System enables automated ingestion of public art data from external sources like government open data portals. This system addresses the challenge of manually entering large volumes of publicly available artwork data by providing a reusable library and CLI tools for efficient, reliable imports with structured metadata preservation.

## Problem Statement

Manual data entry for thousands of public artworks is time-consuming and error-prone. Public data sources like Vancouver's Open Data contain rich artwork information that should be integrated into our platform while maintaining data integrity, avoiding duplicates, and preserving valuable structured metadata.

## Goals

1. **Import Efficiency**: Enable processing of large public art datasets with minimal manual intervention
2. **Data Quality**: Maintain high data integrity through duplicate detection and structured tag validation
3. **Coverage Expansion**: Increase platform coverage by 300-500% through integration of major public art databases
4. **Maintainability**: Create reusable library functions that work across different data source formats
5. **Administrative Efficiency**: Enable bulk approval workflows while maintaining moderation oversight

## Success Metrics

- **Duplicate Prevention**: <2% duplicate artwork creation rate
- **Data Quality**: >95% successful import rate for well-formatted datasets
- **Coverage Increase**: 300-500% increase in total platform artworks within 6 months
- **Tag Application Success**: >90% of imported artworks have structured tags applied
- **Error Recovery**: >99% of problematic records handled without stopping entire import

## User Stories

### System Administrator
- Import Vancouver Public Art dataset with structured tags for comprehensive city coverage
- Run dry-run imports to validate data mapping before production execution

### Content Moderator  
- Bulk approve imported artworks to efficiently process high-quality public data
- Review imported artworks with structured tags and data source attribution

### Developer
- Use standardized library to create import scripts without rebuilding common functionality
- Access detailed import logs and error reporting for troubleshooting

## Functional Requirements

### Core Import Library

**R1: Duplicate Detection**
The system must identify existing artworks using:
- Geographic proximity matching (configurable radius, default 50m)
- Fuzzy string matching on titles (80% similarity threshold)
- External ID tracking for perfect re-import matching

**R2: Data Processing**
The system must:
- Support comprehensive dry-run mode with summary reports and error files
- Continue processing when individual records fail, logging all errors
- Process photos with error tolerance, retrying failures at import completion

**R3: Structured Tagging**
The system must:
- Map external data fields to established tag schema
- Validate all tags against schema before submission
- Apply data source attribution (source, license, import_date tags)
- Support import-specific tags (external_id, import_batch_id, data_source_url)

**R4: API Integration**
The system must:
- Submit data through existing `/api/logbook` endpoints
- Assign submissions to mass-import user account
- Respect existing rate limits and validation rules

### Administrative Functions

**R5: Bulk Approval**
The system must:
- Provide CLI-only bulk approval (no web interface)
- Support approval of all imports from specific data sources
- Require administrator authentication and explicit confirmation
- Maintain audit trails of all approval actions

**R6: Incremental Imports**
The system must:
- Track external IDs to prevent duplicate processing on re-imports
- Detect changes in source data and create edit proposals for existing artworks
- Support retry mechanisms for failed operations

## Non-Goals (Out of Scope)

1. **Real-time synchronization**: The system will not provide real-time updates from external data sources
2. **Direct database access**: Import scripts will not bypass existing API validation and security layers
3. **Custom user interface**: No web interface for managing import scripts, data sources, or approval workflows
4. **Bi-directional sync**: The system will not export data back to external sources
5. **Custom tag schema per import**: All imports must use the established structured tag schema without custom extensions
6. **Individual record approval UI**: Bulk approval will be CLI-based; individual record review remains in existing moderation interface
7. **Historical import tracking**: No long-term audit trail beyond basic import logs and approval records

## Non-Functional Requirements

### Performance
- Sequential processing prioritizing data completeness over speed
- Configurable batch sizes to prevent API overwhelming
- Stream processing for large datasets to manage memory usage

### Security  
- Input validation and sanitization of all external data
- Authentication requirements for bulk approval operations
- Validation of downloaded images for type and size

### Reliability
- Comprehensive error handling and logging
- Rollback capabilities for bulk approvals (24-hour window)
- Retry mechanisms for transient failures

## Technical Architecture

### Design Considerations

#### Library Architecture

- **Language**: TypeScript for type safety and consistency with existing codebase
- **Package Structure**: Separate npm package (`@cultural-archiver/mass-import`) that can be imported by individual scripts
- **Configuration**: JSON-based configuration files for each data source mapping field relationships, tag mappings, and import parameters
- **Tag Integration**: Seamless integration with structured tag schema and validation system

#### CLI Tool Design

- Command structure: `ca-import --source vancouver-public-art --config ./config.json --dry-run`
- Approval commands: `ca-import approve --source vancouver_open_data --confirm`
- Progress indicators and real-time logging during import execution with structured output
- Summary reports saved to `./import-reports/` directory with timestamps and detailed analytics

#### Data Source Integration

- Support for common formats: JSON, CSV, GeoJSON with automatic format detection
- Configurable field mappings for different data source schemas including tag field mappings
- HTTP client with proper error handling and rate limiting for external API calls
- Built-in support for Vancouver Open Data JSON format as reference implementation

#### Structured Tagging Framework

- Integration with existing tag schema and validation rules
- Configurable tag mapping templates for different data sources
- Default tag application (e.g., `tourism=artwork`, `source={data_source_name}`)
- Tag validation and error reporting with specific field-level feedback

### Technical Considerations

#### Dependencies

- **Existing API endpoints**: Must integrate with current `/api/logbook` submission system and structured tag validation
- **Authentication**: Requires mass-import user token to be configured in environment
- **Photo processing**: Depends on existing R2 upload and thumbnail generation pipeline
- **Database**: Uses existing spatial indexing for duplicate detection queries and tag storage
- **Tag validation**: Integrates with existing tag schema validation and error handling systems

#### Performance

- **Batch processing**: Process imports in configurable batches (default 50 records) to prevent API rate limiting
- **Concurrent requests**: Limit concurrent API calls to prevent overwhelming the system
- **Memory management**: Stream processing for large datasets to prevent memory issues
- **Dry-run optimization**: Cache validation results and duplicate detection for fast dry-run iterations

#### Security

- **Input validation**: All external data must be validated and sanitized before API submission
- **Rate limiting**: Respect existing API rate limits and implement backoff strategies
- **File security**: Downloaded images must be validated for type and size before processing
- **Bulk approval security**: Require administrator authentication and confirmation for bulk approval operations
- **Tag validation security**: Prevent injection attacks through strict tag schema validation

### Components

1. **Core Library** (`@cultural-archiver/mass-import`): TypeScript package with reusable import functions
2. **CLI Tools**: Command-line interface for running imports and bulk operations
3. **Vancouver Import Script**: Reference implementation for Vancouver Open Data

### Integration Points

- Existing `/api/logbook` submission endpoints
- Structured tag schema and validation system
- R2 photo processing pipeline
- Mass-import user account (UUID: `00000000-0000-0000-0000-000000000002`)

## Implementation Plan

### Phase 1: Core Library (4 weeks)
- Develop duplicate detection algorithms
- Implement structured tag validation and mapping
- Create comprehensive dry-run functionality
- Build basic CLI interface

### Phase 2: Vancouver Implementation (3 weeks)
- Create Vancouver-specific field mappings
- Implement photo downloading and processing
- Add comprehensive error handling and reporting
- Develop bulk approval commands

### Phase 3: Production Deployment (2 weeks)
- Execute Vancouver dataset import (~3000 artworks)
- Establish monitoring and logging infrastructure
- Create administrator documentation
- Validate success metrics

## Vancouver Public Art Import Specification

### Data Source Overview

- **Source**: Vancouver Open Data - Public Art Registry
- **Format**: JSON array with ~3000+ artwork records
- **Update Frequency**: Quarterly updates from City of Vancouver
- **Data Quality**: High-quality municipal data with comprehensive metadata
- **License**: CC0 (Creative Commons Public Domain)

### Field Mapping Configuration

The Vancouver import script will use the following field mappings from the source JSON to platform fields and structured tags:

#### Core Artwork Fields

```json
{
  "title": "title_of_work",
  "description": "descriptionofwork",
  "notes": "artistprojectstatement", 
  "coordinates": {
    "lat": "geo_point_2d.lat",
    "lon": "geo_point_2d.lon"
  }
}
```

#### Structured Tag Mappings

```json
{
  "tags": {
    "tourism": "artwork",
    "artwork_type": {
      "source_field": "type",
      "transform": "lowercase_with_underscores"
    },
    "artist_name": {
      "source_field": "artists",
      "transform": "array_to_comma_separated"
    },
    "material": "primarymaterial",
    "start_date": {
      "source_field": "yearofinstallation",
      "validation": "year_format"
    },
    "location_type": "sitename",
    "access": "yes",
    "fee": "no",
    "subject": {
      "source_field": "neighbourhood", 
      "prefix": "neighbourhood_"
    },
    "source": "vancouver_open_data",
    "import_date": "2025-09-05",
    "external_id": "registryid",
    "website": "url",
    "license": "CC0",
    "import_batch_id": {
      "source": "generated_uuid"
    },
    "data_source_url": {
      "template": "https://opendata.vancouver.ca/explore/dataset/public-art/information/?refine.registryid={external_id}"
    }
  }
}
```

#### Photo Processing

- **Source**: `photourl.url` field containing image URLs
- **Processing**: Download and process through existing R2 pipeline
- **Credits**: Apply `photocredits` field to photo metadata
- **Validation**: Check image accessibility and format before processing

### Import Script Features

1. **Comprehensive Dry-run**: Validate all 3000+ records without API calls, producing summary reports and detailed error files
2. **Duplicate Detection**: Check against existing Vancouver artworks using external ID tracking and fuzzy matching
3. **Tag Validation**: Ensure all mapped tags conform to schema, including new import-specific tags
4. **Photo Download with Error Tolerance**: Process all available artwork photos, log failures, continue processing, and retry failed photos at the end
5. **Error Reporting**: Generate summary statistics and separate detailed error files for manual review
6. **Progress Tracking**: Sequential processing prioritizing data completeness over speed
7. **License Attribution**: Apply CC0 license tags and update descriptions with attribution text

### Expected Results

- **Total Records**: ~3000 Vancouver public artworks
- **Processing Approach**: Sequential processing prioritizing data completeness over speed
- **Expected Success Rate**: >95% successful imports
- **Structured Tags**: 10-15 tags per artwork on average (including new import-specific tags)
- **Photo Coverage**: ~80% of artworks will have processed photos
- **License Attribution**: All artworks include CC0 license tags and attribution in descriptions

## Example Usage Workflows

### Typical Import Process

```bash
# 1. Initial dry-run to validate data and mappings
ca-import --source vancouver-public-art --config ./vancouver-config.json --dry-run

# 2. Review dry-run summary report and error details
cat ./import-reports/vancouver-public-art-dry-run-summary-2025-09-05.json
cat ./import-reports/vancouver-public-art-dry-run-errors-2025-09-05.json

# 3. Execute actual import (sequential processing for data completeness)
ca-import --source vancouver-public-art --config ./vancouver-config.json

# 4. Review import results and retry failed photos
cat ./import-reports/vancouver-public-art-import-2025-09-05.json
ca-import retry-photos --source vancouver-public-art

# 5. Bulk approve all Vancouver imports (CLI-only, bypass web moderation)
ca-import approve --source vancouver-public-art --all --confirm
```

### Configuration File Example

```json
{
  "source": "vancouver-public-art",
  "data_file": "./public-art.json",
  "processing_mode": "sequential",
  "duplicate_radius_meters": 50,
  "field_mappings": {
    "title": "title_of_work",
    "description": "descriptionofwork",
    "coordinates": {
      "lat": "geo_point_2d.lat", 
      "lon": "geo_point_2d.lon"
    }
  },
  "tag_mappings": {
    "tourism": "artwork",
    "artwork_type": {
      "source_field": "type",
      "transform": "lowercase_with_underscores"
    },
    "artist_name": "artists[0]",
    "material": "primarymaterial",
    "source": "vancouver_open_data",
    "license": "CC0",
    "external_id": "registryid"
  },
  "photo_config": {
    "source_field": "photourl.url",
    "credits_field": "photocredits",
    "download_timeout": 30,
    "retry_on_failure": true
  },
  "license_config": {
    "license_tag": "CC0",
    "attribution_text": "Data licensed under CC0 from City of Vancouver Open Data Portal. Original source: https://opendata.vancouver.ca/explore/dataset/public-art/"
  }
}
```

### Library Usage Example

```typescript
import { MassImportLibrary } from '@cultural-archiver/mass-import';

const importer = new MassImportLibrary({
  apiToken: process.env.MASS_IMPORT_TOKEN,
  baseUrl: 'https://art-api.abluestar.com'
});

// Dry run process
const dryRunResults = await importer.dryRun({
  source: 'vancouver-public-art',
  data: vancouverData,
  config: importConfig
});

// Actual import process  
const importResults = await importer.processImport({
  source: 'vancouver-public-art',
  data: vancouverData,
  config: importConfig,
  dryRun: false
});

// Bulk approval
const approvalResults = await importer.bulkApprove({
  source: 'vancouver-public-art',
  batchSize: 100,
  confirm: true
});
```

## Open Questions

1. **Tag Schema Evolution**: How frequently should we review and update import-specific tags?
2. **Bulk Approval Granularity**: Should approval work only at data source level or support more filtering?
3. **Error Recovery Strategy**: Should failed imports support resume-from-checkpoint functionality?
4. **Performance Monitoring**: What additional metrics should we track for import health monitoring?
5. **Batch Size Optimization**: What is the optimal batch size for API submissions to balance throughput with system stability when including structured tag validation?
6. **Fuzzy Matching Thresholds**: Should similarity thresholds for duplicate detection be configurable per data source, or use global defaults? How should tag similarity factor into duplicate detection?
7. **Bulk Approval Safety**: What additional safety mechanisms should be in place for bulk approval operations beyond confirmation prompts?
8. **Tag Mapping Evolution**: How should the system handle when external data sources change their schema or add new fields that could map to tags?
9. **Dry-run Data Persistence**: Should dry-run results be cached to speed up subsequent actual imports, and how long should this cache be valid?
10. **Import Rollback**: Beyond bulk approval rollback, should the system support rolling back entire import operations, and what would be the technical complexity?
11. **Tag Validation Flexibility**: Should the system allow "soft" tag validation failures that log warnings but don't block imports for non-critical tag fields?

## Appendix: Example CLI Usage

```bash
# Dry-run validation
ca-import --source vancouver-public-art --config ./config.json --dry-run

# Execute import
ca-import --source vancouver-public-art --config ./config.json

# Retry failed photos
ca-import retry-photos --source vancouver-public-art

# Bulk approve all Vancouver imports  
ca-import approve --source vancouver-public-art --all --confirm
```
