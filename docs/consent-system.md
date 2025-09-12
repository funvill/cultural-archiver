# Consent System Documentation

The Cultural Archiver implements a comprehensive consent tracking system that ensures legal compliance for all user-submitted content. This system follows a **consent-first pattern** where consent must be recorded before any content creation occurs.

## Overview

The consent system provides:

- **Legal compliance**: Tracks user consent to specific versions of terms and policies
- **Audit trail**: Complete record of what users agreed to and when
- **Content blocking**: Prevents content creation without proper consent
- **Version tracking**: Links consent to specific versions of legal documents
- **Anonymous support**: Works for both authenticated users and anonymous submissions

## Architecture

### Core Components

#### Database Schema

The consent system uses a centralized `consent` table:

```sql
CREATE TABLE consent (
    id TEXT PRIMARY KEY,                    -- Unique consent record UUID
    created_at TEXT NOT NULL,               -- ISO timestamp of consent
    user_id TEXT,                          -- Authenticated user UUID (if applicable)
    anonymous_token TEXT,                  -- Anonymous user token (if applicable)
    consent_version TEXT NOT NULL,         -- Version of legal terms (e.g., "2025-09-09.v2")
    content_type TEXT NOT NULL,            -- Type of content: "artwork" or "logbook"
    content_id TEXT NOT NULL,              -- ID of the content being consented for
    ip_address TEXT NOT NULL,              -- IP address for audit trail
    consent_text_hash TEXT NOT NULL,       -- SHA-256 hash of consent text user agreed to
    FOREIGN KEY (user_id) REFERENCES users(uuid),
    UNIQUE(user_id, anonymous_token, content_type, content_id, consent_version)
);
```

#### Key Design Principles

1. **Consent-First Pattern**: Content creation is blocked until consent is recorded
2. **Immutable Records**: Consent records are never modified, only created
3. **Hash Verification**: Consent text is cryptographically hashed for integrity
4. **Identity Flexibility**: Supports both authenticated users and anonymous tokens
5. **Content Specificity**: Each piece of content requires its own consent record

### Backend Implementation

#### Core Library: `src/workers/lib/consent-new.ts`

**Key Functions:**

```typescript
// Record consent before content creation
async function recordConsent(params: RecordConsentParams): Promise<RecordConsentResponse>

// Check if consent exists for specific content
async function hasConsentForContent(db: D1Database, params: ConsentQueryParams): Promise<boolean>

// Retrieve specific consent record
async function getConsentRecord(db: D1Database, params: ConsentQueryParams): Promise<ConsentRecord | null>

// Generate cryptographic hash of consent text
async function generateConsentTextHash(consentText: string): Promise<string>

// Validate consent data structure
function validateConsent(consentData: any): ConsentValidationResult
```

#### Constants and Configuration

```typescript
// Mass import reserved UUID for system-generated content
export const MASS_IMPORT_USER_UUID = '00000000-0000-0000-0000-000000000002';

// Current consent version - update when legal terms change
export const CURRENT_CONSENT_VERSION = '1.0.0';

// Required consent fields for valid submission
export const REQUIRED_CONSENTS = [
  'ageVerification',
  'cc0Licensing', 
  'publicCommons',
  'freedomOfPanorama',
] as const;
```

### Content Submission Flow

#### Consent-First Implementation

All content submission routes follow this pattern:

1. **Generate Content ID**: Create UUID for the content before creation
2. **Record Consent**: Call `recordConsent()` with user identity and content details
3. **Create Content**: Only proceed if consent recording succeeds
4. **Process Assets**: Handle photos, validation, etc.
5. **Return Response**: Include consent audit information

#### Example: Logbook Submission

