# PRD: Generic Notification System (includes Badge Notifications)

## Executive Summary

This document outlines the requirements for a new in-app notification system. The Minimum Viable Product (MVP) will focus on delivering notifications to users within the application. The primary entry point will be a notification icon in the global navigation, which leads to a notification center on the user's profile page. The system will be built with a polling mechanism for the MVP, with plans for real-time updates in the future. The initial implementation will support all notification types, including badge awards, administrative messages, and review updates.

---

## Goals

- Provide a single, consistent delivery channel for in-app notifications.
- Support both ephemeral celebratory UI (toasts) and persistent storage / history (notification center).
- Make badge awards discoverable and delightful (confetti animation on dismissal of a new badge notification), while supporting non-badge notifications with appropriate UI treatment.
- Ensure notifications are secure (only visible to intended user), accessible, and performant.
- Build a system that supports future real-time delivery (SSE / WebSocket) but uses a simple poll-based fallback for MVP.

## Non-goals (MVP)

- Push/email/SMS notifications (no external delivery in MVP).
- Complex user-configurable notification preferences
- Social or sharing features

---

## Guiding Principles & Vision

This section clarifies the high-level goals and vision for the notification system based on stakeholder feedback.

**1. What is the single most important business goal for the MVP of the notification system?**

> **A. Increase user engagement and retention by making achievements (like earning badges) more visible and rewarding.** This focuses on making the user feel valued and encouraging them to contribute more.

**2. What should be the core principle guiding the user experience design for notifications?**

> **A. Notifications should be helpful and celebratory, not intrusive or distracting.** The system should prioritize positive reinforcement and provide clear, actionable information without overwhelming the user.

**3. How does a notification system directly support the Cultural Archiver's mission of preserving and sharing cultural artifacts?**

> **A. By encouraging and recognizing user contributions (submissions, reviews), the system directly incentivizes the core activities that build the archive's content and data quality.**

**4. Which element is most critical to get right for the MVP to be considered a success?**

> **A. The "badge awarded" notification flow, including the toast and confetti celebration.** This is the primary user-facing feature that delivers on the engagement goal.

**5. What is the primary "feeling" we want users to associate with receiving a notification?**

> **A. A sense of accomplishment and recognition.** Notifications should feel like a small reward or a helpful tip, making users feel valued.

---

## Relationship to existing Badge PRD

This notification system must fully support the badge system described in `tasks/user-profile-badges.md`:

- Badges are awarded in-app and are permanent once awarded.
- Users are notified in-app when they earn a badge with a small celebratory animation (confetti). This PRD includes that flow.
- Badge notifications are visible to the owning user only and should be persisted as part of the notification center.
- Notification access for badge APIs requires authenticated, verified users (same rules as badge APIs).

Include the badge-related constraints from the badge PRD: MVP is for verified users, real-time award calculation on submission events, and logged award timestamps + reasons.

---

## MVP Scope

Backend

- Persistent `notifications` table to store notifications of various types.
- Notification creation API used by server-side services (BadgeService, Admin scripts, Review workflows).
- User-facing endpoints:
  - GET `/api/me/notifications` — list notifications (paginated, recent-first).
  - POST `/api/me/notifications/:id/read` — mark one notification as read.
  - GET `/api/me/notifications/unread-count` — quick unread count.

Frontend

- A notification icon visible in the top navigation that shows unread count badge.
- A dropdown or panel showing recent notifications with actions (mark read, go to related content).
- Toast component for ephemeral notifications (fast path) — with confetti animation for badge awards.
- Confetti test button on `/status` page to demonstrate the animation.

Integration

- BadgeService will create a notification row when a badge is awarded.
- The submission flow may optionally return awarded badge details in the immediate response to render toasts immediately (fast path), and server will also persist a notification row (authoritative record).

Tests

- Unit tests for notification creation logic and BadgeService integration.
- API endpoint tests for list, unread count, mark read/dismiss.
- Frontend component tests for notification icon, panel, toast, and confetti animation toggle.

