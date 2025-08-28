# Database Schema Documentation

## Overview

The Cultural Archiver MVP uses a SQLite database (Cloudflare D1) with four core
tables designed for crowdsourced public art mapping. The schema supports
geospatial queries, community submissions, and moderation workflows.

## Database Tables

### artwork_types

Lookup table for predefined artwork categories.

| Field         | Type | Constraints                       | Description                              |
| ------------- | ---- | --------------------------------- | ---------------------------------------- |
| `id`          | TEXT | PRIMARY KEY                       | Unique identifier                        |
| `name`        | TEXT | NOT NULL, UNIQUE                  | Human-readable type name                 |
| `description` | TEXT | NULL                              | Optional description of the artwork type |
| `created_at`  | TEXT | NOT NULL, DEFAULT datetime('now') | Creation timestamp                       |

**Indexes:**

- `idx_artwork_types_name` on `name` for lookup queries

**Pre-populated values:**

- `public_art` - "Public art installations and commissioned works"
- `street_art` - "Street art, murals, and graffiti"
- `monument` - "Monuments, memorials, and commemorative structures"
- `sculpture` - "Sculptural works and installations"
- `other` - "Other types of public artwork"

### artwork

Core table storing public artwork locations and metadata.

| Field        | Type | Constraints                           | Description                        |
| ------------ | ---- | ------------------------------------- | ---------------------------------- |
| `id`         | TEXT | PRIMARY KEY                           | Unique identifier                  |
| `lat`        | REAL | NOT NULL                              | Latitude coordinate (-90 to 90)    |
| `lon`        | REAL | NOT NULL                              | Longitude coordinate (-180 to 180) |
| `type_id`    | TEXT | NOT NULL, FK→artwork_types.id         | Reference to artwork type          |
| `created_at` | TEXT | NOT NULL, DEFAULT datetime('now')     | Creation timestamp                 |
| `status`     | TEXT | CHECK('pending','approved','removed') | Moderation status                  |
| `tags`       | TEXT | NULL                                  | JSON object for key-value metadata |

**Indexes:**

- `idx_artwork_lat_lon` on `(lat, lon)` for spatial queries
- `idx_artwork_status` on `status` for filtering
- `idx_artwork_type_id` on `type_id` for type-based filtering

**Foreign Keys:**

- `type_id` → `artwork_types.id`

**Status Workflow:**

- `pending` - Newly submitted, awaiting moderation
- `approved` - Verified and visible on public map
- `removed` - Removed from public view (soft delete)

### logbook

Community submissions and entries for artworks.

| Field        | Type | Constraints                            | Description                                        |
| ------------ | ---- | -------------------------------------- | -------------------------------------------------- |
| `id`         | TEXT | PRIMARY KEY                            | Unique identifier                                  |
| `artwork_id` | TEXT | NULL, FK→artwork.id                    | Reference to artwork (NULL for new submissions)    |
| `user_token` | TEXT | NOT NULL                               | Anonymous UUID or authenticated user ID            |
| `note`       | TEXT | NULL                                   | Optional submission note (≤500 chars at app level) |
| `photos`     | TEXT | NULL                                   | JSON array of R2 URLs: `["url1", "url2"]`          |
| `status`     | TEXT | CHECK('pending','approved','rejected') | Moderation status                                  |
| `created_at` | TEXT | NOT NULL, DEFAULT datetime('now')      | Creation timestamp                                 |

**Indexes:**

- `idx_logbook_artwork_id` on `artwork_id` for relationship queries
- `idx_logbook_status` on `status` for moderation workflows
- `idx_logbook_user_token` on `user_token` for user-specific queries

**Foreign Keys:**

- `artwork_id` → `artwork.id` ON DELETE CASCADE

**Status Workflow:**

- `pending` - Awaiting moderation
- `approved` - Accepted (creates/updates artwork)
- `rejected` - Rejected (hidden from user)

### tags

Flexible tagging system for additional metadata.

