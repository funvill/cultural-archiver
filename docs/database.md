# Database Schema Documentation

## 🗄️ Production Database Infrastructure - Fully Operational

The Cultural Archiver uses a **production-ready SQLite database** (Cloudflare D1) with unified submission system, role-based permissions, and comprehensive audit logging supporting efficient cultural archiving workflows.

### **🔄 Database Schema Status**
- **✅ Unified Submissions System**: Complete transition from legacy logbook/artwork_edits to single submissions table
- **✅ Role-Based Permissions**: New user_roles table with admin/moderator/curator roles
- **✅ Enhanced Audit Logging**: Comprehensive tracking of all system actions
- **✅ TypeScript Integration**: All 653 unit tests passing with full type safety
- **✅ Migration System**: Sequential migration tracking via `d1_migrations` table
- **✅ CLI Tools**: PowerShell-compatible database management commands

### **🎯 Unified Submission Workflow**  
- **✅ Single Submissions Table**: Handles logbook entries, artwork edits, artist edits, and new submissions
- **✅ Flexible Data Structure**: JSON fields for photos, tags, old/new data for edits
- **✅ Email Verification**: Optional email verification workflow for submissions
- **✅ Spatial Indexing**: Optimized for location-based submission queries
- **✅ Moderation Queue**: Streamlined review workflow with reviewer notes

## Database Tables

### Core Content Tables

#### artwork

Primary table for public artwork locations and metadata.

| Field        | Type | Constraints                           | Description                        |
| ------------ | ---- | ------------------------------------- | ---------------------------------- |
| `id`         | TEXT | PRIMARY KEY                           | Unique identifier                  |
| `title`      | TEXT | NOT NULL                              | Artwork title                      |
| `description`| TEXT | NULL                                  | Artwork description               |
| `artist_names`| TEXT | NULL                                  | JSON array of artist names        |
| `lat`        | REAL | NOT NULL                              | Latitude coordinate (-90 to 90)    |
| `lon`        | REAL | NOT NULL                              | Longitude coordinate (-180 to 180) |
| `address`    | TEXT | NULL                                  | Street address                     |
| `tags`       | TEXT | NULL                                  | JSON object for structured metadata |
| `photos`     | TEXT | NULL                                  | JSON array of photo URLs           |
| `status`     | TEXT | CHECK('pending','approved','rejected') | Moderation status                  |
| `created_at` | TEXT | NOT NULL, DEFAULT datetime('now')     | Creation timestamp                 |
| `updated_at` | TEXT | NOT NULL, DEFAULT datetime('now')     | Last update timestamp              |

**Indexes:**
- `idx_artwork_lat_lon` on `(lat, lon)` for spatial queries
- `idx_artwork_status` on `status` for filtering approved artwork
- `idx_artwork_created_at` on `created_at DESC` for chronological ordering

#### artists

Artist information and portfolio details.

| Field        | Type | Constraints                           | Description                        |
| ------------ | ---- | ------------------------------------- | ---------------------------------- |
| `id`         | TEXT | PRIMARY KEY                           | Unique identifier                  |
| `name`       | TEXT | NOT NULL                              | Artist name                        |
| `bio`        | TEXT | NULL                                  | Artist biography                   |
| `website`    | TEXT | NULL                                  | Artist website URL                 |
| `tags`       | TEXT | NULL                                  | JSON object for metadata           |
| `photos`     | TEXT | NULL                                  | JSON array of photo URLs           |
| `status`     | TEXT | CHECK('pending','approved','rejected') | Moderation status                  |
| `created_at` | TEXT | NOT NULL, DEFAULT datetime('now')     | Creation timestamp                 |
| `updated_at` | TEXT | NOT NULL, DEFAULT datetime('now')     | Last update timestamp              |

### Unified Submission System

#### submissions

**Primary submission table** - handles all content submissions including logbook entries, artwork edits, artist edits, and new artwork/artist submissions.