---

## Notification Data Model (MVP)

Table: `notifications`

Columns (recommended):

- `id` TEXT PRIMARY KEY (UUID)
- `user_token` TEXT NOT NULL — recipient's user_token (uuid)
- `type` TEXT NOT NULL — e.g., `badge`, `admin_message`, `review`, `system`
- `type_key` TEXT NULL — subtype or canonical key (e.g., `submission_5`)
- `title` TEXT NOT NULL
- `message` TEXT NULL
- `metadata` TEXT NULL — JSON string for structured payload (badge id, artwork id, url)
- `created_at` TEXT NOT NULL DEFAULT datetime('now')
- `is_dismissed` INTEGER NOT NULL DEFAULT 0
- `related_id` TEXT NULL — optional foreign key (badge id, submission id)

Indexes:

`idx_notifications_user_token` on (`user_token`, `is_dismissed`, `created_at`) to fetch recent and new (not-dismissed) quickly

Notes:

- Notifications are per-user; do not leak other users' notifications.
- Keep notification payload small; use `metadata` for structured data when needed.

---

## API Design (MVP)

Authentication: All `/api/me/*` endpoints require a valid `user_token` and follow same email verification and auth middleware as other `me` routes.

Endpoints:

### GET /api/me/notifications

- Query params: `limit=20` (default), `offset=0`, `not_dismissed_only=false`
- Response: { notifications: [{ id, type, type_key, title, message, metadata, created_at, is_dismissed }], pagination }

### GET /api/me/notifications/unread-count

- Response: { unread_count: N } # number of notifications where `is_dismissed = 0`

### POST /api/me/notifications/:id/dismiss

- Mark dismissed; idempotent. If the notification type is `badge` and it was not dismissed before, the frontend may trigger confetti on dismissal.
- Response: { success: true }

### POST /api/admin/notifications (admin only)

- Create a system/admin notification (Phase 1 limited to admin scripts)

Dev-only: Frontend confetti test button (no persistent backend change). Prefer to put the button on `/status` page and simply trigger the local animation.

Security & Rate-limiting:

- Limit GET list to safe values (max limit 100).
- Only the owning `user_token` may access their notifications.

---

## Backend Behavior & Contracts

- Notification creation is a simple insert; caller is responsible for deduplication if needed.
- BadgeService: when awarding a badge, call NotificationService.create({ user_token, type: 'badge', type_key, title, message, metadata: { badge_id, badge_key, award_reason } }).
- API responses must not leak other users' data.

Mark-dismiss operations should return 204 No Content or success JSON.

Idempotency and deduping

- For badge awards the BadgeService should be the source of truth and be idempotent; notification creation may be conditional on whether the badge award was newly created (BadgeService returns `created: true|false`).

Delivery model

- Fast path (recommended): When the action that awards a badge returns to the client (e.g., submission creation), include the awarded badge(s) in the response so the frontend can show immediate toasts and confetti. Backend still persists notifications.
- Polling: Frontend should poll `/api/me/notifications/unread-count` periodically (e.g., every 30–60 seconds) for minimal real-time feel in MVP.
- Future: add Server-Sent Events (SSE) or WebSocket for push delivery.

---

## Functional Requirements

This section captures clarified functional choices for the notification system (questions 6-10).

### 6) Presentation of multiple notifications in a short period

> **A.** The system will not rely on ephemeral toasts. Instead, the notification icon in the global nav is the entry point; when the user presses it they are navigated to their own public profile page and the "Notifications" tab (notification center) is opened. All notifications are listed in that center. Each notification can be dismissed from the center; dismissing a notification triggers its celebration animation (if applicable) and marks it read on the backend.

### 7) Offline handling

> **A.** Notifications generated while a user is offline are stored on the server and delivered the next time they log in or become active. The unread count reflects these stored notifications.

### 8) Unread count behavior

