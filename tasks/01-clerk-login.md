# Clerk for Social login

The existing login system using resend for email magic links isn't working well.
I want to replace it with the Clerk system

Review https://clerk.com/docs/vue/getting-started/quickstart

Have a system for linking existing users to the user to clerk user tokens

I have created the "admin_dashboard" that is part of the "admin" permission
I have created the "moderator_dashboard" that is part of the "admin", and "moderator" permissions

I have added the 'VITE_CLERK_PUBLISHABLE_KEY' to the .env
I have added the 'CLERK_OAUTH_CLIENT_SECRET' to the .env with the following scopes: email, openid, private_metadata, profile, public_metadata

Discovery URL: https://enabled-teal-74.clerk.accounts.dev/.well-known/openid-configuration
Authorize URL: https://enabled-teal-74.clerk.accounts.dev/oauth/authorize
Token URL: https://enabled-teal-74.clerk.accounts.dev/oauth/token
User Info URL: https://enabled-teal-74.clerk.accounts.dev/oauth/userinfo
Token Introspection URL https://enabled-teal-74.clerk.accounts.dev/oauth/token_info

## Planning Questions & Answers (1-20)

**1. Which Clerk authentication methods should we implement?**
Answer: A - OAuth providers (Google, GitHub, Discord) + email/password (recommended for social login focus)

**2. How should we handle the transition period for existing users?**
Answer: B - Force all users to create new accounts

**3. What should happen to existing magic link records during migration?**
Answer: B - Immediately invalidate all existing magic links, and remove the old system

**4. How should we map Clerk user data to your existing user structure?**
Answer: C - Keep existing UUID system, store Clerk ID as additional field

**5. Which Clerk features should we implement for admin/moderator roles?**
Answer: A - Clerk Organizations with custom roles (admin_dashboard, moderator_dashboard) (recommended)

**6. How should we handle the frontend authentication state management?**
Answer: A - Replace Pinia auth store with Clerk's Vue composables (recommended)

**7. What should we do with the existing session management system?**
Answer: A - Replace with Clerk's JWT tokens and session handling (recommended)

**8. How should we handle the development vs. production Clerk configuration?**
Answer: A - Separate Clerk applications for dev/staging/prod with environment-specific keys (recommended)

**9. Which OAuth providers should we prioritize for implementation?**
Answer: A - Google, GitHub, Discord (developer-focused audience) (recommended)

**10. How should we handle the existing anonymous user token system?**
Answer: A - Keep anonymous tokens until user signs in, then link submissions to Clerk account (recommended)

**11. What should happen to the existing email notification system?**
Answer: B - Replace all emails with Clerk's system

**12. How should we structure the Clerk middleware integration?**
Answer: A - Replace auth middleware with Clerk JWT verification (recommended)

**14. How should we handle user deletion and data privacy?**
Answer: B - Manual deletion process through admin interface

**15. What's the rollback strategy if Clerk integration fails?**
Answer: No rollback - commit to Clerk implementation

**16. How should we handle the existing rate limiting system for authentication?**
Answer: A - Remove auth rate limiting, rely on Clerk's built-in protection (recommended)

**17. Which Clerk webhooks should we implement for user lifecycle management?**
Answer: C - All available webhooks for complete sync

**18. How should we handle the migration of existing user permissions/roles?**
Answer: D - Reset all permissions, require admin re-approval

**19. Should we maintain backward compatibility with existing API authentication?**
Answer: B - Immediate cutover to Clerk-only authentication

**20. How should we test the Clerk integration before deployment?**
Answer: C - Local development testing only

## Planning Questions & Answers (21-40)

**21. How should we structure the Clerk integration in the Vue frontend?**
Answer: A - Install @clerk/vue, wrap App.vue with ClerkProvider, use useAuth() composable (recommended)

**22. Which Clerk prebuilt components should we use vs. custom components?**
Answer: A - Use SignIn, SignUp, UserButton components with custom styling (recommended)

**23. How should we handle the user profile/settings page integration?**
Answer: B - Keep existing UI, populate with Clerk user data

