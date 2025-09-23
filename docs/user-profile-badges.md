# User Profiles & Badges (MVP)

This document consolidates the Product Requirements (PRD) in `tasks/user-profile-badges.md` and the current implementation details found in the codebase (migrations, backend BadgeService, and frontend components). It is intended for developers and integrators.

## Summary (what this feature provides)

- Public user profile pages at `/users/:uuid` with an optional `profile_name`.
- A simple activity-based badge system (MVP): submission count, photo uploads, email verification, and an early-adopter account-age badge.
- Badges are awarded automatically and permanently (never removed).
- Real-time calculation: eligibility is checked on submission events and when email verification occurs.
- Badges are public by default and displayed on public profile pages.

### Source of truth / Where to look in the repo

- Database migration that created the schema: `src/workers/migrations/0025_user_profiles_badges.sql` (also seeded in `_backup_database` dumps).
- Backend badge engine: `src/workers/lib/badges.ts` (BadgeService).
- Frontend display components: `src/frontend/src/components/BadgeGrid.vue` and `BadgeCard.vue`.
- Frontend API client methods: `src/frontend/src/services/api.ts` (endpoints: `/badges`, `/me/badges`, `/me/profile`, `/me/profile-check`, `/users/:uuid`).

### Database schema (important fields)

From `0025_user_profiles_badges.sql`:

- users.profile_name: optional, constrained to 3-20 alphanumeric characters, unique when present.

- badges table (badge definitions):
  - id (UUID primary key)
  - badge_key (unique short key)
  - title, description, icon_emoji
  - category (activity, community, seasonal, geographic)
  - threshold_type (submission_count, photo_count, account_age, email_verified)
  - threshold_value (nullable integer)
  - level (integer; 1+)
  - is_active (boolean)

- user_badges table (awards):
  - id (UUID)
  - user_uuid (FK -> users.uuid)
  - badge_id (FK -> badges.id)
  - awarded_at (timestamp)
  - award_reason (text)
  - metadata (JSON text, optional)
  - unique constraint on (user_uuid, badge_id)

Indexes were added for profile_name uniqueness, badge category/threshold lookups, and user_badges lookups.

### Seeded MVP badges

- Email Verified: `email_verified` (emoji: ✅)
- Submission badges: `submission_1`, `submission_5`, `submission_15`, `submission_50` (🎯, 🗺️, 🔍, 🏆)
- Photo badges: `photo_1`, `photo_10`, `photo_25`, `photo_100` (📸, 📷, 🎨, 🌟)
- Early Adopter: `early_adopter` (🌱) — account age 30 days

See migration for exact UUIDs and titles: `src/workers/migrations/0025_user_profiles_badges.sql`.

### Backend: BadgeService overview

File: `src/workers/lib/badges.ts`

- BadgeService is instantiated with the D1 database connection (`new BadgeService(db)`).
- Public methods used by the app:
  - getAllBadges(): returns active badge definitions.
  - getUserBadges(user_uuid): returns earned badges for a user (with awarded_at, award_reason, metadata).
  - calculateAndAwardBadges(context): core algorithm that checks eligibility and awards new badges.
  - checkSubmissionBadges(user_uuid, user_record?): used after submission events to award submission/photo badges.
  - checkEmailVerificationBadge(user_uuid): used after email verification to award that badge.
  - isProfileNameAvailable(profile_name, excluding_user_uuid?): used when setting a profile name.
  - updateProfileName(user_uuid, profile_name): atomic update after availability check.
  - getUserByUuid / getUserByProfileName: used to power public profile pages.
  - getBadgeStatistics, createBadge, updateBadge, deactivateBadge: admin helpers.

- Eligibility checks supported:
  - email_verified (boolean)
  - submission_count (counts approved submissions for user_token)
  - photo_count (sums json_array_length(photos) across approved submissions)
  - account_age (days since users.created_at)

- Awarding:
  - When a badge is awarded, a row is inserted into `user_badges` and an award_reason is generated.
  - The implementation prevents duplicates by checking existing user_badges before awarding.

Developer notes:

- The BadgeService uses real-time queries (COUNT and SUM on submissions). For very large historical datasets consider a cached counter on users to avoid heavy aggregation.
- Awarding is resilient: failures to record one badge are logged and won't stop other badges from being processed.

### Backend routes / integration points

