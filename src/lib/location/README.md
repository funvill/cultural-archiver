# Location Services

This module provides comprehensive location services for the Cultural Archiver project, including reverse geocoding with local caching for improved performance and adherence to API rate limits.

## Overview

The location services module consists of three main components:

- **`cache-service.ts`** - SQLite database management for local caching
- **`nominatim-client.ts`** - OpenStreetMap Nominatim API client with rate limiting
- **`service.ts`** - Unified service combining cache and API functionality

## Quick Start

`npm run warm-location-cache "src/lib/data-collection/osm/output/merged/merged-artworks.geojson"`

### Basic Usage

```typescript
import { LocationService } from '@cultural-archiver/lib/location';

const locationService = new LocationService();

// Get location information for coordinates
const result = await locationService.getLocation(49.2827, -123.1207);
console.log(result.display_name); // "Downtown Vancouver, BC, Canada"
console.log(result.source); // "cache" or "nominatim"

// Clean up
locationService.close();
```

### Cache Management

```typescript
import { LocationCacheService } from '@cultural-archiver/lib/location';

const cache = new LocationCacheService();

// Check if coordinates are cached
const hasLocation = cache.hasLocation(49.2827, -123.1207);

// Get cache statistics
const stats = cache.getStats();
console.log(`Cache contains ${stats.totalEntries} locations`);

cache.close();
```

### Direct API Access

```typescript
import { NominatimApiClient } from '@cultural-archiver/lib/location';

const client = new NominatimApiClient();

// Make direct API request (respects rate limits)
const result = await client.reverseGeocode(49.2827, -123.1207);
console.log(result.display_name);
```

## Cache Warming

To pre-populate the location cache before running mass imports:

### 1. Prepare Your Data

Ensure your import file contains coordinates in one of these formats:

**JSON Format:**

```json
[
  {
    "lat": 49.2827,
    "lon": -123.1207,
    "title": "Artwork 1"
  },
  {
    "latitude": 49.2476,
    "longitude": -123.1336,
    "title": "Artwork 2"
  }
]
```

**CSV Format:**

```csv
title,lat,lon,description
"Artwork 1",49.2827,-123.1207,"Description here"
"Artwork 2",49.2476,-123.1336,"Another description"
```

### 2. Run Cache Warming

```bash
# From project root
npm run warm-location-cache path/to/your/data.json

# Example with OSM import data
npm run warm-location-cache src/lib/data-collection/osm-vancouver-art.json

# Example with Vancouver Public Art data
npm run warm-location-cache src/lib/data-collection/vancouver-public-art.json
```

### 3. Monitor Progress

The cache warming script provides detailed progress information:

```
🌟 Starting cache warming from: data.json
📍 Extracting coordinates...
Found 1247 total coordinates, 856 unique
234 already in cache, 622 to fetch
📊 Current cache: 234 entries
🚀 Processing 622 coordinates...
⏱️  Estimated time: 11 minutes

Progress: 50/622 (8.0%) | Rate: 0.98/sec | ETA: 9m 32s | Errors: 0 | Skipped: 2
...
✅ Cache warming completed!
📊 Final cache: 856 entries (622 added)
⏱️  Total time: 10m 23s
```

## OSM Import Cache Warming

For OpenStreetMap import data specifically:

### 1. Locate OSM Data Files

OSM import files are typically located in:

```
src/lib/data-collection/
├── osm-vancouver-art.json
├── osm-public-art-bc.json
└── other-osm-files.json
```

### 2. Warm Cache for OSM Data

```bash
# Vancouver OSM art data
npm run warm-location-cache src/lib/data-collection/osm-vancouver-art.json

# British Columbia OSM data (if available)
npm run warm-location-cache src/lib/data-collection/osm-public-art-bc.json

# Custom OSM export
npm run warm-location-cache path/to/your/osm-export.json
```

### 3. Verify Cache Population

```bash
# Check cache statistics
npm run location-cache:stats

# Should show something like:
# { totalEntries: 1247, oldestEntry: '2025-09-22T...', newestEntry: '2025-09-22T...' }
```

## Configuration

### Custom Cache Database Path

```typescript
import { LocationService } from '@cultural-archiver/lib/location';

// Use custom database location
const service = new LocationService('/custom/path/to/cache.sqlite');
```

### API Request Timeout