**24. What's the approach for handling Clerk user metadata for roles?**
Answer: A - Store roles in publicMetadata for client access, sensitive data in privateMetadata (recommended)

**25. How should we implement the admin dashboard authentication?**
Answer: A - Clerk Organizations with admin role, protect routes with useOrganization() (recommended)

**26. What's the strategy for handling Clerk webhook security?**
Answer: A - Verify webhook signatures using Clerk's webhook secret (recommended)

**27. How should we handle user onboarding flow after Clerk signup?**
Answer: A - Redirect to custom onboarding page, create user record via webhook (recommended)

**28. What's the approach for handling organization invitations for moderators?**
Answer: A - Admin users send organization invites through Clerk dashboard (recommended)

**29. How should we handle the submission linking for anonymous users?**
Answer: B - Prompt users to claim submissions during signup

**30. What's the strategy for handling Clerk session tokens in API requests?**
Answer: A - Use getToken() from useAuth, send as Authorization Bearer header (recommended)

**31. How should we handle the development environment Clerk setup?**
Answer: A - Separate dev Clerk instance with test OAuth apps and webhooks to localhost (recommended)

**32. What's the approach for handling Clerk error states and edge cases?**
Answer: A - Custom error boundaries with fallback to app error pages (recommended)

**33. How should we implement the logout functionality?**
Answer: A - Use Clerk's signOut() method, clear any app-specific state (recommended)

**34. What's the strategy for handling Clerk's rate limiting on the backend?**
Answer: D - No special handling, rely on Clerk's error responses

**35. How should we handle the mobile responsiveness of Clerk components?**
Answer: A - Use Clerk's responsive components with custom CSS overrides (recommended)

**36. What's the approach for handling Clerk organization switching for multi-role users?**
Answer: A - Single organization with multiple roles per user (recommended)

**37. How should we implement the "remember me" functionality?**
Answer: A - Rely on Clerk's session persistence and refresh tokens (recommended)

**38. What's the strategy for handling Clerk's TypeScript integration?**
Answer: A - Use @clerk/types for proper typing, extend interfaces as needed (recommended)

**39. How should we handle the search and filtering of users in admin interface?**
Answer: A - Use Clerk's Dashboard for user management, link to app-specific data (recommended)

**40. What's the approach for monitoring and logging Clerk integration?**
Answer: A - Clerk Dashboard analytics + custom logging for app-specific events (recommended)

## Planning Questions & Answers (41-60)

**41. What's the sequence for deploying the Clerk integration to production?**
Answer: B - Complete replacement in single deployment

**42. How should we handle existing user sessions during the cutover?**
Answer: C - Allow old sessions to expire naturally

**43. What's the strategy for communicating the authentication change to users?**
Answer: D - No communication, users discover organically

**44. How should we handle users who can't access their old email accounts?**
Answer: D - No recovery process available

**45. What's the approach for testing OAuth provider integrations?**
Answer: B - Manual testing with personal accounts

**46. How should we handle Clerk service outages or downtime?**
Answer: A - Display maintenance page, no fallback authentication (recommended)

**47. What's the strategy for handling GDPR and user data deletion requests?**
Answer: A - Clerk handles GDPR deletion, webhook triggers app data cleanup (recommended)

**48. How should we handle the transition of anonymous submission claims?**
Answer: No anonymous submission claims

**49. What's the approach for handling different user timezone preferences?**
Answer: A - Store timezone in Clerk user metadata, use for date formatting (recommended)

**50. How should we handle bulk user operations for administrators?**
Answer: A - Clerk Admin Dashboard for user management, custom API for app-specific bulk operations (recommended)

**51. What's the strategy for handling user profile images?**
Answer: A - Use Clerk's profile image system with fallbacks (recommended)

**52. How should we handle the search functionality for artwork by user?**
Answer: B - Maintain user search index separately (searching artworks/artists is outside the scope of Clerk)

