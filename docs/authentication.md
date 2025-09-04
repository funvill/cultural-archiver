# Authentication System Documentation

The Cultural Archiver implements a UUID-based authentication system with magic link verification that supports anonymous users with optional email verification. This system provides a seamless transition from anonymous to authenticated usage while preserving user submissions.

## Overview

The authentication system follows these core principles:

- **Anonymous-first**: Users can immediately use the app without registration
- **UUID claiming**: Users can claim their anonymous submissions during account creation
- **Magic links**: Email-based authentication without passwords
- **Cross-device login**: Seamless authentication across multiple devices
- **Privacy-focused**: Minimal personal information required (email only)

## Architecture

### Backend Components

#### Database Schema

The authentication system uses four main tables:

**users**: Core authenticated user records
- `uuid` (TEXT, PRIMARY KEY): User's claimed UUID token
- `email` (TEXT, UNIQUE): User's email address  
- `created_at` (TEXT): Account creation timestamp
- `last_login` (TEXT): Last login timestamp
- `email_verified_at` (TEXT): Email verification timestamp
- `status` (TEXT): Account status (active/suspended)

**magic_links**: Secure authentication tokens
- `token` (TEXT, PRIMARY KEY): 64-character hex token (32 secure bytes)
- `email` (TEXT): Target email address
- `user_uuid` (TEXT): Associated user UUID (NULL for signup)
- `created_at` (TEXT): Token generation timestamp
- `expires_at` (TEXT): Token expiration (1 hour)
- `used_at` (TEXT): Token consumption timestamp
- `is_signup` (BOOLEAN): Account creation vs. login flag

**rate_limiting**: Abuse prevention
- `identifier` (TEXT): Email or IP address
- `identifier_type` (TEXT): 'email' or 'ip'
- `request_count` (INTEGER): Requests in current window
- `window_start` (TEXT): Rate limit window start
- `blocked_until` (TEXT): Block expiration time

**auth_sessions**: Active user sessions
- `id` (TEXT, PRIMARY KEY): Session UUID
- `user_uuid` (TEXT): Associated user UUID
- `token_hash` (TEXT): SHA-256 hash of session token
- `created_at` (TEXT): Session creation timestamp
- `last_accessed_at` (TEXT): Last access timestamp
- `expires_at` (TEXT): Session expiration
- `is_active` (BOOLEAN): Session status

#### Core Libraries

**lib/auth.ts**: Core authentication logic
- UUID generation with collision detection
- User creation with UUID claiming
- Session management and validation
- Cross-device UUID replacement

**lib/email-auth.ts**: Magic link system
- Secure token generation (Web Crypto API)
- Resend email delivery
- Rate limiting enforcement
- Token lifecycle management

**routes/auth.ts**: REST API endpoints
- `POST /api/auth/request-magic-link`: Request magic link
- `POST /api/auth/verify-magic-link`: Verify and consume token
- `POST /api/auth/logout`: Logout with new anonymous UUID
- `GET /api/auth/status`: Get authentication status

### Frontend Components

#### Vue Components

**AuthModal.vue**: Login/signup modal
- Email validation and submission
- Loading states and error handling
- Accessibility features (ARIA, focus trap)
- Mode switching (login/signup)

**AnonymousUserWarning.vue**: User education
- Submission warnings for anonymous users
- Contextual messaging (submission vs. general)
- Sign-in prompts and calls-to-action

**MagicLinkVerify.vue**: Email verification
- Magic link token processing
- Success/error state handling
- User feedback and next steps

#### State Management

**stores/auth.ts**: Pinia authentication store
- User token management
- Authentication state persistence
- Magic link request/verification
- Cross-device login handling
- LocalStorage integration

**composables/useAuth.ts**: Authentication composable
- API integration abstraction
- Error handling and loading states
- Reactive authentication operations

## Authentication Flows

### Anonymous User Flow

1. **First Visit**: Browser receives UUID cookie
2. **Content Submission**: User submits content anonymously
3. **Anonymous Warning**: System displays account creation benefits
4. **Continued Usage**: User can browse and submit without restrictions