| Field        | Type | Constraints                       | Description                              |
| ------------ | ---- | --------------------------------- | ---------------------------------------- |
| `id`         | TEXT | PRIMARY KEY                       | Unique identifier                        |
| `artwork_id` | TEXT | NULL, FK→artwork.id               | Reference to artwork                     |
| `logbook_id` | TEXT | NULL, FK→logbook.id               | Reference to logbook entry               |
| `label`      | TEXT | NOT NULL                          | Tag category (e.g., "material", "style") |
| `value`      | TEXT | NOT NULL                          | Tag value (e.g., "bronze", "modern")     |
| `created_at` | TEXT | NOT NULL, DEFAULT datetime('now') | Creation timestamp                       |

**Indexes:**

- `idx_tags_artwork_id` on `artwork_id`
- `idx_tags_logbook_id` on `logbook_id`
- `idx_tags_label` on `label` for category-based queries

**Foreign Keys:**

- `artwork_id` → `artwork.id` ON DELETE CASCADE
- `logbook_id` → `logbook.id` ON DELETE CASCADE

**Note:** Either `artwork_id` OR `logbook_id` must be non-NULL (but not both).

## Relationships

```text
artwork_types ──┐
                │ 1:N
                ▼
              artwork ──┐
                │ 1:N  │ 1:N
                ▼      ▼
             logbook  tags
                │ 1:N
                ▼
               tags
```

## Common Queries

### Find artworks near a location

```sql
-- Find approved artworks within ~500m radius (approximate)
SELECT a.*, at.name as type_name
FROM artwork a
JOIN artwork_types at ON a.type_id = at.id
WHERE a.status = 'approved'
  AND a.lat BETWEEN ? - 0.0045 AND ? + 0.0045
  AND a.lon BETWEEN ? - 0.0045 AND ? + 0.0045;
```

### Get artwork with latest submissions

```sql
-- Get artwork details with recent logbook entries
SELECT a.*, at.name as type_name,
       l.note, l.photos, l.created_at as submission_date
FROM artwork a
JOIN artwork_types at ON a.type_id = at.id
LEFT JOIN logbook l ON a.id = l.artwork_id
WHERE a.id = ?
ORDER BY l.created_at DESC;
```

### User's submissions

```sql
-- Get all submissions for a user token
SELECT l.*, a.lat, a.lon, at.name as type_name
FROM logbook l
LEFT JOIN artwork a ON l.artwork_id = a.id
LEFT JOIN artwork_types at ON a.type_id = at.id
WHERE l.user_token = ?
ORDER BY l.created_at DESC;
```

### Pending moderation queue

```sql
-- Get submissions awaiting moderation
SELECT l.*, a.lat, a.lon, at.name as type_name
FROM logbook l
LEFT JOIN artwork a ON l.artwork_id = a.id
LEFT JOIN artwork_types at ON a.type_id = at.id
WHERE l.status = 'pending'
ORDER BY l.created_at ASC;
```

## Performance Considerations

### Spatial Queries

- The `(lat, lon)` composite index enables efficient radius searches
- For precise distance calculations, use the haversine formula in application
  code
- Consider query bounds of ±0.0045 degrees (~500m at mid-latitudes) for initial
  filtering

### Indexing Strategy

- All foreign keys are indexed for fast JOINs
- Status fields are indexed for filtering workflows
- `user_token` index supports user-specific queries

### JSON Fields

- `tags` and `photos` fields store JSON as TEXT
- Parse JSON at application level, not in SQL queries
- Consider extracting frequently-queried JSON keys to separate columns if needed

## Migration Notes

- This schema completely replaces the existing art collection schema
- Migration is destructive - existing data will be lost
- Foreign key constraints must be enabled in SQLite configuration
- Sample data includes realistic Vancouver coordinates for testing

## TypeScript Integration

The database schema is reflected in TypeScript types in `src/shared/types.ts`:

- `ArtworkTypeRecord` - artwork_types table
- `ArtworkRecord` - artwork table
- `LogbookRecord` - logbook table
- `TagRecord` - tags table

Refer to the types file for complete interface definitions and validation
functions.