| Field               | Type | Constraints                                                     | Description                                         |
| ------------------- | ---- | --------------------------------------------------------------- | --------------------------------------------------- |
| `id`                | TEXT | PRIMARY KEY                                                     | Unique identifier                                   |
| `submission_type`   | TEXT | CHECK('logbook_entry','artwork_edit','artist_edit','new_artwork','new_artist') | Type of submission                                  |
| `user_token`        | TEXT | NOT NULL                                                        | Anonymous UUID or authenticated user ID             |
| `email`             | TEXT | NULL                                                            | Optional email for verification                     |
| `submitter_name`    | TEXT | NULL                                                            | Optional submitter name                             |
| `artwork_id`        | TEXT | NULL, FK→artwork.id                                             | Reference to artwork (for edits/photos)            |
| `artist_id`         | TEXT | NULL, FK→artists.id                                             | Reference to artist (for artist edits)             |
| `lat`               | REAL | NULL                                                            | Latitude for location-based submissions             |
| `lon`               | REAL | NULL                                                            | Longitude for location-based submissions            |
| `notes`             | TEXT | NULL                                                            | Submission notes (≤500 chars at app level)         |
| `photos`            | TEXT | NULL                                                            | JSON array of photo URLs: `["url1", "url2"]`       |
| `tags`              | TEXT | NULL                                                            | JSON object of structured tags                      |
| `old_data`          | TEXT | NULL                                                            | JSON object of original data (for edits)           |
| `new_data`          | TEXT | NULL                                                            | JSON object of proposed changes (for edits)        |
| `verification_status` | TEXT | CHECK('pending','verified','unverified')                     | Email verification status                           |
| `status`            | TEXT | CHECK('pending','approved','rejected')                         | Moderation status                                   |
| `reviewer_token`    | TEXT | NULL                                                            | Reviewer who processed submission                   |
| `review_notes`      | TEXT | NULL                                                            | Reviewer's notes                                    |
| `reviewed_at`       | TEXT | NULL                                                            | Review timestamp                                    |
| `created_at`        | TEXT | NOT NULL, DEFAULT datetime('now')                               | Creation timestamp                                  |
| `updated_at`        | TEXT | NOT NULL, DEFAULT datetime('now')                               | Last update timestamp                               |

**Indexes:**
- `idx_submissions_user_token` on `user_token` for user-specific queries
- `idx_submissions_artwork_id` on `artwork_id` for artwork-related submissions
- `idx_submissions_artist_id` on `artist_id` for artist-related submissions
- `idx_submissions_status` on `status` for moderation workflows
- `idx_submissions_type` on `submission_type` for filtering by type
- `idx_submissions_location` on `(lat, lon)` for spatial queries
- `idx_submissions_created_at` on `created_at DESC` for chronological ordering

**Foreign Keys:**
- `artwork_id` → `artwork.id` ON DELETE CASCADE
- `artist_id` → `artists.id` ON DELETE CASCADE

**Submission Types:**
- `logbook_entry` - Photo submissions for existing or new artworks
- `artwork_edit` - Edits to artwork metadata (title, description, etc.)
- `artist_edit` - Edits to artist information
- `new_artwork` - New artwork submissions via fast workflow
- `new_artist` - New artist profile submissions

**Status Workflow:**
- `pending` - Awaiting moderation
- `approved` - Accepted (creates/updates target entity)
- `rejected` - Rejected (hidden from user)

**Verification Status:**
- `pending` - Email verification not yet sent
- `verified` - Email verified via magic link
- `unverified` - Email verification failed or expired

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

#### user_roles

**Role-based permissions system** - manages user access levels and permissions.

| Field        | Type    | Constraints                               | Description                                |
| ------------ | ------- | ----------------------------------------- | ------------------------------------------ |
| `id`         | TEXT    | PRIMARY KEY                               | Unique identifier                          |
| `user_token` | TEXT    | NOT NULL                                  | User token (UUID)                          |
| `role`       | TEXT    | CHECK('admin','moderator','user','banned') | User role                                |
| `granted_by` | TEXT    | NOT NULL                                  | Who granted this role                      |
| `granted_at` | TEXT    | NOT NULL, DEFAULT datetime('now')         | When role was granted                      |
| `revoked_at` | TEXT    | NULL                                      | When role was revoked (NULL if active)    |
| `revoked_by` | TEXT    | NULL                                      | Who revoked this role                      |
| `is_active`  | INTEGER | NOT NULL, DEFAULT 1                       | Whether role is currently active           |
| `notes`      | TEXT    | NULL                                      | Optional notes about role assignment       |

