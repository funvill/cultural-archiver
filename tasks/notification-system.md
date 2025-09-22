# PRD: Generic Notification System (includes Badge Notifications)

## Executive Summary

Add a generic, extensible in-app notification system for the Cultural Archiver. The system will deliver notifications for many event types (badges, review actions, admin messages, system notices, moderation updates) and provide both ephemeral toasts (celebrations) and a persistent notification center. The initial launch will focus on badge notifications (as described in the existing User Profile & Badges PRD) while designing the system to support additional notification types in Phase 2.

This PRD defines the overal architecture, minimal viable product (MVP) scope, API and DB contracts, frontend UX (including a notification icon and confetti celebration), testing strategy, rollout plan, and acceptance criteria. Implementation will include backend + frontend + tests, but this document is design-only: do not begin implementation without separate approval.

---

## Goals

- Provide a single, consistent delivery channel for in-app notifications.
- Support both ephemeral celebratory UI (toasts) and persistent storage / history (notification center).
- Make badge awards discoverable and delightful (confetti animation on dismissal of a new badge notification), while supporting non-badge notifications with appropriate UI treatment.
- Ensure notifications are secure (only visible to intended user), accessible, and performant.
- Build a system that supports future real-time delivery (SSE / WebSocket) but uses a simple poll-based fallback for MVP.

## Non-goals (MVP)

- Push/email/SMS notifications (no external delivery in MVP).
- Complex user-configurable notification preferences (defer to Phase 2).
- Social or sharing features (deferred).

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
  - POST `/api/me/notifications/:id/dismiss` — mark dismissed (optional alias of read).
  - GET `/api/me/notifications/unread-count` — quick unread count.
- Optional: POST `/api/test/notification/confetti` (dev-only) or expose a button on `/status` that triggers the confetti animation on the frontend (no backend side-effect required). For security, test endpoints should be dev-only or behind admin flag.

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
- `is_read` INTEGER NOT NULL DEFAULT 0
- `is_dismissed` INTEGER NOT NULL DEFAULT 0
- `related_id` TEXT NULL — optional foreign key (badge id, submission id)

Indexes:
- `idx_notifications_user_token` on (`user_token`, `is_read`, `created_at`) to fetch recent and unread quickly

Notes:
- Notifications are per-user; do not leak other users' notifications.
- Keep notification payload small; use `metadata` for structured data when needed.

---

## API Design (MVP)

Authentication: All `/api/me/*` endpoints require a valid `user_token` and follow same email verification and auth middleware as other `me` routes.

Endpoints:

1) GET /api/me/notifications
- Query params: `limit=20` (default), `offset=0`, `unread_only=false`
- Response: { notifications: [{ id, type, type_key, title, message, metadata, created_at, is_read }], pagination }

2) GET /api/me/notifications/unread-count
- Response: { unread_count: N }

3) POST /api/me/notifications/:id/read
- Marks notification as read; idempotent.
- Response: { success: true }

4) POST /api/me/notifications/:id/dismiss
- Mark dismissed (optional alias of read + is_dismissed flag); if the notification type is `badge` and unread, trigger confetti on dismissal on the frontend.

5) POST /api/admin/notifications (admin only) — create a system/admin notification (Phase 1 limited to admin scripts)

Dev-only: Frontend confetti test button (no persistent backend change). Prefer to put the button on `/status` page and simply trigger the local animation.

Security & Rate-limiting:
- Limit GET list to safe values (max limit 100).
- Only the owning `user_token` may access their notifications.

---

## Backend Behavior & Contracts

- Notification creation is a simple insert; caller is responsible for deduplication if needed.
- BadgeService: when awarding a badge, call NotificationService.create({ user_token, type: 'badge', type_key, title, message, metadata: { badge_id, badge_key, award_reason } }).
- API responses must not leak other users' data.
- Mark-read/dismiss operations should return 204 No Content or success JSON.

Idempotency and deduping
- For badge awards the BadgeService should be the source of truth and be idempotent; notification creation may be conditional on whether the badge award was newly created (BadgeService returns `created: true|false`).

Delivery model
- Fast path (recommended): When the action that awards a badge returns to the client (e.g., submission creation), include the awarded badge(s) in the response so the frontend can show immediate toasts and confetti. Backend still persists notifications.
- Polling: Frontend should poll `/api/me/notifications/unread-count` periodically (e.g., every 30–60 seconds) for minimal real-time feel in MVP.
- Future: add Server-Sent Events (SSE) or WebSocket for push delivery.

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

Frontend
- Unit tests for `NotificationIcon`, `NotificationPanel`, `BadgeToast` components.
- Integration tests (Vitest + Playwright) to simulate awarding a badge and showing toast + confetti.
- Accessibility tests to ensure keyboard navigation and reduced-motion behavior.

End-to-end
- Simulate full flow: create submission that triggers badge award -> backend persists notification -> frontend receives awarded-badge in response and shows toast -> panel shows notification and unread count increments -> user dismisses toast/panel item -> confetti animates and backend marks read.

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

- Add migrations file `xxxx_add_notifications_table.sql` (include down/rollback comment). Use `TEXT` for metadata JSON to keep D1 compatibility.

---

## Privacy & Security

- Notifications contain minimal PII; avoid embedding full user emails in notifications.
- Only allow access to `/api/me/notifications` for the owning `user_token`.
- Admin-created system notifications must be auditable.

---

## Future / Phase 2 Ideas

- Notification preferences (email, push, in-app toggles)
- Server-Sent Events (SSE) or WebSockets for true push delivery
- Notification categories and filters
- Aggregate summaries (weekly digest)
- Admin dashboard to broadcast system notifications

---

## Next Steps (if approved)

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
