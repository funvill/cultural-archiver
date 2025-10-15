# Mass-Import System Documentation

**Last Updated:** October 13, 2025  
**Version:** 2.0 (with Artist Matching Fix)  
**Status:** Production Ready

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Duplicate Detection Algorithm](#duplicate-detection-algorithm)
   - [Scoring Components](#scoring-components)
   - [Business Rules](#duplicate-detection-business-rules)
   - [Example Scenarios](#example-scoring-scenarios)
4. [Mass-Import V2 API Endpoint](#mass-import-v2-api-endpoint)
   - [Request Schema](#unified-schema)
   - [Response Format](#response-format)
5. [Business Rules & Data Integrity](#business-rules--data-integrity)
6. [CLI Plugin System](#cli-plugin-system)
   - [Available Plugins](#available-plugins)
   - [CLI Usage Examples](#example-cli-commands)
   - [Configuration](#configuration-files)
   - [Report System](#report-system)
7. [Backend Processing](#backend-processing)
8. [Best Practices](#best-practices)
   - [Data Preparation](#data-preparation)
   - [Import Strategy](#import-strategy)
   - [Duplicate Management](#duplicate-management)
9. [Security Considerations](#security-considerations)
10. [Troubleshooting](#troubleshooting)
11. [Additional Resources](#additional-resources)

---

## Overview

The Cultural Archiver provides a comprehensive **mass-import system** for trusted users (admin role required) to import large batches of artworks and artists from public datasets. The system consists of:

1. **Plugin-based CLI System** - Modular data transformation pipeline with importer/exporter plugins
2. **REST API Endpoints** - Backend endpoints for receiving and processing imported data
3. **Duplicate Detection Engine** - Intelligent similarity matching to prevent duplicate records
4. **Photo Processing Pipeline** - Automatic image downloading, validation, and thumbnail generation

### System Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Mass Import CLI System                        │
│  (TypeScript-based plugin architecture)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Data Source] → [Importer Plugin] → [Data Pipeline]            │
│                       ↓                                          │
│              [Standardized Format]                               │
│                       ↓                                          │
│              [Exporter Plugin] → [Report Tracker]                │
│                       ↓                                          │
└───────────────────────┼─────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                Backend API (Cloudflare Workers)                  │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/mass-import/v2                                       │
│       ↓                                                          │
│  [Authentication] → [Validation] → [Duplicate Detection]        │
│       ↓                    ↓               ↓                     │
│  [Photo Processor] → [Database] ← [Artist Linking]              │
│       ↓                    ↓               ↓                     │
│  [Response] ← [Results Aggregation] ← [Error Handler]           │
└─────────────────────────────────────────────────────────────────┘
```

### Components

#### 1. CLI Plugin System (`src/lib/mass-import-system/`)

Modular TypeScript-based system for transforming data from various sources into standardized format.

- **Importer Plugins**: Read and transform data from specific sources (Vancouver Open Data, OpenStreetMap, etc.)
- **Exporter Plugins**: Send transformed data to destinations (REST API, JSON files, console)
- **Data Pipeline**: Orchestrates data flow with validation, transformation, and error handling
- **Report System**: Generates detailed JSON reports with success/failure statistics

#### 2. Backend API Endpoints (`src/workers/routes/`)

RESTful endpoints for receiving and processing imported data with duplicate detection.

- **V2 Endpoint** (Recommended): `/api/mass-import/v2` - Unified schema with comprehensive features
- **V1 Endpoint** (Legacy): `/api/mass-import` - Backward compatibility for older clients

#### 3. Duplicate Detection Engine (`src/workers/lib/mass-import-duplicate-detection.ts`)

Intelligent similarity matching using multi-signal scoring algorithm to prevent duplicate artwork records.

## Duplicate Detection Algorithm

### Overview

The duplicate detection system uses a **multi-signal similarity scoring algorithm** to identify potential duplicate artworks. It prevents importing duplicate records while allowing similar but distinct artworks to coexist.

### Algorithm Specification

**Search Process:**

1. **Spatial Query**: Find existing approved artworks within **100 meters** of import coordinates using spatial indexing
2. **Similarity Scoring**: Calculate weighted similarity score for each candidate using multiple signals
3. **Threshold Comparison**: Mark as duplicate if confidence score ≥ threshold (default: **0.75**)
4. **Best Match Selection**: Return highest scoring match if duplicate detected

**Scoring Formula:**

```
Confidence Score = (Title Score × 0.2) + (Artist Score × 0.2) + 
                   (Location Score × 0.3) + (Tag Score × 0.05 per match)

Duplicate = Confidence Score ≥ 0.75
```

### Scoring Components

#### 1. Title Match (0.2 points maximum)

Uses **Levenshtein distance** with normalization:

- **Normalization**: Lowercase, trim whitespace, remove special characters
- **Calculation**: `similarity = 1 - (levenshtein_distance / max_length)`
- **Scoring**: `title_score = similarity × 0.2`

**Examples:**
- "Victory Monument" vs "Victory Monument" → **1.0 similarity** → **0.2 points**
- "Arc de Triomphe" vs "Arc de Triumph" → **0.92 similarity** → **0.184 points**
- "Statue" vs "Bronze Eagle" → **0.0 similarity** → **0.0 points**

#### 2. Artist Match (0.2 points maximum)

**FIXED in October 2025**: Now properly queries artist data from normalized database schema.

- **Database Query**: JOINs with `artists` and `artwork_artists` tables to retrieve actual artist names
- **Multi-Artist Support**: Handles comma-separated artist lists
- **Comparison Method**: Uses same Levenshtein distance algorithm as title matching
- **Scoring**: `artist_score = max_similarity × 0.2` (takes best match among all artist pairs)

**Previous Bug**: Was comparing submitter UUIDs (`created_by` field) instead of artist names, resulting in **0.0 artist score** for all comparisons.

**Current Implementation:**
```sql
SELECT 
  a.id, a.title, a.lat, a.lon, a.tags,
  GROUP_CONCAT(ar.name, ', ') as artist_names
FROM artwork a
LEFT JOIN artwork_artists aa ON a.id = aa.artwork_id
LEFT JOIN artists ar ON aa.artist_id = ar.id
WHERE a.status = 'approved'
GROUP BY a.id
```

**Examples:**
- "Jane Doe" vs "Jane Doe" → **1.0 similarity** → **0.2 points**
- "Jane Doe, John Smith" vs "Jane Doe" → **1.0 similarity** (best match) → **0.2 points**
- "Jane Doe" vs "J. Doe" → **0.67 similarity** → **0.134 points**
- "Jane Doe" vs "John Smith" → **0.0 similarity** → **0.0 points**

#### 3. Location Proximity (0.3 points maximum)

**Distance-weighted scoring** within 50-meter effective radius:

- **Calculation**: `distance = haversine_formula(lat1, lon1, lat2, lon2)`
- **Scoring**: `location_score = max(0, 1 - distance/50) × 0.3`
- **Falloff**: Linear decrease from 0m (full points) to 50m (zero points)

**Examples:**
- 0 meters apart → **1.0 proximity** → **0.3 points**
- 25 meters apart → **0.5 proximity** → **0.15 points**
- 50+ meters apart → **0.0 proximity** → **0.0 points**

**Note**: Initial spatial query uses 100m radius, but scoring only awards points within 50m.

#### 4. Tag Matches (0.05 points per exact match)

**Exact string matching** on structured metadata tags:

- **Comparison**: Case-sensitive exact matching of tag values
- **Scoring**: `tag_score = matching_tags × 0.05`
- **No Maximum**: Can contribute unlimited points with many matching tags

**Examples:**
- `{material: "bronze"}` vs `{material: "bronze"}` → **1 match** → **0.05 points**
- `{material: "bronze", type: "statue"}` vs `{material: "bronze", type: "statue"}` → **2 matches** → **0.10 points**
- `{material: "Bronze"}` vs `{material: "bronze"}` → **0 matches** → **0.0 points** (case-sensitive)

### Duplicate Detection Business Rules

#### Rule 1: Conservative Threshold

- **Default Threshold**: 0.75 (increased from 0.7 in October 2025)
- **Rationale**: Higher threshold reduces false positives (incorrectly marking distinct artworks as duplicates)
- **Configurable**: Can be adjusted in config file via `exporter.duplicateThreshold` field (see [Configuration Files](#configuration-files))
- **Valid Range**: 0.0 to 1.0 (recommended: 0.70-0.80)
- **Impact**:
  - Lower values (0.6-0.7): More aggressive detection, higher risk of false positives
  - Higher values (0.8-0.9): More conservative detection, may miss some actual duplicates

#### Rule 2: Best Match Selection

- **Behavior**: If multiple candidates exceed threshold, select highest scoring match
- **Ties**: First candidate wins in case of identical scores
- **Single Result**: Only one duplicate match returned per import item

#### Rule 3: Spatial Pre-filtering

- **100-Meter Search Radius**: Only artworks within 100m are considered as candidates
- **Performance**: Uses database spatial indexing (`idx_artwork_lat_lon`) for efficiency
- **Rationale**: Artworks >100m apart are unlikely to be duplicates regardless of other signals

#### Rule 4: Approved Status Only

- **Filter**: Only compares against artworks with `status = 'approved'`
- **Rationale**: Prevents matching against pending/rejected submissions
- **Impact**: Reduces false positives from low-quality pending submissions

#### Rule 5: Skip on Duplicate

- **Action**: Import item marked as "skipped" with reason "duplicate"
- **No Database Insert**: Duplicate items are NOT inserted into database
- **Report Info**: Full duplicate details included in import report for review

### Example Scoring Scenarios

#### Scenario 1: High Confidence Duplicate

**Import Item:**
- Title: "Victory Monument"
- Artist: "Jane Doe"
- Location: (49.2827, -123.1207)
- Tags: `{material: "bronze", type: "statue"}`

**Existing Artwork:**
- Title: "Victory Monument"
- Artist: "Jane Doe"
- Location: (49.2828, -123.1207) - 11 meters away
- Tags: `{material: "bronze", type: "statue"}`

**Scoring:**
- Title: 1.0 × 0.2 = **0.20**
- Artist: 1.0 × 0.2 = **0.20**
- Location: (1 - 11/50) × 0.3 = **0.234**
- Tags: 2 matches × 0.05 = **0.10**
- **Total: 0.734** → ⚠️ **Near threshold** (might not trigger with 0.75 threshold)

#### Scenario 2: Clear Duplicate

**Import Item:**
- Title: "Arc de Triomphe"
- Artist: "Jean-Baptiste Durand"
- Location: (49.2850, -123.1220)
- Tags: `{type: "sculpture"}`

**Existing Artwork:**
- Title: "Arc de Triomphe - Collections"
- Artist: "Jean-Baptiste Durand"
- Location: (49.2850, -123.1220) - 0 meters (exact match)
- Tags: `{type: "sculpture", year: "2020"}`

**Scoring:**
- Title: 0.75 × 0.2 = **0.15** (partial title match)
- Artist: 1.0 × 0.2 = **0.20**
- Location: 1.0 × 0.3 = **0.30**
- Tags: 1 match × 0.05 = **0.05**
- **Total: 0.70** → **Duplicate detected** (with 0.7 threshold)

#### Scenario 3: Similar But Not Duplicate

**Import Item:**
- Title: "Bronze Eagle"
- Artist: "Unknown"
- Location: (49.2850, -123.1220)
- Tags: `{material: "bronze"}`

**Existing Artwork:**
- Title: "Golden Eagle Statue"
- Artist: "Jane Doe"
- Location: (49.2851, -123.1221) - 15 meters away
- Tags: `{material: "gold"}`

**Scoring:**
- Title: 0.45 × 0.2 = **0.09** (some similarity)
- Artist: 0.0 × 0.2 = **0.00** (different artists)
- Location: (1 - 15/50) × 0.3 = **0.21**
- Tags: 0 matches × 0.05 = **0.00**
- **Total: 0.30** → **Not a duplicate** (below threshold)

### Report Output

When duplicates are detected, the import report includes:

```json
{
  "status": "skipped",
  "reason": "duplicate",
  "externalId": "vancouver-art-123",
  "duplicateInfo": {
    "type": "artwork",
    "existingId": "2cdf6ecc-9b89-4074-814d-6fc088ccd6ac",
    "existingTitle": "Arc de Triomphe - Collections",
    "confidenceScore": 1.7,
    "scoreBreakdown": {
      "gps": 0.6,
      "title": 0.25,
      "artist": 0.2,
      "referenceIds": 0,
      "tagSimilarity": 0.65,
      "total": 1.7
    },
    "reason": "Duplicate artwork detected with 1.70 confidence (threshold: 0.75)"
  }
}
```

## Mass-Import V2 API Endpoint

### Endpoint Details

```http
POST /api/mass-import/v2
Content-Type: application/json
Authorization: Bearer {admin-token}
```

**Access Control:** Admin role required (verified via JWT token)

### Unified Schema

The V2 endpoint uses a unified schema that supports both individual artworks and batch imports:

```json
{
  "items": [
    {
      "artwork": {
        "title": "Victory Monument",
        "description": "Bronze statue commemorating local history",
        "lat": 49.2827,
        "lon": -123.1207,
        "address": "123 Main Street, Vancouver, BC",
        "tags": {
          "artwork_type": "statue",
          "material": "bronze",
          "year": "1995",
          "artist_name": "Jane Doe",
          "height": 5.5,
          "condition": "excellent",
          "access": "yes"
        }
      },
      "artist": {
        "name": "Jane Doe",
        "bio": "Canadian sculptor known for public art installations",
        "website": "https://janedoe.art",
        "tags": {
          "country": "Canada",
          "birth_year": "1965",
          "medium": "sculpture"
        }
      },
      "photos": [
        {
          "url": "https://data.vancouver.ca/photos/victory_monument_1.jpg",
          "caption": "Front view of the monument"
        },
        {
          "url": "https://data.vancouver.ca/photos/victory_monument_2.jpg",
          "caption": "Detail of bronze inscription"
        }
      ]
    }
  ],
  "source": {
    "name": "Vancouver Open Data Portal",
    "url": "https://opendata.vancouver.ca/",
    "license": "CC BY 4.0",
    "attribution": "City of Vancouver Open Data"
  }
}
```

### Field Descriptions

#### Required Fields

- `items`: (array, required) List of items to import
- `items[].artwork`: (object, required) Main artwork data
- `items[].artwork.title`: (string, required) Artwork title
- `items[].artwork.lat`: (number, required) Latitude coordinate
- `items[].artwork.lon`: (number, required) Longitude coordinate

#### Optional Fields

- `items[].artwork.description`: (string) Detailed description
- `items[].artwork.address`: (string) Street address
- `items[].artwork.tags`: (object) Structured metadata tags
- `items[].artist`: (object) Artist information
- `items[].photos`: (array) Image URLs with optional captions
- `source`: (object) Data source attribution

### Enhanced Features

#### CLI Plugin Integration

The V2 endpoint is designed to work with CLI plugins for automated data processing:

```bash
# Example CLI plugin usage
cultural-archiver import vancouver-public-art --format=osm --source="https://opendata.vancouver.ca/"
```

#### Validation and Processing

- **Schema Validation**: Comprehensive validation of all input data
- **Duplicate Detection**: Intelligent detection of similar artworks using location + title + artist matching
- **Photo Processing**: Automatic fetch, validation, and thumbnail generation
- **Tag Normalization**: Structured tag validation and normalization
- **Artist Linking**: Automatic creation and linking of artist records

#### Error Handling

- **Atomic Transactions**: All-or-nothing processing per item
- **Detailed Error Reports**: Specific error messages for failed imports
- **Partial Success**: Continues processing remaining items if some fail
- **Rollback Support**: Automatic cleanup of partial imports on failure

### Response Format

#### Success Response (201 Created)

```json
{
  "success": true,
  "data": {
    "import_id": "import-uuid",
    "processed_items": 1,
    "successful_imports": 1,
    "failed_imports": 0,
    "results": [
      {
        "status": "success",
        "artwork_id": "artwork-uuid",
        "artist_id": "artist-uuid",
        "photos_imported": 2,
        "created_new_artist": true
      }
    ],
    "processing_time_ms": 1250,
    "source_attribution": {
      "name": "Vancouver Open Data Portal",
      "license": "CC BY 4.0"
    }
  }
}
```

#### Partial Success Response (207 Multi-Status)

```json
{
  "success": true,
  "data": {
    "import_id": "import-uuid",
    "processed_items": 2,
    "successful_imports": 1,
    "failed_imports": 1,
    "results": [
      {
        "status": "success",
        "artwork_id": "artwork-uuid-1",
        "photos_imported": 1
      },
      {
        "status": "error",
        "error": "Invalid coordinates: lat out of range",
        "item_index": 1
      }
    ],
    "processing_time_ms": 850
  }
}
```

#### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": {
    "message": "Schema validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "invalid_fields": [
        {
          "field": "items[0].artwork.lat",
          "error": "Latitude must be between -90 and 90"
        }
      ]
    }
  }
}
```

## Business Rules & Data Integrity

### Artwork Records

1. **Title Requirements**
   - Minimum: 3 characters
   - Maximum: 500 characters
   - Required field (cannot be null or empty)

2. **Coordinate Requirements**
   - Latitude: -90.0 to 90.0 (inclusive)
   - Longitude: -180.0 to 180.0 (inclusive)
   - Precision: Up to 6 decimal places (~0.1 meter accuracy)
   - Special case: `lat=0, lon=0` reserved for artist records without physical location

3. **Status Assignment**
   - All mass-imported artworks: `status = 'approved'`
   - Bypasses normal submission workflow
   - Immediately visible to public via API and frontend

4. **Duplicate Prevention**
   - Automatic detection using multi-signal algorithm
   - Configurable threshold (default: 0.75)
   - Duplicates are skipped, not imported
   - Detailed duplicate info included in report

### Artist Records

1. **Name Requirements**
   - Minimum: 2 characters
   - Maximum: 200 characters
   - Required field for artist records

2. **Artist Matching**
   - By name: Case-insensitive, normalized comparison
   - By externalId: Exact match on `tags.externalId` field
   - Priority: externalId match > name match

3. **Artist Linking**
   - Many-to-many relationship via `artwork_artists` table
   - Multiple artists per artwork supported
   - Same artist linked to multiple artworks

4. **Artist Creation**
   - New artist created if no match found
   - `status = 'approved'` for mass-imported artists
   - Artist record reused if match found

### Photo Management

1. **Photo Limits**
   - Minimum: 0 photos (optional)
   - Maximum: 10 photos per artwork
   - File size: 10MB per image maximum

2. **Photo Processing**
   - Original images stored in Cloudflare R2
   - 800px thumbnails generated automatically
   - Format conversion: WebP for thumbnails
   - Failed downloads: Log error but continue import

3. **Photo URLs**
   - Stored as JSON array in `photos` field
   - Format: `[{"url": "https://...", "caption": "..."}]`
   - URLs must be publicly accessible

### Tag Management

1. **Tag Structure**
   - Stored as JSON object in `tags` field
   - Keys: Lowercase, snake_case preferred
   - Values: Strings, numbers, or booleans

2. **Reserved Tag Keys**
   - `externalId`: Source system identifier
   - `source`: Data source name
   - `imported_at`: Import timestamp
   - `artwork_type`: Type of artwork (sculpture, mural, etc.)

3. **Tag Validation**
   - No schema enforcement (flexible structure)
   - JSON validation only
   - Special characters allowed in values

### External ID Management

1. **Purpose**
   - Track source record identity
   - Enable re-import without duplicates
   - Support data updates from source

2. **Format**
   - Stored in `tags.externalId` field
   - Format: `<source>-<id>` (e.g., `"osm-123456"`, `"vancouver-art-789"`)
   - Unique within data source

3. **Duplicate Detection**
   - ExternalId match: Perfect duplicate (skip)
   - ExternalId mismatch + high score: Potential duplicate (skip if above threshold)

## Mass-Import V1 API (Legacy)

**⚠️ Deprecated**: Use V2 endpoint for new integrations. V1 maintained for backward compatibility only.

### Endpoint

```http
POST /api/mass-import
Content-Type: application/json
Authorization: Bearer {admin-token}
```

### Differences from V2

- **No Artist Support**: Cannot import artist records separately
- **Limited Validation**: Less comprehensive input validation
- **No Duplicate Detection**: Does not check for existing records
- **Submissions Array**: Legacy logbook entry support

### Payload Structure

```json
{
  "user_uuid": "admin-user-uuid",
  "artwork": {
    "title": "Artwork Title",
    "description": "Description...",
    "lat": 49.2827,
    "lon": -123.1207,
    "photos": [{ "url": "https://..." }]
  },
  "submissions": [
    {
      "submission_type": "logbook_entry",
      "note": "Historical context",
      "tags": { "event": "installation" }
    }
  ]
}
```

**Migration Guide**: Convert V1 payloads to V2 format by wrapping in `items[]` array and updating structure.

## CLI Plugin System

### Architecture

The mass-import CLI system uses a **plugin-based architecture** with clear separation between data sources (importers) and destinations (exporters).

**Location:** `src/lib/mass-import-system/`

### Available Plugins

#### Importer Plugins

1. **`osm-artwork`** - OpenStreetMap artwork data
   - Format: GeoJSON
   - Source: OSM Overpass API extracts
   - Fields: Mapped from OSM tags (artwork_type, artist_name, material, etc.)

2. **`artist-json`** - Standard artist JSON format
   - Format: JSON array of artist objects
   - Fields: name, bio, website, tags, externalId

3. **`vancouver-public-art`** (Legacy) - Vancouver Open Data
   - Format: Custom JSON
   - Source: City of Vancouver public art registry

#### Exporter Plugins

1. **`api`** - REST API exporter (primary)
   - Target: `/api/mass-import/v2` endpoint
   - Features: Duplicate detection, photo processing, artist linking
   - Configuration: `api-config-dev.json` or `api-config-prod.json`

2. **`json`** - JSON file exporter
   - Target: Local JSON file
   - Use: Data inspection, testing, intermediate processing

3. **`console`** - Console output exporter
   - Target: Terminal stdout
   - Use: Quick data validation, debugging

### CLI Usage

**Build System:**

```bash
cd src/lib/mass-import-system
npm install
npm run build
```

**List Available Plugins:**

```bash
node dist/lib/mass-import-system/cli/cli-entry.js list-plugins
```

**Import Command Structure:**

```bash
node dist/lib/mass-import-system/cli/cli-entry.js import \
  --importer <importer-name> \
  --exporter <exporter-name> \
  --input <input-file-path> \
  --output <output-file-path> \
  --config <config-file> \
  --limit <max-records> \
  --offset <skip-records> \
  --generate-report
```

### Example CLI Commands

#### Import OSM Artwork Data

```bash
node dist/lib/mass-import-system/cli/cli-entry.js import \
  --importer osm-artwork \
  --exporter api \
  --config api-config-dev.json \
  --input C:\data\osm\merged-artworks.geojson \
  --output processed-art.json \
  --limit 100 \
  --offset 0 \
  --generate-report
```

#### Import Artists

```bash
node dist/lib/mass-import-system/cli/cli-entry.js import \
  --importer artist-json \
  --exporter api \
  --config api-config-dev.json \
  --input C:\data\artists\vancouver-artists.json \
  --generate-report
```

#### Test Import (Console Output)

```bash
node dist/lib/mass-import-system/cli/cli-entry.js import \
  --importer osm-artwork \
  --exporter console \
  --input test-data.geojson \
  --limit 5
```

### Configuration Files

#### API Exporter Configuration

**File:** `src/lib/mass-import-system/config/api-config-dev.json`

```json
{
  "importer": {},
  "exporter": {
    "apiEndpoint": "http://localhost:8787/api/mass-import/v2",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "authentication": {
      "type": "bearer",
      "token": "test-admin-token"
    },
    "timeout": 30000,
    "retryAttempts": 3,
    "retryDelay": 1000,
    "validateResponse": true,
    "transformData": true,
    "logRequests": true,
    "logResponses": true,
    "autoApproveArtists": true,
    "photoCacheDir": ".cache/photos",
    "duplicateThreshold": 0.75
  }
}
```

**Fields:**
- `apiEndpoint`: Backend API endpoint URL (dev: `http://localhost:8787/api/mass-import/v2`, prod: `https://api.publicartregistry.com/api/mass-import/v2`)
- `method`: HTTP method (typically "POST")
- `headers`: HTTP request headers
- `authentication`: Authentication configuration
  - `type`: Authentication type ("bearer", "apikey", "basic", "none")
  - `token`: Admin JWT token for bearer authentication
- `timeout`: Request timeout in milliseconds
- `retryAttempts`: Number of retry attempts for failed API calls
- `retryDelay`: Delay between retry attempts in milliseconds
- `validateResponse`: Whether to validate API responses
- `transformData`: Whether to transform data before sending
- `logRequests`: Enable request logging
- `logResponses`: Enable response logging
- `autoApproveArtists`: Automatically approve imported artists (use with caution)
- `photoCacheDir`: Local directory for caching downloaded photos
- **`duplicateThreshold`**: Confidence score threshold (0-1) for duplicate detection (default: 0.75)
  - Records with similarity scores at or above this threshold are considered duplicates
  - Lower values (0.6-0.7) = more aggressive duplicate detection (more false positives)
  - Higher values (0.8-0.9) = more conservative detection (fewer false positives, may miss some duplicates)
  - Recommended range: 0.70-0.80

### Report System

The CLI generates detailed JSON reports saved to `./reports/` directory.

**Report Structure:**

```json
{
  "timestamp": "2025-10-13T15:29:15.123Z",
  "importer": "osm-artwork",
  "exporter": "api",
  "inputFile": "merged-artworks.geojson",
  "summary": {
    "total": 100,
    "processed": 100,
    "successful": 88,
    "failed": 2,
    "skipped": 10
  },
  "records": [
    {
      "status": "success",
      "externalId": "osm-123456",
      "artworkId": "uuid-here",
      "title": "Victory Monument"
    },
    {
      "status": "skipped",
      "reason": "duplicate",
      "externalId": "osm-789012",
      "duplicateInfo": {
        "existingId": "uuid-existing",
        "confidenceScore": 0.85,
        "scoreBreakdown": {
          "title": 0.2,
          "artist": 0.2,
          "location": 0.3,
          "tags": 0.15
        }
      }
    },
    {
      "status": "failed",
      "reason": "Invalid coordinates",
      "externalId": "osm-345678",
      "error": "Latitude out of range: 95.123"
    }
  ],
  "performance": {
    "durationMs": 12500,
    "recordsPerSecond": 8.0
  }
}
```

## Backend Processing

### Authentication and Authorization

- **Admin Role Required**: Only users with `role = 'admin'` can access mass-import endpoints
- **JWT Token Authentication**: Bearer token in Authorization header
- **User Attribution**: All imported records attributed to authenticated admin user
- **Automatic Approval**: All imported content automatically set to `status = 'approved'`

### Data Processing Pipeline

1. **Request Validation**
   - Schema validation using Zod
   - Coordinate range validation (-90 to 90 lat, -180 to 180 lon)
   - Required field validation

2. **Duplicate Detection**
   - Spatial query within 100m radius
   - Multi-signal similarity scoring
   - Threshold comparison (default: 0.75)
   - Skip if duplicate detected

3. **Artist Management**
   - Check for existing artist by name or externalId
   - Create new artist record if not found
   - Link artwork to artist via `artwork_artists` table

4. **Photo Processing**
   - Download images from provided URLs
   - Validate image format and size
   - Upload to Cloudflare R2 bucket
   - Generate 800px thumbnails
   - Store photo URLs in `photos` JSON field

5. **Database Insert**
   - Insert artwork record with `status = 'approved'`
   - Insert artist record (if new)
   - Insert artwork_artists linking record
   - Atomic transaction for data consistency

6. **Response Generation**
   - Aggregate results (success/failure/skipped counts)
   - Include detailed error messages
   - Return HTTP 201 (success), 207 (partial), or 400/500 (error)

## Response Codes

| Code                        | Description                       | Scenario                  |
| --------------------------- | --------------------------------- | ------------------------- |
| `201 Created`               | All items imported successfully   | Complete success          |
| `207 Multi-Status`          | Some items succeeded, some failed | Partial success           |
| `400 Bad Request`           | Invalid request format or data    | Schema validation failure |
| `401 Unauthorized`          | Missing or invalid authentication | No admin token            |
| `403 Forbidden`             | Insufficient permissions          | Non-admin user            |
| `429 Too Many Requests`     | Rate limit exceeded               | Throttling active         |
| `500 Internal Server Error` | Server-side processing error      | System failure            |

## Best Practices

### Data Preparation

1. **Validate Coordinates**
   - Ensure latitude: -90 to 90, longitude: -180 to 180
   - Use consistent decimal precision (6 decimal places recommended)
   - Verify coordinates are in WGS84 datum (standard for GPS)

2. **Clean Photo URLs**
   - Verify all URLs are accessible via HTTP/HTTPS
   - Test image formats (JPEG, PNG, WebP supported)
   - Check file sizes (recommended: 500KB - 5MB per image)
   - Avoid temporary or expiring URLs

3. **Normalize Tag Data**
   - Use consistent lowercase keys: `artwork_type` not `Artwork Type`
   - Standardize values: `"sculpture"` not `"Sculpture"`
   - Remove special characters from keys
   - Use ISO formats for dates: `"2020-05-15"` not `"May 15, 2020"`

4. **Source Attribution**
   - Always include `source` object with name, URL, license
   - Verify license compatibility (CC BY, CC0, Public Domain recommended)
   - Document data transformation steps for provenance

### Import Strategy

#### Start Small

1. **Test Import**: Import 5-10 records first with `--limit 10`
2. **Review Report**: Check `./reports/` for errors and duplicates
3. **Adjust Configuration**: Update duplicate threshold or validation rules
4. **Scale Up**: Gradually increase batch size to 50-100 records

#### Batch Processing

1. **Optimal Batch Size**: 50-100 items per batch
   - Smaller batches: Better error isolation, slower overall
   - Larger batches: Faster processing, harder to debug failures

2. **Pagination**: Use `--offset` and `--limit` for large datasets
   ```bash
   # Process 1000 records in 10 batches of 100
   for i in {0..9}; do
     offset=$((i * 100))
     node dist/cli-entry.js import --limit 100 --offset $offset ...
   done
   ```

3. **Error Recovery**: Save report files, retry failed records separately

4. **Performance Monitoring**: Track `recordsPerSecond` in reports

#### Photo Caching

1. **Enable Photo Caching**: Set `photoCacheDir` in config to avoid re-downloading
2. **Cache Management**: Clear cache between different data sources
3. **Bandwidth Consideration**: Large imports may require significant download bandwidth

### Duplicate Management

#### Prevention

1. **Pre-filter Data**: Remove obvious duplicates from source data before import
2. **Check External IDs**: Use consistent externalId format to track source records
3. **Review Reports**: Examine `duplicateInfo` in reports to understand detection

#### Threshold Tuning

- **Default (0.75)**: Conservative, prevents most false positives
- **Lower (0.6-0.7)**: More aggressive duplicate detection, higher false positive rate
- **Higher (0.8-0.9)**: Allows more similar records, higher false negative rate

**Recommendation**: Start with default 0.75, adjust based on duplicate report review

#### Manual Review

1. **Check Skipped Records**: Review all records with `status: "skipped"` and `reason: "duplicate"`
2. **Verify Matches**: Compare `existingTitle` and `confidenceScore` to ensure accuracy
3. **Override if Needed**: Manually import legitimate distinct artworks marked as duplicates

### Development Workflow

#### Plugin Development

1. **Use Templates**: Start with existing plugin as template
2. **Type Safety**: Leverage TypeScript interfaces from `types/plugin.ts`
3. **Error Handling**: Wrap transformations in try-catch blocks
4. **Testing**: Write unit tests using test utilities in `test/test-utils.ts`

#### Configuration Management

1. **Separate Configs**: Use different config files for dev/staging/prod
2. **Environment Variables**: Store sensitive tokens in env vars, not config files
3. **Version Control**: `.gitignore` config files with actual tokens

#### Logging and Monitoring

1. **CLI Verbose Mode**: Enable detailed logging for debugging
2. **Report Generation**: Always use `--generate-report` flag
3. **Report Archive**: Save reports with timestamps for audit trail
4. **Error Analysis**: Parse report JSON files for automated error tracking

## Example Request

```
POST /api/mass-import
Content-Type: application/json

{
  "user_uuid": "MODERATOR-USER-UUID-REQUIRED",
  "artwork": {
    "title": "Vancouver Sculpture",
    "description": "A public artwork in Vancouver.",
    "lat": 49.2827,
    "lon": -123.1207,
    "photos": [
      { "url": "https://example.com/photo.jpg" }
    ]
  },
  "submissions": [
    {
      "submission_type": "logbook_entry",
      "note": "Installed in 2020",
      "tags": { "event": "installation", "material": "bronze" }
    }
  ]
}
```

## Security Considerations

### Authentication & Authorization

1. **Admin-Only Access**
   - Endpoint requires `role = 'admin'` in JWT token
   - Regular users and moderators CANNOT access mass-import
   - Token verification happens before any processing

2. **Token Security**
   - Store admin tokens securely (environment variables, secret managers)
   - Never commit tokens to version control
   - Rotate tokens regularly (recommended: every 90 days)
   - Use separate tokens for dev/staging/prod environments

3. **Audit Logging**
   - All imports logged with admin user ID and timestamp
   - Database tracks `created_by` for attribution
   - Import reports stored for compliance and review

### Data Validation

1. **Input Sanitization**
   - All text fields sanitized to prevent XSS
   - SQL injection prevented via parameterized queries
   - URL validation for photo sources

2. **Coordinate Validation**
   - Strict range checking: lat [-90, 90], lon [-180, 180]
   - Rejection of invalid or missing coordinates

3. **Photo URL Security**
   - HTTPS preferred for photo URLs
   - Timeout limits on photo downloads (30 seconds)
   - File size limits enforced (max 10MB per image)
   - Content-Type validation for images

### Rate Limiting

- **Default**: 100 requests per hour per admin user
- **Configurable**: Adjustable via backend rate_limiting table
- **Throttling**: Returns HTTP 429 when limit exceeded

### Data Privacy

1. **Attribution**: All imported records attributed to importing admin (not original data source user)
2. **Automatic Approval**: Bypasses normal moderation queue
3. **Public Visibility**: All imported records immediately visible to public

## Known Issues & Limitations

### Current Limitations

1. **Artist Matching Fixed (October 2025)**
   - Previous bug: Artist comparison always returned 0 score
   - Fix: Now properly JOINs with artists table for comparison
   - Impact: More accurate duplicate detection with artist data

2. **Photo Processing**
   - Sequential processing (not parallelized)
   - Network failures may cause entire import to fail
   - No support for photo metadata extraction

3. **Tag Validation**
   - Limited validation of tag values
   - Case-sensitive tag matching in duplicate detection
   - No schema enforcement for structured tags

4. **Performance**
   - Large imports (>500 records) may timeout
   - Duplicate detection queries can be slow with many nearby artworks
   - No progress streaming (wait for complete response)

### Planned Improvements

1. **Parallel Photo Processing**: Download multiple images concurrently
2. **Streaming Responses**: Real-time progress updates during import
3. **Enhanced Tag Validation**: Schema-based tag structure validation
4. **Batch Resume**: Resume interrupted large imports
5. **Dry Run Mode**: Preview import results without database changes

## Troubleshooting

### Common Issues

#### Issue: "Unauthorized" (401)

**Cause**: Invalid or expired admin token

**Solution**:
1. Verify token in config file is correct
2. Generate new admin token: `npm run scripts:grant-admin <email>`
3. Ensure token has not expired

#### Issue: "Forbidden" (403)

**Cause**: User does not have admin role

**Solution**:
1. Check user role in database: `SELECT role FROM user_roles WHERE user_id = ?`
2. Grant admin role if needed
3. Use correct admin account token

#### Issue: High Duplicate Detection Rate

**Cause**: Threshold too low or source data overlaps with existing records

**Solution**:
1. Review duplicate reports with `scoreBreakdown` details
2. Increase threshold in config: `duplicateThreshold: 0.85`
3. Pre-filter source data against existing records
4. Check if external IDs are properly mapped

#### Issue: Photo Processing Failures

**Cause**: Network timeouts, invalid URLs, or unsupported formats

**Solution**:
1. Verify all photo URLs are accessible via browser
2. Check image formats (JPEG, PNG, WebP supported)
3. Test with smaller batch size to isolate problematic URLs
4. Enable photo caching to avoid re-downloading

#### Issue: Build Failures

**Cause**: TypeScript compilation errors or missing dependencies

**Solution**:
```bash
cd src/lib/mass-import-system
rm -rf node_modules dist
npm install
npm run build
```

## Additional Resources

### Documentation

- **API Specification**: `/docs/api.md` - General API usage and authentication
- **Database Schema**: `/docs/database.md` - Database table structures and relationships
- **Photo Processing**: `/docs/photo-processing.md` - Image pipeline details
- **CLI System README**: `/src/lib/mass-import-system/README.md` - Plugin development guide

### Configuration Files

- **Dev Config**: `src/lib/mass-import-system/config/api-config-dev.json`
- **Prod Config**: `src/lib/mass-import-system/config/api-config-prod.json`
- **Plugin Metadata**: Importer/exporter JSON files with plugin configuration

### Support

- **GitHub Issues**: Report bugs and request features
- **Email**: `support@publicartregistry.com` for assistance
- **Discord**: Join community server for real-time help
