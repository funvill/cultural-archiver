# Mass Import System

Modular plugin-based system for importing and exporting public art data from various sources.

## Overview

The Mass Import System provides a flexible, plugin-based architecture for:

- **Data Collection**: Scrapers for various data sources (OpenStreetMap, city databases, art galleries)
- **Data Import**: Importers that parse and validate data from different formats
- **Data Export**: Exporters that send data to various destinations (API, files, console)
- **Data Processing**: Pipeline for transforming, validating, and enhancing data

## Directory Structure

```
src/mass-import/
├── cli/                    # Command-line interface
│   ├── cli-entry.ts       # CLI entry point
│   ├── plugin-cli.ts      # CLI implementation
│   └── README.md          # CLI documentation
│
├── config/                # Configuration files
│   └── api-config.json   # API exporter configuration
│
├── exporters/            # Exporter plugins
│   ├── api-exporter.ts   # API exporter (v2 and v3)
│   ├── console-exporter.ts  # Console output exporter
│   ├── json-exporter.ts  # JSON file exporter
│   └── index.ts          # Exporter registration
│
├── importers/            # Importer plugins
│   ├── artist-json.ts    # Artist JSON importer (legacy + v3)
│   ├── osm-artwork.ts    # OSM GeoJSON importer
│   └── index.ts          # Importer registration
│
├── lib/                  # Core library code
│   ├── data-pipeline.ts  # Data processing pipeline
│   ├── plugin-registry.ts  # Plugin management
│   └── location-enhancer.ts  # Location enhancement
│
├── scraper/             # Data collection scrapers
│   ├── burnaby-art-gallery/  # Burnaby Art Gallery scraper
│   ├── new-west-city/        # New Westminster scraper
│   ├── shared/              # Shared scraper utilities
│   └── output/              # Scraper output files
│
└── types/               # TypeScript type definitions
    ├── plugin.ts        # Plugin interfaces
    └── scraper.ts       # Scraper types
```

## Quick Start

### 1. Run a Scraper

Collect data from a source:

```powershell
# Burnaby Art Gallery
npx tsx src/mass-import/scraper/burnaby-art-gallery/cli.ts --verbose --output src/mass-import/scraper/output

# New Westminster
npx tsx src/mass-import/scraper/new-west-city/cli.ts --verbose --output src/mass-import/scraper/output
```

### 2. Import Data via CLI

Import the scraped data:

```powershell
# Import artists
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer artist-json `
  --exporter api `
  --input src/mass-import/scraper/output/burnaby-art-gallery-artists.json `
  --verbose

# Import artworks
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer osm-artwork `
  --exporter api `
  --input src/mass-import/scraper/output/burnaby-art-gallery-artworks.geojson `
  --verbose
```

## Architecture

### Plugin System

The system is built around a plugin architecture with three main components:

1. **Importers**: Parse and validate input data
   - `artist-json`: Handles artist JSON data (legacy and v3 formats)
   - `osm-artwork`: Handles GeoJSON artwork data

2. **Exporters**: Send data to destinations
   - `api`: POST data to Mass Import v3 API endpoint
   - `json`: Write data to JSON files
   - `console`: Output data for debugging

3. **Pipeline**: Coordinates data flow between importers and exporters
   - Validates data
   - Transforms formats
   - Handles batching
   - Manages errors
   - Generates reports

### Data Flow

```text
Source Data → Scraper → JSON/GeoJSON Files → Importer → Pipeline → Exporter → API → Database + R2
```

**Example Flow:**

1. **Scraper** collects data from Burnaby Art Gallery website
2. **Outputs** `artists.json` and `artworks.geojson` files with external photo URLs
3. **Importer** (`osm-artwork`) parses and validates artwork data
4. **Pipeline** processes data in batches
5. **Exporter** (`api`) sends to Mass Import v3 API endpoint
6. **API Handler** processes each artwork:
   - Links artists to artwork
   - Downloads photos from external URLs
   - Uploads photos to R2 storage
   - Stores R2 URLs in database
7. **Result** stored in database with R2-hosted photos

**Photo Processing Workflow:**

```text
External URL → Download (30s timeout) → Validate (type/size) → Upload to R2 → Store R2 URL
```

**Photo Storage:**

