# Mass Import CLI

Command-line interface for the Mass Import Plugin System. This CLI provides a modular approach to importing and exporting data using various plugins.

## Installation

The CLI is part of the mass-import system and can be run using `npx tsx`:

```powershell
npx tsx src/mass-import/cli/cli-entry.ts [command] [options]
```

## Commands

### `import`

Import data using specified importer and exporter plugins.

**Required Options:**
- `--importer <name>` - Importer plugin name (e.g., `artist-json`, `osm-artwork`)
- `--exporter <name>` - Exporter plugin name (e.g., `api`, `console`, `json`)

**Optional Options:**
- `--input <path>` - Input file or data source path
- `--config <path>` - Plugin configuration file path
- `--output <path>` - Output file path (for file-based exporters)
- `--batch-size <number>` - Batch size for processing (default: 50)
- `--limit <number>` - Limit the number of records to process
- `--offset <number>` - Skip the first N records before processing
- `--dry-run` - Run in dry-run mode without making changes
- `--verbose` - Enable verbose logging
- `--generate-report` - Generate processing report
- `--report-path <path>` - Path for generated report
- `--location-enhancement` - Enable location enhancement (adds human-readable location fields)
- `--location-cache <path>` - Path to location cache database (default: `./_data/location-cache.sqlite`)
- `--max-consecutive-errors <number>` - Maximum consecutive errors before aborting (default: 5)

**Examples:**

Import artists from JSON file to API:
```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer artist-json `
  --exporter api `
  --input src/mass-import/scraper/output/burnaby-art-gallery-artists.json `
  --limit 10 `
  --verbose
```

Import artworks from GeoJSON to API:
```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer osm-artwork `
  --exporter api `
  --input src/mass-import/scraper/output/burnaby-art-gallery-artworks.geojson `
  --limit 5 `
  --verbose
```

Dry run with report generation:
```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer artist-json `
  --exporter api `
  --input artists.json `
  --dry-run `
  --generate-report `
  --verbose
```

### `list-plugins`

List all available importer and exporter plugins.

**Options:**
- `--type <type>` - Filter by plugin type: `importer`, `exporter`, or `all` (default: `all`)

**Example:**
```powershell
npx tsx src/mass-import/cli/cli-entry.ts list-plugins
npx tsx src/mass-import/cli/cli-entry.ts list-plugins --type importer
```

### `plugin-info`

Show detailed information about a specific plugin.

**Required Options:**
- `--name <name>` - Plugin name

**Optional Options:**
- `--type <type>` - Plugin type: `importer` or `exporter` (default: `importer`)

**Example:**
```powershell
npx tsx src/mass-import/cli/cli-entry.ts plugin-info --name artist-json
npx tsx src/mass-import/cli/cli-entry.ts plugin-info --name api --type exporter
```

### `validate-config`

Validate plugin configuration files.

**Required Options:**
- `--importer <name>` - Importer plugin name
- `--exporter <name>` - Exporter plugin name

**Optional Options:**
- `--config <path>` - Configuration file path

**Example:**
```powershell
npx tsx src/mass-import/cli/cli-entry.ts validate-config `
  --importer artist-json `
  --exporter api `
  --config api-config.json
```

## Available Plugins

### Importers

- **`artist-json`** - Import artist data from JSON files (supports both legacy and v3 formats)
- **`osm-artwork`** - Import artwork data from GeoJSON files (OpenStreetMap format)

### Exporters

- **`api`** - Export data to Mass Import v3 API endpoint
- **`console`** - Output data to console (for debugging)
- **`json`** - Export data to JSON files

## Configuration Files

### API Exporter Configuration

Create `api-config.json` in your working directory:

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
  "retryDelay": 1000,
  "duplicateThreshold": 0.75
}
```

### Importer Configuration

Configuration can be passed via `--config` flag. Each importer may have different configuration options. Use `plugin-info` command to see available options.

## Data Formats

### Artist JSON Format (v3)

```json
[
  {
    "type": "Artist",
    "id": "source/artist-id",
    "name": "Artist Name",
    "description": "Artist biography",
    "properties": {
      "source": "https://example.com",
      "source_url": "https://example.com/artist/123",
      "birth_date": "1970",
      "website": "https://artist-website.com"
    }
  }
]
```

### Artist JSON Format (Legacy)

```json
[
  {
    "source": "https://example.com",
    "source_url": "https://example.com/artist/123",
    "name": "Artist Name",
    "biography": "Artist biography",
    "birth date": "1970",
    "websites": "https://artist-website.com"
  }
]
```

### Artwork GeoJSON Format

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "source/artwork-id",
      "geometry": {
        "type": "Point",
        "coordinates": [-122.9128, 49.2069]
      },
      "properties": {
        "title": "Artwork Title",
        "description": "Artwork description",
        "artist": "Artist Name",
        "source": "https://example.com",
        "source_url": "https://example.com/artwork/123",
        "photos": [
          "https://example.com/photo1.jpg",
          "https://example.com/photo2.jpg"
        ]
      }
    }
  ]
}
```

## Common Workflows

### Testing with Local Development Server

1. Start the local development server:
```powershell
npm run devout
```

2. Import artists (testing with first 3 records):
```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer artist-json `
  --exporter api `
  --input src/mass-import/scraper/output/burnaby-art-gallery-artists.json `
  --limit 3 `
  --verbose
```

3. Import artworks (testing with first 5 records):
```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer osm-artwork `
  --exporter api `
  --input src/mass-import/scraper/output/burnaby-art-gallery-artworks.geojson `
  --limit 5 `
  --verbose
```

### Production Import

1. Ensure production configuration in `api-config.json`
2. Run full import without limits:
```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer artist-json `
  --exporter api `
  --input production-artists.json `
  --verbose `
  --generate-report
```

## Troubleshooting

### Plugin Not Found

If you see "Importer plugin not found", check available plugins:
```powershell
npx tsx src/mass-import/cli/cli-entry.ts list-plugins
```

### Validation Errors

Use `--verbose` flag to see detailed error messages:
```powershell
npx tsx src/mass-import/cli/cli-entry.ts import --importer artist-json --exporter api --input file.json --verbose
```

### API Connection Issues

1. Verify the development server is running: `npm run devout`
2. Check `api-config.json` has correct endpoint
3. Verify authentication token is valid

### Data Format Issues

Use `plugin-info` to see expected data format:
```powershell
npx tsx src/mass-import/cli/cli-entry.ts plugin-info --name artist-json
```

## Exit Codes

- `0` - Success
- `1` - General error (plugin not found, validation failed, etc.)
- `1` - Import failed (consecutive errors exceeded threshold)

## See Also

- [Mass Import System Overview](../README.md)
- [Plugin Development Guide](../docs/plugins.md)
- [API Documentation](../../../docs/api.md)
