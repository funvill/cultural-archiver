# Location Services Documentation

The Cultural Archiver includes a comprehensive location services system that provides reverse geocoding functionality with local caching. This system converts GPS coordinates into human-readable addresses while respecting API rate limits and providing excellent performance.

## System Overview

### Architecture

The location system consists of three main components:

- **Location Services** (`src/lib/location/`) - Core functionality for geocoding and caching
- **Mass Import Integration** - Automatic location enhancement during data imports  
- **Cache Warming Tools** - Scripts to pre-populate the cache database

### Key Features

- **Cache-first Strategy**: Always checks local SQLite cache before making API requests
- **Rate Limiting**: Respects Nominatim's 1 request/second limit automatically
- **Resumable Operations**: Scripts can be interrupted and resumed without re-fetching
- **Structured Data**: Stores detailed address components (city, state, country, etc.)
- **Mass Import Integration**: Seamlessly enhances import data with location names

## Quick Start Guide

### 1. Install Dependencies

The location system requires `better-sqlite3` and `tsx` which should be installed automatically:

```bash
npm install
```

If you encounter module compilation errors:

```bash
npm rebuild better-sqlite3
```

### 2. Test the System

Verify everything works with the test script:

```bash
npx tsx scripts/test-location-cache.ts
```

Expected output:
```
🧪 Testing Location Cache System...
📊 Initial cache stats: { totalEntries: 0, oldestEntry: null, newestEntry: null }
🗺️  Testing location lookups...
Testing Downtown Vancouver (49.2827, -123.1207):
  In cache: false
  Result: Former Vancouver Law Courts, Downtown, Vancouver, BC, Canada
  Source: nominatim
  ...
```

### 3. Pre-warm Cache for OSM Imports

Before running mass imports, warm the cache with your data files:

**For OSM data:**
```bash
# Vancouver OSM artwork data
npm run warm-location-cache src/lib/data-collection/osm-vancouver-art.json

# British Columbia OSM data (if available)
npm run warm-location-cache src/lib/data-collection/osm-public-art-bc.json
```

**For Vancouver Public Art data:**
```bash
npm run warm-location-cache src/lib/data-collection/vancouver-public-art.json
```

**For custom data files:**
```bash
npm run warm-location-cache path/to/your/data.json
npm run warm-location-cache path/to/your/data.csv
```

### 4. Monitor Cache Status

Check cache statistics at any time:

```bash
npm run location-cache:stats
```

Example output:
```json
{
  "totalEntries": 1247,
  "oldestEntry": "2025-09-22T12:34:56.789Z",
  "newestEntry": "2025-09-22T15:42:31.123Z"
}
```

## OSM Import Cache Warming

### Locating OSM Data Files

OSM import files are located in the data collection directory:

```
src/lib/data-collection/osm/output/merged/
└── merged-artworks.geojson          # 1,412 artwork locations (GeoJSON format)
```

### Cache Warming Process

**Step 1: Identify your data file**
```bash
ls "src/lib/data-collection/osm/output/merged/*.geojson"
```

**Step 2: Run cache warming**
```bash
# Start cache warming with OSM data (this will take ~24 minutes!)
npm run warm-location-cache "src/lib/data-collection/osm/output/merged/merged-artworks.geojson"
```

**Step 3: Monitor progress**
The script provides detailed progress information:

```
🌟 Starting cache warming from: osm-vancouver-art.json
📍 Extracting coordinates...
Found 1,247 total coordinates, 856 unique
234 already in cache, 622 to fetch
📊 Current cache: 234 entries
🚀 Processing 622 coordinates...
⏱️  Estimated time: 11 minutes

Progress: 150/622 (24.1%) | Rate: 0.98/sec | ETA: 8m 02s | Errors: 2 | Skipped: 5
Progress: 200/622 (32.1%) | Rate: 0.99/sec | ETA: 7m 05s | Errors: 2 | Skipped: 5
...
✅ Cache warming completed!
📊 Final cache: 856 entries (622 added)
⏱️  Total time: 10m 23s
✅ Processed: 620
❌ Errors: 2  
⏭️  Skipped: 5
```

