# Database Schema Documentation

## Overview

The Cultural Archiver MVP uses a SQLite database (Cloudflare D1) with core tables for crowdsourced public art mapping and a complete authentication system. The schema supports geospatial queries, community submissions, moderation workflows, and UUID-based authentication with magic link verification.

## Database Tables

### Authentication System Tables

#### users

Core table for authenticated users with UUID claiming functionality.

| Field               | Type | Constraints                       | Description                                   |
| ------------------- | ---- | --------------------------------- | --------------------------------------------- |
| `uuid`              | TEXT | PRIMARY KEY                       | User's claimed UUID (same as anonymous token) |
| `email`             | TEXT | NOT NULL, UNIQUE                  | User's email address                          |
| `created_at`        | TEXT | NOT NULL, DEFAULT datetime('now') | Account creation timestamp                    |
| `last_login`        | TEXT | NULL                              | Last login timestamp                          |
| `email_verified_at` | TEXT | NULL                              | When email was verified via magic link        |
| `status`            | TEXT | CHECK('active','suspended')       | Account status                                |

**Indexes:**

- `idx_users_email` on `email` for login lookups
- `idx_users_status` on `status` for filtering
- `idx_users_last_login` on `last_login` for analytics

**Status Workflow:**

- `active` - Normal account in good standing
- `suspended` - Account temporarily restricted

#### magic_links

Secure tokens for email-based authentication and account creation.

| Field        | Type    | Constraints                       | Description                                |
| ------------ | ------- | --------------------------------- | ------------------------------------------ |
| `token`      | TEXT    | PRIMARY KEY                       | Cryptographically secure token (64+ chars) |
| `email`      | TEXT    | NOT NULL                          | Target email address                       |
| `user_uuid`  | TEXT    | NULL, FK→users.uuid               | Associated user UUID (NULL for signup)     |
| `created_at` | TEXT    | NOT NULL, DEFAULT datetime('now') | Token generation timestamp                 |
| `expires_at` | TEXT    | NOT NULL                          | Token expiration (1 hour)                  |
| `used_at`    | TEXT    | NULL                              | When token was consumed                    |
| `ip_address` | TEXT    | NULL                              | Requesting IP address                      |
| `user_agent` | TEXT    | NULL                              | Requesting user agent                      |
| `is_signup`  | BOOLEAN | NOT NULL, DEFAULT FALSE           | TRUE for account creation                  |

**Indexes:**

- `idx_magic_links_email` on `email` for user lookups
- `idx_magic_links_expires_at` on `expires_at` for cleanup
- `idx_magic_links_used_at` on `used_at` for filtering
- `idx_magic_links_created_at` on `created_at` for analytics

**Foreign Keys:**

- `user_uuid` → `users.uuid` ON DELETE CASCADE

**Security Features:**

- Single-use tokens (marked via `used_at`)
- 1-hour expiration enforced via `expires_at`
- Minimum 64-character token length (32 secure bytes)

#### rate_limiting

Track request rates for magic link abuse prevention.

| Field             | Type | Constraints                       | Description                                 |
| ----------------- | ---- | --------------------------------- | ------------------------------------------- |
| `identifier`      | TEXT | NOT NULL                          | Email address or IP address                 |
| `identifier_type` | TEXT | CHECK('email','ip')               | Type of identifier being limited            |
| `request_count`   | INT  | NOT NULL, DEFAULT 0               | Requests in current window                  |
| `window_start`    | TEXT | NOT NULL, DEFAULT datetime('now') | Start of rate limit window                  |
| `last_request_at` | TEXT | NOT NULL, DEFAULT datetime('now') | Most recent request timestamp               |
| `blocked_until`   | TEXT | NULL                              | Block until this time (NULL if not blocked) |

**Primary Key:** `(identifier, identifier_type)`

**Indexes:**

- `idx_rate_limiting_identifier` on `identifier`
- `idx_rate_limiting_window_start` on `window_start` for cleanup
- `idx_rate_limiting_blocked_until` on `blocked_until` for filtering

**Rate Limits:**

- **Email**: 5 magic link requests per email per hour
- **IP**: 10 magic link requests per IP per hour

#### auth_sessions

Track active authentication sessions across devices.

