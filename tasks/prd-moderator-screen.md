# PRD – Moderator Screen (Review Queue)

## Introduction/Overview

The Moderator Screen is a **review queue interface** where moderators can quickly check user-submitted artwork content for obvious abuse, spam, or inappropriate material. This feature builds on the existing `/api/review/*` endpoints to provide a streamlined frontend interface for content moderation.

Moderators review submissions using a card-stack interface with keyboard shortcuts, focusing on keeping the platform safe while maintaining low volunteer effort. The system integrates with the existing authentication system and extends it with role-based permissions.

**Goal**: Provide a simple, efficient moderation workflow that keeps the Cultural Archiver platform safe and useful while minimizing moderator fatigue.

## Goals

1. **Fast Review Interface**: Enable moderators to process submissions quickly using keyboard shortcuts and auto-advance workflow
2. **Role-Based Access**: Implement moderator and admin permission system with proper access controls  
3. **Audit Trail**: Log all moderation decisions for transparency and accountability
4. **Queue Management**: Provide paginated queue with clear submission details and status tracking
5. **Accessibility**: Ensure screen reader compatibility for inclusive moderation

## User Stories

### Core Moderator Stories

- **US-1**: As a moderator, I want to quickly see if a photo is appropriate so I can approve good content fast
- **US-2**: As a moderator, I want keyboard shortcuts so I can moderate efficiently without using mouse
- **US-3**: As a moderator, I want to skip submissions I'm unsure about so I don't block the queue

### Admin Stories

- **US-4**: As an admin, I want to assign moderator permissions so I can manage the team
- **US-5**: As an admin, I want to see queue health so I know if moderation is keeping up

### Error Handling Stories

- **US-6**: As a moderator, I want clear error messages so I know what went wrong

### Accessibility Stories

- **US-7**: As a moderator using screen reader, I want proper labels so I can moderate accessibly

## Functional Requirements

### 1. Permission System

1.1. Create `user_permissions` table with `user_uuid` and `permission` columns supporting 'moderator' and 'admin' roles
1.2. Extend authentication middleware to check moderator permissions for `/review` route access
1.3. Admin role must include all moderator permissions plus permission management capabilities
1.4. System must validate permissions on every moderation action

### 2. Review Queue Interface

2.1. Create `/review` route accessible only to users with moderator permissions
2.2. Display submissions in card-stack interface showing one submission at a time
2.3. Show submission photo/thumbnail, location, timestamp, and action buttons for each submission
2.4. Implement pagination with 10 submissions per page with next/previous navigation
2.5. Default ordering must be oldest submissions first
2.6. System must auto-scroll to keep current submission visible during navigation

### 3. Moderation Actions

3.1. Provide **Approve** button that makes content live and advances to next submission
3.2. Provide **Reject** button that discards content, logs decision, and advances to next submission  
3.3. Provide **Flag** button that changes submission status to 'flagged' and removes from moderator queue
3.4. Provide **Skip** button that moves to next submission without taking action
3.5. Show success feedback message after each action before auto-advancing
3.6. All actions must be logged in `moderation_decisions` table

### 4. Keyboard Shortcuts

4.1. Implement `A` key for approve action
4.2. Implement `R` key for reject action  
4.3. Implement `S` key for skip action
4.4. Implement `?` key to show/hide keyboard shortcuts help
4.5. Implement `J`/`K` or arrow keys for navigation between submissions
4.6. Display keyboard shortcuts reference on screen for moderator reference

### 5. Access Control & Navigation

5.1. Redirect non-moderators to home page when accessing `/review` route
5.2. Show toast notification "Access denied" before redirecting unauthorized users
5.3. Redirect to login page if user is not authenticated
5.4. Integrate review link into main application navigation for moderators only

### 6. Data Persistence & Audit

6.1. Create `moderation_decisions` table with fields: `submission_id`, `moderator_uuid`, `decision`, `timestamp`
6.2. Log every moderation action (approve, reject, flag) with moderator identity and timestamp
6.3. Link moderation decisions to existing logbook submissions via `submission_id`
6.4. Ensure audit trail is preserved even when submissions are deleted after rejection

### 7. Error Handling

7.1. Display browser alert for network failures during moderation actions
7.2. Allow moderators to retry failed actions using same interface
7.3. Show clear error messages that explain what went wrong
7.4. Handle empty queue state with appropriate "No submissions to review" message

