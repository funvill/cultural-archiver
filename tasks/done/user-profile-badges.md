# PRD: User Profile & Badges System

## Executive Summary

Introduce **user profile pages** with unique profile names and a **badge system** that rewards users for completing defined tasks. This adds personalization, gamification, and community recognition to the platform.

**MVP Scope**: Focus on authenticated users with verified emails, activity badges only, and real-time badge calculation for streamlined delivery.

---

## Problem Statement

Currently, users have no way to personalize their identity or showcase their contributions. There is also no incentive system to encourage continued engagement. By adding profile names and badges, we give users a sense of ownership and accomplishment, motivating them to participate more actively.

---

## Solution Overview

**MVP Scoping Decisions:**

- **User Base**: Authenticated users with verified emails only
- **Badge Categories**: Activity badges only (submission count, photo uploads)
- **Database Design**: Two tables (badges definitions + user_badges awards)
- **Profile Pages**: New public `/users/[uuid]` pages
- **Badge Calculation**: Real-time on submission events
- **Conflict Resolution**: Reject profile name conflicts with no suggestions

1. **User Profiles**
   - Add a **Profile Name** field to the existing `users` table.
   - Users can edit their profile name from their profile page.
   - Profile names must be **unique** across the system.
   - Allowed characters: `a–z`, `A–Z`, `0–9`, and `-`.
   - Cannot start or end with `-`.
   - Maintain a **list of banned names** (e.g., `admin`, `moderator`, `boss`, `mod`, etc.) to prevent impersonation.
   - Profile names are:
     - Changeable at any time, with uniqueness validation.
     - Must be between **3–20 characters** long.
     - Case-insensitive (stored in lowercase), though user capitalization can be preserved for display.
     - Checked for availability in real-time during input.
     - **Conflicts are rejected** with no auto-suggestions or reservation system.
   - **MVP Constraint**: Only available to authenticated users with verified emails.

2. **Badges System**
   - Users earn **Activity Badges** when they complete submission-related milestones.
   - **MVP Focus**: Submission count and photo upload badges only.
   - Badges can **only be awarded**, never removed.
   - Badges have **visual icons**; emojis used for MVP.
   - Badges are **public by default** and displayed on user profiles.
   - Badges support **progressive levels** (e.g., Level 1 = 1 submission, Level 2 = 5 submissions).
   - Users are notified when they earn a badge, but do **not** see progress tracking until the badge is achieved.
   - Badge eligibility calculated **real-time** on each submission.
   - All badges are **permanent** once awarded.
   - **Future**: Seasonal badges, geographic badges, community badges deferred to Phase 2.
3. **Notifications & Visibility**
   - Users are notified **in-app only** when they earn a badge.
   - Badge awards include a **small celebratory animation** (e.g., confetti or pop-up).
   - No email or external notifications.
   - No social sharing options in MVP.
   - Badges are **only visible on public profile pages** at `/users/[uuid]`, not in comments or other contexts.
   - Badges are visible but cannot be commented on or reacted to by others.

4. **Badge Management & Governance**
   - The **badge list** is defined manually by admins (rules, thresholds, descriptions).
   - **MVP Focus**: New activity tracking only (no retroactive awards in Phase 1).
   - Badges are always awarded **automatically**, never manually by admins.
   - Every badge award is logged with a **timestamp + reason** (milestone, seasonal, etc.).
   - No admin dashboard in MVP — management handled directly in the database.

5. **Profile Page Display**
   - **New public pages** at `/users/[uuid]` display profile name and badges.
   - Badges are shown in a **grid layout** with icon + title.
   - All earned badges are displayed (no subsets or "view more").
   - Only **earned badges** are visible; unearned badges are not shown.
   - **MVP**: All badges displayed equally with no special styling.

6. **MVP Implementation Scope**
   - **Database Schema**: Add `profile_name` to `users` table, create `badges` and `user_badges` tables.
   - **Initial Badge Types**:
     - Submission count badges (1, 5, 15, 50 submissions)
     - Photo upload badges (1, 10, 25, 100 photos)
     - Email verification badge
     - Early adopter badge (account age)
   - **Profile Name Validation**: 3-20 chars, a-z/A-Z/0-9/dash only, no start/end dash, unique, banned list checking.
   - **Real-time Calculation**: Badge eligibility checked on every submission event.
   - **Public Profile Pages**: New frontend routes at `/users/[uuid]` for public viewing.
   - **No Retroactive Awards**: Focus on new activity tracking to simplify MVP.

