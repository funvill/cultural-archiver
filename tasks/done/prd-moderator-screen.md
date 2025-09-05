# PRD – Moderator Screen (Review Queue)

## Introduction/Overview

The Moderator Screen is a **review queue interface** where moderators can quickly check user-submitted artwork content for obvious abuse, spam, or inappropriate material. This feature leverages the existing `/api/review/*` endpoints and `ReviewView.vue` frontend component that have already been implemented.

The review system includes a fully functional frontend interface with card-stack layout, keyboard shortcuts, and moderation actions. The system integrates with the implemented UUID-based authentication system with `isReviewer` permission checking.

**Goal**: Enhance the existing moderation workflow with improved permission management, audit trails, and admin capabilities while maintaining the current efficient moderation interface.

**Current Status**: ✅ **Core moderation interface implemented** - The basic review queue with approve/reject functionality is already working. This PRD focuses on adding permission management and audit capabilities.

## Goals

1. **Enhanced Permission Management**: Implement granular moderator and admin permission system with database-backed role management
2. **Audit Trail Implementation**: Add comprehensive logging of all moderation decisions for transparency and accountability
3. **Admin Interface**: Provide admin capabilities for managing moderator permissions and reviewing audit logs
4. **Queue Health Monitoring**: Add tools for admins to monitor moderation queue performance and moderator activity
5. **Enhanced Security**: Strengthen permission validation and add admin-specific security controls

## User Stories

### Core Moderator Stories

- **US-1**: As a moderator, I want to quickly see if a photo is appropriate so I can approve good content fast
- **US-2**: As a moderator, I want keyboard shortcuts so I can moderate efficiently without using mouse
- **US-3**: As a moderator, I want to skip submissions I'm unsure about so I don't block the queue

### Admin Stories (**🚧 New Requirements**)

- **US-4**: As an admin, I want to assign moderator permissions so I can manage the moderation team
- **US-5**: As an admin, I want to see queue health and moderator activity so I know if moderation is keeping up
- **US-6**: As an admin, I want to review audit logs so I can monitor moderation decisions and resolve disputes

### Enhanced Security Stories (**🚧 New Requirements**)

- **US-7**: As a system admin, I want comprehensive audit trails so I can track all moderation actions
- **US-8**: As an admin, I want to manage permission escalation so I can grant/revoke admin access securely

### Accessibility Stories

- **US-9**: As a moderator using screen reader, I want proper labels so I can moderate accessibly

## Functional Requirements

### 1. Permission System Enhancement (**🚧 New Requirements**)

1.1. Create `user_permissions` table with `user_uuid` and `permission` columns supporting 'moderator' and 'admin' roles 1.2. Extend existing authentication middleware to check moderator permissions using database records instead of hardcoded logic 1.3. Admin role must include all moderator permissions plus permission management capabilities 1.4. System must validate permissions on every moderation action using database lookups 1.5. Add permission caching layer to avoid database queries on every request

### 2. Review Queue Interface

2.1. `/review` route accessible only to users with moderator permissions 2.2. Card-stack interface showing one submission at a time 2.3. Submission details including photo, location, timestamp, and action buttons 2.4. Pagination with submission navigation 2.5. Oldest submissions first ordering 2.6. Auto-scroll and navigation features

### 3. Moderation Actions

3.1. **Approve** button functionality 3.2. **Reject** button with reason tracking 3.3. **Skip** button for uncertain submissions 3.4. Success feedback and auto-advance 3.5. Backend logging via existing API endpoints

### 4. Keyboard Shortcuts

4.1. `A` key for approve action 4.2. `R` key for reject action 4.3. `S` key for skip action 4.4. `?` Keyboard shortcuts help display 4.5. Arrow key navigation

### 5. Access Control & Navigation

5.1. Non-moderator redirect to home page 5.2. "Access denied" toast notification 5.3. Authentication requirement handling 5.4. Review link in navigation for moderators

### 6. Data Persistence & Audit (**🚧 Enhancement Required**)

6.1. **NEW:** Create `moderation_decisions` audit table with fields: `id`, `submission_id`, `moderator_uuid`, `decision`, `timestamp`, `notes` 6.2. **NEW:** Log every moderation action in audit table (approve, reject, skip) with moderator identity 6.3. **NEW:** Link decisions to existing logbook submissions via `submission_id` 6.4. **NEW:** Preserve audit trail even when submissions are deleted 6.5. **NEW:** Add audit query capabilities for admin review

### 7. Error Handling

7.1. Network failure handling with retry options 7.2. Clear error messages with recovery guidance 7.3. Empty queue state handling

### 8. Integration with Existing System

8.1. Uses existing `/api/review/queue` endpoint 8.2. Uses existing `/api/review/approve` and `/api/review/reject` endpoints 8.3. Integrates with existing `AuthContext` and `isReviewer` system

## Non-Goals (Out of Scope)

- **Advanced Moderation Features**: No crowdsourced voting, trust scores, or user reputation systems _(unchanged)_
- **Fact-Checking Workflows**: Moderators only check for abuse, not content accuracy _(unchanged)_
- **Metadata Editing**: No capability to edit submission content during review _(future feature)_
- **Batch Operations**: No multi-select or bulk approve/reject functionality _(future feature)_
- **Mobile Optimization**: Desktop-first interface _(mobile support via responsive design already implemented)_
- **Performance Metrics Dashboard**: No detailed moderation speed tracking or moderator leaderboards _(basic statistics already implemented)_
- **Advanced Filtering**: No filtering by submission type, location, or date ranges _(basic filtering already implemented)_
- **Appeal Process**: No mechanism for users to contest rejected submissions _(future feature)_
- **UI/UX Changes**: The existing ReviewView.vue interface will not be redesigned _(interface already optimized)_

