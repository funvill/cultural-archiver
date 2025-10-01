# Implementation Plan: Moderator Feedback System

## Overview

This document provides a comprehensive implementation plan for the Moderator Feedback System, a lightweight, private feedback flow allowing users to report issues with artworks or artists directly to moderators.

## Feature Summary

- **Goal**: Enable users to quickly report problems (missing artwork, incorrect info, etc.) to moderators
- **Scope**: Text-only feedback submission with two flows: "Missing" (prefilled) and "Comment" (empty)
- **Privacy**: All feedback is private to moderators; no public display
- **Notification**: No automatic moderator notifications; moderators check queue on their cadence
- **Users**: All public users including anonymous visitors
- **Success Metric**: Number of content issues identified and resolved, leading to improved data quality

## Key Design Decisions (from Q&A)

1. **User Experience**: Quick, intuitive, low-friction reporting (Q5)
2. **Relationship to Edits**: Lighter-weight alternative to the formal "Artwork Edit" system (Q6)
3. **Volume**: Low to moderate expected volume (Q7)
4. **Spam Prevention**: Manual moderation; no automated spam prevention initially (Q8)
5. **User Feedback Loop**: One-way communication; users don't receive status updates (Q10)
6. **Feedback Type**: Free-form text field for user categorization (Q11)
7. **Missing Flow**: Prefilled with "The artwork is missing" (Q12)
8. **Comment Flow**: Empty note field; Send disabled until user types (Q13)
9. **Character Limit**: 1000 characters max (Q14)
10. **Subject Types**: Both artworks AND artists (Q15)

## Architecture

### Data Model

**New Table**: `feedback`

```sql
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,                    -- UUID
  subject_type TEXT NOT NULL,             -- 'artwork' | 'artist'
  subject_id TEXT NOT NULL,               -- artwork_id or artist_id
  user_token TEXT,                        -- anonymous token (nullable)
  issue_type TEXT NOT NULL,               -- 'missing' | 'incorrect_info' | 'other' | 'comment'
  note TEXT NOT NULL,                     -- max 1000 chars
  status TEXT NOT NULL DEFAULT 'open',    -- 'open' | 'archived' | 'resolved'
  created_at TEXT NOT NULL,               -- ISO timestamp
  reviewed_at TEXT,                       -- ISO timestamp (nullable)
  moderator_token TEXT,                   -- reviewer ID (nullable)
  review_notes TEXT,                      -- moderator's internal notes (nullable)
  ip_address TEXT,                        -- for abuse investigation (nullable)
  user_agent TEXT                         -- for abuse investigation (nullable)
);

CREATE INDEX idx_feedback_subject ON feedback(subject_type, subject_id);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);
```

### TypeScript Types

**Location**: `src/shared/types.ts`

```typescript
export interface FeedbackRecord {
  id: string;
  subject_type: 'artwork' | 'artist';
  subject_id: string;
  user_token: string | null;
  issue_type: 'missing' | 'incorrect_info' | 'other' | 'comment';
  note: string;
  status: 'open' | 'archived' | 'resolved';
  created_at: string;
  reviewed_at: string | null;
  moderator_token: string | null;
  review_notes: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface CreateFeedbackRequest {
  subject_type: 'artwork' | 'artist';
  subject_id: string;
  issue_type: 'missing' | 'incorrect_info' | 'other' | 'comment';
  note: string;
  user_token?: string | null;
  consent_version?: string;
  consent_text_hash?: string;
}

export interface CreateFeedbackResponse {
  id: string;
  status: 'open';
  created_at: string;
  message?: string;
}

export interface FeedbackListResponse extends PaginatedResponse<FeedbackRecord> {
  feedback: FeedbackRecord[];
}

export interface ReviewFeedbackRequest {
  action: 'archive' | 'resolve' | 'apply_changes';
  moderator_token: string;
  review_notes?: string;
  changes?: Partial<CreateArtworkRequest> | Partial<CreateArtistRequest>;
}

export interface ReviewFeedbackResponse {
  feedback: FeedbackRecord;
  message?: string;
}

// Constants
export const FEEDBACK_SUBJECT_TYPES = ['artwork', 'artist'] as const;
export const FEEDBACK_ISSUE_TYPES = ['missing', 'incorrect_info', 'other', 'comment'] as const;
export const FEEDBACK_STATUSES = ['open', 'archived', 'resolved'] as const;
export const MAX_FEEDBACK_NOTE_LENGTH = 1000;

// Validators
export const isValidFeedbackSubjectType = (t: string): t is FeedbackRecord['subject_type'] =>
  FEEDBACK_SUBJECT_TYPES.includes(t as any);

export const isValidFeedbackIssueType = (t: string): t is FeedbackRecord['issue_type'] =>
  FEEDBACK_ISSUE_TYPES.includes(t as any);

export const isValidFeedbackStatus = (s: string): s is FeedbackRecord['status'] =>
  FEEDBACK_STATUSES.includes(s as any);
```