7. **Phase 2 Roadmap**
   - Retroactive badge awards for existing users.
   - Seasonal and geographic badges.
   - Community badges (login streaks, account milestones).
   - Admin dashboard for badge management.
   - Social sharing and leaderboards.
   - Custom badge icons beyond emojis. **Phase 2**.\
   - Future enhancement: allow showing **locked badges** for motivation.\
   - Future enhancement: introduce **custom-designed badge icons** beyond emojis.

---

## User Flows

**MVP User Flows:**

1. **Profile Name Setup**
   - Authenticated user with verified email visits their profile page.
   - They enter a profile name following validation rules (3-20 chars, alphanumeric + dash).
   - System validates: uniqueness, allowed characters, banned names, and length requirements.
   - If valid, the profile name is saved and public profile becomes accessible at `/users/[uuid]`.
   - **Conflicts are rejected** with error message, no auto-suggestions provided.

2. **Earning a Badge (Real-time)**
   - System tracks user activity on each submission (artwork discoveries, photo uploads).
   - When milestone conditions are met (e.g., 5 submissions), badge eligibility is calculated immediately.
   - Badge is automatically awarded and added to `user_badges` table with timestamp and reason.
   - User receives an in-app notification with celebratory animation on next page interaction.

3. **Viewing Badges**
   - Public profile pages at `/users/[uuid]` display profile name and earned badges.
   - Badges shown in **grid layout** with emoji icon, title, and description.
   - Only **earned badges** are visible (no progress tracking or locked badge previews).
   - **MVP**: Simple display with no special styling or badge categories.

---

## Success Metrics

**MVP Success Metrics:**

- % of verified users who claim a profile name
- % of users earning at least one activity badge
- Increase in submission frequency after badge system launch
- Public profile page engagement and visit patterns

---

## Final Scope Decisions

**✅ MVP Phase 1 - APPROVED:**

- **User Base**: Authenticated users with verified emails only
- **Badge Types**: Activity badges only (submissions, photos, verification, account age)
- **Database Design**: Two tables (badges definitions + user_badges awards)
- **Profile Pages**: New public `/users/[uuid]` pages
- **Badge Calculation**: Real-time on submission events
- **Profile Name Conflicts**: Reject with no suggestions or reservations
- **No Retroactive Awards**: Focus on new activity tracking

**❌ MVP Phase 1 - DEFERRED:**

- Anonymous user badge tracking
- Seasonal and geographic badges
- Retroactive badge awards for existing activity
- Community badges (login streaks, social actions)
- Admin dashboard for badge management
- Social sharing and leaderboards
- Advanced profile name conflict resolution

**🔄 Phase 2 - FUTURE CONSIDERATION:**

- ✅ **Yes**: Retroactive awards for existing users
- ✅ **Yes**: Seasonal and geographic badge categories
- ✅ **Yes**: Admin dashboard for badge management
- ✅ **Yes**: Locked badge previews for motivation
- ✅ **Yes**: Custom-designed badge icons beyond emojis
- ✅ **Yes**: Badge export API with full details
- ✅ **Yes**: Social sharing and leaderboard features

---

## Tasks

### Phase 1: Analysis & Planning

- [ ] 1.0 Database Schema & Migration Setup
  - [ ] 1.1 Apply database migration 0023_user_profiles_badges.sql to development environment
  - [ ] 1.2 Verify migration creates tables (users.profile_name, badges, user_badges) with proper indexes
  - [ ] 1.3 Test migration rollback strategy and document any constraints
  - [ ] 1.4 Update database.md documentation with new schema sections

### Phase 2: Backend Foundation