### Account Creation Flow

1. **Email Entry**: User enters email in signup modal
2. **Magic Link Generation**: System creates secure token and sends email
3. **Token Verification**: User clicks magic link in email
4. **UUID Claiming**: Current browser UUID becomes account UUID
5. **Account Active**: User can access enhanced features

### Login Flow (Existing Users)

1. **Email Entry**: User enters email in login modal
2. **Magic Link Generation**: System creates token for existing account
3. **Token Verification**: User clicks magic link in email
4. **UUID Replacement**: Browser UUID replaced with account UUID
5. **Session Active**: User sees all account content

### Cross-Device Login

1. **Different Device**: User has different UUID on new device
2. **Magic Link Login**: User logs in via email on new device
3. **UUID Replacement**: New device UUID replaced with account UUID
4. **Content Access**: User sees all account content immediately

## Security Features

### Token Security

- **Cryptographic Generation**: Web Crypto API with 32 secure random bytes
- **Single Use**: Tokens invalidated after first use
- **Time Limited**: 1-hour expiration window
- **Secure Storage**: Server stores SHA-256 hashes only

### Rate Limiting

- **Email Limits**: 10 magic link requests per email per hour
- **IP Limits**: 20 magic link requests per IP per hour
- **Sliding Windows**: Rate limits reset progressively (1-hour rolling windows)
- **Abuse Prevention**: Blocked identifiers until window reset
- **Database Storage**: Rate limits stored in D1 database with automatic cleanup
- **Per-Window Tracking**: Precise request counting with window_start timestamps

### Session Management

- **Secure Sessions**: SHA-256 token hashing in database
- **Cross-Device Support**: Multiple active sessions per user
- **Automatic Cleanup**: Expired session removal
- **Session Validation**: Token verification on each request

## Email System and Resend Integration

### Resend Configuration

The Cultural Archiver uses **Resend** for sending magic link emails through Cloudflare Workers. Resend provides a modern transactional email API with excellent deliverability and comprehensive tracking.

#### DNS Configuration

**Proper DNS setup is required** for Resend authorization and email delivery. The domain must be verified and configured with appropriate SPF, DKIM, and DMARC records as outlined in the Resend setup documentation.

### Email Templates

