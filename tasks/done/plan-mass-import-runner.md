# Mass Import v3: CLI Runner Development Plan

## Overview

The Mass-Import CLI Runner is the **third and final component** of the mass import v3 system. It's a command-line tool that orchestrates the entire import process: reading scraper output files, enhancing data with location information, downloading and caching photos, and sending individual items to the Mass-Import Endpoint.

**Key Responsibility**: The CLI handles all **orchestration, session management, statistics, checkpoints, and error recovery**.

## Goals

- Read GeoJSON and JSON files from scrapers
- Enhance artwork data with location information (reverse geocoding)
- Download and cache photos from source URLs
- Send individual items to Mass-Import Endpoint via API
- Track comprehensive session statistics
- Generate detailed import reports
- Support resumable imports via checkpoints
- Handle retries and error recovery
- Display real-time progress to user

## Design Decisions

Based on the clarifying questions (50-69), here are the key decisions:

### File Processing

- **File Loading**: Load entire file with `JSON.parse()` (no streaming)
- **Location Cache**: Pre-process locations before API calls (cache-first strategy)
- **CLI Arguments**: Rich interface with `--input`, `--config`, `--resume`, `--offset`, `--limit`, `--verbose`, `--report-dir`
- **Progress Display**: Rich progress bar with stats (using `cli-progress`)
- **Checkpoints**: Configurable path (default: `./.mass-import-checkpoints/<sessionId>.json`)

### Session Management

- **Resume Functionality**: Automatic detection with user confirmation
- **Config Validation**: Validate only when each field is used
- **Session ID**: Use input filename with date and timestamp
- **Logging**: Log everything to both console and file
- **Concurrency**: No concurrency - sequential processing only

### Data Processing

- **Markdown Sanitization**: Sanitize before sending to API (remove `<script>`, etc.)
- **Photo Handling**: Download from URLs, validate, cache locally, upload to API
- **Pre-flight Validation**: Basic validation before sending (required fields, coordinate ranges)
- **Artist Tracking**: Track created vs linked artists in statistics
- **Report Generation**: Multiple formats (JSON + text summary)

### Error Handling

- **Network Timeouts**: Configurable with retry and exponential backoff
- **Filtering**: No filtering - import everything in file
- **Error Categorization**: Different handling for 400, 401, 429, 500 errors
- **Exit Codes**: Only 0 (success) or 1 (any error)

## CLI Specification

### Command Structure

**Basic Usage:**

```bash
mass-import-cli --input ./data/artworks.geojson --config ./config/production.json
```

**Full Options:**

```bash
mass-import-cli \
  --input <path>           # Input file (GeoJSON or JSON) - REQUIRED
  --config <path>          # Configuration file (JSON) - REQUIRED
  --resume                 # Resume from checkpoint
  --offset <number>        # Skip first N items
  --limit <number>         # Process only N items
  --verbose                # Detailed logging
  --report-dir <path>      # Report output directory (default: ./reports/)
  --fresh                  # Ignore existing checkpoint, start fresh
```

### Configuration File Format

```json
{
  "api": {
    "endpoint": "https://api.publicartregistry.com/api/mass-import/v3",
    "token": "admin-token-here",
    "timeout": 60000
  },
  "processing": {
    "maxRetries": 3,
    "retryDelayMs": 1000,
    "delayBetweenItems": 100
  },
  "location": {
    "cacheEnabled": true,
    "cachePath": "./location-cache.db",
    "enhanceWithLocationData": true
  },
  "photos": {
    "cacheDir": "./.photo-cache",
    "maxDownloadRetries": 3,
    "downloadTimeoutMs": 10000
  },
  "logging": {
    "level": "verbose",
    "outputFile": "./import-logs/{timestamp}.log",
    "format": "text"
  },
  "checkpoints": {
    "enabled": true,
    "directory": "./.mass-import-checkpoints"
  }
}
```

## Development Plan

### Phase 1: CLI Framework Setup

**Goal**: Create basic CLI structure with argument parsing

**Tasks**:

- [ ] Create CLI entry file: `src/lib/mass-import-system/cli/cli-entry.ts`
- [ ] Install dependencies:
  - [ ] `commander` - CLI argument parsing
  - [ ] `chalk` - Terminal colors
  - [ ] `cli-progress` - Progress bars
  - [ ] `winston` - Structured logging
