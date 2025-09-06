# Cultural Archiver Mass Import System

A comprehensive TypeScript library and CLI tools for importing public art data from external sources into the Cultural Archiver platform. Designed for efficient, reliable imports with validation, duplicate detection, and structured metadata preservation.

## Features

- **Data Validation**: Comprehensive input validation using Zod schemas
- **Duplicate Detection**: Geographic proximity and fuzzy title matching
- **Structured Tagging**: Integration with Cultural Archiver's 15 essential tags system
- **Dry-Run Mode**: Validation without API calls for safe testing
- **CLI Tools**: Command-line interface for import operations
- **Vancouver Integration**: Built-in support for Vancouver Open Data format
- **Progress Reporting**: Detailed statistics and error reporting
- **Photo Processing**: Integration with R2 photo pipeline

## Installation

```bash
# Install the package
npm install @cultural-archiver/mass-import

# Or install globally for CLI access
npm install -g @cultural-archiver/mass-import
```

## CLI Usage

### Basic Commands

```bash
# Show help
ca-import --help

# Validate data file
ca-import validate --data ./public-art.json --source vancouver-public-art

# Dry-run (validation only)
ca-import dry-run --source vancouver-public-art --config ./config.json --data ./public-art.json

# Execute import
ca-import import --source vancouver-public-art --config ./config.json --data ./public-art.json

# Bulk approve (admin only)
ca-import bulk-approve --source vancouver-public-art --confirm
```

### Configuration File

Create a configuration file with your API credentials:

```json
{
  "apiBaseUrl": "https://art-api.abluestar.com",
  "apiToken": "your-mass-import-token",
  "source": "vancouver-public-art"
}
```

### Vancouver Import Script

Use the included Vancouver import script for a complete workflow:

```bash
# Dry-run validation
node scripts/vancouver-import.js --dry-run

# Full import
node scripts/vancouver-import.js --config=./production-config.json
```

## Library Usage

### Basic Import Process

```typescript
import { MassImportLibrary, mapVancouverRecord } from '@cultural-archiver/mass-import';

const config = {
  apiBaseUrl: 'https://art-api.abluestar.com',
  apiToken: 'your-token',
  source: 'vancouver-public-art',
  dryRun: true // Start with validation
};

const importer = new MassImportLibrary(config);

// Load and map Vancouver data
const vancouverRecords = loadVancouverData();
const importRecords = vancouverRecords.map(mapVancouverRecord);

// Process import
const result = await importer.processImport(importRecords);
console.log(`Processed ${result.totalRecords} records`);
console.log(`Success: ${result.successCount}, Failed: ${result.failureCount}`);
```

### Vancouver Data Mapping

```typescript
import { mapVancouverRecord, isValidVancouverRecord } from '@cultural-archiver/mass-import';

// Validate Vancouver record
if (isValidVancouverRecord(record)) {
  // Convert to Cultural Archiver format
  const importRecord = mapVancouverRecord(record);
  
  // Tags are automatically mapped
  console.log(importRecord.tags.tourism); // 'artwork'
  console.log(importRecord.tags.artwork_type); // 'sculpture'
  console.log(importRecord.tags.source); // 'vancouver-opendata'
}
```

### Custom Data Processing

```typescript
import { MassImportLibrary, ImportRecord } from '@cultural-archiver/mass-import';

// Create custom import records
const records: ImportRecord[] = [
  {
    externalId: 'custom-1',
    lat: 49.293313,
    lon: -123.133965,
    title: 'Custom Artwork',
    description: 'A custom artwork description',
    tags: {
      tourism: 'artwork',
      artwork_type: 'sculpture',
      material: 'bronze',
      source: 'custom-import'
    }
  }
];

const importer = new MassImportLibrary(config);
const result = await importer.processImport(records);
```

## Data Format Support

### Vancouver Open Data

The system includes comprehensive support for Vancouver's Public Art dataset:

- **Automatic field mapping** from Vancouver schema to Cultural Archiver types
- **Tag conversion** using the structured tag system
- **Photo URL processing** with validation
- **Geographic validation** within Vancouver bounds
- **Quality statistics** reporting

### Custom Data Sources

Extend the system for other data sources:

```typescript
import { ImportRecord } from '@cultural-archiver/mass-import';

function mapCustomRecord(customRecord: any): ImportRecord {
  return {
    externalId: customRecord.id,
    lat: customRecord.latitude,
    lon: customRecord.longitude,
    title: customRecord.name,
    description: customRecord.description,
    tags: {
      tourism: 'artwork',
      artwork_type: mapArtworkType(customRecord.type),
      source: 'custom-source'
    }
  };
}
```

## Features in Detail

### Duplicate Detection

- **Geographic proximity**: Configurable radius (default 50m)
- **Fuzzy title matching**: 80% similarity threshold using Levenshtein distance
- **External ID tracking**: Perfect matching for re-imports

### Validation

- **Coordinate bounds**: Validates latitude/longitude ranges
- **Required fields**: Ensures essential data is present
- **Tag schema**: Validates against Cultural Archiver's structured tags
- **Photo URLs**: Validates format and accessibility

### Error Handling

- **Graceful degradation**: Continue processing when individual records fail
- **Detailed logging**: Comprehensive error and warning reports
- **Retry logic**: Configurable retry for network operations
- **Batch processing**: Rate-limited API calls

### Reporting

The system generates detailed reports:

- **Summary statistics**: Success/failure counts, processing time
- **Error details**: Specific failures with context
- **Warning logs**: Non-critical issues
- **Geographic coverage**: Bounds and distribution statistics

## API Integration

The mass import system integrates with existing Cultural Archiver APIs:

- **Logbook endpoints**: Uses `/api/logbook` for submissions
- **Authentication**: Mass-import user account integration
- **Rate limiting**: Respects existing API limits
- **Photo processing**: Integrates with R2 pipeline

### Mass Import User Account

All imports are attributed to the special mass-import user account:
- **UUID**: `00000000-0000-0000-0000-000000000002`
- **Purpose**: Distinguish imported content from user submissions
- **Permissions**: Special account for bulk operations

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Type Checking

```bash
npm run type-check
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

**Cultural Archiver Mass Import System** - Efficient, reliable public art data import with validation and quality assurance.