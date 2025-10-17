# Mass Import CLI Reorganization

**Date**: October 14, 2025  
**Branch**: mass-import-v3

## Summary

Reorganized the Mass Import CLI to a more logical location in the project structure, moving it from `src/lib/mass-import-system/cli/` to `src/mass-import/cli/` to align with the overall project architecture.

## Changes Made

### Directory Structure Changes

**Before:**
```
src/
  lib/
    mass-import-system/
      cli/
        cli-entry.ts
        plugin-cli.ts
        processor.ts
        index.ts
        index.test.ts
      config/
        api-config-*.json
```

**After:**
```
src/
  mass-import/
    cli/
      cli-entry.ts
      plugin-cli.ts
      processor.ts
      index.ts
      index.test.ts
    config/
      api-config-dev.json
      api-config-dev-v3.json
      api-config-production.json
      api-config-production-v3.json
    scraper/
```

### Files Moved

1. **CLI Files** (`src/lib/mass-import-system/cli/` → `src/mass-import/cli/`):
   - `cli-entry.ts` - Main entry point for CLI
   - `plugin-cli.ts` - Plugin-based CLI orchestration
   - `processor.ts` - Data processing logic
   - `index.ts` - Legacy CLI commands
   - `index.test.ts` - CLI tests

2. **Configuration Files** (`src/lib/mass-import-system/config/` → `src/mass-import/config/`):
   - `api-config-dev.json` - Development v2 config
   - `api-config-dev-v3.json` - Development v3 config
   - `api-config-production.json` - Production v2 config
   - `api-config-production-v3.json` - Production v3 config

### Import Path Updates

Updated import paths in moved files to reference the original locations in `src/lib/mass-import-system/`:

**plugin-cli.ts:**
```typescript
// Old paths
import { PluginRegistry } from '../lib/plugin-registry.js';
import { DataPipeline } from '../lib/data-pipeline.js';

// New paths
import { PluginRegistry } from '../../lib/mass-import-system/lib/plugin-registry.js';
import { DataPipeline } from '../../lib/mass-import-system/lib/data-pipeline.js';
```

**processor.ts:**
```typescript
// Old paths
import { MassImportAPIClient } from '../lib/api-client.js';

// New paths
import { MassImportAPIClient } from '../../lib/mass-import-system/lib/api-client.js';
```

**index.ts:**
```typescript
// Old paths
import { loadOSMData } from '../importers/osm.js';

// New paths
import { loadOSMData } from '../../lib/mass-import-system/importers/osm.js';
```

### Documentation Updates

Updated `docs/mass-import-v3-cli-integration.md` to reflect new paths:

**Old CLI invocation:**
```powershell
npx tsx src/lib/mass-import-system/cli/cli-entry.ts import ...
```

**New CLI invocation:**
```powershell
npx tsx src/mass-import/cli/cli-entry.ts import ...
```

**Old config path:**
```
--config src/lib/mass-import-system/config/api-config-dev-v3.json
```

**New config path:**
```
--config src/mass-import/config/api-config-dev-v3.json
```

## Rationale

### Project Organization

The new structure better aligns with the project's architecture:

- **`src/mass-import/`** - High-level mass import functionality
  - `cli/` - Command-line interface for running imports
  - `config/` - Configuration files for CLI
  - `scraper/` - Data scraping tools

- **`src/lib/mass-import-system/`** - Low-level import system components
  - `lib/` - Core libraries (plugin registry, pipeline, API client)
  - `importers/` - Data source importers (OSM, Vancouver, GeoJSON)
  - `exporters/` - Output exporters (API, JSON, console)
  - `types/` - Type definitions

### Benefits

1. **Logical Separation**: CLI lives alongside other user-facing mass import tools
2. **Clearer Intent**: `src/mass-import/` clearly indicates end-user functionality
3. **Better Modularity**: Core library code (`src/lib/mass-import-system/`) is separate from CLI tools
4. **Easier Navigation**: Related tools (scraper, CLI, config) are grouped together

## Testing

✅ Build succeeds with 0 errors  
✅ Import paths correctly updated  
✅ Configuration files accessible at new locations  

## Usage Examples

### Development (v3 endpoint):
```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer geojson `
  --input data/artworks.geojson `
  --exporter api `
  --config src/mass-import/config/api-config-dev-v3.json `
  --verbose
```

### Production (v3 endpoint):
```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer geojson `
  --input data/artworks.geojson `
  --exporter api `
  --config src/mass-import/config/api-config-production-v3.json
```

### Legacy v2 endpoint (still supported):
```powershell
npx tsx src/mass-import/cli/cli-entry.ts import `
  --importer osm-artwork `
  --input reports/artwork-data.geojson `
  --exporter api `
  --config src/mass-import/config/api-config-production.json
```

## Migration Notes

### For Users

If you have scripts or documentation referencing the old paths, update them:

**Old:**
```powershell
npx tsx src/lib/mass-import-system/cli/cli-entry.ts ...
--config src/lib/mass-import-system/config/api-config-*.json
```

**New:**
```powershell
npx tsx src/mass-import/cli/cli-entry.ts ...
--config src/mass-import/config/api-config-*.json
```

### For Developers

The core mass-import-system library remains at `src/lib/mass-import-system/`. Only the CLI and configs were moved. Library imports from other parts of the codebase do not need updating.

## Next Steps

1. ✅ CLI moved to logical location
2. ✅ Import paths updated
3. ✅ Documentation updated
4. ✅ Build verified
5. ⏳ Delete old CLI directory (after confirming no references remain)
6. ⏳ Update any CI/CD scripts referencing old paths
7. ⏳ Test CLI with real data using new paths

## Related Documents

- `docs/mass-import-v3-cli-integration.md` - v3 CLI integration guide
- `tasks/plan-mass-import-endpoint.md` - Mass Import v3 endpoint plan
- `tasks/plan-mass-import-runner.md` - CLI development plan
