# PRD: Centralize Content Consent in a `consent` Table

## Overview

Centralize consent tracking by removing `consent_version` from resource tables (artwork, logbook) and creating a dedicated `consent` table. This provides a flexible foundation for all user-submitted content with proper legal compliance.

## Key Decisions

- **Principal**: Support both `users.id` AND `anonymous_token` (anonymous submissions are critical)
- **Enforcement**: On submit only
- **Data Migration**: No backfill required (development environment)
- **Duplicate Prevention**: Unique constraint on `(user_id, anonymous_token, content_type, content_id, consent_version)`
- **Content Types**: artwork, logbook (photos/media inherit from parent)
- **Schema**: Enhanced with audit fields for legal compliance
- **Pattern**: "Consent-first then content" for data consistency
- **Endpoints**: Integrate into existing submission flows

## Goals

1. **Data Structure**: Remove `consent_version` from artwork/logbook tables and centralize in `consent` table
2. **Legal Compliance**: Record consent with audit trail (IP, consent text hash)
3. **Enforcement**: Require consent record before content submission
4. **Anonymous Support**: Maintain critical anonymous submission capability
5. **Integration**: Embed consent into existing submission flows
6. **Documentation**: Update all specs, types, and API docs

## User Stories

- **Submitter**: "I must confirm consent to submit my artwork for public sharing"
- **Moderator**: "The system prevents submissions without valid consent records"
- **Developer**: "I can query consent across all content types from one table"
- **Product Owner**: "Consent is standardized across artwork, logbook, and media"

## Database Schema

### `consent` Table

```sql
CREATE TABLE consent (
  id TEXT PRIMARY KEY,                    -- UUID
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id TEXT,                          -- References users.id, nullable for anonymous
  anonymous_token TEXT,                  -- UUID for anonymous users, nullable for authenticated
  consent_version TEXT NOT NULL,         -- Frontend-provided policy version
  content_type TEXT NOT NULL,            -- 'artwork', 'logbook', etc.
  content_id TEXT NOT NULL,              -- Resource ID of the content
  ip_address TEXT NOT NULL,              -- For legal compliance
  consent_text_hash TEXT NOT NULL,       -- Hash of exact consent text shown

  -- Constraints
  UNIQUE(user_id, anonymous_token, content_type, content_id, consent_version)
);

-- Indexes
CREATE INDEX idx_consent_content_type_id ON consent(content_type, content_id);
CREATE INDEX idx_consent_user_id ON consent(user_id);
CREATE INDEX idx_consent_anonymous_token ON consent(anonymous_token);
```

### Schema Changes

- **Remove**: `consent_version` columns from `artwork` and `logbook` tables
- **Validation**: Exactly one of `user_id` OR `anonymous_token` must be non-null (enforced at application level)

## API Integration

### Shared Function

Create `src/workers/lib/consent.ts`:

```typescript
async function recordConsent(params: { userId?: string; anonymousToken?: string; contentType: string; contentId: string; consentVersion: string; ipAddress: string; consentTextHash: string; source?: string; requestId?: string; db: D1Database }): Promise<{ id: string }>;
```

### Implementation Details

- **Validation**: Exactly one of `userId` or `anonymousToken` required
- **Error Handling**: Handle unique constraint violations gracefully
- **Mass Import**: Use reserved `MASS_IMPORT_USER_UUID = 'a0000000-1000-4000-8000-000000000002'` (from shared/constants.ts)
- **Pattern**: Create consent record BEFORE creating content
- **Failure Response**: Return `SUBMISSION_BLOCKED` (409) if consent fails

## UI Requirements

- **Consent Checkbox**: Required before submit is enabled
- **Version Display**: Show consent version to user
- **Policy Link**: Link to full consent policy text
- **Accessibility**: Keyboard and screen-reader friendly

## Implementation Notes

### Deployment Pattern

1. Create and validate consent record
2. Create content only after consent success
3. Return `SUBMISSION_BLOCKED` (409) if consent fails

### Code Changes Required

- **Submissions**: Change from version equality to existence-only check
- **Types**: Update `src/workers/types.ts` consent definitions
- **Version Source**: Frontend build-time constant from policy file last-updated date

## Out of Scope

- Consent revocation or withdrawal tracking
- Centralized consent management UI
- Standalone consent API endpoints
- Legacy data backfill
- Advanced audit features (user agent, retention periods)

## Success Metrics

- 100% of submit operations for artwork/logbook create or reference a consent record
- 0 code paths read `consent_version` from artwork/logbook after release
- All unit/integration tests pass (`npm run test`) and build succeeds (`npm run build`)
- No regression in submission funnel completion rate

## Open Questions

- **Policy File Path**: What is the exact path of the consent policy file for version string generation? (e.g., `/docs/policy/content-consent.md`)
- **Photo Consent**: Track per individual photo asset or inherit from parent content (artwork/logbook)?
- **Moderation**: Check existence of any consent record or require latest version?

## Developer Tasks

### Database Migration

- [x] Create migration script for `consent` table with all fields
- [x] Add unique constraint: `(user_id, anonymous_token, content_type, content_id, consent_version)`
- [x] Add indexes: `content_type+content_id`, `user_id`, `anonymous_token`
- [x] Remove `consent_version` columns from `artwork` and `logbook` tables
- [ ] Test migration rollback in development environment

### Backend Implementation

- [x] Create `src/workers/lib/consent.ts` with `recordConsent()` function
- [x] Update submission endpoints to use consent-first pattern
- [x] Add consent payload validation (IP address, consent text hash)
- [x] Implement unique constraint violation handling
- [x] Add mass import support with reserved UUID
- [x] Update existing consent validation from equality to existence-only

### Types and Validation

- [x] Add `ConsentRecord` and `ContentType` to `src/shared/types.ts`
- [x] Create Zod schemas for consent request validation
- [x] Update existing request/response types
- [ ] Remove legacy `consent_version` from content types

### Frontend Integration

- [ ] Implement consent checkbox UI component
- [ ] Add consent version display
- [ ] Include IP address and consent text hash in submissions
- [ ] Update submission forms to handle consent-first flow
- [ ] Add policy link to submission forms
- [ ] Ensure accessibility compliance

### Testing

- [x] Unit tests for `recordConsent()` function
- [x] Integration tests for consent-first submission flow
- [x] Test submission rejection without consent
- [x] Test anonymous vs authenticated consent paths
- [x] Test unique constraint violations
- [x] Test mass import consent handling

### Documentation

- [ ] Update `/docs/database.md` with new schema
- [ ] Update `/docs/api.md` with request/response changes
- [ ] Document consent workflow in user guide
- [ ] Update migration documentation

### Quality Assurance

- [x] Run full test suite (`npm run test`)
- [x] Verify build succeeds (`npm run build`)
- [ ] Test anonymous submission flow
- [ ] Verify no regression in submission completion rates
- [x] Confirm all legacy `consent_version` references removed