**Indexes:**
- `idx_user_roles_user_token` on `user_token` WHERE `is_active = 1`
- `idx_user_roles_role` on `role` WHERE `is_active = 1`

**Unique Constraints:**
- `UNIQUE(user_token, role)` - prevents duplicate role assignments

**Role Types:**
- `admin` - Full system access
- `moderator` - Can review and approve submissions
- `user` - Standard user permissions (default)
- `banned` - Restricted access

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

#### consent

Legal compliance table tracking user consent for all submitted content. Implements a consent-first pattern where content creation is blocked until consent is recorded.

| Field               | Type | Constraints                           | Description                                      |
| ------------------- | ---- | ------------------------------------- | ------------------------------------------------ |
| `id`                | TEXT | PRIMARY KEY                           | Unique consent record UUID                       |
| `created_at`        | TEXT | NOT NULL                              | ISO timestamp of consent                         |
| `user_id`           | TEXT | NULL, FK→users.uuid                   | Authenticated user UUID (if applicable)          |
| `anonymous_token`   | TEXT | NULL                                  | Anonymous user token (if applicable)             |
| `consent_version`   | TEXT | NOT NULL                              | Version of legal terms (e.g., "2025-09-09.v2")  |
| `content_type`      | TEXT | NOT NULL, CHECK('artwork','logbook')  | Type of content being consented for              |
| `content_id`        | TEXT | NOT NULL                              | ID of the content being consented for            |
| `ip_address`        | TEXT | NOT NULL                              | IP address for audit trail                       |
| `consent_text_hash` | TEXT | NOT NULL                              | SHA-256 hash of consent text user agreed to      |

**Indexes:**

- `idx_consent_user_id` on `user_id` for user consent lookups
- `idx_consent_anonymous_token` on `anonymous_token` for anonymous consent lookups
- `idx_consent_content` on `(content_type, content_id)` for content consent checks
- `idx_consent_version` on `consent_version` for version tracking
- `idx_consent_created_at` on `created_at` for temporal queries

**Foreign Keys:**

- `user_id` → `users.uuid` ON DELETE CASCADE

**Unique Constraints:**

- `UNIQUE(user_id, anonymous_token, content_type, content_id, consent_version)` prevents duplicate consent

**Legal Compliance Features:**

- **Consent-First Pattern**: Content creation blocked until consent recorded
- **Immutable Records**: Consent records never modified after creation
- **Audit Trail**: Complete record of what users agreed to and when
- **Hash Verification**: Cryptographic proof of agreed terms
- **Identity Flexibility**: Supports both authenticated users and anonymous tokens
- **Version Tracking**: Links consent to specific versions of legal documents

**Content Types:**

- `artwork` - Direct artwork submissions and fast photo uploads
- `logbook` - Logbook entries that may be approved as artworks

**Identity Handling:**

- **Authenticated Users**: `user_id` populated, `anonymous_token` is NULL
- **Anonymous Users**: `user_id` is NULL, `anonymous_token` populated
- **Mass Import**: Uses reserved UUID `00000000-0000-0000-0000-000000000002`

**See Also:** [Consent System Documentation](./consent-system.md) for detailed implementation guide.

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

### submissions

**NEW UNIFIED TABLE**: Unified submission system replacing legacy logbook and artwork_edits tables.