#### Magic Link Email Structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>Cultural Archiver - Magic Link</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Cultural Archiver</h1>
    
    <!-- Account Creation vs Login -->
    <h2>{{ is_signup ? "Verify your email" : "Sign in to your account" }}</h2>
    
    <!-- Magic Link Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{ magicLink }}" 
         style="background: #0066cc; color: white; padding: 15px 30px; 
                text-decoration: none; border-radius: 5px; font-weight: bold;">
        {{ is_signup ? "Complete Account Setup" : "Sign In Now" }}
      </a>
    </div>
    
    <!-- Security Information -->
    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Security Information:</strong></p>
      <ul>
        <li>This link expires at: {{ expiresAt }}</li>
        <li>This link can only be used once</li>
        <li>If you didn't request this, you can safely ignore this email</li>
      </ul>
    </div>
    
    <!-- Anonymous Submissions Count (for signup) -->
    {{#if anonymousSubmissions}}
    <p>You currently have <strong>{{ anonymousSubmissions }}</strong> anonymous submissions 
       that will be linked to your account.</p>
    {{/if}}
    
    <!-- Manual Link -->
    <p style="font-size: 12px; color: #666;">
      If the button doesn't work, copy and paste this link:<br>
      {{ magicLink }}
    </p>
  </div>
</body>
</html>
```

#### Email Content Variations

**Account Creation (is_signup: true):**
- Subject: "Verify your email - Cultural Archiver"
- Shows anonymous submission count if applicable
- Emphasizes account creation benefits
- Button text: "Complete Account Setup"

**Existing User Login (is_signup: false):**
- Subject: "Sign in to Cultural Archiver"
- Focuses on sign-in process
- Button text: "Sign In Now"

### Resend Implementation

#### API Integration

```typescript
// Email payload for Resend API
const emailPayload = {
  from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`,
  to: [recipient],
  subject: subject,
  html: htmlContent,
  reply_to: env.EMAIL_REPLY_TO,
  tags: [
    { name: 'type', value: 'magic-link' },
    { name: 'app', value: 'cultural-archiver' }
  ]
};

// Send via Resend
const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.RESEND_API_KEY}`
  },
  body: JSON.stringify(emailPayload)
});
```

#### Fallback System

When Resend fails (401 Unauthorized or network issues), the system automatically falls back to development mode:

```typescript
// Development Fallback
if (mailChannelsError) {
  console.log('=== DEVELOPMENT FALLBACK: MAGIC LINK EMAIL ===');
  console.log('To:', email);
  console.log('Magic Link:', magicLink);
  console.log('Expires:', expiresAt);
  
  // Store in KV for manual access
  await env.SESSIONS.put(
    `dev-magic-link:${email}`,
    JSON.stringify({ token, magicLink, expiresAt }),
    { expirationTtl: MAGIC_LINK_EXPIRY_HOURS * 60 * 60 }
  );
}
```

### Email Delivery Monitoring

#### Success Indicators

- Resend returns HTTP 200/202
- No rate limiting errors
- No DNS authentication failures

#### Common Issues

**401 Unauthorized from Resend:**
- DNS records not properly configured
- Email Routing not enabled in Cloudflare
- Domain verification record missing
- DKIM signature validation failed

**Rate Limiting:**
- Too many requests from same IP/email
- Current limits: 10/hour per email, 20/hour per IP
- Blocked until rate limit window resets

**DNS Issues:**
- SPF record doesn't include Resend
- DKIM record missing or malformed
- Domain verification record incorrect

#### Troubleshooting Commands

```bash
# Check DNS records
nslookup -type=TXT yourdomain.com
nslookup -type=TXT mailchannels._domainkey.yourdomain.com
nslookup -type=TXT _mailchannels.yourdomain.com

# Test MailChannels connectivity
curl -X POST https://api.mailchannels.net/tx/v1/send \
  -H "Content-Type: application/json" \
  -d '{"personalizations":[{"to":[{"email":"test@example.com"}]}],"from":{"email":"noreply@yourdomain.com"},"subject":"Test","content":[{"type":"text/plain","value":"Test message"}]}'
```

## Configuration

### Magic Link Email Template

The system sends HTML emails with:
- Clear call-to-action button
- Security information and warnings
- Token expiration details
- Submission count for account creation
- Branded styling and accessibility

## API Reference

### Magic Link Endpoints

#### Request Magic Link

```http
POST /api/auth/magic-link
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Account creation magic link sent successfully",
  "email": "user@example.com", 
  "is_signup": true,
  "rate_limit_remaining": 9,
  "rate_limit_reset_at": "2025-09-03T07:35:57.354Z"
}
```

**Response (Rate Limited)**:
```json
{
  "error": "Too many requests from this IP address. Please try again at 6:36:38 AM.",
  "message": "MAGIC_LINK_CREATION_FAILED",
  "details": {
    "correlation_id": "abc123"
  },
  "show_details": true
}
```

#### Consume Magic Link

```http
POST /api/auth/consume
Content-Type: application/json