**53. What's the approach for handling password reset flows?**
Answer: A - Clerk handles all password resets, no custom implementation needed (recommended)

**54. How should we handle multi-factor authentication requirements?**
Answer: A - Enable MFA in Clerk settings, make optional for users initially (recommended)

**55. What's the strategy for handling API versioning with Clerk?**
Answer: A - Single API version with Clerk integration, deprecate old endpoints (recommended)

**56. How should we handle Clerk's webhook retry logic and failures?**
Answer: A - Implement idempotent webhook handlers with proper error responses (recommended)

**57. What's the approach for handling user email verification status?**
Answer: A - Trust Clerk's email verification, update user records accordingly (recommended)

**58. How should we handle the submission moderation workflow with new user system?**
Answer: A - Update moderation queries to use Clerk user IDs, maintain existing workflow (recommended)

**59. What's the strategy for handling user analytics and tracking?**
Answer: A - Clerk user ID as primary identifier, integrate with existing analytics (recommended)

**60. How should we handle the final cleanup of the old authentication system?**
Answer: A - Remove all magic link code, database tables, and related infrastructure after 30 days (recommended)

## Key Principle

### Authentication = Clerk | User Data/Content = Existing System

Everything to do with auth is handled by Clerk, while anything to do with user profile data, artworks, or artists is handled by the existing system.

## Implementation Plan

### Phase 1: Clerk Setup & Configuration

#### 1.1 Clerk Account Setup
- [ ] Create separate Clerk applications for dev/staging/prod environments
- [ ] Configure OAuth providers: Google, GitHub, Discord
- [ ] Enable email/password authentication
- [ ] Set up Clerk Organizations with roles: `admin_dashboard`, `moderator_dashboard`
- [ ] Configure webhook endpoints for user lifecycle events

#### 1.2 Environment Configuration
- [ ] Add Clerk environment variables to all environments:
  - `VITE_CLERK_PUBLISHABLE_KEY` (frontend)
  - `CLERK_SECRET_KEY` (backend)
  - `CLERK_WEBHOOK_SECRET` (backend)
- [ ] Update development webhook URLs to point to localhost
- [ ] Configure production webhook URLs

### Phase 2: Backend Integration

#### 2.1 Remove Existing Auth System
- [ ] Delete magic link authentication endpoints:
  - `POST /api/auth/request-magic-link`
  - `POST /api/auth/verify-magic-link`
  - `GET /api/auth/dev-magic-link`
