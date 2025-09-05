# Backup and Data Dump System

The Cultural Archiver platform includes a comprehensive backup and data dump system that provides both disaster recovery capabilities and public data sharing functionality.

## Overview

The system consists of two distinct but complementary components:

1. **Backup System**: Complete system snapshots for disaster recovery
2. **Data Dump System**: Public CC0-licensed data exports for researchers and developers

Both systems support multiple access methods: web UI, REST API, and command-line interface.

## Backup System

### Purpose
Create complete system snapshots including all database tables, user data, and photos for disaster recovery purposes.

### Contents
- **Database**: Complete SQL dump of all tables with data and relationships
- **Photos**: Both original files and 800px thumbnails from R2 storage
- **Metadata**: Backup timestamp, content summary, and restoration instructions

### File Structure
```
backup-YYYY-MM-DD-HHMMSS.zip
├── database.sql           # Complete database dump (via Wrangler D1 export)
├── migration_state.json   # Current migration status information
├── photos/
│   ├── originals/         # Full resolution images  
│   └── thumbnails/        # 800px versions
├── metadata.json          # Backup information and integrity checksum
└── README.md             # Restoration instructions
```

### Usage

#### Command Line
```bash
# Generate backup using Wrangler D1 export (recommended)
npm run backup

# Development environment backup  
npm run backup:dev

# Production environment backup
npm run backup:remote

# Download only photos to local directory
npm run backup:photos

# Validate existing backup files
npm run backup:validate

# Custom output directory
npm run backup -- --output-dir ./backups

# Show help
npm run backup -- --help
```

#### New Wrangler Integration Features

**Wrangler D1 Export Mode (Default)**
- Uses `wrangler d1 export` for database backup instead of direct API calls
- Includes migration state tracking in backup metadata
- Provides better D1 compatibility and data consistency
- Supports environment-specific operations (development vs production)

**Enhanced Commands**
- `npm run backup` - Uses Wrangler D1 export with remote Cloudflare resources
- `npm run backup:dev` - Targets development environment D1 database
- `npm run backup:remote` - Targets production environment D1 database  
- `npm run backup:validate` - Validates integrity of existing backup archives

#### Environment Variables
Required for remote backups:
```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id
DATABASE_ID=your-d1-database-id
PHOTOS_BUCKET=your-r2-bucket-name
```

## Data Dump System

### Purpose
Generate public CC0-licensed data exports containing only approved artwork with sensitive information filtered out.

### Contents
- **Artwork Data**: Only approved submissions with public metadata
- **Creator Information**: Artist names and public details
- **Tags**: Metadata and categorization
- **Photos**: Thumbnail images only (800px versions)
- **License**: CC0 1.0 Universal Public Domain Dedication

### Data Filtering
The following sensitive information is **excluded** from public data dumps:
- User tokens and session data
- Email addresses and contact information
- IP addresses and geolocation metadata
- Moderation notes and admin comments
- Rejected or pending submissions
- Internal audit logs

### File Structure
```
datadump-YYYY-MM-DD.zip
├── LICENSE.txt           # CC0 license
├── README.md            # Usage documentation
├── artwork.json         # Approved artwork data
├── creators.json        # Artist information
├── tags.json           # Metadata tags
├── artwork_creators.json # Relationships
├── photos/thumbnails/   # 800px images only
└── metadata.json       # Dataset information
```

### Usage

#### Admin Web Interface
1. Navigate to Admin Dashboard → Data Dumps tab
2. Click "Generate Data Dump" for one-click generation
3. Monitor real-time progress and receive notifications
4. Browse history and download previous dumps

## System Testing

The backup system includes comprehensive testing utilities to ensure reliability:

### Testing Commands
```bash
# Run backup system tests
npm run test:backup

# Run all unit tests (includes backup tests)
npm run test

# Run only worker tests (includes backup library tests)  
npm run test:workers
```