{
  "token": "59d43b84a0fef00fac697f653591dc5abe91935551bbbd0933e5f1b70fcad321"
}
```

**Response (Account Creation)**:
```json
{
  "success": true,
  "message": "Account created successfully",
  "user": {
    "uuid": "4571d949-6497-4894-9c42-5258a20b2b58",
    "email": "placeholder@example.com",
    "created_at": "2025-09-03T06:36:33.314Z",
    "email_verified_at": "2025-09-03T06:36:33.314Z"
  },
  "session": {
    "token": "ee791a3255cb21ae5996430b0e9830fb597441232231aaea4cfe1d59c7a4e880",
    "expires_at": ""
  },
  "uuid_replaced": false,
  "is_new_account": true
}
```

**Response (Login)**:
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "uuid": "existing-user-uuid",
    "email": "user@example.com",
    "created_at": "2025-09-01T12:00:00.000Z",
    "last_login": "2025-09-03T06:36:33.314Z",
    "email_verified_at": "2025-09-01T12:05:00.000Z"
  },
  "session": {
    "token": "session-token-hash",
    "expires_at": "2025-09-10T06:36:33.314Z"
  },
  "uuid_replaced": true,
  "is_new_account": false
}
```

#### Authentication Status

```http
GET /api/auth/status
```

**Response (Authenticated)**:
```json
{
  "user_token": "4571d949-6497-4894-9c42-5258a20b2b58",
  "is_authenticated": true,
  "is_anonymous": false,
  "user": {
    "uuid": "4571d949-6497-4894-9c42-5258a20b2b58",
    "email": "user@example.com",
    "created_at": "2025-09-03T06:36:33.314Z",
    "last_login": "2025-09-03T06:36:33.314Z",
    "email_verified_at": "2025-09-03T06:36:33.314Z",
    "status": "active"
  },
  "session": {
    "token": "session-token-hash",
    "expires_at": "2025-09-10T06:36:33.314Z",
    "created_at": "2025-09-03T06:36:33.314Z"
  }
}
```

**Response (Anonymous)**:
```json
{
  "user_token": "d063bcd3-6901-4b14-a2b1-1657bba2238a",
  "is_authenticated": false,
  "is_anonymous": true,
  "user": null,
  "session": null
}
```

#### Logout

```http
POST /api/auth/logout
```

**Response**:
```json
{
  "success": true,
  "message": "Logged out successfully",
  "new_anonymous_token": "new-uuid-v4-token"
}
```

### Error Response Format

All authentication endpoints use progressive error disclosure:

```json
{
  "error": "Human-readable error message",
  "message": "ERROR_CODE_FOR_PROGRAMMATIC_HANDLING", 
  "details": {
    "correlation_id": "unique-request-id",
    "additional_context": "if_applicable"
  },
  "show_details": true
}
```

### Frontend URL Integration

Magic links are generated with the correct frontend path:

```
https://art.abluestar.com/verify?token={64-character-hex-token}
```

The frontend Vue router handles the `/verify` route to process magic link tokens.

## Database Schema and Migrations

### Current Schema (Migration 005)

The authentication system uses the following tables in the Cloudflare D1 database:

#### `users` Table
```sql
CREATE TABLE users (
    uuid TEXT PRIMARY KEY,              -- User's claimed UUID token (UUID v4)
    email TEXT UNIQUE NOT NULL,         -- User's email address
    created_at TEXT NOT NULL,           -- Account creation timestamp (ISO 8601)
    last_login TEXT,                    -- Last login timestamp
    email_verified_at TEXT,             -- Email verification timestamp
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'))
);

-- Indexes for efficient queries
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);
```

#### `magic_links` Table
```sql
CREATE TABLE magic_links (
    token TEXT PRIMARY KEY,             -- 64-character hex token (32 secure bytes)
    email TEXT NOT NULL,                -- Target email address
    user_uuid TEXT,                     -- Associated user UUID (NULL for signup)
    created_at TEXT NOT NULL,           -- Token generation timestamp
    expires_at TEXT NOT NULL,           -- Token expiration (1 hour from creation)
    used_at TEXT,                       -- Token consumption timestamp (NULL if unused)
    ip_address TEXT,                    -- Client IP address for audit
    user_agent TEXT,                    -- Client user agent for audit
    is_signup BOOLEAN NOT NULL DEFAULT 0,  -- Account creation vs login flag
    
    -- Constraints
    CONSTRAINT magic_link_token_length CHECK (length(token) >= 64),
    CONSTRAINT magic_link_expires_valid CHECK (expires_at > created_at),
    CONSTRAINT magic_link_used_valid CHECK (used_at IS NULL OR used_at >= created_at),
    
    -- Foreign key relationship
    FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE
);

-- Indexes for queries and cleanup
CREATE INDEX idx_magic_links_email ON magic_links(email);
CREATE INDEX idx_magic_links_expires_at ON magic_links(expires_at);
CREATE INDEX idx_magic_links_used_at ON magic_links(used_at);
CREATE INDEX idx_magic_links_created_at ON magic_links(created_at);
```