- [ ] 2.0 TypeScript Types & Validation
  - [ ] 2.1 Complete badge-related types in src/shared/types.ts (BadgeRecord, UserBadgeRecord already added)
  - [ ] 2.2 Add badge API request/response interfaces (BadgeListResponse, UserBadgeResponse, ProfileUpdateRequest)
  - [ ] 2.3 Create profile name validation schema using Zod in src/workers/middleware/validation.ts
  - [ ] 2.4 Create banned names list constant in src/shared/constants.ts
  - [ ] 2.5 Add profile name validation rules (3-20 chars, alphanumeric + dash, no start/end dash)

- [ ] 3.0 Badge Calculation Engine
  - [ ] 3.1 Create badge calculation service in src/workers/lib/badges.ts
  - [ ] 3.2 Implement submission count badge calculation logic
  - [ ] 3.3 Implement photo count badge calculation logic
  - [ ] 3.4 Implement verification and account age badge logic
  - [ ] 3.5 Create badge award function with database persistence and logging
  - [ ] 3.6 Add real-time badge checking integration points for submission events

- [ ] 4.0 Backend API Endpoints
  - [ ] 4.1 Add GET /api/users/:uuid endpoint for public profile viewing
  - [ ] 4.2 Add PATCH /api/me/profile endpoint for profile name updates
  - [ ] 4.3 Add GET /api/me/badges endpoint for user's badge collection
  - [ ] 4.4 Add GET /api/badges endpoint for available badge definitions
  - [ ] 4.5 Integrate profile name validation with conflict checking in user routes
  - [ ] 4.6 Update src/workers/index.ts with new route mappings

### Phase 3: Frontend Implementation

- [ ] 5.0 Frontend Services & API Integration
  - [ ] 5.1 Add badge-related API methods to src/frontend/src/services/api.ts
  - [ ] 5.2 Add profile name API methods (get, update, check availability)
  - [ ] 5.3 Create badge notification service for in-app celebrations
  - [ ] 5.4 Update frontend types in src/frontend/src/types/index.ts

- [ ] 6.0 Public Profile Pages
  - [ ] 6.1 Create PublicProfileView.vue component for /users/:uuid routes
  - [ ] 6.2 Add profile header with profile name display
  - [ ] 6.3 Create BadgeGrid.vue component for displaying earned badges
  - [ ] 6.4 Create individual BadgeCard.vue component with icon, title, description
  - [ ] 6.5 Add route configuration in src/frontend/src/router/index.ts
  - [ ] 6.6 Handle user not found and invalid UUID scenarios

- [ ] 7.0 Profile Management UI
  - [ ] 7.1 Add profile name editing section to existing ProfileView.vue
  - [ ] 7.2 Create ProfileNameEditor.vue component with real-time validation
  - [ ] 7.3 Implement profile name availability checking with debounced API calls
  - [ ] 7.4 Add profile name conflict error handling (reject with clear messaging)
  - [ ] 7.5 Show current badges in user's private profile page

- [ ] 8.0 Badge Notification System
  - [ ] 8.1 Create BadgeNotification.vue component with celebratory animation
  - [ ] 8.2 Add notification state management to Pinia store
  - [ ] 8.3 Integrate badge award detection with submission success flows
  - [ ] 8.4 Implement confetti or pop-up animation for badge awards
  - [ ] 8.5 Add badge notification polling or SSE for real-time updates

### Phase 4: Integration & Testing

- [ ] 9.0 Submission Event Integration
  - [ ] 9.1 Hook badge calculation into submission creation workflows
  - [ ] 9.2 Hook badge calculation into photo upload completions
  - [ ] 9.3 Hook badge calculation into email verification events
  - [ ] 9.4 Test badge awards trigger correctly on milestone achievements
  - [ ] 9.5 Verify badge persistence and no duplicate awards

- [ ] 10.0 Testing & Quality Assurance
  - [ ] 10.1 Write unit tests for badge calculation logic in src/workers/lib/**tests**/
  - [ ] 10.2 Write API endpoint tests for profile and badge routes
  - [ ] 10.3 Write frontend component tests for badge display and profile editing
  - [ ] 10.4 Write integration tests for real-time badge award flow
  - [ ] 10.5 Test profile name validation edge cases and banned names
  - [ ] 10.6 Test public profile page accessibility and responsiveness

