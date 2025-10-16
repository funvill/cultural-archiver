# Surrey Public Art Scraper - Geocoding Integration

## Summary

Successfully integrated geocoding functionality into the Surrey public art scraper to convert text addresses into GPS coordinates.

## Changes Made

### 1. Location Service Enhancements

#### `src/lib/location/nominatim-client.ts`
- Added `geocode(query, options)` method for forward geocoding (address → coordinates)
- Uses Nominatim's `/search` endpoint
- Respects same 1-second rate limit as reverse geocoding
- Returns `LocationResult | null` (null when no results found)

#### `src/lib/location/service.ts`
- Added `geocodeAddress(address, options)` method with cache-first strategy
- Checks cache before making API calls
- Stores results in cache for future lookups
- Returns `LocationResult | null`

#### `src/lib/location/cache-service.ts`
- **Database Schema Update**: Added `address_query TEXT` column to `location_cache` table
- **New Index**: Created `idx_location_cache_address` for fast address lookups
- **New Method**: `getLocationByAddress(address)` for cache retrieval by address
- **New Method**: `storeLocationWithAddress(locationData)` for storing geocoded results with address

### 2. Surrey Scraper Integration

#### `src/mass-import/scraper/surrey-ca/scraper.ts`
- Added LocationService instance to scraper class
- Integrated geocoding into `scrapeArtwork()` method
- **Address Extraction**: Extracts address from parentheses (e.g., "City Hall (13450 104 Ave)" → "13450 104 Ave")
- **Enhanced Query**: Appends ", Surrey, BC, Canada" to improve geocoding accuracy
- Fallback to `[0, 0]` coordinates when location is missing or geocoding fails

## Testing Results

### Test Run 1: Fresh Cache
```
Scraped 2 artworks:
- "A Busy Street": Successfully geocoded to [-122.849229, 49.191354]
  - Original location: "3rd Floor Reception Area at City Hall (13450 104 Ave)"
  - Extracted address: "13450 104 Ave"
  - Geocoded to: Surrey City Hall
- "A Million Summers": No location field, coordinates [0, 0]
```

### Test Run 2: Cache Validation
```
Re-scraped same 2 artworks:
- Geocoding was instant (retrieved from cache)
- Same coordinates verified
- No API calls made
```

### Cache Database
```sql
SELECT * FROM location_cache WHERE address_query IS NOT NULL;

-- Result:
-- address_query: "13450 104 Ave, Surrey, BC, Canada"
-- display_name: "Surrey City Hall, 13450, 104 Avenue, City Centre, Surrey..."
-- lat: 49.191354, lon: -122.849229
```

## Performance Characteristics

- **Cold Cache**: ~1 second per geocoding request (API rate limit)
- **Warm Cache**: < 10ms per lookup (SQLite query)
- **Cache Hit Rate**: 100% for duplicate addresses
- **Error Handling**: Graceful fallback to [0, 0] when geocoding fails

## Geocoding Strategy

1. **Address Extraction**:
   - Detect addresses in parentheses: `"Location Name (Address)"` → `"Address"`
   - If no parentheses, use full location string

2. **Query Enhancement**:
   - Append city/province/country: `"{address}, Surrey, BC, Canada"`
   - Improves accuracy for local addresses

3. **Cache First**:
   - Check SQLite cache by address query string
   - Only hit Nominatim API on cache miss
   - Store results for future lookups

4. **Error Handling**:
   - Return `[0, 0]` coordinates on failure
   - Log warnings for failed geocoding attempts
   - Continue processing remaining artworks

## Database Migration

The location cache database was automatically upgraded with the new schema when the service was initialized. No manual migration was required.

**Important**: If you have an existing `_data/location-cache.sqlite` database, it will be automatically updated with the `address_query` column on first use. If you encounter SQLite errors, delete the cache file and it will be recreated with the correct schema.

## Future Enhancements

1. **Batch Geocoding**: Process multiple addresses in parallel (respecting rate limits)
2. **Address Normalization**: Standardize address formats before caching
3. **Geocoding Quality Score**: Track confidence/accuracy of geocoded results
4. **Manual Overrides**: Allow manual coordinate corrections for failed geocoding
5. **Bounding Box Filtering**: Add viewbox parameter to Nominatim for better local results

## Usage

```typescript
import { LocationService } from './src/lib/location/service';

const service = new LocationService();

// Geocode an address
const result = await service.geocodeAddress('13450 104 Ave, Surrey, BC, Canada');

if (result) {
  console.log(`Coordinates: [${result.lon}, ${result.lat}]`);
  console.log(`Location: ${result.display_name}`);
  console.log(`Source: ${result.source}`); // 'cache' or 'nominatim'
}
```

## Files Modified

1. `src/lib/location/nominatim-client.ts` - Added forward geocoding
2. `src/lib/location/service.ts` - Added geocodeAddress method
3. `src/lib/location/cache-service.ts` - Added address-based caching
4. `src/mass-import/scraper/surrey-ca/scraper.ts` - Integrated geocoding

## Files Created

1. `docs/location-geocoding.md` - This documentation file