### Performance Estimates for OSM Data

| Dataset | Actual Size | Cache Warming Time |
|---------|-------------|-------------------|
| OSM Merged Artworks | 1,412 locations | ~24 minutes |

*Note: Times assume no existing cache. Subsequent runs only process new coordinates.*

## Mass Import Integration

### Automatic Enhancement

Location enhancement is automatically enabled in mass imports. Coordinates are enhanced with human-readable location names:

**Before Enhancement:**
```json
{
  "lat": 49.2827,
  "lon": -123.1207,
  "title": "Sample Artwork",
  "tags": {
    "material": "bronze",
    "artist": "Example Artist"
  }
}
```

**After Enhancement:**
```json
{
  "lat": 49.2827,
  "lon": -123.1207,
  "title": "Sample Artwork", 
  "tags": {
    "material": "bronze",
    "artist": "Example Artist",
    "location_display_name": "Downtown Vancouver, British Columbia, Canada",
    "location_country": "Canada",
    "location_state": "British Columbia",
    "location_city": "Vancouver",
    "location_suburb": "Downtown"
  }
}
```

### Configuration

Control location enhancement behavior:

```bash
# Run import with location enhancement (default)
npm run mass-import -- osm api-exporter osm-data.json

# Disable location enhancement
npm run mass-import -- osm api-exporter osm-data.json --no-location-enhancement

# Custom configuration via processing options
```

Programmatic configuration:

```typescript
import { DataPipeline } from './src/lib/mass-import-system/lib/data-pipeline.js';

const result = await pipeline.process(inputData, {
  locationEnhancement: {
    enabled: true,
    failOnErrors: false,
    requestTimeout: 15000,
    tagFields: {
      displayName: 'address_full',
      city: 'address_city', 
      country: 'address_country'
    }
  }
});
```

## Technical Details

### Database Schema

The cache uses a single SQLite table:

```sql
CREATE TABLE location_cache (
  lat REAL NOT NULL,                 -- Latitude (6 decimal precision)
  lon REAL NOT NULL,                 -- Longitude (6 decimal precision)
  version TEXT NOT NULL DEFAULT '1.0', -- Schema version
  display_name TEXT NOT NULL,        -- Full address string
  country_code TEXT,                 -- ISO country code (e.g., "ca")
  country TEXT,                      -- Country name
  state TEXT,                        -- State/province name
  city TEXT,                         -- City name
  suburb TEXT,                       -- Suburb/district
  neighbourhood TEXT,                -- Neighbourhood name
  road TEXT,                         -- Street name
  postcode TEXT,                     -- Postal/ZIP code
  raw_response TEXT NOT NULL,        -- Full JSON from Nominatim
  created_at TEXT NOT NULL,          -- ISO 8601 timestamp
  PRIMARY KEY (lat, lon)
);

CREATE INDEX idx_location_cache_coords ON location_cache (lat, lon);
```

### File Locations

```
Project Structure:
├── src/lib/location/              # Core location services
│   ├── cache-service.ts           # SQLite database management
│   ├── nominatim-client.ts        # API client with rate limiting
│   ├── service.ts                 # Unified location service
│   └── README.md                  # Detailed technical docs
├── src/lib/mass-import-system/lib/
│   └── location-enhancer.ts       # Mass import integration
├── scripts/
│   ├── warm-location-cache.ts     # Cache warming utility
│   └── test-location-cache.ts     # System test script
├── _data/
│   └── location-cache.sqlite      # Cache database (auto-created)
└── docs/
    └── location-cache-system.md   # This documentation
```

### API Rate Limiting

The system strictly follows Nominatim's usage policy:

- **Maximum 1 request per second**
- **Proper User-Agent identification**
- **English language preference** (`accept-language: en`)
- **Timeout handling** (default 10 seconds)
- **Exponential backoff** on errors

### Error Handling

The system gracefully handles:

- **Network timeouts**: Configurable timeout with retry logic
- **API errors**: 4xx/5xx responses logged but don't stop processing  
- **Invalid coordinates**: Out-of-range values skipped with warnings
- **Rate limiting**: Automatic delay enforcement
- **Database corruption**: Automatic database recreation

## Advanced Usage

### Custom Cache Database Location

```typescript
import { LocationService } from './src/lib/location/service.js';

// Use custom database path
const service = new LocationService('/custom/path/cache.sqlite');
```

### Batch Processing Large Datasets

For very large datasets, process in batches:

```bash
# Process first 1000 records
npm run warm-location-cache large-dataset.json --limit 1000 --offset 0

# Process next 1000 records  
npm run warm-location-cache large-dataset.json --limit 1000 --offset 1000
```

*Note: The --limit and --offset flags may need to be implemented depending on your script structure.*

### Monitoring and Debugging

Enable verbose logging:

```bash
DEBUG=location:* npm run warm-location-cache data.json
```

Check database directly:

```bash
sqlite3 _data/location-cache.sqlite "SELECT COUNT(*) FROM location_cache;"
sqlite3 _data/location-cache.sqlite "SELECT * FROM location_cache LIMIT 5;"
```

## Troubleshooting

### Common Issues

**"Module was compiled against a different Node.js version"**

```bash
npm rebuild better-sqlite3
```

**"Database is locked"**

- Ensure no other processes are using the cache
- Check if VS Code or other tools have the database file open
- Restart and try again

**"Rate limit exceeded" or 429 errors**

- The system automatically handles this
- If you see persistent errors, wait 5-10 minutes before retrying

**"Permission denied" on _data directory**

```bash
# Ensure directory exists and is writable
mkdir -p _data
chmod 755 _data
```

**Out of memory during large cache warming**

- Process datasets in smaller batches
- Close other applications to free memory
- Consider using a machine with more RAM for very large datasets

### Performance Optimization

**For large datasets:**

1. **Pre-warm incrementally**: Process data in chunks during off-peak hours
2. **Monitor memory usage**: Large datasets may require significant RAM
3. **Use SSD storage**: Database performance improves significantly on SSD drives

**For production:**

1. **Migrate to cloud**: Consider moving cache to Cloudflare D1 for production
2. **Index optimization**: Current indexes are optimized for coordinate lookups
3. **Backup strategy**: Include cache database in backup procedures

## Attribution Requirements

When displaying location data in any user interface, you must include attribution as required by OpenStreetMap:

> **"Geocoding © OpenStreetMap contributors"**

This attribution should be visible wherever location-enhanced data is displayed.

## Future Roadmap

### Planned Enhancements

- **Cloud Migration**: Port cache to Cloudflare D1 for production scalability
- **Spatial Indexing**: Add geospatial queries for "nearby locations"
- **Batch API**: Support bulk reverse geocoding requests
- **Cache Expiration**: Add TTL and refresh strategies for stale data
- **Alternative Providers**: Support additional geocoding services
- **Performance Monitoring**: Built-in metrics and monitoring

### Integration Opportunities  

- **Frontend Integration**: Real-time location lookup for user submissions
- **API Endpoints**: Expose location services via REST API
- **Background Jobs**: Automated cache warming for new data
- **Analytics**: Location-based insights and reporting

## Related Documentation

- **[Mass Import System](../src/lib/mass-import-system/README.md)** - Import pipeline integration
- **[API Documentation](./api.md)** - REST API specifications  
- **[Database Schema](./database.md)** - Complete database documentation
- **[Location Services Technical Docs](../src/lib/location/README.md)** - Developer documentation

---

**Location Services** - Making GPS coordinates human-readable while respecting API limits and providing excellent performance.

## Configuration

### Location Enhancement Options