> **A.** The notification icon's badge shows the number of unread notifications and disappears when the count is zero. The count updates in near-real-time as notifications are received or marked read.

### 9) Dismissing a new badge notification

> **A.** When the user dismisses a new badge notification in the notification center, the notification is removed from the visible list (or marked read), a confetti animation is triggered client-side, and the backend marks the notification as read. This provides immediate celebratory feedback while preserving the authoritative record on the server.

### 10) Future notification types to support

> **A.** Design the system to support submission status changes (e.g., "Approved", "Needs more info"), admin messages, and system-wide announcements in future phases.

---

## Frontend UX (MVP)

Global nav

- Add a notification icon (bell) to the top nav:
  - Show a small red unread count badge when `unread_count > 0` (capped at 99+)
  - Clicking opens a dropdown/panel with recent notifications (paginated link to full panel)

Notification Panel

- Show recent notifications grouped by time (new/unread at top)
- Each entry: icon (based on `type`), title, short message, timeago, action link (if `metadata.url` or related resource)
- Actions: mark as read (checkbox on hover), dismiss (x), go-to (click on body)

Toasts

- Ephemeral toasts (top-right) for newly received notifications. Badge awards produce a toast with badge icon/title and small CTA (view profile)
- When a user dismisses a notification that represents a NEW badge award (i.e., unread badge notification), trigger confetti animation. The confetti should be optional and accessible (prefers-reduced-motion respected).

Confetti Test Button

- Add a small `Test Celebration` button to `/status` that triggers the confetti animation locally. This button does not create notifications; it only demonstrates the UI. Keep the button behind a dev/testing flag in production.

Accessibility

- All interactive controls must be keyboard focusable with descriptive ARIA labels.
- Respect `prefers-reduced-motion` and provide a non-animated fallback.

Design tokens

- Use existing Tailwind / CSS tokens from the frontend for colors, spacing, and icons.

---

## Tests & QA

Backend

- Unit tests for NotificationService: create, list, mark read, delete/dismiss.
- Integration tests for BadgeService -> notification creation.
- API tests for authentication/authorization (ensure only owning user can list/mark notifications).

---

## User Stories

This section records the prioritized user stories and choices (questions 11-15).

### 11) Highest-priority user story for the MVP notification flow

> **A.** As a verified user, when I earn a badge, I want to see a clear notification in my notification center and be able to dismiss it, so I feel recognized.

### 12) Notification ordering when viewing the center

> **A.** Newest-first, with unread items pinned to the top.

### 13) Actions available on each notification (MVP)

> **A.** Mark as read/dismiss and go-to related content (if applicable).

### 14) Accessibility of notifications from the user's profile

> **A.** Yes — the notification icon should navigate to the user's profile and open the notification tab (private to that user).

### 15) Backend contract for marking read/dismiss

> **A.** Notifications do not have a separate "read" state. A notification is either new or dismissed; the unread-count reflects notifications where `is_dismissed = 0`.

## Design Considerations

This section captures UI and privacy decisions for the notification system (questions 16-20).

### 16) Accessibility for confetti/celebration animations

> **B.** Always show full confetti for maximum delight.

### 17) Treatment of long messages or rich metadata

> **A.** Show a short summary (title + 1–2 line snippet) with a "view more" or "go to" action that navigates to the related content; keep the center compact.

### 18) Freshness requirement for unread-count

> **D.** Only update on full page reloads.

### 19) Confetti placement when a badge is dismissed

> **B.** Full-screen center so it's obvious to all users.

### 20) Privacy constraints for notification payloads

> **A.** Avoid embedding PII (emails, phone numbers) or any sensitive user data; include only minimal identifiers and links for context.

Frontend

- Unit tests for `NotificationIcon`, `NotificationPanel`, `BadgeToast` components.
- Integration tests (Vitest + Playwright) to simulate awarding a badge and showing toast + confetti.
- Accessibility tests to ensure keyboard navigation and reduced-motion behavior.

End-to-end

