# PRD: Authentication System

## Introduction/Overview

The Cultural Archiver needs a simple, privacy-focused authentication system that supports two user types: anonymous users and logged-in users. The system must allow users to claim ownership of their submissions without requiring extensive personal information, while providing secure access to enhanced features for authenticated users.

The authentication system will use a UUID-based approach with optional email verification via magic links. Users can only claim anonymous submissions at the moment of account creation when their current browser UUID is associated with their email address. The system is designed with clear interfaces to allow replacement with alternative authentication systems in the future.

## Goals

1. **Minimize friction**: Anonymous users can immediately use the site without any registration
2. **Enable ownership**: Users can claim their submissions by associating their UUID with an email address at account creation only
3. **Maintain privacy**: Require minimal personal information (only email for authenticated users)
4. **Secure access**: Provide secure authentication for enhanced features
5. **Simple recovery**: Users can recover access to their content via email-based magic links
6. **Clear user education**: Anonymous users understand the benefits of creating an account
7. **Future flexibility**: Design authentication interfaces to allow easy replacement with alternative systems

## User Stories

### Anonymous User Stories

- As an anonymous visitor, I want to immediately use the site without creating an account, so I can quickly submit content
- As an anonymous user, I want to see a warning when submitting content, so I understand I should create an account to keep track of my submissions
- As an anonymous user, I want to easily sign up when I'm ready, so I can claim ownership of my current browser's submissions

### Logged-in User Stories

- As a logged-in user, I want to see all my submissions that were made when I created my account, so I can track my contributions
- As a logged-in user, I want to access enhanced features not available to anonymous users, so I get additional value from having an account
- As a logged-in user, I want to log in on multiple devices simultaneously, so I can access my account from anywhere
- As a logged-in user, I want to recover my account via email if I lose access, so I don't lose my submission history
- As a logged-in user, I understand that submissions made on different browsers before login cannot be claimed retroactively

## Functional Requirements

### Core Authentication Flow

1. **Anonymous UUID Generation**: The system must generate a unique UUID for every user on their first page visit and store it in a persistent cookie that never expires (until manually cleared)

2. **Account Creation with UUID Claiming**: When a user creates an account by entering their email, the system must permanently associate their current browser UUID with their email address (one UUID per email address)

3. **Magic Link Authentication**: The system must allow existing users to authenticate by entering their email address and receiving a one-time magic link that expires after 1 hour

4. **UUID Replacement on Login**: When a user logs in via magic link and their browser has a different UUID than their account UUID, the system must silently replace the browser UUID with the account UUID

5. **One-time Claiming Window**: Users can only claim anonymous submissions at the moment of account creation when their current browser UUID is associated with their email - submissions made with different UUIDs cannot be claimed retroactively

6. **Session Management**: User login sessions must persist until explicit logout, and users can be logged in on multiple devices simultaneously

### Security Requirements

7. **One-time Magic Links**: Magic links must be invalidated after a single use, even if not expired

8. **Magic Link Expiration**: Magic links must expire after exactly 1 hour from generation

9. **Rate Limiting**: The system must limit magic link requests to prevent abuse:
   - Maximum 5 magic link requests per email address per hour
   - Maximum 10 magic link requests per IP address per hour

10. **Secure Token Generation**: Magic link tokens must be cryptographically secure random tokens (minimum 32 bytes)

11. **Basic Email Validation**: The system must validate email addresses using basic format checking (contains @ and . characters)

### User Interface Requirements

12. **Anonymous User Warning**: The system must display a warning on every submission attempt by anonymous users, explaining they should create an account to track their submissions (no dismissal option)

13. **Login Access Control**: When anonymous users attempt to access login-only features, the system must show an explanation with a "Sign In" button

14. **Logout Confirmation**: The system must show a simple "Are you sure?" confirmation when users attempt to log out

15. **Authentication Error Handling**: The system must display modal dialogs explaining authentication issues and providing clear next steps for resolution

### Data Management Requirements

16. **Instant Transition**: When users log in and their UUID is replaced, the system must provide instant access to their account content without loading states

17. **Persistent Sessions**: User authentication state must persist across browser sessions until explicit logout

18. **Multiple Magic Links**: If users request multiple magic links before using the first one, all links must share the same 1-hour expiration from the first request

19. **Cross-device Compatibility**: Users must be able to access their account from multiple devices simultaneously without session conflicts

### System Architecture Requirements

20. **Modular Authentication Interface**: The authentication system must implement clear interfaces and abstractions to allow replacement with alternative authentication systems in the future

21. **Separation of Concerns**: Authentication logic must be separated from business logic to enable independent testing and replacement

22. **Standardized User Context**: The system must provide a consistent user context interface that abstracts the underlying authentication implementation

## Non-Goals (Out of Scope)