| Field               | Type | Constraints                                                     | Description                                         |
| ------------------- | ---- | --------------------------------------------------------------- | --------------------------------------------------- |
| `id`                | TEXT | PRIMARY KEY                                                     | Unique identifier                                   |
| `submission_type`   | TEXT | CHECK('logbook_entry','artwork_edit','artist_edit','new_artwork','new_artist') | Type of submission                                  |
| `user_token`        | TEXT | NOT NULL                                                        | Anonymous UUID or authenticated user ID             |
| `email`             | TEXT | NULL                                                            | Optional email for verification                     |
| `submitter_name`    | TEXT | NULL                                                            | Optional submitter name                             |
| `artwork_id`        | TEXT | NULL, FK→artwork.id                                             | Reference to artwork (for edits/photos)            |
| `artist_id`         | TEXT | NULL, FK→artists.id                                             | Reference to artist (for artist edits)             |
| `lat`               | REAL | NULL                                                            | Latitude for location-based submissions             |
| `lon`               | REAL | NULL                                                            | Longitude for location-based submissions            |
| `notes`             | TEXT | NULL                                                            | Submission notes (≤500 chars at app level)         |
| `photos`            | TEXT | NULL                                                            | JSON array of R2 URLs: `["url1", "url2"]`          |
| `tags`              | TEXT | NULL                                                            | JSON object of structured tags                      |
| `old_data`          | TEXT | NULL                                                            | JSON object of original data (for edits)           |
| `new_data`          | TEXT | NULL                                                            | JSON object of proposed changes (for edits)        |
| `verification_status` | TEXT | CHECK('pending','verified','unverified')                     | Email verification status                           |
| `status`            | TEXT | CHECK('pending','approved','rejected')                         | Moderation status                                   |
| `reviewer_token`    | TEXT | NULL                                                            | Reviewer who processed submission                   |
| `review_notes`      | TEXT | NULL                                                            | Reviewer's notes                                    |
| `reviewed_at`       | TEXT | NULL                                                            | Review timestamp                                    |
| `created_at`        | TEXT | NOT NULL, DEFAULT datetime('now')                               | Creation timestamp                                  |
| `updated_at`        | TEXT | NOT NULL, DEFAULT datetime('now')                               | Last update timestamp                               |

**Indexes:**

- `idx_submissions_user_token` on `user_token` for user-specific queries
- `idx_submissions_artwork_id` on `artwork_id` for artwork-related submissions
- `idx_submissions_artist_id` on `artist_id` for artist-related submissions
- `idx_submissions_status` on `status` for moderation workflows
- `idx_submissions_type` on `submission_type` for filtering by type
- `idx_submissions_location` on `lat, lon` for spatial queries
- `idx_submissions_created_at` on `created_at` for chronological ordering

**Foreign Keys:**

- `artwork_id` → `artwork.id` ON DELETE CASCADE
- `artist_id` → `artists.id` ON DELETE CASCADE

**Submission Types:**

- `logbook_entry` - Photo submissions for existing or new artworks
- `artwork_edit` - Edits to artwork metadata (title, description, etc.)
- `artist_edit` - Edits to artist information
- `new_artwork` - New artwork submissions via fast workflow
- `new_artist` - New artist profile submissions

**Status Workflow:**

- `pending` - Awaiting moderation
- `approved` - Accepted (creates/updates target entity)
- `rejected` - Rejected (hidden from user)

**Verification Status:**

- `pending` - Email verification not yet sent
- `verified` - Email verified via magic link
- `unverified` - Email verification failed or expired

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
 │         user_roles ─── 1:N ─── user_token
 │
 ▼
artists ──┐               ┌── artwork ──┐
          │ 1:N       1:N │             │ 1:N
          ▼               ▼             ▼
        submissions ──────────────── submissions
          │ 1:N                        │
          ▼                            ▼
      audit_log                   user_activity
```

**Unified Submission Flow:**
- All content changes flow through the `submissions` table
- Approved submissions create/update target entities (artwork, artists)
- Complete audit trail maintained in `audit_log`
- Role-based permissions control who can approve submissions

## Common Queries

### Find artworks near a location

```sql
-- Find approved artworks within ~500m radius
SELECT a.*, 
       json_extract(a.tags, '$.artwork_type') as artwork_type,
       json_extract(a.tags, '$.material') as material
FROM artwork a
WHERE a.status = 'approved'
  AND a.lat BETWEEN ? - 0.0045 AND ? + 0.0045
  AND a.lon BETWEEN ? - 0.0045 AND ? + 0.0045
ORDER BY a.created_at DESC;
```

### Get artwork with recent submissions

```sql
-- Get artwork details with recent submissions (unified approach)
SELECT a.*, s.notes, s.photos, s.created_at as submission_date,
       s.submission_type, s.status as submission_status,
       s.submitter_name, s.email
FROM artwork a
LEFT JOIN submissions s ON a.id = s.artwork_id
WHERE a.id = ?
  AND (s.submission_type IN ('logbook_entry', 'artwork_edit') OR s.id IS NULL)