- [ ] Implement argument parsing:
  - [ ] `--input <path>` (required)
  - [ ] `--config <path>` (required)
  - [ ] `--resume` (optional flag)
  - [ ] `--offset <number>` (optional)
  - [ ] `--limit <number>` (optional)
  - [ ] `--verbose` (optional flag)
  - [ ] `--report-dir <path>` (optional)
  - [ ] `--fresh` (optional flag)
- [ ] Implement basic validation:
  - [ ] Check required arguments present
  - [ ] Validate file paths exist
  - [ ] Show help text if invalid
- [ ] Create logger setup:
  - [ ] Configure Winston with console + file transports
  - [ ] Support log levels (debug, info, warn, error)
  - [ ] Use timestamp in log filename
- [ ] Create version command: `--version`
- [ ] Write CLI framework tests

**Success Criteria**:

- CLI parses all arguments correctly
- Help text displays properly
- Logger writes to console and file
- Validation catches invalid arguments
- Tests pass

### Phase 2: Configuration Loading & Validation

**Goal**: Load and validate configuration file

**Tasks**:

- [ ] Create config loader: `src/lib/mass-import-system/cli/config-loader.ts`
- [ ] Create Zod schema for config validation
- [ ] Implement config file loading:
  - [ ] Read JSON file
  - [ ] Parse JSON (handle syntax errors)
  - [ ] Validate against schema (lazy validation)
  - [ ] Return typed config object
- [ ] Handle config errors:
  - [ ] File not found
  - [ ] Invalid JSON
  - [ ] Missing required fields
  - [ ] Invalid field types
- [ ] Create default config values:
  - [ ] API timeout: 60000ms
  - [ ] Max retries: 3
  - [ ] Retry delay: 1000ms
  - [ ] Item delay: 100ms
- [ ] Display config summary at startup
- [ ] Write config loading tests

**Success Criteria**:

- Config loads and validates correctly
- Defaults applied when fields missing
- Clear error messages for invalid configs
- Tests cover all validation rules

### Phase 3: Session Management

**Goal**: Implement session initialization and tracking

**Tasks**:

- [ ] Create session manager: `src/lib/mass-import-system/cli/session-manager.ts`
- [ ] Implement session ID generation:
  - [ ] Use input filename + date + timestamp
  - [ ] Format: `import-<filename>-<YYYY-MM-DD-HHMMSS>-<random>`
- [ ] Create session state structure:
  - [ ] Session ID, start time, input file, config file
  - [ ] Statistics (total, processed, success, failed, skipped)
  - [ ] Item results array
- [ ] Implement checkpoint directory creation
- [ ] Implement log file creation with session ID
- [ ] Create session summary display
- [ ] Write session manager tests

**Success Criteria**:

- Session ID generated correctly
- Session state initialized
- Directories created as needed
- Summary displays properly
- Tests pass

### Phase 4: Input File Processing

**Goal**: Load and parse scraper output files

**Tasks**:

- [ ] Create file loader: `src/lib/mass-import-system/cli/file-loader.ts`
- [ ] Implement GeoJSON loading:
  - [ ] Read file into memory
  - [ ] Parse JSON
  - [ ] Validate GeoJSON structure (FeatureCollection)
  - [ ] Extract features array
  - [ ] Return typed features
- [ ] Implement Artist JSON loading:
  - [ ] Read file into memory
  - [ ] Parse JSON
  - [ ] Validate structure
  - [ ] Extract artists array
  - [ ] Return typed artists
- [ ] Handle file errors:
  - [ ] File not found
  - [ ] Invalid JSON
  - [ ] Wrong file format
  - [ ] Empty file
- [ ] Implement offset/limit filtering:
  - [ ] Skip first N items if `--offset`
  - [ ] Take only N items if `--limit`
- [ ] Display file summary (total items, type)
- [ ] Write file loader tests

**Success Criteria**:

- GeoJSON files load correctly
- Artist JSON files load correctly
- Offset/limit applied properly
- Error handling works
- Tests pass

### Phase 5: Checkpoint System

**Goal**: Implement resumable imports with checkpoints

**Tasks**:

- [ ] Create checkpoint manager: `src/lib/mass-import-system/cli/checkpoint-manager.ts`
- [ ] Implement checkpoint file format:
  - [ ] Session ID, input file, config file
  - [ ] Start time, last checkpoint time
  - [ ] Total items, processed items
  - [ ] Items array with index, sourceId, status, error