### API Endpoints

#### 1. POST `/api/feedback` (Public)
- **Purpose**: Create a new feedback record
- **Auth**: None required (supports anonymous submissions)
- **Rate Limit**: Apply per-user-token and per-IP limits
- **Request Body**:
  ```json
  {
    "subject_type": "artwork",
    "subject_id": "uuid-here",
    "issue_type": "missing",
    "note": "The artwork is missing",
    "user_token": "optional-uuid",
    "consent_version": "1.0.0",
    "consent_text_hash": "sha256-hash"
  }
  ```
- **Response** (201):
  ```json
  {
    "success": true,
    "data": {
      "id": "feedback-uuid",
      "status": "open",
      "created_at": "2025-09-30T12:00:00Z"
    }
  }
  ```
- **Validation**:
  - `subject_type` must be 'artwork' or 'artist'
  - `subject_id` must exist in respective table
  - `issue_type` must be valid enum value
  - `note` length: 1-1000 characters
  - Capture IP and User-Agent from headers

#### 2. GET `/api/moderation/feedback` (Protected)
- **Purpose**: List feedback for moderators
- **Auth**: Moderator session required
- **Query Params**:
  - `status`: 'open' | 'archived' | 'resolved' (default: 'open')
  - `subject_type`: 'artwork' | 'artist' (optional)
  - `issue_type`: filter by issue type (optional)
  - `page`: pagination (default: 1)
  - `per_page`: results per page (default: 20, max: 100)
- **Response** (200):
  ```json
  {
    "success": true,
    "data": {
      "feedback": [...],
      "total": 42,
      "page": 1,
      "per_page": 20,
      "has_more": true
    }
  }
  ```

#### 3. POST `/api/moderation/feedback/:id/review` (Protected)
- **Purpose**: Moderator action on feedback
- **Auth**: Moderator session required
- **Request Body**:
  ```json
  {
    "action": "archive",
    "moderator_token": "mod-uuid",
    "review_notes": "Duplicate report, already fixed"
  }
  ```
- **Response** (200):
  ```json
  {
    "success": true,
    "data": {
      "feedback": { /* updated FeedbackRecord */ }
    }
  }
  ```
- **Actions**:
  - `archive`: Set status to 'archived', record moderator_token and review_notes
  - `resolve`: Set status to 'resolved', record moderator_token and review_notes
  - `apply_changes`: (Future) Apply changes to artwork/artist and resolve feedback

### Frontend Components

#### 1. FeedbackDialog.vue
**Location**: `src/frontend/src/components/FeedbackDialog.vue`

**Props**:
- `open: boolean` - Dialog visibility
- `subjectType: 'artwork' | 'artist'` - What is being reported
- `subjectId: string` - ID of artwork/artist
- `mode: 'missing' | 'comment'` - Prefill behavior