- Simulate full flow: create submission that triggers badge award -> backend persists notification -> frontend receives awarded-badge in response and shows toast -> panel shows notification and unread count increments -> user dismisses toast/panel item -> confetti animates and backend marks read.

---

## Technical Considerations

This section records technical choices and constraints for the notification system (questions 21-25).

### 21) Storage for MVP

> **A.** Store notifications in Cloudflare D1 in a new `notifications` table (persistent, queryable, SQLite-compatible).

### 22) Authorization model

> **A.** Require the owning `user_token` and existing auth middleware (same as other `/api/me/*` endpoints). Server-side enforcement only.

### 23) Deduplication strategy

> **A.** Keep notifications simple; BadgeService should be idempotent and only create notifications when an award is new. Deduping handled at the service level for MVP.

### 24) Retention and cleanup

> **A.** Store indefinitely in D1, but surface only recent items (last 90 days) in the UI; provide admin tools to prune if needed.

### 25) Real-time delivery approach

> **A.** Polling every 30–60 seconds for MVP; plan for SSE/WebSocket in Phase 2. (User indicated: "No real time" — MVP will use polling.)

---

## Scope Reduction

Use this section to lock down decisions that shrink the MVP surface.

### 26) Which user segment should the MVP target?

> **A.** Verified, authenticated users only (keeps scope small and consistent with badge system).

### 27) Which notification types should MVP include?

> **C.** All types (badges, admin messages, review updates, system notices).

### 28) Which delivery channels should the MVP support?

> **A.** In-app notification center + unread-count polling only.

### 29) Which admin features should be in MVP?

> **B.** Full admin UI for broadcasting messages.

### 30) For initial rollout, what's the retention/visibility policy?

> **A.** Persist notifications indefinitely in DB but show only last 90 days in UI (admin tools to adjust later).

---

## Implementation Decisions (further scope reduction)

### 31) Which UI component should we implement first for the frontend MVP?

> **A.** Notification icon + unread-count badge and the Notification center tab on the user's profile page.

### 32) Which platforms should the frontend MVP support?

> **A.** Desktop and mobile web (responsive SPA behavior).

### 33) What level of testing should be required before rolling out to dev environment?

> **A.** Unit tests + a small integration test covering badge->notification flow (happy path). Additionally: add an end-to-end suite with Playwright.

### 34) Should localization be included in MVP?

> **A.** No — English-only for MVP, add localization in Phase 2.

### 35) Rollout strategy for enabling notifications for users

> **All at once.** Enable for all verified users in dev/staging first, then production rollout for all verified users after monitoring.

---

## Metrics & Success Criteria

- Unread count API latency < 200ms for typical queries.
- Notification list API latency < 300ms for page sizes <= 20.
- Badge award to toast time (fast path) < 1s when returning award in response.
- At least 90% of users see the animation when awarded a badge (subject to reduced-motion preferences).

Qualitative success:

- Users report increased discoverability of awards and minimal friction in viewing notifications.

---

## Rollout Plan

1. Build backend pieces (notifications table, NotificationService, API endpoints). Add migration and unit tests.
2. Integrate NotificationService into BadgeService and test end-to-end in dev.
3. Add frontend notification icon, panel, and toast; wire to APIs; implement confetti animation behind a feature flag.
4. Run integration + e2e tests.
5. Staged rollout: enable for small percentage of users or dev environment; validate metrics and logs.

---

## Migration

- Add migrations file `0026_add_notifications_table.sql` (include down/rollback comment). Use `TEXT` for metadata JSON to keep D1 compatibility.

---

## Privacy & Security

- Notifications contain minimal PII; avoid embedding full user emails in notifications.
- Only allow access to `/api/me/notifications` for the owning `user_token`.
- Admin-created system notifications must be auditable.

---

## Future / Phase 2 Ideas

- Admin dashboard to broadcast system notifications

---

## Next Steps

Backend-first plan (recommended):