### Test Coverage
- **Environment validation**: Credential checking and security validation
- **CLI functionality**: Help documentation and argument parsing
- **Local mode behavior**: Graceful failure with helpful error messages
- **Remote validation**: Proper credential validation before backup attempts
- **Photos-only mode**: Standalone photo download functionality
- **Archive integrity**: Automated validation of backup completeness
- **Error recovery**: Retry logic and exponential backoff for failed operations

## Security Enhancements

The backup system includes several security features:

### Credential Validation
- **Format checking**: Validates Cloudflare account ID and API token formats
- **Permission requirements**: Ensures API tokens have appropriate D1:Read and R2:Read permissions
- **Environment isolation**: Encourages environment-specific tokens (not global admin tokens)
- **Rotation reminders**: Recommends regular API token rotation (90-day cycle)

### Secure Storage Guidelines
- **Encrypted backups**: Optional encryption for sensitive backup data
- **Access control**: Recommendations for backup file access restrictions
- **Secure transfer**: Guidelines for secure backup file transfer protocols
- **Data retention**: Policy recommendations for backup retention periods

### Integrity Protection
- **Checksum validation**: Automated backup integrity verification
- **Content verification**: File count and size validation
- **Metadata consistency**: Database and photo count verification
- **Error detection**: Comprehensive validation with detailed error reporting

## Reliability Improvements

### Error Recovery
- **Exponential backoff**: Automatic retry logic for failed R2 downloads
- **Partial failure handling**: Continues backup even if some photos fail to download
- **Detailed logging**: Comprehensive error messages and progress reporting
- **Timeout management**: Appropriate timeouts for large backup operations

### Archive Validation
- **File integrity**: Automated validation of ZIP archive completeness
- **Content verification**: Ensures all expected files are present in backup
- **Size validation**: Detects suspiciously small or corrupt backup files
- **Metadata consistency**: Verifies backup metadata matches actual content

### Progress Reporting
- **Real-time progress**: Detailed progress reporting for long-running operations
- **Batch processing**: Efficient handling of large photo collections
- **Performance metrics**: Duration and throughput reporting
- **Memory optimization**: Streaming downloads to prevent memory exhaustion

## Data Dump API

#### REST API
```bash
# Generate a new data dump (admin authentication required)
curl -X POST https://art-api.abluestar.com/api/admin/data-dump/generate \
  -H "Authorization: Bearer <admin-token>"

# List all generated dumps
curl https://art-api.abluestar.com/api/admin/data-dumps \
  -H "Authorization: Bearer <admin-token>"
```

## API Reference

### Admin Data Dump Endpoints

#### POST /api/admin/data-dump/generate
Generate a new public data dump.