ORDER BY s.created_at DESC;
```

### User's submissions across all types

```sql
-- Get all submissions for a user token (unified view)
SELECT s.*, 
       a.title as artwork_title, a.lat, a.lon,
       ar.name as artist_name
FROM submissions s
LEFT JOIN artwork a ON s.artwork_id = a.id
LEFT JOIN artists ar ON s.artist_id = ar.id
WHERE s.user_token = ?
ORDER BY s.created_at DESC;
```

### Moderation queue (all submission types)

```sql
-- Get submissions awaiting moderation (all types)
SELECT s.*, 
       a.title as artwork_title, a.lat, a.lon,
       ar.name as artist_name,
       u.email as user_email
FROM submissions s
LEFT JOIN artwork a ON s.artwork_id = a.id
LEFT JOIN artists ar ON s.artist_id = ar.id
LEFT JOIN users u ON s.user_token = u.uuid
WHERE s.status = 'pending'
ORDER BY s.created_at ASC;
```

### Check user permissions

```sql
-- Get active roles for a user
SELECT role, granted_at, granted_by
FROM user_roles 
WHERE user_token = ? 
  AND is_active = 1 
  AND (revoked_at IS NULL OR revoked_at > datetime('now'));
```

## Performance Considerations

### Spatial Queries
- The `(lat, lon)` composite index enables efficient radius searches
- For precise distance calculations, use the haversine formula in application code
- Consider query bounds of ±0.0045 degrees (~500m at mid-latitudes) for initial filtering

### Unified Submissions Table
- Single table approach eliminates complex JOINs between legacy logbook/artwork_edits tables
- JSON fields (`photos`, `tags`, `old_data`, `new_data`) provide flexibility without schema changes
- Indexes on `submission_type` and `status` enable efficient moderation workflows

### Role-Based Permissions
- Simple role hierarchy (admin > moderator > user) with efficient lookups
- Single query to check user permissions via `user_roles` table
- Active role filtering via index on `is_active = 1`

## Migration System

The Cultural Archiver uses a comprehensive database migration system for managing Cloudflare D1 schema changes:

- **Migration Files**: Located in `src/workers/migrations/` with sequential numbering
- **State Tracking**: Applied migrations tracked in `d1_migrations` table automatically
- **Backup System**: Export commands create timestamped backups in `_backup_database/`
- **Environment Isolation**: Separate commands for development and production environments

### Migration Commands (PowerShell Compatible)

```powershell
# Export database backups
npm run database:export:dev        # Export development database
npm run database:export:prod       # Export production database  

# Apply migrations
npm run database:migration:dev     # Apply migrations to development
npm run database:migration:prod    # Apply migrations to production

# Check migration status
npm run database:status:dev        # Check development status
npm run database:status:prod       # Check production status
```

### Migration Guidelines
- Use sequential numbering with descriptions (0001_initial_schema.sql, 0002_add_users.sql)
- Use SQLite-compatible syntax (Cloudflare D1 is SQLite-based)
- Use `TEXT` for JSON storage, not native JSON type
- Use `REAL` for floating-point numbers (lat/lon coordinates)
- Test migrations in development first
- Create backups before production migrations using export commands
- Follow existing table naming conventions (snake_case)
- Include proper constraints and indexes for performance

## TypeScript Integration

The database schema is reflected in TypeScript types in `src/shared/types.ts`:

**Core Tables:**
- `ArtworkRecord` - artwork table with enhanced fields
- `ArtistRecord` - artists table
- `SubmissionRecord` - unified submissions table (replaces LogbookRecord/ArtworkEditRecord)
- `UserRoleRecord` - role-based permissions
- `UserRecord` - user authentication

**API Types:**
- `ArtworkApiResponse` - artwork with parsed JSON fields
- `ArtistApiResponse` - artist with metadata
- `CreateSubmissionRequest` - submission creation
- `AuthStatusResponse` - authentication status

**Legacy Types (Backward Compatibility):**
- `LogbookRecord` - maintained for existing code
- `TagRecord` - separate tags table (being phased out)

All types include proper validation functions and status guards for type safety across the frontend and backend systems.
