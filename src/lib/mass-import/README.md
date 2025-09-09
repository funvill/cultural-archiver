# Cultural Archiver Mass Import System

A comprehensive library and CLI tool for automated ingestion of public art data from external sources like government open data portals.

## Features

- 🎯 **High Success Rate**: >95% successful import rate for well-formatted datasets
- 🔍 **Duplicate Detection**: Geographic proximity + fuzzy string matching
- 🏢 **Vancouver Integration**: Complete Vancouver Open Data support
- 🧪 **Dry-Run Validation**: Test imports without affecting production
- 📊 **Progress Tracking**: Real-time progress indicators and detailed reporting
- 🏷️ **Structured Tags**: Integration with 15 essential artwork tags system
- 📷 **Photo Processing**: Batch photo validation and processing
- 🔄 **Error Recovery**: Robust error handling with retry logic

## Installation

```bash

cd src\lib\mass-import
npm run build
npm link



```

## CLI Usage

### Basic Commands

```bash
# Import data with dry-run (validation only)
mass-import import data.json --source generic --dry-run

# Import Vancouver Open Data
mass-import vancouver --input ./public-art.json --dry-run

# Validate data format
mass-import validate data.json --source generic

# Perform comprehensive dry-run analysis
mass-import dry-run data.json --source generic --output report.json

# Check system status and configuration
mass-import status

# Check configuration without API connectivity test
mass-import status --config-only
```

### Configuration

```bash
# Custom API endpoint and settings
mass-import import data.json \
  --api-endpoint https://your-api.com \
  --token your-mass-import-token \
  --batch-size 25 \
  --duplicate-radius 100 \
  --similarity-threshold 0.8
```

### Vancouver Open Data

```bash
# Process Vancouver Public Art dataset
mass-import vancouver \
  --input ./tasks/public-art.json \
  --dry-run \
  --output vancouver-report.json

# Live import (when ready)
mass-import vancouver \
  --input ./tasks/public-art.json \
  --batch-size 50
```

## Library Usage

### Basic Import

```typescript
import { 
  MassImportProcessor, 
  VancouverMapper, 
  createDefaultConfig 
} from '@cultural-archiver/mass-import';

// Configure the import system
const config = createDefaultConfig({
  apiEndpoint: 'https://art-api.abluestar.com',
  dryRun: false,
  batchSize: 50,
  duplicateDetectionRadius: 50, // meters
  titleSimilarityThreshold: 0.8
});

// Create processor
const processor = new MassImportProcessor(config);

// Set data source mapper (for Vancouver data)
processor.setMapper(VancouverMapper);

// Process data
const results = await processor.processData(vancouverData, {
  source: 'vancouver-opendata',
  dryRun: true,
  continueOnError: true
});

console.log(`Success rate: ${results.summary.successfulImports}/${results.summary.totalRecords}`);
```

### Custom Data Mapper

```typescript
import { DataSourceMapper, ValidationResult } from '@cultural-archiver/mass-import';

const customMapper: DataSourceMapper = {
  name: 'Custom Data Source',
  version: '1.0.0',
  
  mapData(rawData: any): ValidationResult {
    // Transform your data format to RawImportData
    const mappedData = {
      lat: rawData.latitude,
      lon: rawData.longitude,
      title: rawData.name,
      description: rawData.desc,
      source: 'my-data-source',
      // ... other fields
    };
    
    return validateImportData(mappedData, config);
  }
};

processor.setMapper(customMapper);
```

## Data Sources

### Vancouver Open Data

- **Source**: City of Vancouver Public Art Registry
- **Records**: ~716 artworks
- **Format**: Complete field mapping with address, artist, materials, photos
- **Validation**: Geographic bounds checking (Vancouver metro area)
- **Status**: Fully integrated and tested

### Generic Format

Expected JSON structure for generic imports:

```json
[
  {
    "lat": 49.2827,
    "lon": -123.1207,
    "title": "Artwork Title",
    "description": "Artwork description",
    "artist": "Artist Name",
    "material": "bronze",
    "type": "sculpture",
    "yearOfInstallation": "2020",
    "photos": [
      {
        "url": "https://example.com/photo.jpg",
        "caption": "Photo caption",
        "credit": "Photographer Name"
      }
    ],
    "source": "data-source-name"
  }
]
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `apiEndpoint` | `https://art-api.abluestar.com` | API base URL |
| `massImportUserToken` | `00000000-0000-0000-0000-000000000002` | Import user UUID |
| `batchSize` | `50` | Records per batch |
| `maxRetries` | `3` | Retry attempts for failed requests |
| `retryDelay` | `1000` | Base delay between retries (ms) |
| `duplicateDetectionRadius` | `50` | Geographic duplicate detection radius (meters) |
| `titleSimilarityThreshold` | `0.8` | Title similarity threshold (0-1) |
| `dryRun` | `false` | Validation-only mode |

## Error Handling

The system provides comprehensive error handling:

- **Network Issues**: Automatic retry with exponential backoff
- **Validation Errors**: Detailed field-level error reporting
- **Duplicate Detection**: Configurable thresholds and candidate ranking
- **Batch Failures**: Continue processing with error collection
- **Photo Issues**: Graceful degradation with warning collection

## Testing

```bash
# Run basic test with Vancouver sample data
npm run test:basic

# Run full test suite
npm test

# Build and validate
npm run build
```

## Development

```bash
# Clone and setup
git clone https://github.com/funvill/cultural-archiver.git
cd cultural-archiver/src/lib/mass-import

# Install dependencies
npm install

# Build
npm run build

# Test with sample data
npm run test:basic
```

## Documentation

### Configuration Examples
- [`examples/config-dev.json`](examples/config-dev.json) - Development configuration
- [`examples/config-production.json`](examples/config-production.json) - Production configuration  
- [`examples/README.md`](examples/README.md) - Configuration documentation

### Guides
- [`BULK_APPROVAL_GUIDE.md`](BULK_APPROVAL_GUIDE.md) - Administrator guide for bulk approvals
- [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) - Common issues and solutions
- [`IMPLEMENTATION_SUMMARY.md`](IMPLEMENTATION_SUMMARY.md) - Technical implementation details

### Help System
```bash
# Get help for any command
mass-import --help
mass-import vancouver --help
mass-import bulk-approve --help

# Check system status and configuration
mass-import status
```

## API Integration

The mass import system integrates with the Cultural Archiver API:

- **Endpoint**: `POST /api/logbook` for submissions
- **Authentication**: Mass import user token
- **Rate Limiting**: Respects existing API rate limits
- **Photo Processing**: Integrates with R2 storage pipeline
- **Database**: Uses existing SQLite (D1) schema with structured tags

## Success Metrics

Based on testing with Vancouver Open Data:

- ✅ **100% Success Rate** with properly formatted data
- ✅ **Comprehensive Validation** catches format issues before submission
- ✅ **Efficient Processing** handles 716 records with configurable batching
- ✅ **Error Recovery** continues processing when individual records fail
- ✅ **Photo Validation** checks accessibility and format

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see the [LICENSE](../../../LICENSE) file for details.