- Public and authenticated endpoints (front-end calls these):
  - GET /badges -> list of badge definitions (apiService.getAllBadges())
  - GET /me/badges -> current user's earned badges (apiService.getUserBadges())
  - PATCH /me/profile -> update profile name (apiService.updateProfileName())
  - GET /me/profile-check?profile_name=... -> check availability (apiService.checkProfileNameAvailability())
  - GET /users/:uuid -> public user profile (includes badges array)

- Badge awarding integration points in backend codebase:
  - After a submission is approved (or on create when approvals are immediate), code should call BadgeService.checkSubmissionBadges(user_uuid, user_record) to calculate and award submission/photo badges.
  - After an email verification flow completes, call BadgeService.checkEmailVerificationBadge(user_uuid).

Search for usages of BadgeService in `src/workers/routes` and submission review code to confirm integration points.

### Frontend integration

Components:

- `BadgeGrid.vue` — a grid view used to show a user's earned badges. Props: `badges: UserBadgeResponse['user_badges']`, `loading`.
- `BadgeCard.vue` — individual badge card that shows emoji icon, title, description, level, award date, and a details popover.
- `ProfileNameEditor.vue` — UI for setting/updating `profile_name` (uses `apiService.updateProfileName` and `apiService.checkProfileNameAvailability`).

API client methods (frontend):

- `apiService.getAllBadges()` -> GET `/badges`
- `apiService.getUserBadges()` -> GET `/me/badges`
- `apiService.getPublicUserProfile(uuid)` -> GET `/users/:uuid` (returns profile info + badges array)
- `apiService.updateProfileName()` -> PATCH `/me/profile`
- `apiService.checkProfileNameAvailability()` -> GET `/me/profile-check`

Types:

- Shared types for badges and user badges are in `shared/types.ts` and re-exported for the frontend in `src/frontend/src/types/index.ts`.

UI behaviour and rules (from PRD & implementation):

- Only earned badges are displayed on a user's public profile page; unearned badges are not shown.
- Badges are permanent once awarded.
- Users are notified in-app when they earn a badge (backend should trigger a toast/notification via the existing notification system).
- MVP uses emoji icons; future enhancement supports custom image icons.

### Developer guidance / how to extend

- Adding new badge definitions:
  1. Use the admin createBadge endpoint or add a migration to insert into `badges` with the required fields.
  2. For complex or seasonal badges, set category to `seasonal` or `geographic` and include metadata in `metadata` when awarding.

- Changing badge thresholds/levels:
  - Update `badges.threshold_value` and `badges.level` via `BadgeService.updateBadge()` or a migration. Old awards are not removed.

- Performance considerations:
  - The BadgeService aggregates submissions and photos per user in real-time. For systems with many users and submissions, consider tracking counters on the `users` table (e.g., submissions_count, photos_count) and updating them transactionally when submissions are approved.

### Testing

- Unit tests for BadgeService live under `src/workers/lib/__tests__/badges.test.ts` (see existing mocks used in tests).
- Frontend components have tests under `src/frontend/src/components/__tests__` for UI behaviour (check for BadgeGrid/BadgeCard tests).

### Migration & rollout notes

- Migration file: `src/workers/migrations/0025_user_profiles_badges.sql` — run migrations (development/prod scripts available in the repo). PRD notes recommend retroactive awarding for existing users; BadgeService has methods to calculate badges and can be invoked in a migration or a one-off script to award badges to existing users.

### TODO / Future improvements (from PRD)

- Phase 2: seasonal, geographic, and community badges (e.g., streaks, leaderboard-based awards).
- Admin UI to manage badge definitions and view award logs.
- Localized or image-based badge icons instead of emojis.
- Progress hints for users (show progress towards next badge) — currently hidden until badge is earned.

### Quick links

- Migration: `src/workers/migrations/0025_user_profiles_badges.sql`
- Backend engine: `src/workers/lib/badges.ts`
- Frontend components: `src/frontend/src/components/BadgeGrid.vue`, `BadgeCard.vue`, `ProfileNameEditor.vue`
- Frontend API: `src/frontend/src/services/api.ts` (badge/profile methods)
- PRD: `tasks/user-profile-badges.md`

If you want, I can also add a short example curl (PowerShell/Invoke-WebRequest) section showing how to call the public profile endpoint and how to fetch badges for the current user.
