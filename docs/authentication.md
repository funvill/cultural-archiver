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
- MailChannels email delivery
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

- **Email Limits**: 5 magic link requests per email per hour
- **IP Limits**: 10 magic link requests per IP per hour
- **Sliding Windows**: Rate limits reset progressively
- **Abuse Prevention**: Blocked identifiers until window reset

### Session Management

- **Secure Sessions**: SHA-256 token hashing in database
- **Cross-Device Support**: Multiple active sessions per user
- **Automatic Cleanup**: Expired session removal
- **Session Validation**: Token verification on each request

## Configuration

### Environment Variables

```bash
# MailChannels Configuration (Workers)
MAILCHANNELS_API_TOKEN=your_api_token  # Optional: For advanced features
MAILCHANNELS_FROM_EMAIL=noreply@yourdomain.com
MAILCHANNELS_FROM_NAME="Cultural Archiver"

# Database Configuration
DATABASE_URL=your_d1_database_url

# Rate Limiting
MAGIC_LINK_EMAIL_RATE_LIMIT=5  # Per hour
MAGIC_LINK_IP_RATE_LIMIT=10    # Per hour
```

### Magic Link Email Template

The system sends HTML emails with:
- Clear call-to-action button
- Security information and warnings
- Token expiration details
- Submission count for account creation
- Branded styling and accessibility

## API Reference

### Request Magic Link

```http
POST /api/auth/request-magic-link
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "isSignup": false,
  "message": "Magic link sent to your email"
}
```

### Verify Magic Link

```http
POST /api/auth/verify-magic-link
Content-Type: application/json

{
  "token": "64-character-hex-token"
}
```

**Response**:
```json
{
  "success": true,
  "user": {
    "uuid": "user-uuid",
    "email": "user@example.com",
    "emailVerified": true
  },
  "uuidReplaced": false
}
```

### Logout

```http
POST /api/auth/logout
```

**Response**:
```json
{
  "success": true,
  "newToken": "new-anonymous-uuid"
}
```

### Authentication Status

```http
GET /api/auth/status
```

**Response**:
```json
{
  "isAuthenticated": true,
  "user": {
    "uuid": "user-uuid",
    "email": "user@example.com",
    "emailVerified": true
  }
}
```

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