#### `rate_limiting` Table
```sql
CREATE TABLE rate_limiting (
    identifier TEXT NOT NULL,           -- Email address or IP address
    identifier_type TEXT NOT NULL CHECK (identifier_type IN ('email', 'ip')),
    request_count INTEGER NOT NULL DEFAULT 0,      -- Requests in current window
    window_start TEXT NOT NULL,         -- Rate limit window start timestamp
    last_request_at TEXT NOT NULL,      -- Last request timestamp
    blocked_until TEXT,                 -- Block expiration time (NULL if not blocked)
    
    -- Composite primary key for identifier + type
    PRIMARY KEY (identifier, identifier_type)
);

-- Indexes for rate limit queries
CREATE INDEX idx_rate_limiting_blocked_until ON rate_limiting(blocked_until);
CREATE INDEX idx_rate_limiting_window_start ON rate_limiting(window_start);
```

#### `auth_sessions` Table
```sql
CREATE TABLE auth_sessions (
    id TEXT PRIMARY KEY,                -- Session UUID
    user_uuid TEXT NOT NULL,            -- Associated user UUID
    token_hash TEXT NOT NULL UNIQUE,    -- SHA-256 hash of session token
    created_at TEXT NOT NULL,           -- Session creation timestamp
    last_accessed_at TEXT NOT NULL,     -- Last access timestamp
    expires_at TEXT,                    -- Session expiration (NULL = no expiry)
    ip_address TEXT,                    -- Client IP address
    user_agent TEXT,                    -- Client user agent
    is_active BOOLEAN NOT NULL DEFAULT 1,   -- Session status
    device_info TEXT,                   -- JSON device information
    
    -- Foreign key relationship
    FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT session_expires_valid CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Indexes for session management
CREATE INDEX idx_auth_sessions_user_uuid ON auth_sessions(user_uuid);
CREATE INDEX idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX idx_auth_sessions_is_active ON auth_sessions(is_active);
```

### Migration Commands

To apply the authentication schema:

```bash
# Apply the authentication migration
cd migrations
npx wrangler d1 execute cultural-archiver --remote --file=005_authentication_tables.sql

# Verify tables were created
npx wrangler d1 execute cultural-archiver --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'auth_%' OR name IN ('users', 'magic_links', 'rate_limiting');"
```

### Data Relationships

```
users (1) ←→ (many) magic_links
users (1) ←→ (many) auth_sessions
rate_limiting (independent)
```

**Key Relationships:**
- One user can have multiple magic links (for login attempts)
- One user can have multiple active sessions (cross-device)
- Rate limiting is independent and tracks by email/IP
- Magic links reference users for existing accounts (user_uuid NOT NULL)
- Magic links for signup have user_uuid = NULL initially

### Data Cleanup

The system includes automatic cleanup for:

**Expired Magic Links:**
```sql
DELETE FROM magic_links 
WHERE expires_at < datetime('now') 
   OR used_at IS NOT NULL;
```

**Expired Sessions:**
```sql
DELETE FROM auth_sessions 
WHERE expires_at IS NOT NULL 
  AND expires_at < datetime('now');
```

**Old Rate Limit Records:**
```sql
DELETE FROM rate_limiting 
WHERE window_start < datetime('now', '-2 hours')
  AND blocked_until IS NULL;
```

### Recent Changes (September 2025)

**Rate Limits Doubled:**
- Email rate limit: 5 → 10 requests per hour
- IP rate limit: 10 → 20 requests per hour
- Deployed successfully with Version ID: `edd24938-2238-495c-95d7-4bd2c6ca6031`