1. Create migration and `src/workers/lib/notifications.ts` (NotificationService) + tests.
2. Add endpoints in `src/workers/routes/user.ts` and wire middleware (`ensureUserToken`, `checkEmailVerification`).
3. Integrate NotificationService into `src/workers/lib/badges.ts` so badges persist notifications on award.

Frontend plan:

1. Add UI components (`NotificationIcon`, `NotificationPanel`, `BadgeToast`).
2. Add Pinia store slice for notifications and wire APIs.
3. Add `/status` confetti test button behind a dev flag.

Testing plan:

1. Unit tests for backend and frontend components.
2. Integration tests to confirm BadgeService->NotificationService flow.
3. End-to-end tests that exercise the confetti flow (respect reduce-motion).

---

## Appendix: Notes pulled from `tasks/user-profile-badges.md`

- MVP users: authenticated users with verified emails only.
- Badges are awarded automatically and are permanent; notify in-app only.
- Badge award must be logged with timestamp + reason.
- Badges are public on `/users/:uuid` but notifications are private to the user.
- Real-time badge calculation on submission events; notification system must integrate with that pipeline.
- Toast celebration is required for badge awards; confetti behavior must respect `prefers-reduced-motion`.

---

Document author: (auto-generated PRD) — update with product owner and date when approved.

---

## Developer Task List

This developer-facing task list translates the PRD into an ordered set of implementation tasks. The list is intentionally prescriptive and broken down into parent tasks and concrete sub-tasks so a junior developer can follow it.

### Relevant Files

- `src/workers/migrations/0026_add_notifications_table.sql` - DB migration to add the `notifications` table.
- `src/workers/lib/notifications.ts` - NotificationService implementation (create, list, unread-count, mark-read/dismiss).
- `src/workers/routes/notifications.ts` or `src/workers/routes/user.ts` - API endpoints for `/api/me/notifications` and `/api/me/notifications/unread-count`.
- `src/workers/lib/badges.ts` - Integration point: call NotificationService when badges are awarded.
- `src/shared/types.ts` - Add Notification types/interfaces used by backend and frontend.
- `src/frontend/src/components/NotificationIcon.vue` - Top-nav icon + unread-count badge component.
- `src/frontend/src/components/NotificationPanel.vue` - Panel / dropdown listing recent notifications.
- `src/frontend/src/components/BadgeToast.vue` - Ephemeral toast used for fast-path badge awards.
- `src/frontend/src/stores/notifications.ts` - Pinia store slice to manage notifications and polling.
- `src/frontend/src/views/ProfileNotificationsView.vue` - Profile page Notifications tab / full center view.
- `src/frontend/src/pages/Status.vue` or `/status` view - Add confetti test button (dev-only behind flag).
- `src/frontend/test/e2e/notifications.spec.ts` - Playwright end-to-end tests for badge->notification flow.
- `src/workers/test/notifications.test.ts` - Unit tests for NotificationService.
- `src/frontend/test/unit/NotificationIcon.test.ts` - Unit tests for components.

### Tasks

- [ ] 1.0 Backend: Schema & Migration
  - [ ] 1.1 Create migration `0026_add_notifications_table.sql` using the PRD data model (UUID id, user_token, type, type_key, title, message, metadata TEXT, created_at, is_dismissed, related_id).
  - [ ] 1.2 Add index `idx_notifications_user_token` on (`user_token`, `is_dismissed`, `created_at`).
  - [ ] 1.3 Add rollback/down comments and validate migration by running against the local development database.

- [ ] 2.0 Backend: NotificationService
  - [ ] 2.1 Implement `src/workers/lib/notifications.ts` exposing: create(notification), listForUser(user_token, { limit, offset, unread_only }), unreadCount(user_token), markRead(id, user_token), dismiss(id, user_token).
  - [ ] 2.2 Add Zod input validation and TypeScript types in `src/shared/types.ts`.
  - [ ] 2.3 Add unit tests covering happy path, invalid input, and authorization checks.

