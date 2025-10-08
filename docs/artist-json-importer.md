# Artist JSON Importer

## Overview

The `artist-json` importer is a generic importer plugin that can import artist data from JSON files following a standard format. It's designed to work with any artist JSON file that follows the structure used by Burnaby Art Gallery and similar sources.

## JSON Format

The importer expects a JSON array of artist objects with the following structure:

```json
[
  {
    "source": "https://example.com",
    "source_url": "https://example.com/artist/123",  // optional
    "name": "Artist Name",
    "type": "Artist",                                 // optional
    "biography": "Artist biography text...",          // optional
    "birth date": "1950",                             // optional
    "death date": "2020",                             // optional
    "websites": "https://artist-website.com"          // optional
  }
]
```

### Required Fields
- `name` - Artist's name (string)
- `source` - Data source URL or identifier (string)

### Optional Fields
- `source_url` - Specific URL for this artist's page
- `type` - Artist type/classification
- `biography` - Artist biography or description
- `birth date` - Birth year or date
- `death date` - Death year or date
- `websites` - Artist's website(s)

## Features

### Automatic Biography Updates
The importer is optimized for updating existing artist records with biographies:

- **Duplicate Detection**: Uses exact name matching with optimized weights
- **Biography Enrichment**: Automatically updates existing artists who have empty biographies
- **Smart Merging**: Appends new biography content to existing records
- **Tag Preservation**: Merges new tags without overwriting existing data

### Configuration

The importer includes optimized default configuration for artist matching:

```typescript
{
  duplicateWeights: {
    title: 1.0,     // Name is the primary match criteria
    gps: 0.0,       // Artists don't have geographic location
    artist: 0.0,    // Not applicable
    referenceIds: 0.0,
    tagSimilarity: 0.0
  },
  duplicateThreshold: 0.25  // Lower threshold for name-only matching
}
```

## Usage

### Command Line Interface

Basic import:
```powershell
npx tsx src/lib/mass-import-system/cli/cli-entry.ts import \
  --importer artist-json \
  --input path/to/artists.json \
  --exporter api \
  --config src/lib/mass-import-system/api-config-dev.json
```

Import with limits:
```powershell
npx tsx src/lib/mass-import-system/cli/cli-entry.ts import \
  --importer artist-json \
  --input path/to/artists.json \
  --limit 10 \
  --exporter api \
  --config src/lib/mass-import-system/api-config-dev.json
```

### Direct API Import (Recommended for Artists)

For better control over duplicate detection settings when importing artists, use the Mass Import V2 API directly:

```typescript
import type { MassImportRequestV2 } from './src/shared/mass-import';

const request: MassImportRequestV2 = {
  metadata: {
    importId: `artist-import-${Date.now()}`,
    source: {
      pluginName: 'artist-json',
      pluginVersion: '1.0.0',
      originalDataSource: 'https://source-url.com',
    },
    timestamp: new Date().toISOString(),
  },
  config: {
    duplicateThreshold: 0.25,
    duplicateWeights: {
      gps: 0.0,
      title: 1.0,
      artist: 0.0,
      referenceIds: 0.0,
      tagSimilarity: 0.0,
    },
    enableTagMerging: true,
    createMissingArtists: false,
    batchSize: 10,
  },
  data: {
    artists: artistsData.map(artist => ({
      lat: 0,
      lon: 0,
      title: artist.name,
      description: artist.biography || undefined,
      source: artist.source,
      externalId: `artist-json-${artist.name.toLowerCase().replace(/\s+/g, '-')}`,
      tags: {
        source: artist.source,
        source_url: artist.source_url,
        // ... other tags
      },
      photos: [],
    })),
  },
};

// Send to API
const response = await fetch('http://localhost:8787/api/mass-import/v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request),
});
```

## Examples

### Burnaby Art Gallery Artists

The importer was originally designed for Burnaby Art Gallery's artist data:

```powershell
npx tsx src/lib/mass-import-system/cli/cli-entry.ts import \
  --importer artist-json \
  --input src/lib/data-collection/burnabyartgallery/output/artists.json \
  --limit 10 \
  --exporter api \
  --config src/lib/mass-import-system/api-config-dev.json
```

### Custom Artist Data

Any JSON file following the format will work:

```json
[
  {
    "source": "https://my-museum.org",
    "source_url": "https://my-museum.org/artists/jane-doe",
    "name": "Jane Doe",
    "type": "Sculptor",
    "biography": "Jane Doe is a contemporary sculptor known for...",
    "birth date": "1975",
    "websites": "https://janedoe-art.com"
  }
]
```

## Import Results

The importer provides detailed feedback:

- **Created**: New artist records added to the database
- **Duplicates**: Existing artists detected (may include biography updates)
- **Failed**: Artists that couldn't be imported (with error details)

When duplicates are detected with empty biographies, the response will indicate `DUPLICATE_DETECTED_BIO_UPDATED`.

## Production Use

### Updating Existing Artists with Biographies

If you have existing artist records without biographies:

1. Prepare your artist JSON file with biographies
2. Run the import - it will detect existing artists by name
3. Empty biographies will be automatically updated
4. Tags will be merged
5. No data loss - existing information is preserved

### Safety Features

- Exact name matching prevents false duplicates
- Biography content checking prevents redundant updates
- Tag merging preserves all existing metadata
- Original source attribution is maintained

## Troubleshooting

### Low Success Rate

If you see a low success rate with many duplicates, this is expected and correct behavior:
- Artists already in the database are detected as duplicates
- Check the `error` field: `DUPLICATE_DETECTED_BIO_UPDATED` means biography was successfully updated
- `DUPLICATE_DETECTED` means the artist already exists with complete data

### No Biographies Added

Check that:
- Your JSON file contains `biography` fields
- The biography fields are not empty strings
- Artist names match exactly (case-insensitive matching is used)

### All Records Failing

Verify:
- JSON structure matches the expected format
- Required fields (`name`, `source`) are present
- File encoding is UTF-8
- JSON is valid (no syntax errors)