```typescript
interface LocationEnhancementOptions {
  enabled?: boolean;           // Enable/disable enhancement (default: true)
  cacheDbPath?: string;        // Custom cache database path
  requestTimeout?: number;     // API timeout in ms (default: 10000)
  failOnErrors?: boolean;      // Fail on lookup errors (default: false)
  tagFields?: {               // Custom tag field names
    displayName?: string;     // Field for full address (default: 'location_display_name')
    country?: string;         // Field for country (default: 'location_country') 
    state?: string;           // Field for state/province (default: 'location_state')
    city?: string;            // Field for city (default: 'location_city')
    suburb?: string;          // Field for suburb (default: 'location_suburb')
    neighbourhood?: string;   // Field for neighbourhood (default: 'location_neighbourhood')
  };
}
```

## Database Schema

The cache uses a single SQLite table with the following structure:

```sql
CREATE TABLE location_cache (
  lat REAL NOT NULL,                 -- Latitude (6 decimal places)
  lon REAL NOT NULL,                 -- Longitude (6 decimal places) 
  version TEXT NOT NULL DEFAULT '1.0', -- Schema version
  display_name TEXT NOT NULL,        -- Full address string
  country_code TEXT,                 -- Two-letter country code
  country TEXT,                      -- Country name
  state TEXT,                        -- State/province
  city TEXT,                         -- City/town
  suburb TEXT,                       -- Suburb/district
  neighbourhood TEXT,                -- Neighbourhood
  road TEXT,                         -- Road name
  postcode TEXT,                     -- Postal code
  raw_response TEXT NOT NULL,        -- Full JSON response from Nominatim
  created_at TEXT NOT NULL,          -- ISO 8601 timestamp
  PRIMARY KEY (lat, lon)
);
```

## Rate Limiting

The system strictly adheres to Nominatim's usage policy:

- **1 request per second maximum**
- **Proper User-Agent header** identifying the application
- **English language preference** for consistent results
- **Aggressive caching** to minimize API load

## Attribution

As required by OpenStreetMap and Nominatim terms of service, any UI displaying location data must include:

> "Geocoding © OpenStreetMap contributors"

## File Locations

- **Cache Database**: `_data/location-cache.sqlite` (excluded from git)
- **Main Services**: `src/lib/location-*.ts`
- **Mass Import Integration**: `src/lib/mass-import-system/lib/location-enhancer.ts`
- **Scripts**: `scripts/warm-location-cache.ts`, `scripts/test-location-cache.ts`

## Performance

**Cache Warming Estimates:**
- 1,000 unique coordinates: ~17 minutes
- 10,000 unique coordinates: ~2.8 hours  
- 50,000 unique coordinates: ~14 hours

**Typical Usage:**
- Vancouver Public Art dataset: ~500 locations = ~8.5 minutes to warm
- Cache hits are instantaneous (< 1ms)
- API misses respect 1-second rate limit

## Error Handling

The system handles various error conditions gracefully:

- **Network timeouts**: Configurable timeout with retry logic
- **API errors**: 4xx/5xx responses logged but don't stop processing
- **Invalid coordinates**: Skipped with warning messages
- **Cache corruption**: Database recreated automatically

## Future Enhancements

This local cache system is designed to be easily portable to cloud infrastructure:

- **Cloudflare D1**: Same SQLite schema works directly
- **API Integration**: Can become part of the main application API
- **Batch Processing**: Foundation for batch geocoding endpoints
- **Performance Optimization**: Spatial indexing for nearby location queries

## Troubleshooting

### Common Issues

**"Module compilation error" for better-sqlite3:**
```bash
npm rebuild better-sqlite3
```

**"Permission denied" on database file:**
- Ensure `_data/` directory exists and is writable
- Check that database file isn't locked by another process

**Rate limit exceeded:**
- The system automatically handles rate limiting
- If you see 429 errors, wait and retry

**Out of memory during cache warming:**
- Process large datasets in smaller batches
- Use the `--limit` option to process incrementally

## Contributing

When modifying the location cache system:

1. **Maintain Schema Compatibility**: Use migration scripts for schema changes
2. **Respect Rate Limits**: Never bypass the 1-second delay
3. **Test with Real Data**: Use actual coordinate data for testing
4. **Update Documentation**: Keep this README current with changes
5. **Consider Cloud Migration**: Design changes to be portable to D1

## License

This module is part of the Cultural Archiver project and follows the same MIT license.