- [ ] 3.0 Backend: API Endpoints & Auth
  - [ ] 3.1 Add routes for `/api/me/notifications` (GET list), `/api/me/notifications/unread-count` (GET), `/api/me/notifications/:id/read` (POST), `/api/me/notifications/:id/dismiss` (POST). Place under `src/workers/routes/notifications.ts` or extend `user.ts` with clear route grouping.
  - [ ] 3.2 Apply `ensureUserToken` and `checkEmailVerification` middleware to protect endpoints.
  - [ ] 3.3 Add rate-limiting for list endpoints and input validation (limit bounds, offset, id format).

- [ ] 4.0 Integration: BadgeService
  - [ ] 4.1 In `src/workers/lib/badges.ts`, call NotificationService.create when a badge is awarded. Only create a notification if the badge award is newly created (BadgeService returns created: true).
  - [ ] 4.2 Ensure the call is idempotent and add integration tests covering award -> notification creation.

- [ ] 5.0 Frontend: Components & Store
  - [ ] 5.1 Implement `NotificationIcon.vue` with unread-count badge (capped at 99+) wired to the notifications Pinia store.
  - [ ] 5.2 Implement `NotificationPanel.vue` (dropdown or panel) showing recent notifications and actions (mark read, dismiss, go-to). Include pagination link to the full center view.
  - [ ] 5.3 Implement `BadgeToast.vue` for ephemeral fast-path toasts. When dismissed for an unread badge, trigger confetti and call `/api/me/notifications/:id/dismiss`.
  - [ ] 5.4 Create `src/frontend/src/stores/notifications.ts` Pinia slice to call APIs, manage polling for unread-count (30–60s), and cache/paginate notification lists.
  - [ ] 5.5 Add `ProfileNotificationsView.vue` (notifications tab) to show full history (default: last 90 days) and actions.

- [ ] 6.0 Frontend: Confetti & Accessibility
  - [ ] 6.1 Implement confetti animation component; respect `prefers-reduced-motion` and expose a feature flag to enable/disable full-screen confetti.
  - [ ] 6.2 Add a dev-only `Test Celebration` button on `/status` to trigger the confetti locally (no server changes). Guard behind an env flag.
  - [ ] 6.3 Add keyboard/ARIA support and unit tests for accessibility on all interactive controls.

- [ ] 7.0 Testing: Integration & End-to-End
  - [ ] 7.1 Add integration tests (BadgeService -> NotificationService -> DB) in `src/workers/test/`.
  - [ ] 7.2 Add Playwright E2E test (`src/frontend/test/e2e/notifications.spec.ts`) covering: award badge -> show toast -> panel list contains notification -> dismiss -> confetti triggered -> server marks read.
  - [ ] 7.3 Run full test suite: `npm run test` and ensure new tests pass.

- [ ] 8.0 Admin: System Notifications & Tools
  - [ ] 8.1 Add admin API `POST /api/admin/notifications` (admin-only) to broadcast system messages (Phase 1: minimal create-only endpoint).
  - [ ] 8.2 Create a minimal admin UI or a script for broadcasting messages; ensure messages are auditable.

- [ ] 9.0 Documentation & Rollout
  - [ ] 9.1 Add `README.md` under `src/workers/migrations/` describing how to apply the migration locally and in CI (include `npm run database:migration:dev` guidance).
  - [ ] 9.2 Add developer notes in `tasks/notification-system.md` (link to PRD) describing the feature flag, rollout plan, and verification steps for staging/production.
  - [ ] 9.3 Plan staged rollout: enable in dev/staging first, monitor unread-count and API latency, then enable for production for all verified users.

### Notes

- Tests: prefer Vitest for unit tests (backend and frontend) and Playwright for E2E.
- Keep migrations idempotent and include a rollback comment for reviewers; we prefer replacing the dev DB if necessary during early development instead of complex migrations.
- Feature flag: gate the confetti animation and any user-visible toggles behind a frontend feature flag and an env variable so rollout can be controlled.