- [ ] Remove rate limiting for authentication (rely on Clerk's protection)
- [ ] Delete auth middleware in `src/workers/middleware/auth.ts`
- [ ] Remove email authentication libraries:
  - `src/workers/lib/email-auth.ts`
  - `src/workers/lib/resend-email.ts`

#### 2.2 Clerk JWT Middleware
- [ ] Install `@clerk/backend` for Workers
- [ ] Create new JWT verification middleware to replace existing auth
- [ ] Update all protected routes to use Clerk JWT validation
- [ ] Extract Clerk user ID and store in request context

#### 2.3 Database Schema Updates
- [ ] Add `clerk_user_id` column to `users` table
- [ ] Keep existing UUID system for backward compatibility
- [ ] Update user creation to link Clerk ID with internal UUID
- [ ] Create migration script for new column

#### 2.4 Webhook Implementation
- [ ] Create webhook endpoint: `POST /api/webhooks/clerk`
- [ ] Implement webhook signature verification
- [ ] Handle all Clerk webhook events:
  - `user.created` - Create user record with Clerk ID
  - `user.updated` - Update user profile data
  - `user.deleted` - Clean up user data and submissions
  - `session.created` - Log user activity
  - `organizationMembership.created` - Handle role assignments

#### 2.5 User Management Updates
- [ ] Update user queries to support Clerk user ID lookup
- [ ] Modify permission system to work with Clerk Organizations
- [ ] Update admin endpoints to use Clerk user management
- [ ] Remove old session management code

### Phase 3: Frontend Integration

#### 3.1 Clerk Vue Integration
- [ ] Install `@clerk/vue` and `@clerk/types`
- [ ] Wrap `App.vue` with `ClerkProvider`
- [ ] Configure Clerk with environment variables and OAuth providers
- [ ] Set up proper TypeScript types for Clerk integration

#### 3.2 Replace Authentication Components
- [ ] Remove existing auth components:
  - `AuthModal.vue`
  - `MagicLinkVerify.vue`
- [ ] Implement Clerk prebuilt components:
  - `SignIn` component with custom styling
  - `SignUp` component with custom styling
  - `UserButton` for user menu
- [ ] Update navigation to use Clerk's authentication state

#### 3.3 Update Auth Store
- [ ] Replace Pinia auth store with Clerk's `useAuth()` composable
- [ ] Remove magic link related functions
- [ ] Update authentication state management to use Clerk
- [ ] Maintain anonymous user token system until sign-in

#### 3.4 Route Protection
- [ ] Update route guards to use Clerk authentication
- [ ] Protect admin routes with Clerk Organizations
- [ ] Handle unauthenticated states with Clerk redirects

#### 3.5 User Profile Integration
- [ ] Keep existing profile UI, populate with Clerk user data
- [ ] Use Clerk's profile image system
- [ ] Store additional preferences in Clerk user metadata
- [ ] Handle timezone preferences in Clerk metadata

### Phase 4: Data Migration & Cleanup

#### 4.1 User Data Migration
- [ ] Force all users to create new accounts (no migration)
- [ ] Reset all permissions, require admin re-approval
- [ ] No anonymous submission claims process

#### 4.2 Database Cleanup
- [ ] Remove magic link related tables:
  - `magic_links`
  - `rate_limiting` (auth-related only)
- [ ] Clean up old session data
- [ ] Remove unused authentication columns after 30 days

#### 4.3 Code Cleanup
- [ ] Remove all magic link authentication code
- [ ] Delete unused email templates
- [ ] Remove authentication rate limiting
- [ ] Clean up old middleware and utilities

### Phase 5: Testing & Deployment

#### 5.1 Local Testing
- [ ] Manual testing with personal accounts for all OAuth providers
- [ ] Test role assignments and permissions
- [ ] Verify webhook functionality with local endpoints
- [ ] Test error handling and edge cases

#### 5.2 Production Deployment
- [ ] Complete replacement in single deployment
- [ ] Allow old sessions to expire naturally
- [ ] No user communication about changes
- [ ] Display maintenance page during Clerk outages

#### 5.3 Post-Deployment
- [ ] Monitor Clerk Dashboard analytics
- [ ] Verify webhook events are processing correctly
- [ ] Confirm user registration and role assignment workflows
- [ ] Test admin dashboard access with Organizations

### Phase 6: Maintenance & Monitoring

#### 6.1 Ongoing Maintenance
- [ ] Use Clerk Dashboard for user management
- [ ] Handle GDPR requests through Clerk with webhook cleanup
- [ ] Monitor authentication analytics through Clerk
- [ ] Regular security review of webhook endpoints

#### 6.2 Future Enhancements
- [ ] Optional MFA for users
- [ ] Additional OAuth providers as needed
- [ ] Enhanced role management through Clerk Organizations
- [ ] Integration with additional Clerk features

## Technical Notes

### Authentication Flow
1. User authenticates via Clerk (OAuth or email/password)
2. Clerk JWT token sent with API requests
3. Backend validates JWT and extracts Clerk user ID
4. Internal user record linked via Clerk ID
5. Existing permission system works with Clerk Organizations

### Data Separation
- **Clerk Handles**: Authentication, user sessions, profile images, basic user info
- **App Handles**: Artwork data, submissions, artist information, moderation workflows

### Error Handling
- Clerk outages = maintenance page
- No fallback authentication system
- Custom error boundaries for Clerk component failures
- Proper webhook error responses for retry logic

### Security
- Webhook signature verification required
- JWT validation on all protected endpoints
- Remove old authentication rate limiting
- Trust Clerk's built-in security features

