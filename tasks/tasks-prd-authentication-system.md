# Task List: Authentication System Implementation

Based on `tasks/prd-authentication-system.md` - Authentication system with UUID-based anonymous users, magic link authentication, and account creation with UUID claiming.

## Relevant Files

- `migrations/005_authentication_tables.sql` - Database migration for user, magic link, and rate limiting tables
- `src/shared/types.ts` - Add authentication interfaces and database record types (extends existing AuthContext)
- `src/workers/lib/auth.ts` - Core authentication business logic (UUID generation, session management, user creation)
- `src/workers/lib/auth.test.ts` - Unit tests for authentication logic
- `src/workers/lib/email-auth.ts` - Magic link generation, validation, and email sending using MailChannels
- `src/workers/lib/email-auth.test.ts` - Unit tests for magic link functionality
- `src/workers/middleware/auth.ts` - Extend existing auth middleware with new authentication logic
- `src/workers/middleware/auth.test.ts` - Unit tests for authentication middleware
- `src/workers/routes/auth.ts` - Extend existing auth routes with new endpoints (logout, user status)
- `src/workers/routes/auth.test.ts` - Unit tests for authentication API endpoints
- `src/frontend/src/stores/auth.ts` - Extend existing auth store with new authentication flows
- `src/frontend/src/stores/auth.test.ts` - Unit tests for authentication store
- `src/frontend/src/components/AuthModal.vue` - New modal component for login/signup flows
- `src/frontend/src/components/AuthModal.test.ts` - Unit tests for authentication modal
- `src/frontend/src/components/AnonymousUserWarning.vue` - Warning component for anonymous users
- `src/frontend/src/components/AnonymousUserWarning.test.ts` - Unit tests for warning component
- `src/frontend/src/views/AuthVerifyView.vue` - New view for magic link verification
- `src/frontend/src/views/AuthVerifyView.test.ts` - Unit tests for verification view

### Notes

- Use existing middleware patterns in `src/workers/middleware/auth.ts` as foundation
- Extend existing auth store in `src/frontend/src/stores/auth.ts` rather than replacing
- Follow existing API patterns in `src/workers/routes/auth.ts`
- Use existing shared types in `src/shared/types.ts` as base for new interfaces
- Run tests with `npm test` in respective directories (frontend, workers, or root)
- Run tests after each task, resolve any errors before continuing.
- Document the features in the /docs/ folder.

## Tasks

- [ ] 1.0 Database Schema Implementation
  - [ ] 1.1 Create migration file `migrations/005_authentication_tables.sql` with user table (uuid, email, created_at, last_login)
  - [ ] 1.2 Add magic_links table (token, email, user_uuid, created_at, used_at, expires_at) with indexes
  - [ ] 1.3 Add rate_limiting table (identifier, request_count, window_start) for tracking magic link requests
  - [ ] 1.4 Test migration with sample data to verify foreign key relationships and constraints
  - [ ] 1.5 Update database documentation in `docs/database.md` with new authentication tables

- [ ] 2.0 Core Authentication Logic
  - [ ] 2.1 Create `src/workers/lib/auth.ts` with UUID generation and validation functions
  - [ ] 2.2 Implement user creation logic that claims anonymous UUID and associates with email
  - [ ] 2.3 Add UUID collision detection and retry logic (generate new UUID on collision)
  - [ ] 2.4 Implement session management functions (create, validate, destroy sessions)
  - [ ] 2.5 Add UUID replacement logic for cross-device login (replace browser UUID with account UUID)
  - [ ] 2.6 Write comprehensive unit tests in `src/workers/lib/auth.test.ts` covering all authentication flows

- [ ] 3.0 Magic Link Email System
  - [ ] 3.1 Create `src/workers/lib/email-auth.ts` with MailChannels integration for sending emails
  - [ ] 3.2 Implement magic link token generation (32+ byte cryptographically secure tokens)
  - [ ] 3.3 Add magic link validation and consumption logic with single-use and expiration checks
  - [ ] 3.4 Create email templates for magic links with proper HTML formatting and security considerations
  - [ ] 3.5 Implement rate limiting for magic link requests (5 per email/hour, 10 per IP/hour)
  - [ ] 3.6 Add comprehensive error handling for email delivery failures and invalid tokens
  - [ ] 3.7 Write unit tests in `src/workers/lib/email-auth.test.ts` covering token lifecycle and email sending

