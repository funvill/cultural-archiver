# Artist pages

## Executive Summary

Create dedicated artist profile pages that showcase artist information and their artworks

## Problem Statement

Currently, artist information is stored only as text fields within individual artwork records (artist_name). Users cannot easily discover other works by the same artist or learn comprehensive information about artists. There's no centralized place to showcase an artist's portfolio within the platform.

## Solution Overview

Implement a dedicated Artist page type with full CRUD operations

## Notes

- Don't use the creator field in the artwork
- artwork_artists roll defaults to "artist"

## Technical Architecture

### Database Schema

**New `artists` table:**

```sql
CREATE TABLE artists (
  id TEXT PRIMARY KEY DEFAULT (uuid()), -- UUID
  name TEXT NOT NULL,
  description TEXT,                    -- Markdown biography
  tags TEXT,                          -- JSON object for metadata (website, birth_year, etc.)
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);
```

**New `artwork_artists` junction table:**

```sql
CREATE TABLE artwork_artists (
  id TEXT PRIMARY KEY DEFAULT (uuid()),
  artwork_id TEXT NOT NULL,
  artist_id TEXT NOT NULL,
  role TEXT DEFAULT 'artist',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artwork_id) REFERENCES artworks(id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
  UNIQUE(artwork_id, artist_id, role) -- Allow same artist with different roles
);
```

**New `artist_edits` table:**

```sql
CREATE TABLE artist_edits (
  edit_id TEXT PRIMARY KEY DEFAULT (uuid()),
  artist_id TEXT NOT NULL,
  user_token TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_value_old TEXT,
  field_value_new TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  moderator_notes TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);
```

### Role Field Usage

The `role` field in the `artwork_artists` junction table allows for flexible attribution of different types of involvement with an artwork:

- **creator** - Primary artist who made the artwork
- **collaborator** - Co-artist who worked on the piece
- **commissioner** - Person/organization who commissioned the work
- **curator** - Curator who selected/displayed the work
- **designer** - Designer of architectural elements
- **fabricator** - Person/company who physically built the work

This enables:

1. **Multiple attribution types** - Same artwork can have different people in different roles
2. **Same person, multiple roles** - An artist can be both creator and fabricator
3. **Flexible crediting** - Proper attribution for complex public art projects
4. **Historical documentation** - Track all parties involved in artwork creation

## API Endpoints

Core CRUD Operations:

- GET /api/artists - List artists with search/filter
- GET /api/artists/:id - Get artist profile with artworks
- PUT /api/artists/:id - Submit artist profile edits (queued for moderation)
- POST /api/artists - Create artist profile (authenticated users)

Moderation Endpoints:

- GET /api/admin/artist-edits/pending - Review pending artist edits
- POST /api/admin/artist-edits/:id/review - Approve/reject artist edits

## Frontend Components

Artist Profile Page (/artist/:uuid):

- ArtistHeader.vue - Name
- ArtistBio.vue - Markdown-rendered biography with edit capability
- ArtistTags.vue - Artist metadata tags (website, birth year, etc.)
- ArtistArtworks.vue - Grid of artwork cards using existing ArtworkCard.vue
- ArtistEditForm.vue - Modal for editing artist information

## User Stories

### Primary Users

- Art enthusiasts discovering artists and their complete portfolios
- Community members contributing artist biographies and metadata

### User Flows

Viewing Artist Profile:

1. User discovers artist through artwork page or search
2. Clicks artist name → navigates to /artist/:uuid
3. Views biography, tags, and complete artwork portfolio
4. Can navigate to individual artworks or discover related artists

Editing Artist Information:

1. Logged-in user visits artist page
2. Clicks "Edit Artist Info" → opens ArtistEditForm.vue
3. Modifies name, biography, tags
4. Submits → queued for moderator approval
5. User sees pending edit indicator until approved

Implementation Plan

Phase 1: Backend Foundation

1. Create new database schema (artists, artwork_artists, artist_edits tables)
2. Add TypeScript interfaces to src/shared/types.ts
3. Implement API endpoints for artist CRUD operations
4. Set up artist edit moderation system (mirror artwork edit system)

Phase 2: Frontend Pages

1. Create ArtistProfile.vue page component
2. Implement artist editing workflow with moderation queue
3. Add artist links to existing artwork pages
4. Create artist search and discovery features

Phase 3: Integration & Polish

1. Integrate with existing tag system for artist metadata
2. Add artist profile creation during artwork submission
3. Implement UUID-based routing and duplicate handling
4. Add SEO optimization for artist pages

Success Metrics

- Discovery: 40% of artwork page visits lead to artist page views
- Engagement: Artist pages have >2 minute average session duration
- Content Quality: 80% of artist edit submissions are approved
- Coverage: 60% of artworks have linked artist profiles within 6 months

Risk Mitigation

- Data Migration: Gradual migration of existing artist_name text to artist profiles
- Moderation Load: Leverage existing reviewer system and audit trails
- Duplicate Artists: Implement fuzzy matching for artist name deduplication
- SEO Impact: Implement proper canonical URLs and structured data

This PRD creates a new artist system independent of existing creator infrastructure, using UUID-based routing and a dedicated junction table for artwork-artist relationships to enable many-to-many associations.