| Field              | Type    | Constraints                       | Description                            |
| ------------------ | ------- | --------------------------------- | -------------------------------------- |
| `id`               | TEXT    | PRIMARY KEY                       | Session identifier (UUID)              |
| `user_uuid`        | TEXT    | NOT NULL, FK→users.uuid           | Associated user UUID                   |
| `token_hash`       | TEXT    | NOT NULL                          | SHA-256 hash of session token          |
| `created_at`       | TEXT    | NOT NULL, DEFAULT datetime('now') | Session creation timestamp             |
| `last_accessed_at` | TEXT    | NOT NULL, DEFAULT datetime('now') | Last access timestamp                  |
| `expires_at`       | TEXT    | NULL                              | Session expiration (NULL = persistent) |
| `ip_address`       | TEXT    | NULL                              | Session IP address                     |
| `user_agent`       | TEXT    | NULL                              | Session user agent                     |
| `is_active`        | BOOLEAN | NOT NULL, DEFAULT TRUE            | Session active status                  |
| `device_info`      | TEXT    | NULL                              | Device fingerprint (JSON)              |

**Indexes:**

- `idx_auth_sessions_user_uuid` on `user_uuid` for user sessions
- `idx_auth_sessions_token_hash` on `token_hash` for validation
- `idx_auth_sessions_expires_at` on `expires_at` for cleanup
- `idx_auth_sessions_last_accessed` on `last_accessed_at` for analytics
- `idx_auth_sessions_active` on `is_active` for filtering

**Foreign Keys:**

- `user_uuid` → `users.uuid` ON DELETE CASCADE

**Security Features:**

- Token hashes stored (never plain tokens)
- Multi-device support
- Persistent sessions (NULL expiration)
- Automatic cleanup of expired sessions

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

Core table storing public artwork locations and metadata with structured tagging system.

| Field        | Type | Constraints                           | Description                        |
| ------------ | ---- | ------------------------------------- | ---------------------------------- |
| `id`         | TEXT | PRIMARY KEY                           | Unique identifier                  |
| `lat`        | REAL | NOT NULL                              | Latitude coordinate (-90 to 90)    |
| `lon`        | REAL | NOT NULL                              | Longitude coordinate (-180 to 180) |
| `type_id`    | TEXT | NOT NULL, FK→artwork_types.id         | Reference to artwork type          |
| `created_at` | TEXT | NOT NULL, DEFAULT datetime('now')     | Creation timestamp                 |
| `status`     | TEXT | CHECK('pending','approved','removed') | Moderation status                  |
| `tags`       | TEXT | NULL                                  | JSON object for structured metadata (see Structured Tags section) |
| `title`      | TEXT | NULL                                  | Artwork title (editable field)    |
| `description`| TEXT | NULL                                  | Artwork description (editable field) |
| `created_by` | TEXT | NULL                                  | Creator/artist name (editable field) |

**Indexes:**

- `idx_artwork_lat_lon` on `(lat, lon)` for spatial queries
- `idx_artwork_status` on `status` for filtering
- `idx_artwork_type_id` on `type_id` for type-based filtering
- `idx_artwork_tags_fts` on `tags` for full-text search on tags
- `idx_artwork_tourism_tag` on `json_extract(tags, '$.tags.tourism')` for OSM compatibility
- `idx_artwork_type_tag` on `json_extract(tags, '$.tags.artwork_type')` for artwork type filtering
- `idx_artwork_artist_tag` on `json_extract(tags, '$.tags.artist_name')` for artist searches
- `idx_artwork_name_tag` on `json_extract(tags, '$.tags.name')` for artwork name searches
- `idx_artwork_title` on `title` for text search
- `idx_artwork_description` on `description` for text search  
- `idx_artwork_created_by` on `created_by` for creator search

**Foreign Keys:**

- `type_id` → `artwork_types.id`

**Status Workflow:**

- `pending` - Newly submitted, awaiting moderation
- `approved` - Verified and visible on public map
- `removed` - Removed from public view (soft delete)

#### Structured Tags System

The `tags` field contains a JSON object with the following structure:

```json
{
  "tags": {
    "tourism": "artwork",
    "artwork_type": "statue",
    "name": "Victory Angel",
    "artist_name": "Jane Doe",
    "material": "bronze",
    "height": 5.5,
    "start_date": "1995-06",
    "access": "yes",
    "fee": "no",
    "subject": "historical figure",
    "style": "classical",
    "condition": "excellent",
    "website": "https://example.org/artwork-info",
    "wikipedia": "en:Victory_Angel_Statue",
    "description": "Large bronze statue commemorating local history"
  },
  "version": "1.0.0",
  "lastModified": "2024-12-19T12:00:00.000Z"
}
```