### 8. Integration with Existing System

8.1. Consume existing `/api/review/queue` endpoint for submission data
8.2. Use existing `/api/review/approve` and `/api/review/reject` endpoints for actions
8.3. Extend existing `AuthContext` type to include moderator role information
8.4. Build on existing `isReviewer` permission system without breaking current functionality

## Non-Goals (Out of Scope)

- **Advanced Moderation Features**: No crowdsourced voting, trust scores, or user reputation systems
- **Fact-Checking Workflows**: Moderators only check for abuse, not content accuracy
- **Metadata Editing**: No capability to edit submission content during review (future feature)
- **Batch Operations**: No multi-select or bulk approve/reject functionality  
- **Mobile Optimization**: Desktop-first interface (mobile support is future enhancement)
- **Performance Metrics**: No moderation speed tracking or moderator leaderboards
- **Advanced Filtering**: No filtering by submission type, location, or date ranges
- **Appeal Process**: No mechanism for users to contest rejected submissions

## Design Considerations

### UI/UX Requirements

- **Card-Stack Layout**: Single submission visible at a time with clear action buttons
- **Minimal Interface**: Focus on content and actions, minimize visual clutter
- **Standard Buttons**: Use existing component library button styles for consistency
- **Toast Notifications**: Use application's existing toast system for user feedback
- **Responsive Text**: Ensure submission notes and metadata are clearly readable

### Accessibility Requirements

- **Screen Reader Support**: All interactive elements must have proper ARIA labels
- **Keyboard Navigation**: Full functionality available via keyboard shortcuts
- **High Contrast**: Ensure sufficient color contrast for action buttons
- **Focus Management**: Clear visual focus indicators for keyboard navigation

## Technical Considerations

### Database Schema Extensions

```sql
-- New permissions table
CREATE TABLE user_permissions (
  user_uuid TEXT NOT NULL,
  permission TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  granted_by TEXT,
  PRIMARY KEY (user_uuid, permission),
  FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE
);

-- New moderation decisions audit table  
CREATE TABLE moderation_decisions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  submission_id TEXT NOT NULL,
  moderator_uuid TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'flagged')),
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (submission_id) REFERENCES logbook(id) ON DELETE CASCADE,
  FOREIGN KEY (moderator_uuid) REFERENCES users(uuid) ON DELETE SET NULL
);
```

### API Integration

- **Authentication**: Extend existing auth middleware to check moderator permissions
- **Queue Endpoint**: Use existing `/api/review/queue` with pagination parameters
- **Action Endpoints**: Leverage existing `/api/review/approve` and `/api/review/reject` endpoints
- **Permission Check**: Add permission validation to all moderation endpoints

### Frontend Architecture

- **Vue Router**: Add `/review` route with beforeEnter guard for permission checking
- **Composables**: Create `useModeration()` composable for queue management and actions
- **Components**: Build reusable `SubmissionCard` and `ModerationActions` components
- **State Management**: Use Pinia store for moderation queue state and pagination

## Success Metrics

### MVP Success Criteria

1. **Functional Moderation**: Moderators can successfully approve/reject submissions using the interface
2. **Permission Security**: Only authorized moderators can access the review interface
3. **Audit Compliance**: All moderation decisions are logged with proper moderator attribution
4. **Performance**: Queue loads and actions complete within 2 seconds on standard connections
5. **Accessibility**: Interface passes basic screen reader testing

### Post-Launch Metrics (Not in MVP)

- Moderation queue processing speed
- Average time to moderate per submission  
- Moderator activity and retention rates
- Queue backlog and health indicators

## Open Questions

1. **Admin Interface**: Should admins have a separate interface for managing flagged submissions, or handle them through the same queue?
2. **Permission Management**: Should there be a UI for admins to grant/revoke moderator permissions, or handle this via database/API initially?
3. **Queue Refresh**: Should the queue auto-refresh when new submissions arrive, or require manual page refresh?
4. **Submission Context**: Should moderators see related submissions from the same user token for context (while maintaining blind moderation)?
5. **Mobile Support Timeline**: When should mobile-optimized moderation interface be prioritized for the roadmap?

---

**Document Version**: 1.0  
**Created**: September 2, 2025  
**Target Audience**: Junior developers implementing moderation system  
**Dependencies**: Existing authentication system, review API endpoints, Vue 3 frontend framework
