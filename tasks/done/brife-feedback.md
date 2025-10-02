# Feedback (Moderator-only) — Brief

Goal
-----
Implement a lightweight, private feedback flow so users can quickly report problems with an artwork or artist to moderators. Feedback is not public and moderators will take action (update artwork/artist or archive the feedback).

Key requirements
----------------
- Quick action from artwork/artist pages: one-click "Missing" button and a "Report"/"Comment" option.
- Modal dialog: prefilled note for the "Missing" action with "The artwork is missing" (editable). For other comments the note is empty and Send is disabled until the user types text.
- Feedback is private: stored in a distinct `FeedbackRecord` and only visible to moderators. No public display.
- No moderator notifications are sent automatically on new feedback (team prefers to check moderation queue on their cadence).
- Feedback must be linkable to either an artwork or an artist and include the referenced id and type.
- Rate limiting to prevent spam (per-user-token and per-IP). Default to the project's standard rate-limit strategy.

Data model
----------
Add a new type `FeedbackRecord` stored in the database and exposed in `src/shared/types.ts`.

Fields (suggested)
- id: string (uuid)
- subject_type: 'artwork' | 'artist'
- subject_id: string (artwork_id or artist_id)
- user_token: string | null (anonymous token, optional)
- issue_type: 'missing' | 'incorrect_info' | 'other' | 'comment'
- note: string (required, max 1000 chars)
- status: 'open' | 'archived' | 'resolved'
- created_at: ISO timestamp
- reviewed_at?: ISO timestamp | null
- moderator_token?: string | null
- review_notes?: string | null
- ip_address?: string | null (for abuse investigation)
- user_agent?: string | null

API
---
1. POST /api/feedback
   - Purpose: create a feedback record
   - Body: { subject_type, subject_id, issue_type, note, user_token?, consent_version?, consent_text_hash? }
   - Response: { id, status: 'open', created_at }

2. GET /api/moderation/feedback?status=open&page=1
   - Purpose: moderators list feedback (protected route)
   - Response: paginated list of FeedbackRecord

3. POST /api/moderation/feedback/:id/review
   - Purpose: moderator actions (archive, resolve, apply changes)
   - Body: { action: 'archive' | 'resolve' | 'apply_changes', moderator_token, review_notes?, changes? }
   - Response: updated FeedbackRecord

Notes: Use existing authentication middleware for moderator routes. No automatic notification is sent when feedback is created.

UX copy / behavior
-------------------
- Missing button flow:
  - User clicks "Missing" → opens modal.
  - Textarea prefilled with: "The artwork is missing". User can edit or add details.
  - Buttons: Cancel (closes, no send) and Send (enabled if textarea non-empty).
  - On Send: POST /api/feedback with issue_type='missing'. Show success toast and return to page.

- Comment flow:
  - User clicks "Report / Comment" → opens modal with empty textarea and placeholder.
  - Send disabled until user enters text.

Privacy & compliance
--------------------
- Feedback is private and only visible to moderators.
- Store ip_address and user_agent for abuse investigations but limit access to moderators.
- If allowing optional contact email, treat it as PII and store accordingly (encrypt at rest if required).

Rate limiting & abuse
---------------------
- Apply per-user-token and per-IP rate limits. Reuse project's existing RateLimitRecord logic.
- Consider a lightweight captcha challenge only if abuse is detected.

Moderator UX suggestions
------------------------
- Moderation queue page with filters: subject_type, issue_type, status, date range.
- Bulk actions: archive, resolve, convert feedback into an artwork edit (apply changes) or link to another artwork.
- Provide a quick preview with artwork image, location, and submitter note.
- Record audit trail: moderator_token, reviewed_at, review_notes.

Acceptance criteria
-------------------
- Users can send feedback from artwork/artist pages with the two flows described.
- Feedback is persisted in the DB as `FeedbackRecord` and not visible publicly.
- Moderators can list, filter, and change status of feedback items.
- No email or push notifications are sent on creation.
- Rate limiting is enforced (same limits as other user submissions).

Implementation notes & next steps
--------------------------------
1. Add `FeedbackRecord` type to `src/shared/types.ts` and wire DB migration in `src/workers/migrations/`.
2. Implement API route handlers in `src/workers/routes/feedback.ts` and moderation handlers under `src/workers/routes/moderation/feedback.ts`.
3. Create frontend `FeedbackDialog.vue` in `src/frontend/src/components/` and a Pinia store `src/frontend/src/stores/feedback.ts` to call the API.
4. Add a small frontend unit test to verify the dialog validates and sends correctly.
5. Create moderation UI (separate task) with filters and bulk actions.

Open questions
--------------
- Should feedback allow attachments (photos)? If yes, wire R2 uploads and store photo URLs on the FeedbackRecord.
- Do moderators need immediate notifications for high-severity reports? If yes, provide an opt-in digest/notify later.

Files to add/change (minimal)
- src/shared/types.ts — add FeedbackRecord and request/response types
- src/workers/migrations/000X_create_feedback_table.sql — create table
- src/workers/routes/feedback.ts — POST handler
- src/workers/routes/moderation/feedback.ts — moderator handlers
- src/frontend/src/components/FeedbackDialog.vue — modal UI
- src/frontend/src/stores/feedback.ts — Pinia actions

---
Prepared by: engineering (brief)