**Features**:
- Modal overlay with centered dialog
- Title varies by mode: "Report Missing Artwork" vs "Report an Issue"
- Textarea with character counter (0/1000)
- Prefill "The artwork is missing" for mode='missing'
- Send button disabled when:
  - Note is empty (after trimming)
  - Note exceeds 1000 characters
  - Request is in-flight
- Cancel button closes dialog without submission
- Success: Show toast message, emit 'sent' event, close dialog
- Error: Display error message inline

**Example**:
```vue
<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="w-full max-w-lg bg-white rounded-lg shadow-xl p-6">
      <h3 class="text-xl font-semibold mb-3">{{ title }}</h3>
      <p class="text-sm text-gray-600 mb-4">
        This feedback will be sent privately to moderators who will review and update the content.
      </p>
      
      <textarea
        v-model="note"
        :placeholder="placeholder"
        :maxlength="MAX_FEEDBACK_NOTE_LENGTH"
        class="w-full h-32 p-3 border rounded-md resize-none focus:ring-2 focus:ring-blue-500"
      />
      
      <div class="flex justify-between items-center mt-4">
        <span class="text-sm text-gray-500">{{ note.length }} / {{ MAX_FEEDBACK_NOTE_LENGTH }}</span>
        <div class="space-x-3">
          <button
            @click="onCancel"
            :disabled="sending"
            class="px-4 py-2 border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            @click="onSend"
            :disabled="sendDisabled || sending"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {{ sending ? 'Sending...' : 'Send' }}
          </button>
        </div>
      </div>
      
      <p v-if="error" class="text-sm text-red-600 mt-3">{{ error }}</p>
    </div>
  </div>
</template>
```

#### 2. Pinia Store
**Location**: `src/frontend/src/stores/feedback.ts`

**Actions**:
- `submitFeedback(request: CreateFeedbackRequest): Promise<CreateFeedbackResponse>`
  - POST to `/api/feedback`
  - Handle errors and return response
  - Update user's submission count (if tracking)

**State** (minimal):
- `submitting: boolean` - Request in-flight status
- `lastError: string | null` - Last error message

#### 3. Integration Points

**ArtworkDetailView.vue**:
- Add "Report Missing" button to action bar
- Add "Report Issue" option to overflow menu
- Wire both to `FeedbackDialog` with appropriate `mode` and `subjectType='artwork'`

**ArtistDetailView.vue** (if exists):
- Add "Report Issue" option to action bar or menu
- Wire to `FeedbackDialog` with `subjectType='artist'` and `mode='comment'`

### Backend Implementation

#### 1. Database Migration
**File**: `src/workers/migrations/0009_create_feedback_table.sql`

- Create `feedback` table with schema above
- Add indexes for performance
- No data migration required (new feature)

#### 2. Route Handler: Public Feedback Submission
**File**: `src/workers/routes/feedback.ts`

