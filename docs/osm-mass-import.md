# OpenStreetMap Mass Import

Integration for importing OpenStreetMap artwork data into the Cultural Archiver platform.

## Overview

This feature enables bulk importing of public artwork data from OpenStreetMap using the `fetch-osm-artworks.js` script output. The system processes GeoJSON FeatureCollections and converts them to platform-compatible artwork records with proper attribution.

## Implementation

### Core Components

1. **Parser Library** (`src/workers/lib/osm-mass-import.ts`)
   - Converts OSM GeoJSON to mass-import payloads
   - Handles field mapping and validation
   - Generates structured tags with OSM attribution

2. **API Endpoints** (`src/workers/routes/mass-import-osm.ts`)
   - `POST /api/mass-import/osm` - Import OSM GeoJSON data
   - `POST /api/mass-import/osm/validate` - Validate without importing

3. **Configuration** (`src/config/osm-import-config.json`)
   - Field mapping rules
   - Validation presets (default, strict, permissive, vancouver)
   - Batch processing settings

4. **CLI Tool** (`scripts/osm-import.js`)
   - Command-line interface for imports
   - Progress tracking and error reporting
   - Dry-run validation support

## Usage

### API Integration

```javascript
// Import OSM GeoJSON data
const response = await fetch('/api/mass-import/osm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    geoJSON: {
      type: 'FeatureCollection',
      features: [
        /* OSM artwork features */
      ],
    },
    config: {
      duplicateThreshold: 0.7,
      preset: 'vancouver',
    },
    batchSize: 50,
  }),
});
```

### CLI Usage

```bash
# Dry run validation
node scripts/osm-import.js merged-artworks.geojson --dry-run

# Import with Vancouver preset
node scripts/osm-import.js merged-artworks.geojson --preset vancouver

# Custom batch size
node scripts/osm-import.js data.geojson --batch-size 25
```

## Data Mapping

### Field Mappings

- `properties.name` → `artwork.title`
- `properties.artist_name` → `artwork.created_by`
- `geometry.coordinates` → `artwork.lat/lon`
- `id` → `External ID` tag

### Attribution Tags

- `Source`: "OpenStreetMap"
- `License`: "[ODbL](https://www.openstreetmap.org/copyright)"
- `Attribution`: "© OpenStreetMap contributors"
- `External ID`: OSM feature ID

### Property Mapping

All OSM properties are converted to structured tags:

- `artwork_type` → "Artwork Type"
- `material` → "Material"
- `website` → "Website"
- Custom fields automatically formatted

## Configuration Presets

### Default

- Standard validation and duplicate detection (0.7 threshold)
- Requires name and coordinates
- Skips incomplete records

### Vancouver

- Optimized for Vancouver public art dataset
- Higher duplicate threshold (0.8)
- Additional metadata tags

### Strict

- High-quality imports only
- Requires name, artist, and artwork type
- Higher duplicate threshold (0.9)

### Permissive

- Maximum data inclusion
- Lower duplicate threshold (0.5)
- Allows incomplete records

## Error Handling

- **Validation Errors**: Invalid coordinates, missing required fields
- **Duplicate Detection**: Uses existing similarity service with OSM ID matching
- **Rate Limiting**: 2 imports per hour per IP
- **Batch Processing**: Sequential processing with error recovery

## Testing

Comprehensive test coverage:

- Unit tests for parser logic (`osm-mass-import.test.ts`)
- API integration tests (`osm-mass-import-api.test.ts`)
- Edge case handling and validation

## Integration Notes

- Uses existing `processMassImport` endpoint for actual data insertion
- Integrates with duplicate detection service
- Maintains audit trail with `MASS_IMPORT_USER_UUID`
- Compatible with existing review and approval workflows

## Future Enhancements

- R2 storage integration for large datasets
- Real-time progress tracking
- Advanced field mapping rules
- Photo URL extraction from OSM websites
- Integration with Overpass API for live updates