- [ ] 4.0 Authentication API Endpoints
  - [ ] 4.1 Extend `src/workers/routes/auth.ts` with `POST /auth/request-magic-link` endpoint
  - [ ] 4.2 Add `POST /auth/verify-magic-link` endpoint for consuming magic link tokens
  - [ ] 4.3 Implement `POST /auth/logout` endpoint that clears sessions and generates new anonymous UUID
  - [ ] 4.4 Add `GET /auth/status` endpoint returning current authentication state and user info
  - [ ] 4.5 Update authentication middleware to support new UUID claiming and session management
  - [ ] 4.6 Add proper error responses for all authentication failures with clear user messaging
  - [ ] 4.7 Write API tests in `src/workers/routes/auth.test.ts` covering all endpoints and error cases

- [ ] 5.0 Frontend Authentication Components
  - [ ] 5.1 Create `src/frontend/src/components/AuthModal.vue` with login/signup form and email validation
  - [ ] 5.2 Implement `src/frontend/src/components/AnonymousUserWarning.vue` for submission warnings
  - [ ] 5.3 Add `src/frontend/src/views/AuthVerifyView.vue` for magic link verification flow
  - [ ] 5.4 Create reusable authentication form components with proper accessibility (ARIA labels, focus management)
  - [ ] 5.5 Add loading states, error handling, and success messaging for all authentication flows
  - [ ] 5.6 Implement email format validation on frontend with real-time feedback
  - [ ] 5.7 Write component tests covering user interactions, form validation, and error states

- [ ] 6.0 Authentication Store Integration
  - [ ] 6.1 Extend `src/frontend/src/stores/auth.ts` with UUID claiming logic and account creation
  - [ ] 6.2 Add logout functionality that clears authentication state and generates new UUID
  - [ ] 6.3 Implement authentication status checking and automatic token refresh
  - [ ] 6.4 Add persistent session management with localStorage for authentication state
  - [ ] 6.5 Integrate UUID replacement logic for cross-device login scenarios
  - [ ] 6.6 Add error handling and retry logic for failed authentication attempts
  - [ ] 6.7 Write store tests in `src/frontend/src/stores/auth.test.ts` covering all authentication state management

- [ ] 7.0 User Interface Implementation
  - [ ] 7.1 Add authentication warnings to all anonymous user submission flows
  - [ ] 7.2 Implement login-required feature blocking with clear explanations and sign-in prompts
  - [ ] 7.3 Add logout confirmation modal with "Are you sure?" messaging
  - [ ] 7.4 Create user account status display showing authentication state and email verification
  - [ ] 7.5 Implement magic link email sent confirmation with resend functionality
  - [ ] 7.6 Add authentication error modals with specific error messages and recovery steps
  - [ ] 7.7 Update navigation and user interface to reflect authentication status throughout app

- [ ] 8.0 Rate Limiting & Security
  - [ ] 8.1 Implement rate limiting middleware for magic link requests using KV storage
  - [ ] 8.2 Add IP-based and email-based rate limiting with sliding window algorithm
  - [ ] 8.3 Implement magic link token security (secure generation, single-use, proper expiration)
  - [ ] 8.4 Add CSRF protection for authentication endpoints using request validation
  - [ ] 8.5 Implement basic email validation (@ and . characters) with normalization
  - [ ] 8.6 Add security headers and proper CORS configuration for authentication endpoints
  - [ ] 8.7 Create logging for authentication events and security monitoring

- [ ] 9.0 Testing & Validation
  - [ ] 9.1 Run all unit tests and resolve any failures in authentication logic
  - [ ] 9.2 Perform integration testing of complete authentication flows (signup, login, logout)
  - [ ] 9.3 Test UUID claiming behavior and cross-device login scenarios
  - [ ] 9.4 Validate rate limiting effectiveness and proper error responses
  - [ ] 9.5 Test magic link email delivery and token validation edge cases
  - [ ] 9.6 Perform accessibility testing on all authentication UI components
  - [ ] 9.7 Create documentation in `docs/authentication.md` covering implementation details and troubleshooting