**URL Path Fixed:**
- Magic link URLs now use `/verify` instead of `/auth/verify`
- Matches Vue.js frontend router configuration
- Eliminates 404 errors on magic link clicks

**Resend Integration:**
- DNS records configured on `art.abluestar.com`
- API key authentication with Bearer token
- Fallback system logs to console when Resend fails
- Production deployment successful with Version ID: `8754c89d-039a-4d8e-a86d-71215e83ffe5`

### Monitoring and Maintenance

**Key Metrics to Monitor:**
- Magic link delivery success rate (Resend API responses)
- Token verification success rate
- Rate limiting effectiveness (blocked vs allowed requests)
- Session creation and cleanup rates
- Authentication error rates and correlation IDs

**Regular Maintenance:**
- Clean up expired magic links and sessions
- Monitor rate limiting patterns for abuse
- Review authentication logs for anomalies
- Update DNS records if domain changes
- Test magic link flow after deployments

### Security Considerations

- Never log magic link tokens in production
- Use HTTPS for all authentication endpoints
- Implement proper CORS policies for frontend integration
- Monitor for authentication anomalies and suspicious patterns
- Regular security audits of token generation and validation
- Email provider security is dependent on user's email service
- MailChannels provides transport security but email content security varies by recipient

## Testing

### Backend Tests

- **auth.test.ts**: 31 tests covering core authentication logic
- **email-auth.test.ts**: 29 tests covering magic link system
- **Comprehensive Coverage**: UUID generation, session management, rate limiting
- **Error Scenarios**: Network failures, invalid tokens, rate limits

### Frontend Tests

- **AuthModal.test.ts**: Modal component interactions and validation
- **AnonymousUserWarning.test.ts**: Warning component behavior
- **auth.test.ts**: Store state management and API integration
- **Accessibility Testing**: ARIA attributes, focus management, keyboard navigation

## Troubleshooting

### Common Issues

**Magic Links Not Received**:
- Check spam/junk folders
- Verify email address format
- Check rate limiting status
- Verify MailChannels configuration

**Token Expired/Invalid**:
- Tokens expire after 1 hour
- Tokens are single-use only
- Request new magic link
- Check server time synchronization

**UUID Not Claimed**:
- UUID claiming only works during account creation
- Cannot claim submissions from different UUIDs retroactively
- One email = one UUID permanently

**Cross-Device Issues**:
- UUID replacement requires magic link login
- Content appears immediately after UUID replacement
- Session cookies don't transfer between devices

### Error Codes

- `INVALID_EMAIL`: Email format validation failed
- `RATE_LIMITED`: Too many requests from email/IP
- `TOKEN_EXPIRED`: Magic link token expired (>1 hour)
- `TOKEN_USED`: Magic link token already consumed
- `TOKEN_INVALID`: Token not found or malformed
- `USER_EXISTS`: Email already registered (signup)
- `USER_NOT_FOUND`: Email not registered (login)

### Monitoring

Key metrics to monitor:
- Magic link delivery success rate
- Token verification success rate  
- Rate limiting effectiveness
- Session creation/cleanup rates
- Authentication error rates

### Performance Optimization

- Database indexes on email, tokens, and timestamps
- Rate limiting with sliding windows
- Session cleanup via background processes
- Email template caching
- UUID collision retry logic (rarely needed)

## Migration Notes

When updating the authentication system:

1. **Database Changes**: Run migrations in order
2. **Token Format**: Maintain 64-character hex tokens
3. **API Compatibility**: Preserve existing endpoint contracts
4. **Session Migration**: Handle existing sessions gracefully
5. **Rate Limit Migration**: Preserve existing rate limit data

## Security Considerations

- Never log magic link tokens
- Use HTTPS for all authentication endpoints
- Implement proper CORS policies
- Monitor for authentication anomalies
- Regular security audits of token generation
- Email provider security is user responsibility