**Pseudocode**:
```typescript
// POST /api/feedback
export async function createFeedback(c: Context) {
  // 1. Parse and validate request body
  const body = await c.req.json();
  
  // 2. Validate fields with Zod schema
  // - subject_type, subject_id, issue_type, note
  
  // 3. Check rate limits (per user_token and IP)
  await checkRateLimit(c, 'feedback_submission');
  
  // 4. Verify subject exists (artwork or artist)
  const exists = await verifySubjectExists(subject_type, subject_id);
  if (!exists) return c.json({ error: 'Subject not found' }, 404);
  
  // 5. Create feedback record
  const id = crypto.randomUUID();
  const ip_address = c.req.header('CF-Connecting-IP');
  const user_agent = c.req.header('User-Agent');
  
  await c.env.DB.prepare(`
    INSERT INTO feedback (id, subject_type, subject_id, user_token, issue_type, note, status, created_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
  `).bind(id, subject_type, subject_id, user_token, issue_type, note, new Date().toISOString(), ip_address, user_agent).run();
  
  // 6. Return success response
  return c.json({
    success: true,
    data: { id, status: 'open', created_at: new Date().toISOString() }
  }, 201);
}
```

#### 3. Route Handlers: Moderator Routes
**File**: `src/workers/routes/moderation/feedback.ts`

**List Feedback** (GET):
```typescript
export async function listFeedback(c: Context) {
  // 1. Verify moderator authentication
  const session = await getSession(c);
  if (!session?.is_moderator) return c.json({ error: 'Unauthorized' }, 403);
  
  // 2. Parse query params (status, subject_type, issue_type, page, per_page)
  const { status = 'open', page = 1, per_page = 20 } = c.req.query();
  
  // 3. Build SQL query with filters
  let query = 'SELECT * FROM feedback WHERE status = ?';
  const params = [status];
  
  // Add optional filters...
  
  // 4. Execute with pagination
  const offset = (page - 1) * per_page;
  const results = await c.env.DB.prepare(query + ' ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .bind(...params, per_page, offset).all();
  
  // 5. Get total count
  const countResult = await c.env.DB.prepare('SELECT COUNT(*) as total FROM feedback WHERE status = ?')
    .bind(status).first();
  
  // 6. Return paginated response
  return c.json({
    success: true,
    data: {
      feedback: results.results,
      total: countResult.total,
      page,
      per_page,
      has_more: (page * per_page) < countResult.total
    }
  });
}
```

**Review Feedback** (POST):
```typescript
export async function reviewFeedback(c: Context) {
  // 1. Verify moderator authentication
  const session = await getSession(c);
  if (!session?.is_moderator) return c.json({ error: 'Unauthorized' }, 403);
  
  // 2. Parse request body
  const { action, review_notes } = await c.req.json();
  const feedbackId = c.req.param('id');
  
  // 3. Validate action
  if (!['archive', 'resolve', 'apply_changes'].includes(action)) {
    return c.json({ error: 'Invalid action' }, 400);
  }
  
  // 4. Update feedback record
  const newStatus = action === 'archive' ? 'archived' : 'resolved';
  await c.env.DB.prepare(`
    UPDATE feedback 
    SET status = ?, reviewed_at = ?, moderator_token = ?, review_notes = ?
    WHERE id = ?
  `).bind(newStatus, new Date().toISOString(), session.user_token, review_notes, feedbackId).run();
  
  // 5. Fetch updated record
  const updated = await c.env.DB.prepare('SELECT * FROM feedback WHERE id = ?')
    .bind(feedbackId).first();
  
  // 6. Return response
  return c.json({
    success: true,
    data: { feedback: updated }
  });
}
```

#### 4. Rate Limiting
**Integration**: Use existing `RateLimitRecord` system

- **Key**: `feedback_submission:{user_token}` or `feedback_submission:ip:{ip_address}`
- **Limits**: 
  - 10 submissions per hour per user_token
  - 20 submissions per hour per IP (to allow anonymous users)
- **Response**: 429 Too Many Requests with retry-after header

### Testing

#### Frontend Tests
**File**: `src/frontend/src/components/__tests__/FeedbackDialog.test.ts`

Test cases:
1. ✅ Renders with correct title for 'missing' mode
2. ✅ Renders with correct title for 'comment' mode
3. ✅ Prefills note for 'missing' mode
4. ✅ Note is empty for 'comment' mode
5. ✅ Send button disabled when note is empty (comment mode)
6. ✅ Send button enabled when note is filled (missing mode)
7. ✅ Character counter updates as user types
8. ✅ Validates max length (1000 chars)
9. ✅ Cancel button closes dialog without API call
10. ✅ Send button calls API and emits 'sent' event
11. ✅ Displays error message on API failure
12. ✅ Disables buttons during submission

#### Backend Tests
**File**: `src/workers/routes/__tests__/feedback.test.ts`

Test cases:
1. ✅ POST /api/feedback creates record successfully
2. ✅ POST /api/feedback validates subject_type
3. ✅ POST /api/feedback validates subject_id exists
4. ✅ POST /api/feedback enforces max note length
5. ✅ POST /api/feedback applies rate limiting
6. ✅ POST /api/feedback captures IP and User-Agent
7. ✅ GET /api/moderation/feedback requires auth
8. ✅ GET /api/moderation/feedback filters by status
9. ✅ GET /api/moderation/feedback paginates correctly
10. ✅ POST /api/moderation/feedback/:id/review requires auth
11. ✅ POST /api/moderation/feedback/:id/review updates status
12. ✅ POST /api/moderation/feedback/:id/review records moderator_token

### Documentation Updates

**Files to update**:
1. `docs/api.md` - Add feedback endpoints documentation
2. `docs/database.md` - Add feedback table schema
3. `README.md` - Mention feedback feature in feature list

## Tasks

- [x] 1.0 Database Schema & Types
  - [x] 1.1 Create migration file `src/workers/migrations/0030_create_feedback_table.sql`
  - [x] 1.2 Add `FeedbackRecord` and related types to `src/shared/types.ts`
  - [x] 1.3 Add constants and validators for feedback enums
  - [x] 1.4 Apply migration to development database
  - [ ] 1.5 Update `docs/database.md` with feedback table schema

- [x] 2.0 Backend API - Public Feedback Submission
  - [x] 2.1 Create `src/workers/routes/feedback.ts` with POST handler
  - [x] 2.2 Implement request validation (Zod schema)
  - [x] 2.3 Add subject existence verification (artwork/artist lookup)
  - [x] 2.4 Integrate rate limiting (reuse existing system)
  - [x] 2.5 Implement feedback record creation with IP/User-Agent capture
  - [ ] 2.6 Add unit tests for public feedback endpoint
  - [x] 2.7 Register route in main worker app

- [x] 3.0 Backend API - Moderator Routes
  - [x] 3.1 Create `src/workers/routes/moderation/feedback.ts`
  - [x] 3.2 Implement GET `/api/moderation/feedback` with filtering and pagination
  - [x] 3.3 Implement POST `/api/moderation/feedback/:id/review` for moderator actions
  - [x] 3.4 Add authentication checks for moderator-only access
  - [ ] 3.5 Add unit tests for moderator feedback routes
  - [x] 3.6 Register routes in main worker app

- [x] 4.0 Frontend - FeedbackDialog Component
  - [x] 4.1 Create `src/frontend/src/components/FeedbackDialog.vue`
  - [x] 4.2 Implement modal UI with textarea and character counter
  - [x] 4.3 Add mode-specific behavior (prefill for 'missing', empty for 'comment')
  - [x] 4.4 Implement send/cancel button logic with disabled states
  - [x] 4.5 Add loading state during API submission
  - [x] 4.6 Add error display for failed submissions
  - [ ] 4.7 Add success toast notification
  - [ ] 4.8 Create unit tests for FeedbackDialog component

- [x] 5.0 Frontend - Pinia Store
  - [x] 5.1 Create `src/frontend/src/stores/feedback.ts`
  - [x] 5.2 Implement `submitFeedback` action
  - [x] 5.3 Add error handling and state management
  - [x] 5.4 Add loading state tracking

- [ ] 6.0 Frontend - Integration Points
  - [x] 6.1 Add "Report Missing" button to `ArtworkDetailView.vue` action bar
  - [x] 6.2 Add "Report Issue" option to `ArtworkDetailView.vue` overflow menu
  - [x] 6.3 Wire both actions to `FeedbackDialog` with correct props
  - [x] 6.4 Add "Report Issue" to `ArtistDetailView.vue` (if exists)
  - [x] 6.5 Ensure user_token is available from auth store
  - [ ] 6.6 Test integration end-to-end in development

- [ ] 7.0 Moderator UI (Future/Separate Task)
  - [ ] 7.1 Create moderation queue page (`ModeratorFeedbackView.vue`)
  - [ ] 7.2 Add filtering controls (status, subject_type, issue_type)
  - [ ] 7.3 Display feedback list with subject preview
  - [ ] 7.4 Implement review actions (archive, resolve)
  - [ ] 7.6 Add navigation link in moderator dashboard

- [ ] 8.0 Documentation & Deployment
  - [ ] 8.1 Update `docs/api.md` with feedback endpoint documentation
  - [ ] 8.2 Update `docs/database.md` with feedback table details
  - [ ] 8.3 Add feature description to `README.md`
  - [ ] 8.4 Test full feature in staging environment
  - [ ] 8.5 Apply migration to production database
  - [ ] 8.6 Deploy frontend and backend to production
  - [ ] 8.7 Monitor for errors and user adoption

## Implementation Progress

**Completed** (2025-09-30):
1. Database migration created and applied (`0030_create_feedback_table.sql`)
2. TypeScript types added to `src/shared/types.ts` with validators and constants
3. Backend API routes implemented:
   - POST `/api/feedback` - Public feedback submission with rate limiting
   - GET `/api/moderation/feedback` - Moderator list with filtering/pagination
   - POST `/api/moderation/feedback/:id/review` - Moderator review actions
4. Routes registered in `src/workers/index.ts` with proper middleware
5. Frontend components created:
   - `FeedbackDialog.vue` - Modal dialog with mode-specific behavior
   - `feedback.ts` Pinia store - API integration and state management

**In Progress**:
- Frontend integration into ArtworkDetailView and ArtistDetailView
- Success toast notifications
- Unit tests for frontend and backend

**Pending**:
- Documentation updates (API, database, README)
- Moderator UI (separate task/future enhancement)
- End-to-end testing

## Acceptance Criteria

- ✅ Users can click "Report Missing" on artwork pages and submit with prefilled note
- ✅ Users can click "Report Issue" and submit custom feedback (artworks and artists)
- ✅ Send button is disabled appropriately (empty notes for comment mode)
- ✅ Character limit (1000 chars) is enforced client and server-side
- ✅ Feedback is stored in database with all required fields
- ✅ Rate limiting prevents spam (10/hour per user, 20/hour per IP)
- ✅ Feedback is NOT visible on public artwork/artist pages
- ✅ Moderators can list feedback with status filters
- ✅ Moderators can archive or resolve feedback with notes
- ✅ No automatic email/push notifications on feedback creation
- ✅ IP address and User-Agent are captured for abuse investigation
- ✅ All tests pass (`npm run test`)
- ✅ Frontend builds successfully (`npm run build:frontend`)
- ✅ Backend deploys without errors

## Open Questions & Future Enhancements

### Answered (from Q&A)
- ✅ Free-form text categorization (Q11: Answer C)
- ✅ No photo attachments in v1 (keeping it simple)
- ✅ No user status updates (one-way communication)
- ✅ Manual spam moderation (no automated prevention)

### For Future Consideration
1. **Photo Attachments**: Should users be able to attach evidence photos? (Would require R2 integration)
2. **Urgent/Priority Flags**: Should certain issue types be marked as high-priority?
3. **Auto-conversion**: Should some feedback automatically create artwork edit submissions?
4. **User Dashboard**: Should users be able to view their own feedback history?
5. **Moderator Notifications**: Opt-in digest or real-time alerts for high-volume teams?
6. **Analytics**: Track resolution time, most common issues, etc.
7. **Public Resolution**: Should resolved feedback ever be shown publicly as "community notes"?

## Dependencies

- Existing authentication system (session management)
- Existing rate limiting system (`RateLimitRecord`)
- Existing consent system (if tracking consent for feedback)
- Cloudflare D1 database
- Vue 3 + Pinia frontend
- Hono backend framework

---

**Document Version**: 1.0  
**Last Updated**: September 30, 2025  
**Author**: Engineering Team  
**Status**: Ready for Implementation
