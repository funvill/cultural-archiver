# Mass Import Configuration Examples

This directory contains example configuration files for the mass import system.

## Configuration Files

### `config-dev.json` - Development Configuration
- Smaller batch sizes for testing
- More retries and longer delays for unstable connections
- Dry-run mode enabled by default
- Verbose logging enabled
- Localhost API endpoint

### `config-production.json` - Production Configuration  
- Optimized batch sizes for performance
- Standard retry settings
- Live API endpoint
- Verbose logging disabled for performance

## Usage

```bash
# Use development config
mass-import vancouver --config examples/config-dev.json --input data.json

# Use production config
mass-import vancouver --config examples/config-production.json --input data.json

# Override specific settings
mass-import vancouver --config examples/config-dev.json --batch-size 5 --input data.json
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiEndpoint` | string | `"https://art-api.abluestar.com"` | API base URL |
| `massImportUserToken` | string | `"00000000-0000-0000-0000-000000000002"` | User token for mass import |
| `batchSize` | number | `50` | Number of records per batch |
| `maxRetries` | number | `3` | Maximum retry attempts for failed requests |
| `retryDelay` | number | `1000` | Delay between retries (ms) |
| `duplicateDetectionRadius` | number | `50` | Geographic radius for duplicate detection (meters) |
| `titleSimilarityThreshold` | number | `0.8` | Fuzzy match threshold for title similarity (0-1) |
| `dryRun` | boolean | `false` | Enable validation-only mode |
| `verbose` | boolean | `false` | Enable verbose logging |

## Environment Variables

You can also use environment variables to set configuration:

```bash
export MASS_IMPORT_API_ENDPOINT="http://localhost:8787"
export MASS_IMPORT_USER_TOKEN="your-token-here"
export MASS_IMPORT_BATCH_SIZE=10
```

Environment variables take precedence over configuration files.