```typescript
// 1. Generate content ID
const contentId = crypto.randomUUID();

// 2. Generate consent text hash
const consentTextHash = await generateConsentTextHash(
  `Cultural Archiver Consent v${consentVersion} - Logbook Submission`
);

// 3. Record consent FIRST
const consentRecord = await recordConsent({
  userId: isAuthenticated ? userToken : undefined,
  anonymousToken: isAuthenticated ? undefined : userToken,
  contentType: 'logbook',
  contentId,
  consentVersion,
  ipAddress: clientIP,
  consentTextHash,
  db: c.env.DB,
});

// 4. Create content only after consent success
const logbookEntry = await createLogbookEntry({
  id: contentId, // Use same ID as consent
  // ... other properties
});
```

## Content Types and Consent Text

### Logbook Submissions

- **Content Type**: `"logbook"`
- **Consent Text**: `"Cultural Archiver Consent v{version} - Logbook Submission"`
- **Hash Example**: `8aefe787f867b56c485d537ea1d339790a6197f33a2c38af57829ad67fd1a1e6`

### Artwork Submissions

- **Content Type**: `"artwork"`  
- **Consent Text**: `"Cultural Archiver Consent v{version} - Artwork Submission"`
- **Hash Example**: `64ca674d89841c377f5e589957f62d90a4e3b2be359acfeb008f8636cbbb4ea8`

### Fast Photo Upload

- **Content Type**: `"artwork"`
- **Consent Text**: Same as artwork submissions
- **Special Handling**: Requires `ensureUserToken` middleware for anonymous token generation

## User Identity Handling

### Authenticated Users

```typescript
{
  userId: "user-uuid-here",
  anonymousToken: null
}
```

### Anonymous Users

```typescript
{
  userId: null,
  anonymousToken: "anonymous-token-uuid"
}
```

### Mass Import System

```typescript
{
  userId: "00000000-0000-0000-0000-000000000002", // Reserved UUID
  anonymousToken: null
}
```

## API Integration

### Submission Endpoints

All content submission endpoints implement consent-first pattern:

- `POST /api/logbook` - Logbook submissions
- `POST /api/artworks/fast` - Fast photo upload
- `POST /api/review/{id}/approve` - Artwork creation during approval

### Error Handling

**Consent Recording Failure:**
```json
{
  "error": "Submission blocked: Consent could not be recorded",
  "code": "SUBMISSION_BLOCKED",
  "status": 409,
  "details": {
    "message": "Your consent is required before submitting content",
    "consentVersion": "2025-09-09.v2"
  }
}
```

**Invalid Identity:**
```json
{
  "error": "Either userId or anonymousToken must be provided",
  "code": "CONSENT_INVALID_IDENTITY", 
  "status": 400
}
```

## Middleware Dependencies

### Required Middleware

1. **`ensureUserToken`**: Generates anonymous tokens for unauthenticated users
2. **`addUserTokenToResponse`**: Manages token persistence in cookies
3. **Rate limiting**: Prevents consent spam

### Middleware Order

```typescript
// Correct order for content submission routes
app.use('/api/artworks/fast', ensureUserToken);  // Generate token first
app.use('/api/artworks/fast', addUserTokenToResponse); // Persist token
app.use('/api/artworks/fast', handleFastPhotoUpload); // Process submission
```

## Legal Compliance Features

### Audit Trail

Every consent record provides:

- **User Identity**: Authenticated UUID or anonymous token
- **Timestamp**: Exact time of consent (ISO 8601)
- **IP Address**: For geolocation and abuse prevention
- **Content Hash**: Cryptographic proof of agreed terms
- **Version Tracking**: Links to specific version of legal documents

### Data Integrity

- **SHA-256 Hashing**: Consent text is cryptographically hashed
- **Immutable Records**: Consent cannot be modified after creation
- **Unique Constraints**: Prevents duplicate consent for same content
- **Foreign Keys**: Maintains referential integrity with users table

### Privacy Protection

- **Anonymous Support**: No personal information required for anonymous users
- **Token-based Identity**: Uses UUIDs instead of personal identifiers
- **IP Limitation**: IP addresses for audit only, not user tracking
- **Minimal Data**: Only consent-essential information stored