- **R2 Path**: `mass-import/YYYY/MM/DD/TIMESTAMP-sanitized-filename.ext`
- **Metadata**: Original URL, upload source, timestamp, format, size
- **Size Limit**: 15MB per photo
- **Supported Formats**: JPEG, PNG, WebP, GIF

## Components

### Scrapers

Located in `scraper/` directory:

- **Burnaby Art Gallery**: Scrapes artist and artwork data
- **New Westminster**: Scrapes public art data
- **Shared**: Common utilities for all scrapers

Each scraper can output:

- **Artists**: JSON format with artist information
- **Artworks**: GeoJSON format with location and metadata

See individual scraper READMEs for details.

### Importers

Located in `importers/` directory:

#### artist-json

Imports artist data from JSON files. Supports two formats:

**V3 Format** (current):

```json
{
  "type": "Artist",
  "id": "source/artist-id",
  "name": "Artist Name",
  "description": "Biography",
  "properties": {
    "source": "https://example.com",
    "source_url": "https://example.com/artist/123"
  }
}
```

**Legacy Format** (backward compatible):

```json
{
  "source": "https://example.com",
  "source_url": "https://example.com/artist/123",
  "name": "Artist Name",
  "biography": "Biography"
}
```

#### osm-artwork

Imports artwork data from GeoJSON files. Handles both legacy and modern photo formats.

**GeoJSON Format:**

```json
{
  "type": "Feature",
  "id": "source/artwork-id",
  "geometry": {
    "type": "Point",
    "coordinates": [-122.9128, 49.2069]
  },
  "properties": {
    "title": "Artwork Title",
    "artists": ["Artist Name"],
    "source": "https://example.com",
    "photos": ["https://example.com/photo.jpg"]
  }
}
```

**Photo Handling:**

The importer accepts external photo URLs in multiple formats:

```json
// Simple URL array
"photos": ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"]

// Or with metadata (caption, credit)
"photos": [
  {
    "url": "https://example.com/photo1.jpg",
    "caption": "Front view",
    "credit": "Photographer Name"
  }
]
```

**Automatic R2 Upload:**

When photos are imported, the Mass Import v3 API automatically:

1. Downloads photos from external URLs with browser headers
2. Validates content-type and file size (15MB limit)
3. Uploads to Cloudflare R2 storage at `mass-import/YYYY/MM/DD/TIMESTAMP-filename.ext`
4. Stores metadata (original URL, upload timestamp, format, size)
5. Updates database with R2 URL instead of external URL

**Benefits:**

- ✅ No hotlinking to external sources
- ✅ Photos owned and controlled by the platform
- ✅ CDN-ready R2 storage for fast delivery
- ✅ Resilient to external site changes or deletions
- ✅ Metadata tracking for audit trails

### Exporters

Located in `exporters/` directory:

#### api

Sends data to Mass Import v3 API endpoint:

- Supports both artists and artworks
- Handles authentication
- Retry logic with exponential backoff
- Validates API responses
- Configurable via `api-config.json`

#### json

Writes data to JSON files:

- Pretty-printed output
- Configurable output path
- Useful for debugging and data inspection

#### console

Outputs data to terminal:

- Color-coded output
- Useful for debugging
- Shows data structure

## Configuration

### API Configuration

Create `src/mass-import/config/api-config.json`:

```json
{
  "apiEndpoint": "http://127.0.0.1:8787/api/mass-import/v3",
  "method": "POST",
  "authentication": {
    "type": "bearer",
    "token": "a0000000-1000-4000-8000-000000000001"
  },
  "timeout": 30000,
  "retryAttempts": 2,
  "duplicateThreshold": 0.75
}
```

### Local dev authentication

When testing imports against a local dev server, use the canonical system admin
token below so the mass-import worker will accept requests as an admin user.

- Canonical system admin token: `a0000000-1000-4000-8000-000000000001`

Example `api-config-dev-v3.json` (placed under `src/mass-import/config/`):

```json
{
  "importer": {
    "includeUnknownFeatureTypes": true
  },
  "exporter": {
    "apiEndpoint": "http://localhost:8787/api/mass-import/v3",
    "method": "POST",
    "headers": { "Content-Type": "application/json" },
    "authentication": {
      "type": "bearer",
      "token": "a0000000-1000-4000-8000-000000000001"
    },
    "timeout": 30000,
    "retryAttempts": 3,
    "retryDelay": 1000,
    "validateResponse": true,
    "transformData": true
  }
}
```