```typescript
// Set custom timeout (default: 10 seconds)
const result = await service.getLocation(lat, lon, {
  timeout: 15000, // 15 seconds
});
```

### Disable Cache

```typescript
// Force API lookup (bypass cache)
const result = await service.getLocation(lat, lon, {
  useCache: false,
});
```

## Rate Limiting

The system strictly adheres to Nominatim's usage policy:

- **Maximum 1 request per second**
- **Proper User-Agent identification**
- **English language preference**
- **Automatic retry with exponential backoff**

The rate limiting is handled automatically - you don't need to manage it manually.

## Database Schema

The cache uses a SQLite database with this structure:

```sql
CREATE TABLE location_cache (
  lat REAL NOT NULL,                 -- Latitude (rounded to 6 decimals)
  lon REAL NOT NULL,                 -- Longitude (rounded to 6 decimals)
  version TEXT NOT NULL DEFAULT '1.0', -- Schema version
  display_name TEXT NOT NULL,        -- Full address string
  country_code TEXT,                 -- ISO country code (e.g., "ca")
  country TEXT,                      -- Country name
  state TEXT,                        -- State/province
  city TEXT,                         -- City name
  suburb TEXT,                       -- Suburb/district
  neighbourhood TEXT,                -- Neighbourhood
  road TEXT,                         -- Street name
  postcode TEXT,                     -- Postal/ZIP code
  raw_response TEXT NOT NULL,        -- Full JSON from Nominatim
  created_at TEXT NOT NULL,          -- ISO 8601 timestamp
  PRIMARY KEY (lat, lon)
);
```

## Error Handling

The location services handle various error conditions:

### Network Errors

- Connection timeouts (configurable)
- DNS resolution failures
- HTTP error responses (4xx, 5xx)

### Data Errors

- Invalid coordinates (out of range)
- Malformed API responses
- Database corruption

### Rate Limiting

- Automatic throttling to respect API limits
- Graceful handling of 429 (Too Many Requests) responses

Example error handling:

```typescript
try {
  const result = await locationService.getLocation(lat, lon);
  console.log(result.display_name);
} catch (error) {
  if (error.message.includes('timeout')) {
    console.log('Request timed out, try again later');
  } else if (error.message.includes('rate limit')) {
    console.log('Rate limit exceeded, waiting...');
  } else {
    console.error('Location lookup failed:', error.message);
  }
}
```

## Performance

### Cache Performance

- **Cache hits**: < 1ms response time
- **Database size**: ~1KB per cached location
- **Memory usage**: ~50MB for 50,000 cached locations

### API Performance

- **Rate limit**: 1 request/second (enforced)
- **Typical response**: 200-500ms per request
- **Timeout**: 10 seconds (configurable)

### Warming Estimates

| Dataset Size     | Estimated Time |
| ---------------- | -------------- |
| 100 locations    | ~2 minutes     |
| 500 locations    | ~9 minutes     |
| 1,000 locations  | ~17 minutes    |
| 5,000 locations  | ~1.4 hours     |
| 10,000 locations | ~2.8 hours     |

## File Structure

```
src/lib/location/
├── index.ts              # Module exports
├── cache-service.ts      # SQLite cache management
├── nominatim-client.ts   # Nominatim API client
├── service.ts            # Unified location service
└── README.md            # This file
```

## Integration with Mass Import

The location services integrate seamlessly with the mass import system. See the [Mass Import System README](../mass-import-system/README.md) for details on enabling location enhancement during imports.

## Troubleshooting

### Common Issues

**Database locked error:**

```bash
# Ensure no other processes are using the cache
ps aux | grep location-cache
# Or restart and try again
```

**Rate limit errors:**

```bash
# The system handles this automatically, but you can check:
npm run location-cache:stats
# And wait before retrying
```

**Module compilation errors (better-sqlite3):**

```bash
# Rebuild native modules for your Node.js version
npm rebuild better-sqlite3
```

**Out of memory during cache warming:**

```bash
# Process in smaller batches using offset/limit
npm run warm-location-cache data.json --limit 1000 --offset 0
npm run warm-location-cache data.json --limit 1000 --offset 1000
# etc.
```

## Attribution

When displaying location data in your UI, include this attribution as required by OpenStreetMap:

> "Geocoding © OpenStreetMap contributors"

## License

This module is part of the Cultural Archiver project under the MIT license.