- **Password-based authentication**: This system will not use passwords or password reset functionality
- **Social media login**: No integration with Google, Facebook, or other OAuth providers
- **Account recovery for lost email access**: If users lose access to their email, their account cannot be recovered
- **Multiple UUID merging**: Users cannot merge content from multiple UUIDs - one email = one UUID permanently
- **Retroactive claiming**: Users cannot claim submissions made with different UUIDs after account creation
- **Email verification beyond magic links**: No separate email verification process beyond successful magic link usage
- **Advanced security features**: No two-factor authentication, security questions, or account lockout mechanisms
- **User profile management**: No user profile editing, avatar uploads, or personal information storage beyond email
- **Moderator system**: Moderation functionality is out of scope for this PRD and will be addressed separately

## Design Considerations

### User Experience Flow

1. **First Visit**: User gets UUID cookie → can immediately submit content → sees warning about account benefits
2. **Account Creation**: User enters email → receives magic link → clicks link → automatically logged in and current UUID claimed
3. **Return Visit on Same Browser**: Authenticated user sees all their content → can access enhanced features
4. **Login on Different Browser**: User enters email → receives magic link → clicks link → browser UUID replaced with account UUID → sees their account content
5. **Logout**: User confirms logout → gets new UUID → becomes anonymous again (but can recover via magic link)

### Error States

- Invalid email format: Clear inline validation message
- Magic link expired: Explanation with option to request new link
- Magic link already used: Explanation with option to request new link
- Rate limit exceeded: Clear message with time until next request allowed
- Authentication required: Modal explaining benefits of logging in with sign-in option
- UUID mismatch scenarios: Silent handling with no user-visible errors

### Security Considerations

- Magic link tokens can appear in URLs since they are single-use and short-lived (1 hour expiration)
- Server logs must not store magic link tokens to prevent exposure
- Email provider security is outside system control but should be documented as user responsibility

## Technical Considerations

### Database Schema Requirements

- User table with: uuid (primary key), email (unique), created_at, last_login
- Magic link table with: token (primary key), email, created_at, used_at (nullable), expires_at
- Rate limiting table with: identifier (email or IP), request_count, window_start

### API Endpoints Needed

- `POST /auth/request-magic-link` - Request magic link (with rate limiting)
- `POST /auth/verify-magic-link` - Verify and consume magic link token
- `POST /auth/logout` - Clear user session
- `GET /auth/status` - Check current authentication status

### Integration Points

- Email service for sending magic links
- Session management for maintaining login state
- Existing submission system to associate content with UUIDs
- Authentication abstraction layer for future system replacement

## Success Metrics

### User Engagement

- **Account creation rate**: 15% of anonymous users create accounts within their first session
- **Content claiming**: 90% of users who create accounts successfully see their claimed submissions
- **Return user rate**: 60% of authenticated users return within 30 days

### System Performance

- **Magic link delivery**: 95% of magic links delivered within 2 minutes
- **Authentication success rate**: 98% of valid magic links result in successful login
- **Rate limiting effectiveness**: Less than 1% of magic link requests blocked due to abuse

### Security Metrics

- **Magic link misuse**: Zero successful authentication with expired or used tokens
- **Rate limiting accuracy**: All rate limiting rules enforced with 99.9% accuracy
- **Session security**: Zero unauthorized access to user accounts

## Open Questions

1. **Email service selection**: Which email service provider should be used for sending magic links (SendGrid, Mailgun, AWS SES)?

**Answer**: Use MailChannels integration with Cloudflare Workers (free, zero-setup email service specifically designed for Workers). Backup options: AWS SES for cost-effectiveness, Mailgun for simplicity, or SendGrid for enterprise features if advanced requirements emerge.

2. **Login-only feature definition**: Specific features that require authentication need to be defined in future requirements

3. **Analytics integration**: How should user authentication events be tracked for product analytics?

4. **GDPR compliance**: What data retention and user deletion capabilities are needed for privacy compliance?

5. **Magic link email templates**: Design and content for magic link emails need to be created

6. **Error logging**: What authentication errors should be logged for debugging and security monitoring?

7. **Performance monitoring**: What authentication performance metrics should be tracked and alerted on?

8. **Authentication interface design**: What specific interfaces and abstractions should be implemented to enable future system replacement?

9. **UUID collision handling**: How should the extremely rare case of UUID collisions be handled?

**Answer**: UUID v4 collisions are astronomically rare (1 in 2^122 probability). If a collision occurs during user registration, generate a new UUID and retry. Log collision events for monitoring but no special user messaging needed since the probability is effectively zero in practice.

10. **Cloudflare managed auth evaluation**: Why was Cloudflare Zero Trust Access not chosen over custom implementation?

**Answer**: Zero Trust costs $3/user/month making it prohibitively expensive for public applications, designed for enterprise internal apps not consumer-facing websites with anonymous users, and lacks support for custom UUID claiming logic. MailChannels integration with Cloudflare Workers provides free email delivery for magic links without additional authentication service costs.