### Environment-Specific Configuration

- **Local**: `http://127.0.0.1:8787/api/mass-import/v3`
- **Staging**: `https://test.publicartregistry.com/api/mass-import/v3`
- **Production**: `https://api.publicartregistry.com/api/mass-import/v3`

## Development

### Adding a New Importer

1. Create file in `importers/` directory
2. Implement `ImporterPlugin` interface:
   - `name`: Plugin identifier
   - `metadata`: Plugin information
   - `supportedFormats`: File formats (json, geojson, csv)
   - `validateData()`: Validate input data
   - `mapData()`: Transform to `RawImportData[]`

3. Register in `importers/index.ts`:

```typescript
import { myImporter } from './my-importer.js';
registry.registerImporter(myImporter);
```

### Adding a New Exporter

1. Create file in `exporters/` directory
2. Implement `ExporterPlugin` interface:
   - `name`: Plugin identifier
   - `metadata`: Plugin information
   - `configure()`: Setup configuration
   - `validate()`: Validate configuration
   - `export()`: Send data to destination

3. Register in `exporters/index.ts`:

```typescript
import { myExporter } from './my-exporter.js';
registry.registerExporter(myExporter);
```

### Adding a New Scraper

1. Create directory in `scraper/` with your source name
2. Implement scraper logic using shared utilities
3. Create CLI wrapper for command-line usage
4. Output to `scraper/output/` directory

## Testing

### Test with Local Server

1. Start development server:

```powershell
npm run devout
```

1. Import test data:

```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer artist-json `
  --exporter api `
  --input src/mass-import/scraper/output/burnaby-art-gallery-artists.json `
  --limit 3 `
  --verbose
```

### Validation

Validate configuration before importing:

```powershell
npx tsx src/mass-import/cli/cli-entry.ts validate-config `
  --importer artist-json `
  --exporter api `
  --config api-config.json
```

## Common Workflows

### Full Import Process

1. **Scrape Data**:

```powershell
npx tsx src/mass-import/scraper/burnaby-art-gallery/cli.ts --output src/mass-import/scraper/output
```

1. **Import Artists**:

```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer artist-json `
  --exporter api `
  --input src/mass-import/scraper/output/burnaby-art-gallery-artists.json `
  --verbose
```

1. **Import Artworks**:

```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer osm-artwork `
  --exporter api `
  --input src/mass-import/scraper/output/burnaby-art-gallery-artworks.geojson `
  --verbose
```

### Debug Workflow

1. **List Available Plugins**:

```powershell
npx tsx src/mass-import/cli/cli-entry.ts list-plugins
```

1. **Check Plugin Info**:

```powershell
npx tsx src/mass-import/cli/cli-entry.ts plugin-info --name artist-json
```

1. **Dry Run Import**:

```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer artist-json `
  --exporter console `
  --input artists.json `
  --dry-run `
  --limit 1 `
  --verbose
```

## Documentation

- [CLI Documentation](./cli/README.md) - Command-line usage
- [API Documentation](../../docs/api.md) - Mass Import v3 API
- [Database Schema](../../docs/database.md) - Database structure

## Troubleshooting

### Common Issues

**Issue**: "Plugin not found"

- **Solution**: Run `list-plugins` to see available plugins
- Ensure plugin is registered in `importers/index.ts` or `exporters/index.ts`

**Issue**: "Validation failed"

- **Solution**: Use `--verbose` flag to see detailed errors
- Check data format matches plugin requirements
- Use `plugin-info` to see expected format

**Issue**: "API connection failed"

- **Solution**: Verify dev server is running (`npm run devout`)
- Check `api-config.json` endpoint URL
- Verify authentication token

**Issue**: "Empty source_url"

- **Solution**: Ensure source data includes proper `source_url` field
- For v3 format: check `properties.source_url`
- For legacy format: check top-level `source_url`

## Version History

- **v2.0.0**: Plugin-based architecture with modular importers/exporters
- **v1.0.0**: Legacy hardcoded mass import system (deprecated)

## See Also

- [Mass Import v3 API](../../docs/mass-import-v3-implementation.md)
- [Database Migration Guide](../../docs/database.md)
- [Deployment Guide](../../docs/deployment.md)