## Design Considerations

### UI/UX Requirements

- **Card-Stack Layout**: Single submission visible with clear action buttons
- **Minimal Interface**: Focus on content and actions, minimal clutter
- **Standard Buttons**: Uses existing component library button styles
- **Toast Notifications**: Uses application's existing toast system
- **Responsive Text**: Submission notes and metadata clearly readable

### Accessibility Requirements

- **Screen Reader Support**: All interactive elements have proper ARIA labels
- **Keyboard Navigation**: Full functionality via keyboard shortcuts
- **High Contrast**: Sufficient color contrast for action buttons
- **Focus Management**: Clear visual focus indicators

### New Admin Interface Requirements (**🚧 New**)

- **Permission Management UI**: Simple interface for granting/revoking moderator permissions
- **Audit Log Viewer**: Searchable table of moderation decisions with filtering
- **Queue Statistics Dashboard**: Enhanced metrics beyond current basic statistics
- **Admin Actions Logging**: All admin actions must be logged separately from moderation decisions

## Technical Considerations

### Database Schema Extensions (**🚧 New Requirements**)

```sql
-- New permissions table (extends existing authentication system)
CREATE TABLE user_permissions (
  id TEXT PRIMARY KEY,
  user_uuid TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('moderator', 'admin')),
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  granted_by TEXT NOT NULL, -- UUID of admin who granted permission
  revoked_at TEXT NULL,
  revoked_by TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(uuid) ON DELETE SET NULL,
  FOREIGN KEY (revoked_by) REFERENCES users(uuid) ON DELETE SET NULL
);

-- Enhanced moderation decisions audit table
CREATE TABLE moderation_decisions (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  moderator_uuid TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'skipped')),
  rejection_reason TEXT NULL,
  notes TEXT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  session_info TEXT NULL, -- JSON with IP, user agent, etc.
  FOREIGN KEY (submission_id) REFERENCES logbook(id) ON DELETE CASCADE,
  FOREIGN KEY (moderator_uuid) REFERENCES users(uuid) ON DELETE SET NULL
);

-- Admin actions audit table
CREATE TABLE admin_actions (
  id TEXT PRIMARY KEY,
  admin_uuid TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'grant_permission', 'revoke_permission', etc.
  target_uuid TEXT, -- User affected by action
  details TEXT, -- JSON with action details
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (admin_uuid) REFERENCES users(uuid) ON DELETE SET NULL,
  FOREIGN KEY (target_uuid) REFERENCES users(uuid) ON DELETE SET NULL
);
```

### API Integration

- **Authentication**: Uses existing auth middleware with `isReviewer` checks
- **Queue Endpoint**: Uses existing `/api/review/queue` with pagination
- **Action Endpoints**: Uses existing `/api/review/approve` and `/api/review/reject`
- Permission validation using database records instead of hardcoded logic
- Admin endpoints for permission management (`/api/admin/permissions`)
- Audit endpoints for decision tracking (`/api/admin/audit`)

### Frontend Architecture

- **Vue Router**: `/review` route with beforeEnter guard
- **Components**: Functional `ReviewView.vue` with card interface
- **State Management**: Uses existing auth store for permission checking
- Admin interface components for permission management
- Audit log viewing components
- Enhanced permission checking using database-backed roles

## Success Metrics

### MVP Success Criteria

1. **Functional Moderation**: Moderators can successfully approve/reject submissions using the interface
2. **Permission Security**: Only authorized moderators can access the review interface
3. **Performance**: Queue loads and actions complete within 2 seconds on standard connections
4. **Accessibility**: Interface passes WCAG AA compliance testing

### Enhanced Success Criteria

1. **Database-Backed Permissions**: All permission checks use database records instead of hardcoded logic
2. **Comprehensive Audit Trail**: All moderation decisions are logged with detailed metadata
3. **Admin Management**: Admins can grant/revoke moderator permissions through UI interface
4. **Audit Transparency**: Admin users can review complete moderation decision history

### Post-Launch Metrics (Not in MVP)

- Enhanced moderation queue processing analytics
- Permission change audit reports
- Moderator activity tracking and insights
- System security and access monitoring

## Open Questions

1. **Admin Interface Location**: Should admin permission management be a separate `/admin` route or integrated into the existing `/review` interface?

2. **Permission Granularity**: Should we implement role-based permissions (moderator, admin) or more granular permissions (approve_submissions, manage_users, view_audit_logs)?

3. **Audit Log Retention**: How long should moderation decision logs be retained, and should there be automatic cleanup policies?

4. **Permission Bootstrap**: How should the first admin user be created? Should this be done via database migration, environment variable, or special setup interface?

5. **Audit Log Access**: Should regular moderators have access to view their own moderation history, or should audit logs be admin-only?

6. **Performance Optimization**: Should permission checks be cached in Redis/KV storage to avoid database queries on every request?

7. **Security Alerts**: Should the system generate alerts for suspicious admin actions (mass permission changes, bulk rejections, etc.)?

---

**Document Version**: 2.0  
**Updated**: January 3, 2025  
**Previous Version**: 1.0 (September 2, 2025)  
**Target Audience**: Junior developers extending existing moderation system  
**Dependencies**: ✅ Existing authentication system, ✅ review API endpoints, ✅ Vue 3 frontend framework, ✅ ReviewView.vue component

**Status**: 🚧 **Enhancement Phase** - Core moderation functionality already implemented, focusing on permission management and audit capabilities.