**Tag Categories:**

1. **Physical Properties**: `material`, `height`, `condition`
2. **Historical Information**: `artist_name`, `start_date`
3. **Location Details**: `access`, `fee` 
4. **Artwork Classification**: `tourism`, `artwork_type`, `name`, `subject`, `style`, `description`
5. **Reference Data**: `website`, `wikipedia`

**Tag Data Types:**

- **enum**: Fixed set of values (e.g., `artwork_type`, `access`, `condition`)
- **text**: Free text with length limits (e.g., `name`, `artist_name`, `material`)
- **number**: Numeric values with range validation (e.g., `height`)
- **date**: ISO date formats: YYYY, YYYY-MM, or YYYY-MM-DD (e.g., `start_date`)
- **yes_no**: Boolean values as "yes" or "no" strings (e.g., `fee`)
- **url**: Valid HTTP/HTTPS URLs (e.g., `website`)

**Required Tags:**

- `tourism`: Must be "artwork" for OpenStreetMap compatibility

**OpenStreetMap Export:**

Tags can be exported in OpenStreetMap-compatible format with "ca:" prefixes for custom tags:
- `tourism=artwork` (direct mapping)
- `artwork_type=statue` (direct mapping)  
- `ca:condition=excellent` (custom tag with prefix)

**Tag Queries:**

```sql
-- Find artwork by specific tag value
SELECT * FROM artwork 
WHERE json_extract(tags, '$.tags.artwork_type') = 'statue';

-- Find artwork by artist
SELECT * FROM artwork 
WHERE json_extract(tags, '$.tags.artist_name') LIKE '%Jane Doe%';

-- Find artwork with specific material
SELECT * FROM artwork 
WHERE json_extract(tags, '$.tags.material') = 'bronze';

-- Find artwork accessible to public
SELECT * FROM artwork 
WHERE json_extract(tags, '$.tags.access') = 'yes';
```

### artwork_edits

Community-proposed edits to existing artwork records stored in flexible key-value format.

| Field             | Type | Constraints                            | Description                          |
| ----------------- | ---- | -------------------------------------- | ------------------------------------ |
| `edit_id`         | TEXT | PRIMARY KEY                            | Unique edit identifier (UUID)        |
| `artwork_id`      | TEXT | NOT NULL, FK→artwork.id                | Reference to artwork being edited    |
| `user_token`      | TEXT | NOT NULL                               | User proposing the edit              |
| `field_name`      | TEXT | NOT NULL                               | Field being edited (e.g., 'title')   |
| `field_value_old` | TEXT | NULL                                   | Original value before edit (JSON)    |
| `field_value_new` | TEXT | NULL                                   | Proposed new value (JSON)            |
| `status`          | TEXT | CHECK('pending','approved','rejected') | Moderation status                    |
| `moderator_notes` | TEXT | NULL                                   | Feedback from moderator on rejection |
| `reviewed_at`     | TEXT | NULL                                   | Timestamp when moderated             |
| `reviewed_by`     | TEXT | NULL                                   | Moderator who reviewed               |
| `submitted_at`    | TEXT | NOT NULL, DEFAULT datetime('now')      | When edit was submitted              |

**Indexes:**

- `idx_artwork_edits_artwork_id` on `artwork_id` for per-artwork queries
- `idx_artwork_edits_user_token` on `user_token` for per-user queries
- `idx_artwork_edits_status` on `status` for filtering by moderation status
- `idx_artwork_edits_submitted_at` on `submitted_at DESC` for chronological ordering
- `idx_artwork_edits_moderation_queue` on `(status, submitted_at DESC)` for moderation queue
- `idx_artwork_edits_user_pending` on `(user_token, artwork_id, status)` for pending edits check

**Foreign Keys:**

- `artwork_id` → `artwork.id` (CASCADE DELETE)

**Status Workflow:**

- `pending` - Newly submitted edit, awaiting moderation
- `approved` - Edit approved and applied to original artwork
- `rejected` - Edit rejected with moderator feedback

**Editable Fields:**