## Version Management

### Consent Version Format

```
YYYY-MM-DD.v{increment}
```

Examples:
- `2025-09-09.v1` - Initial version
- `2025-09-09.v2` - Updated same day
- `2025-12-01.v1` - Major revision

### Updating Consent Version

When legal terms change:

1. **Update Version**: Change `CURRENT_CONSENT_VERSION` in `consent-new.ts`
2. **Update Text**: Modify consent text generation in submission routes
3. **Database Migration**: No schema changes needed
4. **Deploy**: All new submissions use new version automatically

## Testing

### Test Coverage

The consent system includes comprehensive tests:

- **Unit Tests**: `lib/__tests__/consent-new.test.ts` (15 tests)
- **Integration Tests**: `routes/__tests__/submissions-consent.test.ts` (10 tests)
- **End-to-End**: Covered in submission flow tests

### Test Scenarios

- Authenticated user consent recording
- Anonymous user consent recording
- Mass import system consent
- Consent validation and retrieval
- Error handling for invalid data
- Hash generation consistency
- Duplicate consent prevention

## Troubleshooting

### Common Issues

**Missing Consent Records for Approved Artworks**
- **Cause**: Approval process wasn't creating artwork consent records
- **Solution**: Enhanced `review.ts` to create consent during approval
- **Prevention**: Test approval workflow in staging

**Empty User Tokens Causing Consent Failures**
- **Cause**: Missing `ensureUserToken` middleware on submission routes
- **Solution**: Add middleware to generate anonymous tokens
- **Prevention**: Verify middleware order in route configuration

**Double-Hashed Consent Text**
- **Cause**: `recordConsent()` was re-hashing already-hashed text
- **Solution**: Use pre-computed hash directly in database storage
- **Prevention**: Test hash consistency between generation and storage

### Debugging Tools

**Check Consent for Content:**
```sql
SELECT * FROM consent 
WHERE content_type = 'artwork' 
AND content_id = 'artwork-id-here';
```

**Verify Hash Generation:**
```javascript
const crypto = require('crypto');
const text = 'Cultural Archiver Consent v2025-09-09.v2 - Artwork Submission';
const hash = await crypto.webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
console.log(Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));
```

**Monitor Consent Creation:**
```sql
SELECT 
  content_type,
  consent_version,
  COUNT(*) as consent_count,
  DATE(created_at) as consent_date
FROM consent 
GROUP BY content_type, consent_version, DATE(created_at)
ORDER BY consent_date DESC;
```

## Security Considerations

### Threat Mitigation

- **Consent Spam**: Rate limiting prevents abuse
- **Hash Manipulation**: SHA-256 provides cryptographic integrity
- **Identity Spoofing**: UUID tokens prevent user impersonation
- **Data Tampering**: Immutable records with foreign key constraints

### Best Practices

1. **Always validate** user identity before recording consent
2. **Use rate limiting** to prevent consent spam attacks
3. **Monitor consent patterns** for unusual activity
4. **Regularly audit** consent records for compliance
5. **Test consent flow** thoroughly before legal document updates

## Future Enhancements

### Planned Features

- **Consent Withdrawal**: Allow users to revoke consent for specific content
- **Granular Consent**: Track consent for different types of data usage
- **Compliance Reports**: Generate audit reports for legal teams
- **Consent History**: Show users their consent history
- **Automated Cleanup**: Remove content when consent is withdrawn

### Integration Opportunities

- **GDPR Compliance**: Extend for European data protection requirements
- **CCPA Support**: Add California Consumer Privacy Act features
- **International Law**: Support region-specific consent requirements
- **Analytics Integration**: Track consent conversion rates
- **Admin Dashboard**: Visual consent management interface

---

**Last Updated**: September 12, 2025
**Document Version**: 1.0
**Author**: Cultural Archiver Development Team