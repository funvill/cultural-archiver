# PRD: Backup and Data Dump System

## Introduction/Overview

The Cultural Archiver needs a dual-purpose export system to ensure data protection and enable open data sharing. This feature implements two distinct capabilities:

1. **Backup System**: A private disaster recovery tool that creates complete system snapshots for rebuilding the platform in case of production database failure
2. **Data Dump System**: A public data export that provides CC0-licensed artwork data for researchers, developers, and other projects

The MVP focuses on basic implementations of both systems with admin-triggered generation and simple error handling, laying the foundation for future automation and optimization.

## Goals

1. Provide reliable disaster recovery capability through complete system backups
2. Enable open data sharing with public, CC0-licensed data dumps
3. Create admin-accessible tools for generating both backup and data dump archives
4. Establish foundation for automated monthly data dump generation
5. Ensure data privacy by excluding sensitive information from public data dumps

## User Stories

1. **As a system administrator**, I want to run `npm run backup` to create a complete system backup so that I can restore the platform after a disaster.

2. **As a platform administrator**, I want to trigger a data dump generation through the admin interface so that I can provide updated public data to the community.

3. **As a researcher**, I want to download public artwork data dumps from the help page so that I can analyze public art trends and patterns.

4. **As a developer**, I want to access CC0-licensed artwork data so that I can build complementary applications or services.

5. **As a data user**, I want clear documentation about when the data was collected and its source so that I can properly cite and understand the dataset.

## Functional Requirements

### Backup System

1. The system must provide an `npm run backup` command that creates a complete local backup ZIP file
2. The backup must include the complete database dump with all tables, records, and relationships
3. The backup must include all R2 photos (both originals and thumbnails) for approved artwork
4. The backup must preserve exact timestamps, internal IDs, and audit trails
5. The backup file must be named with timestamp format: `backup-YYYY-MM-DD-HHMMSS.zip`
6. The backup must be stored locally only with basic access controls
7. The backup process must use basic try/catch error handling with console logging

### Data Dump System

1. The system must provide an admin-only API endpoint for triggering data dump generation
2. The data dump must include only approved artwork with public metadata fields
3. The data dump must exclude all user-specific data (emails, IP addresses, tokens, session data)
4. The data dump must exclude rate limiting data, moderation notes, and private admin comments
5. The data dump must exclude rejected submissions, spam content, and deleted artwork
6. The data dump must be organized as multiple JSON files to handle large datasets efficiently
7. The data dump must include thumbnails (800px versions) of approved artwork photos
8. The data dump file must be named with timestamp format: `datadump-YYYY-MM-DD.zip`
9. The data dump must include CC0 license text and README documentation
10. The data dump must include metadata about generation date and data source
11. The data dump must be stored in R2 bucket for public access
12. Generated data dumps must be accessible through the admin interface initially

### Data Structure

1. The backup must use raw database dump format preserving all system data
2. The data dump must use a simple field blacklist approach to exclude sensitive data
3. The data dump must organize data into logical JSON files (artwork.json, creators.json, etc.)
4. Both systems must process data in memory for MVP simplicity
5. Both systems must include basic error logging for troubleshooting

## Non-Goals (Out of Scope)

1. Automated monthly data dump generation (future enhancement)
2. Help page integration for public download links (future phase)
3. Point-in-time recovery or incremental backups
4. Advanced data anonymization or comprehensive privacy controls
5. Streaming or chunked processing for large datasets
6. Multiple backup storage locations or encryption
7. Backup validation or automated restore capabilities
8. Rate limiting on data dump downloads
9. User analytics or download tracking
10. Multiple export formats (CSV, GeoJSON) beyond JSON

## Design Considerations

### Admin Interface Integration

- Add "Generate Data Dump" button to existing admin panel
- Display generation status and completion notifications
- Show list of previously generated dumps with download links

### File Structure

**Backup Archive:**

```text
backup-2025-09-04-143022.zip
├── database.sql
├── photos/
│   ├── originals/
│   └── thumbnails/
└── metadata.json
```

**Data Dump Archive:**

```text
datadump-2025-09-04.zip
├── LICENSE.txt (CC0)
├── README.md
├── artwork.json
├── creators.json
├── tags.json
├── photos/
│   └── thumbnails/
└── metadata.json
```

## Technical Considerations

1. Integrate with existing Cloudflare Workers architecture
2. Use existing R2 bucket configuration for data dump storage
3. Leverage existing admin authentication middleware
4. Build on current database connection and query patterns
5. Follow existing error handling patterns with basic logging
6. Use existing file upload/download utilities where applicable
7. Consider database size limitations for in-memory processing

## Success Metrics

1. Successful backup generation within 5 minutes for current dataset size
2. Data dump generation completes without memory errors
3. Generated archives contain expected file counts and structure
4. Admin interface successfully triggers both backup and data dump processes
5. Public data dumps exclude all sensitive information as verified by manual review
6. Zero data corruption in backup files when tested with restore process

## Open Questions

1. Should we set a maximum dataset size limit for MVP in-memory processing?
2. How should we handle partial failures during photo collection from R2?
3. Should the admin interface show progress indicators for long-running operations?
4. Do we need to validate that generated archives are not corrupted?
5. Should we implement any compression optimization for the ZIP files?
6. How should we handle artwork with missing or deleted photos during dump generation?