- `title` - Artwork title
- `description` - Artwork description
- `created_by` - Creator information (comma-separated)
- `tags` - JSON object with key-value metadata tags

**Key-Value Design:**

Each field change is stored as a separate row with old/new values, enabling:

- Atomic approval/rejection of entire edit submissions
- Clear diff views for moderation
- Future extensibility for new editable fields
- Complete audit trail of all changes

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
users ──────┐
 │          │ 1:N
 │ 1:N      ▼
 ▼       auth_sessions
magic_links
 │
 │ rate_limiting (identifier joins)
 │
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

## Authentication Workflows

### Account Creation Flow

1. **Anonymous user** gets UUID on first visit (stored in cookie)
2. **User submits content** using anonymous UUID
3. **Account creation**: User enters email → magic link sent
4. **Magic link clicked** → account created with current UUID claimed
5. **User authenticated** → can see all content from claimed UUID

### Login Flow

1. **Returning user** enters email → magic link sent
2. **Magic link clicked** → user authenticated
3. **Cross-device login**: If different UUID, replace browser UUID with account UUID
4. **User sees all content** from their account UUID

### Rate Limiting Flow

1. **Magic link request** → check rate limits (email + IP)
2. **Within limits** → generate token, send email, increment counters
3. **Rate exceeded** → reject with clear error message and reset time
4. **Cleanup task** → reset expired rate limit windows

### Session Management Flow

1. **Successful authentication** → create session record
2. **Session token** → hashed and stored, plain token sent to client
3. **API requests** → validate session hash, update last_accessed_at
4. **Logout** → mark session inactive, generate new anonymous UUID

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
- For precise distance calculations, use the haversine formula in application code
- Consider query bounds of ±0.0045 degrees (~500m at mid-latitudes) for initial filtering

### Indexing Strategy

- All foreign keys are indexed for fast JOINs
- Status fields are indexed for filtering workflows
- `user_token` index supports user-specific queries

### JSON Fields

- `tags` and `photos` fields store JSON as TEXT
- Parse JSON at application level, not in SQL queries
- Consider extracting frequently-queried JSON keys to separate columns if needed

## Migration System

The Cultural Archiver uses a comprehensive database migration system for managing Cloudflare D1 schema changes and data operations:

- **Migration Files**: Located in `src/workers/migrations/` directory with sequential numbering (0001_description.sql, 0002_add_table.sql, etc.)
- **State Tracking**: Applied migrations are tracked in `d1_migrations` table automatically
- **Backup System**: Export commands create timestamped backups in `_backup_database/` directory
- **Environment Isolation**: Separate commands for development, staging, and production environments

### Migration Commands (PowerShell Compatible)

```powershell
# Export database backups
npm run database:export:dev     # Export development database
npm run database:export:prod    # Export production database  
npm run database:export:staging # Export staging database

# Apply migrations
npm run database:migration:dev     # Apply migrations to development
npm run database:migration:prod    # Apply migrations to production
npm run database:migration:staging # Apply migrations to staging

# Import SQL files
npm run database:import:dev <file.sql>     # Import to development
npm run database:import:prod <file.sql>    # Import to production
npm run database:import:staging <file.sql> # Import to staging

# Check migration status
npm run database:status:dev     # Check development status
npm run database:status:prod    # Check production status
npm run database:status:staging # Check staging status
```

### Migration Guidelines

- Use sequential 4-digit numbering with descriptions (0001_initial_schema.sql, 0002_add_users.sql)
- Use SQLite-compatible syntax (Cloudflare D1 is SQLite-based)
- Use `TEXT` for JSON storage, not native JSON type
- Use `REAL` for floating-point numbers (lat/lon coordinates)
- Test migrations in development first
- Create backups before production migrations using export commands
- Follow existing table naming conventions (snake_case)
- Include proper constraints and indexes for performance
- Avoid D1-incompatible patterns (PRAGMA, WITHOUT ROWID, AUTOINCREMENT)
- See [docs/migrations.md](./migrations.md) for complete migration documentation
## TypeScript Integration

The database schema is reflected in TypeScript types in `src/shared/types.ts`:

- `ArtworkTypeRecord` - artwork_types table
- `ArtworkRecord` - artwork table
- `LogbookRecord` - logbook table
- `TagRecord` - tags table

Refer to the types file for complete interface definitions and validation functions.