### Phase 5: Documentation & Deployment

- [ ] 11.0 Documentation Updates
  - [ ] 11.1 Update API documentation in docs/api.md with new endpoints
  - [ ] 11.2 Update database documentation in docs/database.md with badge tables
  - [ ] 11.3 Create user guide section for profile names and badges
  - [ ] 11.4 Update frontend architecture docs with new components and flows

- [ ] 12.0 Production Deployment Preparation
  - [ ] 12.1 Test database migration on staging environment
  - [ ] 12.2 Verify frontend build includes new routes and components
  - [ ] 12.3 Test badge calculation performance under load
  - [ ] 12.4 Verify CORS and security headers for new endpoints
  - [ ] 12.5 Create deployment checklist and rollback plan

---

## Relevant Files

### Backend Files (Create)

- `src/workers/lib/badges.ts` - Badge calculation and award logic
- `src/workers/lib/__tests__/badges.test.ts` - Badge logic unit tests
- `src/workers/routes/__tests__/profile.test.ts` - Profile API endpoint tests

### Backend Files (Modify)

- `src/shared/types.ts` - Add badge API types and profile name interfaces
- `src/shared/constants.ts` - Add banned profile names list
- `src/workers/middleware/validation.ts` - Add profile name validation schemas
- `src/workers/routes/user.ts` - Add profile management endpoints
- `src/workers/index.ts` - Add new route mappings
- `src/workers/migrations/0023_user_profiles_badges.sql` - Database schema (already created)

### Frontend Files (Create)

- `src/frontend/src/views/PublicProfileView.vue` - Public profile page
- `src/frontend/src/components/BadgeGrid.vue` - Badge display grid
- `src/frontend/src/components/BadgeCard.vue` - Individual badge component
- `src/frontend/src/components/ProfileNameEditor.vue` - Profile name editing
- `src/frontend/src/components/BadgeNotification.vue` - Badge award celebration
- `src/frontend/tests/views/PublicProfileView.spec.ts` - Public profile tests
- `src/frontend/tests/components/BadgeGrid.spec.ts` - Badge display tests

### Frontend Files (Modify)

- `src/frontend/src/services/api.ts` - Add badge and profile API methods
- `src/frontend/src/types/index.ts` - Add frontend badge types
- `src/frontend/src/router/index.ts` - Add public profile routes
- `src/frontend/src/views/ProfileView.vue` - Add profile name editing section
- `src/frontend/src/stores/auth.ts` - Add badge notification state

### Documentation Files (Modify)

- `docs/api.md` - Document new profile and badge endpoints
- `docs/database.md` - Document badge system tables and relationships
- `docs/frontend-architecture.md` - Document new components and flows

---

## Implementation Notes

### Database Migration Strategy

- Migration 0023 already created with proper indexes and constraints
- Use existing migration system via npm scripts (database:migration:dev)
- Badge definitions pre-populated with initial activity badges

### Authentication Integration

- Leverage existing email verification checking in requireEmailVerification middleware
- Use existing getUserToken() and getAuthContext() patterns for authenticated endpoints
- Public profile pages accessible without authentication

### Frontend Architecture Patterns

- Follow existing Vue 3 Composition API patterns from ProfileView.vue
- Use established Pinia store patterns for state management
- Follow existing component organization (views/ for pages, components/ for reusable)
- Use existing API service patterns with proper error handling

### Badge Calculation Strategy

- Real-time calculation on submission events (not background jobs)
- Integrate with existing submission workflow in routes/submissions.ts
- Use database queries to count achievements (submissions, photos)
- Award badges immediately but notify user on next page interaction

### Validation Patterns

- Use existing Zod schema patterns from middleware/validation.ts
- Profile name validation: /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/ (3-20 chars)
- Banned names checking via array lookup in constants
- Real-time availability checking with debounced API calls

### Testing Strategy

- Follow existing test patterns in src/workers/test/ and src/frontend/tests/
- Unit tests for badge calculation logic with mock data
- Integration tests for API endpoints using existing testing framework
- Component tests using Vue Test Utils patterns from existing tests