**Authentication**: Admin token required

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "filename": "datadump-2025-09-04.zip",
    "size": 2048576,
    "download_url": "https://...",
    "created_at": "2025-09-04T14:30:22.000Z"
  }
}
```

#### GET /api/admin/data-dumps
List all generated data dumps with metadata.

**Authentication**: Admin token required

**Query Parameters**:
- `page` (optional): Page number for pagination
- `limit` (optional): Results per page (max 100)

**Response**:
```json
{
  "success": true,
  "data": {
    "dumps": [
      {
        "id": "uuid",
        "filename": "datadump-2025-09-04.zip",
        "size": 2048576,
        "artwork_count": 150,
        "creator_count": 75,
        "tag_count": 200,
        "photo_count": 145,
        "download_url": "https://...",
        "created_at": "2025-09-04T14:30:22.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "has_more": false
    }
  }
}
```

## Database Schema

### data_dumps Table
The system tracks generated data dumps in the database:

```sql
CREATE TABLE data_dumps (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    size INTEGER NOT NULL,
    artwork_count INTEGER NOT NULL,
    creator_count INTEGER NOT NULL,
    tag_count INTEGER NOT NULL,
    photo_count INTEGER NOT NULL,
    download_url TEXT NOT NULL,
    admin_user_id TEXT NOT NULL,
    warnings TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_data_dumps_created_at ON data_dumps(created_at);
CREATE INDEX idx_data_dumps_admin_user ON data_dumps(admin_user_id);
```

## Security and Privacy

### Data Protection
- All sensitive user information is excluded from public data dumps
- Only approved artwork with public metadata is included
- Original photos are excluded; only thumbnails are distributed
- Admin authentication required for all generation operations

### Licensing
Public data dumps are released under CC0 1.0 Universal Public Domain Dedication, allowing unrestricted use for research, education, and development purposes.

## Setup and Configuration

### Environment Setup
1. Configure Cloudflare credentials for remote operations
2. Ensure proper R2 bucket permissions for photo access
3. Set up admin authentication tokens
4. Create output directories for local backups

### Dependencies
The system uses the following key dependencies:
- Cloudflare Workers D1 for database operations
- Cloudflare R2 for photo storage
- Web Streams API for memory-efficient ZIP creation
- Zod for data validation and type safety

## Troubleshooting

### Common Issues

#### Backup Generation Fails
- **Check Credentials**: Ensure CLOUDFLARE_ACCOUNT_ID and DATABASE_ID are set
- **Verify Permissions**: Confirm admin user has proper access rights
- **Check Storage**: Ensure sufficient disk space for output directory
- **Review Logs**: Check console output for specific error messages

#### Data Dump Generation Timeout
- **Large Datasets**: Generation may take several minutes for large datasets
- **Memory Limits**: Cloudflare Workers have execution time limits
- **Photo Collection**: Large photo collections may require chunked processing

#### Missing Photos in Archives
- **R2 Bucket Access**: Verify PHOTOS_BUCKET environment variable
- **Permissions**: Ensure R2 bucket allows read access
- **Photo Paths**: Check that photo references in database match R2 objects

### Performance Considerations

#### Memory Usage
- ZIP creation is memory-efficient using streaming APIs
- Large datasets are processed in chunks to avoid memory limits
- Photo collection is optimized for Cloudflare Workers constraints

#### Generation Time
- Backup generation: 1-5 minutes depending on data size
- Data dump generation: 30 seconds to 2 minutes for typical datasets
- Photo collection: Depends on number and size of images

### Monitoring and Logs

#### Backup Logs
```
[BACKUP] Starting database dump generation...
[BACKUP] Found 5 tables: ['artwork', 'users', 'logbook', ...]
[BACKUP] Processing table: artwork
[BACKUP] Table artwork: 150 records
[BACKUP] Database dump completed in 1.2s
[BACKUP] Starting R2 photo collection...
[BACKUP] Found 300 objects in R2 bucket
[BACKUP] R2 photo collection completed in 2.1s
[BACKUP] Backup archive created: backup-2025-09-04-143022.zip
```

#### Data Dump Logs
```
[DATA_DUMP] Starting data dump generation...
[DATA_DUMP] Filtering approved artwork: 145 records
[DATA_DUMP] Extracting creators: 75 unique creators
[DATA_DUMP] Processing tags: 200 tags
[DATA_DUMP] Collecting thumbnails: 140 photos
[DATA_DUMP] Data dump archive created: datadump-2025-09-04.zip
```

## Migration and Restoration

### Backup Restoration
1. Extract backup ZIP file
2. Restore database using `database.sql`
3. Upload photos to R2 bucket maintaining folder structure
4. Verify data integrity and photo links

### Data Import
Public data dumps can be imported into other systems:
1. Parse JSON files for structured data
2. Import photos from thumbnails folder
3. Respect CC0 licensing terms
4. Maintain attribution if desired

## Best Practices

### Regular Backups
- Schedule regular backup generation for disaster recovery
- Store backups in multiple locations (local and cloud)
- Test restoration process periodically
- Monitor backup file sizes and content

### Data Dump Management
- Generate fresh data dumps when significant content is added
- Provide clear documentation for data consumers
- Maintain historical versions for research continuity
- Monitor download usage and feedback

### Security
- Rotate admin tokens regularly
- Monitor data dump access logs
- Review exported data for any sensitive information leakage
- Implement proper access controls for backup storage