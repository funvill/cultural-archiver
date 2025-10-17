# Mass Import v3 CLI Integration

## Summary

Updated the existing Mass Import CLI system to support the new Mass Import v3 endpoint. The CLI now automatically detects whether to use v2 (batch) or v3 (individual item) format based on the endpoint URL.

## Changes Made

### 1. **API Exporter Updates** (`src/lib/mass-import-system/exporters/api-exporter.ts`)

Added support for both v2 and v3 API formats with automatic version detection:

#### Version Detection

```typescript
private getApiVersion(): 'v2' | 'v3' {
  const endpoint = this.config?.apiEndpoint ?? '';
  return endpoint.includes('/v3') ? 'v3' : 'v2';
}
```

#### v3 Format Transformation

- **Artworks**: Transformed to GeoJSON Feature format

  ```json
  {
    "type": "Feature",
    "geometry": {
      "type": "Point",
      "coordinates": [lon, lat]
    },
    "properties": {
      "title": "...",
      "description": "...",
      "artist": "...",
      "source": "...",
      "externalId": "...",
      "tags": {},
      "photos": [],
      "skipDuplicateDetection": false
    }
  }
  ```

- **Artists**: Transformed to Artist JSON format

  ```json
  {
    "type": "Artist",
    "name": "...",
    "properties": {
      "description": "...",
      "source": "...",
      "externalId": "...",
      "tags": {},
      "photos": [],
      "skipDuplicateDetection": false
    }
  }
  ```

#### v3 Response Handling

- Updated duplicate detection: `status === 'skipped' && reason === 'DUPLICATE_DETECTED'`
- Updated duplicate detail extraction to parse v3 response format
- Maintained backward compatibility with v2 batch format

### 2. **Configuration Files**

Created new v3 configuration files:

**Development** (`src/mass-import/config/api-config-dev-v3.json`):

```json
{
  "importer": {
    "includeUnknownFeatureTypes": true
  },
  "exporter": {
    "apiEndpoint": "http://localhost:8787/api/mass-import/v3",
    "method": "POST",
    "authentication": {
      "type": "bearer",
      "token": "test-admin-token"
    },
    "timeout": 30000,
    "retryAttempts": 3,
    "retryDelay": 1000,
    "skipDuplicateDetection": false,
    "autoApproveArtists": false
  }
}
```

**Production** (`src/mass-import/config/api-config-production-v3.json`):

```json
{
  "importer": {},
  "exporter": {
    "apiEndpoint": "https://api.publicartregistry.com/api/mass-import/v3",
    "method": "POST",
    "authentication": {
      "type": "bearer",
      "token": "test-admin-token"
    },
    "timeout": 30000,
    "retryAttempts": 3,
    "retryDelay": 1000,
    "skipDuplicateDetection": false,
    "autoApproveArtists": false
  }
}
```

## Usage

### CLI Commands

The CLI commands remain unchanged. The version detection happens automatically based on the config file used:

**Development (v3):**

```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer geojson `
  --input data/artworks.geojson `
  --exporter api `
  --config src/mass-import/config/api-config-dev-v3.json
```

**Production (v3):**

```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer geojson `
  --input data/artworks.geojson `
  --exporter api `
  --config src/mass-import/config/api-config-production-v3.json
```

**Legacy v2 (still supported):**

```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer geojson `
  --input data/artworks.geojson `
  --exporter api `
  --config src/mass-import/config/api-config-production.json
```

## Technical Details

### Artist Detection Heuristic

Both v2 and v3 use the same artist detection logic:

- Record is considered an artist if:
  - Coordinates are (0, 0), AND
  - externalId starts with "artist-json-", OR
  - tags.type equals "artist" (case insensitive)

### API Format Differences

| Aspect | v2 (Batch) | v3 (Individual) |
|--------|------------|-----------------|
| Request Format | `{ metadata, config, data: { artworks: [...] } }` | Single GeoJSON Feature or Artist JSON |
| Items Per Request | Multiple (batch) | One |
| Duplicate Response | `{ status: 200, data: { summary: { totalDuplicates: N } } }` | `{ status: "skipped", reason: "DUPLICATE_DETECTED", duplicate: {...} }` |
| Success Response | `{ status: 200, data: { summary: { totalSucceeded: N } } }` | `{ status: "created", id: "...", type: "artwork"/"artist" }` |

### Backward Compatibility

The api-exporter maintains full backward compatibility with v2:

- v2 endpoints continue to work unchanged
- v2 batch format is preserved
- v2 duplicate detection logic still functions
- v2 response parsing remains intact

## Testing

✅ All 785 tests pass (1 skipped)
✅ Build succeeds with 0 errors
✅ TypeScript compilation successful

## Next Steps

1. **Test CLI with v3 endpoint** - Run real imports using the new config files
2. **Update authentication token** - Replace "test-admin-token" with actual production token
3. **Monitor performance** - Track v3 endpoint response times during imports
4. **Phase 7: Performance Optimization** - Optimize v3 endpoint for batch operations
5. **Phase 8: Integration Testing** - End-to-end testing with production data

## Files Modified

- `src/lib/mass-import-system/exporters/api-exporter.ts` - Added v3 format support

## Files Added

- `src/mass-import/cli/` - Moved CLI from `src/lib/mass-import-system/cli/`
  - `cli-entry.ts` - CLI entry point
  - `plugin-cli.ts` - Plugin-based CLI orchestration
  - `processor.ts` - Data processing logic
  - `index.ts` - Legacy CLI commands
  - `index.test.ts` - CLI tests
- `src/mass-import/config/` - Moved configs from `src/lib/mass-import-system/config/`
  - `api-config-dev-v3.json` - Development v3 config
  - `api-config-production-v3.json` - Production v3 config
  - `api-config-dev.json` - Development v2 config (legacy)
  - `api-config-production.json` - Production v2 config (legacy)

## Migration Path

To migrate from v2 to v3:

1. Update configuration file to use v3 endpoint URL
2. Set `skipDuplicateDetection: false` to enable v3 duplicate detection
3. Set `autoApproveArtists: false` for manual review workflow
4. Run import command with new config file
5. Monitor results for duplicate detection accuracy

No code changes required in scrapers or data preparation workflows - the API exporter handles all transformation automatically.