- [ ] Implement checkpoint loading:
  - [ ] Check if checkpoint exists for input file
  - [ ] Load checkpoint JSON
  - [ ] Validate checkpoint structure
  - [ ] Return processed item indices
- [ ] Implement checkpoint saving:
  - [ ] Write after each item processed
  - [ ] Use atomic write (temp file + rename)
  - [ ] Handle write errors gracefully
- [ ] Implement resume confirmation:
  - [ ] Detect existing checkpoint
  - [ ] Show summary (X items already processed)
  - [ ] Prompt user: "Resume? (y/n)"
  - [ ] Skip if `--fresh` flag
- [ ] Implement checkpoint cleanup:
  - [ ] Delete checkpoint on successful completion
  - [ ] Keep checkpoint on failure for resume
- [ ] Write checkpoint tests

**Success Criteria**:

- Checkpoints save after each item
- Resume skips already-processed items
- User confirmation works
- Cleanup works correctly
- Tests pass

### Phase 6: Location Cache Integration

**Goal**: Integrate location enhancement before API calls

**Tasks**:

- [ ] Create location enhancer: `src/lib/mass-import-system/cli/location-enhancer.ts`
- [ ] Integrate existing location cache (from `src/lib/location/`)
- [ ] Implement location enhancement:
  - [ ] Extract coordinates from item
  - [ ] Check location cache
  - [ ] If cached, add location fields to properties
  - [ ] If not cached, query Nominatim (1 req/sec)
  - [ ] Cache result
  - [ ] Add fields: `location_display_name`, `location_country`, `location_state`, `location_city`
- [ ] Handle location errors:
  - [ ] Log warning if cache fails
  - [ ] Continue without location data
  - [ ] Don't fail entire item
- [ ] Respect rate limiting (1 req/sec for Nominatim)
- [ ] Display location cache statistics
- [ ] Write location enhancer tests

**Success Criteria**:

- Locations added from cache
- Nominatim queries work (respecting rate limit)
- Cache updated with new locations
- Errors handled gracefully
- Tests pass

### Phase 7: Photo Download & Cache

**Goal**: Download and cache photos from source URLs

**Tasks**:

- [ ] Create photo manager: `src/lib/mass-import-system/cli/photo-manager.ts`
- [ ] Implement photo cache:
  - [ ] Create cache directory (from config)
  - [ ] Use content hash for filenames
  - [ ] Check cache before downloading
- [ ] Implement photo download:
  - [ ] Extract photo URLs from item
  - [ ] Download each photo (with retry logic)
  - [ ] Validate file format (magic bytes)
  - [ ] Calculate content hash (SHA-256)
  - [ ] Save to cache with hash filename
  - [ ] Return cached file paths
- [ ] Implement retry logic:
  - [ ] Max retries from config (default: 3)
  - [ ] Exponential backoff
  - [ ] Handle timeout errors
  - [ ] Log download failures
- [ ] Implement photo validation:
  - [ ] Check file format (JPEG, PNG, WebP)
  - [ ] Check file size (max 15MB)
  - [ ] Validate is valid image
- [ ] Track photo statistics:
  - [ ] Downloads: successful, failed, cached
  - [ ] Include in session stats
- [ ] Write photo manager tests

**Success Criteria**:

- Photos download successfully
- Cache prevents re-downloading
- Retries work on failures
- Validation catches invalid files
- Statistics tracked correctly
- Tests pass

### Phase 8: Markdown Sanitization

**Goal**: Sanitize Markdown before sending to API

**Tasks**:

- [ ] Install `sanitize-markdown` or similar library
- [ ] Create sanitizer: `src/lib/mass-import-system/cli/markdown-sanitizer.ts`
- [ ] Implement sanitization:
  - [ ] Remove `<script>` tags
  - [ ] Remove `javascript:` protocols
  - [ ] Remove `onerror` attributes
  - [ ] Remove other dangerous HTML
  - [ ] Preserve safe Markdown
- [ ] Apply to description fields:
  - [ ] Artwork descriptions
  - [ ] Artist biographies
- [ ] Log sanitization actions (if content changed)
- [ ] Write sanitizer tests

**Success Criteria**:

- Dangerous content removed
- Safe Markdown preserved
- Applied to all descriptions
- Tests pass

### Phase 9: API Client

**Goal**: Implement API communication with Mass-Import Endpoint

**Tasks**:

- [ ] Create API client: `src/lib/mass-import-system/cli/api-client.ts`
- [ ] Implement HTTP request function:
  - [ ] Use `node-fetch` or `axios`
  - [ ] Set timeout from config
  - [ ] Add Authorization header (bearer token)
  - [ ] Set Content-Type: application/json
  - [ ] Handle multipart/form-data for photos
- [ ] Implement request sending:
  - [ ] Serialize item to JSON
  - [ ] Send POST request to endpoint
  - [ ] Parse response
  - [ ] Return typed response
- [ ] Implement retry logic:
  - [ ] Max retries from config
  - [ ] Exponential backoff
  - [ ] Handle 429 (rate limit) - use Retry-After header
  - [ ] Retry on 500 errors
  - [ ] Don't retry on 400, 401 errors
- [ ] Implement timeout handling:
  - [ ] Wrap request in timeout
  - [ ] Cancel on timeout
  - [ ] Treat as retryable error
- [ ] Implement error categorization:
  - [ ] 200/201: Success
  - [ ] 400: Validation error (don't retry)
  - [ ] 401: Auth error (fail entire import)
  - [ ] 429: Rate limit (wait and retry)
  - [ ] 500: Server error (retry)
  - [ ] Other: Log and retry
- [ ] Write API client tests (with mocks)

**Success Criteria**:

- Requests sent correctly
- Responses parsed correctly
- Retry logic works
- Timeout handling works
- Error categorization correct
- Tests pass

### Phase 10: Import Orchestration

**Goal**: Implement main import loop with all features

**Tasks**:

- [ ] Create import orchestrator: `src/lib/mass-import-system/cli/import-orchestrator.ts`
- [ ] Implement main import loop:
  - [ ] For each item in input file:
    - [ ] Check checkpoint (skip if already processed)
    - [ ] Validate required fields (pre-flight)
    - [ ] Enhance with location data
    - [ ] Sanitize Markdown
    - [ ] Download and cache photos
    - [ ] Prepare multipart request with photos
    - [ ] Send to API endpoint
    - [ ] Handle response (success/error)
    - [ ] Update statistics
    - [ ] Write checkpoint
    - [ ] Update progress display
    - [ ] Apply delay between items
- [ ] Implement pre-flight validation:
  - [ ] Check required fields exist
  - [ ] Validate coordinate ranges
  - [ ] Validate URL formats
  - [ ] Skip item if validation fails
- [ ] Implement statistics tracking:
  - [ ] Total items, processed, success, failed, skipped
  - [ ] Artwork stats (created, failed)
  - [ ] Artist stats (created, linked, auto-created)
  - [ ] Photo stats (downloaded, failed, cached)
  - [ ] Performance metrics (items/sec, avg response time)
- [ ] Implement error handling:
  - [ ] Log errors with context
  - [ ] Continue processing on item errors
  - [ ] Fail entire import on auth errors
  - [ ] Track retry counts
- [ ] Write orchestration tests

**Success Criteria**:

- Full import loop works end-to-end
- All features integrated
- Statistics tracked accurately
- Error handling works
- Tests pass

### Phase 11: Progress Display

**Goal**: Implement real-time progress indicators

**Tasks**:

- [ ] Create progress manager: `src/lib/mass-import-system/cli/progress-manager.ts`
- [ ] Implement progress bar:
  - [ ] Use `cli-progress` library
  - [ ] Show: current/total items, percentage
  - [ ] Show: success/failed/skipped counts
  - [ ] Show: current item title
  - [ ] Show: speed (items/sec), ETA
  - [ ] Update after each item
- [ ] Implement verbose mode output:
  - [ ] Log each item processed (title, status)
  - [ ] Log errors immediately
  - [ ] Log location cache hits/misses
  - [ ] Log photo downloads
- [ ] Handle progress bar cleanup on completion
- [ ] Write progress display tests (manual verification)

**Success Criteria**:

- Progress bar displays correctly
- Updates are smooth (no flicker)
- Verbose mode shows details
- Cleanup works properly

### Phase 12: Report Generation

**Goal**: Generate comprehensive import reports

**Tasks**:

- [ ] Create report generator: `src/lib/mass-import-system/cli/report-generator.ts`
- [ ] Implement JSON report:
  - [ ] Session ID, summary, statistics
  - [ ] Failed items with full details
  - [ ] Performance metrics
  - [ ] Configuration used
  - [ ] Save to `<report-dir>/<sessionId>.json`
- [ ] Implement text summary:
  - [ ] Session info (ID, duration, input file)
  - [ ] Results (total, success, failed, skipped)
  - [ ] Details (artworks, artists, photos)
  - [ ] Performance (items/sec, API calls, retries)
  - [ ] Failed items list (title, error)
  - [ ] Save to `<report-dir>/<sessionId>.txt`
- [ ] Display text summary to console
- [ ] Create report directory if doesn't exist
- [ ] Write report generator tests

**Success Criteria**:

- JSON report is complete and valid
- Text summary is readable
- Both files saved correctly
- Console displays summary
- Tests pass

### Phase 13: Integration Testing

**Goal**: Test full CLI with real scraper data

**Tasks**:

- [ ] Create test data directory: `test-data/`
- [ ] Prepare test inputs:
  - [ ] Sample GeoJSON (10-20 artworks)
  - [ ] Sample artist JSON (5-10 artists)
  - [ ] Include edge cases (multiple artists, no photos)
- [ ] Create test config:
  - [ ] Point to development API endpoint
  - [ ] Set short timeouts for testing
  - [ ] Enable verbose logging
- [ ] Test scenarios:
  - [ ] Full import (no checkpoint)
  - [ ] Resume import (with checkpoint)
  - [ ] Import with offset/limit
  - [ ] Import with location enhancement
  - [ ] Import with photo downloads
  - [ ] Handle API errors (simulate)
  - [ ] Handle network errors (simulate)
- [ ] Verify results:
  - [ ] Check database records
  - [ ] Verify artist linking
  - [ ] Confirm photos in R2
  - [ ] Review checkpoint files
  - [ ] Inspect reports
  - [ ] Check location cache
  - [ ] Review logs
- [ ] Fix any issues found
- [ ] Document test scenarios

**Success Criteria**:

- All test scenarios pass
- Database records match expectations
- Reports are accurate
- Checkpoints work for resume
- Location cache populated
- Photos cached and uploaded
- No crashes or data loss

## CLI Workflow

```text
Start CLI
    ↓
Parse arguments (--input, --config, etc.)
    ↓
Load & validate configuration
    ↓
Initialize logger (console + file)
    ↓
Generate session ID
    ↓
Check for existing checkpoint
    ↓
[If checkpoint exists] → Prompt user to resume
    ↓
Load input file (GeoJSON or JSON)
    ↓
Apply offset/limit if specified
    ↓
Initialize location cache (if enabled)
    ↓
Initialize photo cache directory
    ↓
Display session summary
    ↓
Initialize progress bar
    ↓
For each item in file:
    ├─ Check checkpoint (skip if already processed)
    ├─ Pre-flight validation (required fields, coordinates)
    ├─ Enhance with location data (cache-first)
    ├─ Sanitize Markdown (descriptions)
    ├─ Download photos (with retry, cache)
    ├─ Prepare API request (with photo uploads)
    ├─ Send to API endpoint
    ├─ Handle response:
    │   ├─ Success: Update success count
    │   ├─ Error: Log error, update fail count
    │   └─ Retry if appropriate
    ├─ Update session statistics
    ├─ Write checkpoint
    ├─ Update progress bar
    └─ Apply delay before next item
    ↓
Close progress bar
    ↓
Generate reports (JSON + text)
    ↓
Display final summary to console
    ↓
Cleanup (delete checkpoint if successful)
    ↓
Exit with code (0 = success, 1 = errors)
```

## Error Handling Strategy

| Error Type | CLI Action | Retry | Continue |
|------------|------------|-------|----------|
| Config file not found | Show error, exit 1 | No | No |
| Input file not found | Show error, exit 1 | No | No |
| Invalid JSON in file | Show error, exit 1 | No | No |
| Auth failure (401) | Show error, exit 1 | No | No |
| Network timeout | Exponential backoff | Yes (3x) | Yes |
| API validation (400) | Log error, mark failed | No | Yes |
| Server error (500) | Exponential backoff | Yes (3x) | Yes |
| Rate limit (429) | Wait (Retry-After) | Yes (10x) | Yes |
| Location cache error | Log warning, skip enhancement | No | Yes |
| Photo download fail | Log error, skip photo | Yes (3x) | Yes |
| Pre-flight validation | Log error, mark failed | No | Yes |

## Output Examples

### Progress Display (Normal Mode)

```text
Mass Import v3 - Session: import-burnaby-20251014-143052
Input: ./data/burnaby-artworks.geojson (150 items)
Config: ./config/production.json

Processing: ████████████████░░░░ 80% | 120/150
Success: 115 | Failed: 5 | Skipped: 0
Current: "Blacktail" by Muse Atelier
Speed: 3.2 items/sec | ETA: 2m 15s
```

### Final Summary

```text
✅ Import Complete!

Session: import-burnaby-20251014-143052
Duration: 45m 23s
Input: ./data/burnaby-artworks.geojson

Results:
  Total Items: 150
  ✓ Successful: 143
  ✗ Failed: 7
  ⊘ Skipped: 0

Details:
  Artworks Created: 115
  Artists Created: 12
  Artists Linked: 18
  Photos Downloaded: 232
  Photos Cached: 8

Performance:
  Items/Second: 3.3
  API Calls: 150
  Retries: 12

Reports saved to:
  - ./reports/import-burnaby-20251014-143052.json
  - ./reports/import-burnaby-20251014-143052.txt

❌ 7 items failed - see report for details
```

## Dependencies

### Required Packages

```json
{
  "dependencies": {
    "commander": "^11.1.0",
    "chalk": "^5.3.0",
    "cli-progress": "^3.12.0",
    "winston": "^3.11.0",
    "zod": "^3.22.4",
    "node-fetch": "^3.3.2",
    "sanitize-markdown": "^1.2.0",
    "better-sqlite3": "^9.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/better-sqlite3": "^7.6.8",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

## Success Metrics

### Functional Requirements

- ✅ Parse CLI arguments correctly
- ✅ Load and validate config
- ✅ Read GeoJSON and JSON files
- ✅ Enhance with location data
- ✅ Download and cache photos
- ✅ Sanitize Markdown
- ✅ Send to API endpoint
- ✅ Track session statistics
- ✅ Generate checkpoints
- ✅ Resume from checkpoint
- ✅ Generate detailed reports
- ✅ Display real-time progress
- ✅ Handle errors gracefully

### Performance Requirements

- Process 1-5 items per second (depends on API)
- <100MB memory usage for 1000 items
- Checkpoint writes <10ms
- Photo cache lookups <5ms

### Quality Requirements

- Test coverage >80%
- Clear error messages
- Comprehensive logging
- User-friendly progress display
- Detailed reports
- Robust error handling

## Timeline Estimate

- **Phase 1** (CLI Framework): 1 day
- **Phase 2** (Config Loading): 1 day
- **Phase 3** (Session Management): 1 day
- **Phase 4** (File Processing): 1 day
- **Phase 5** (Checkpoints): 1-2 days
- **Phase 6** (Location Cache): 1 day
- **Phase 7** (Photo Download): 2 days
- **Phase 8** (Markdown Sanitization): 0.5 days
- **Phase 9** (API Client): 1-2 days
- **Phase 10** (Orchestration): 2 days
- **Phase 11** (Progress Display): 1 day
- **Phase 12** (Report Generation): 1 day
- **Phase 13** (Integration Testing): 2 days

**Total**: ~15-17 days

## Next Steps After Completion

Once CLI is complete and tested:

1. **Full system integration testing**: Scraper → CLI → Endpoint
2. **Performance testing**: Large dataset (500+ items)
3. **User documentation**: Create user guide with examples
4. **Production deployment**: Deploy endpoint, distribute CLI
5. **Run initial imports**: Import data from all scrapers
6. **Monitor and iterate**: Collect feedback, fix issues

## Documentation

Create comprehensive CLI documentation:

- [ ] Update `docs/mass-import.md` with v3 CLI
- [ ] Add installation instructions
- [ ] Document all CLI arguments
- [ ] Provide configuration examples
- [ ] Add troubleshooting guide
- [ ] Include example workflows
- [ ] Document checkpoint system
- [ ] Explain resume functionality
