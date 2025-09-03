# Tasks for PRD: Moderator Screen (Review Queue)

## Relevant Files

- `migrations/007_permissions_audit_tables.sql` - New database migration for permission management and audit tables.
- `src/workers/middleware/auth.ts` - Update existing auth middleware to use database-backed permissions instead of hardcoded logic.
- `src/workers/routes/admin.ts` - New API route handlers for admin permission management and audit viewing.
- `src/workers/routes/admin.test.ts` - Unit tests for admin route handlers.
- `src/workers/lib/permissions.ts` - New utility functions for permission management and checking.
- `src/workers/lib/permissions.test.ts` - Unit tests for permission utilities.
- `src/workers/lib/audit.ts` - New utility functions for audit logging and retrieval.
- `src/workers/lib/audit.test.ts` - Unit tests for audit utilities.
- `src/workers/routes/review.ts` - Update existing review routes to use new permission system and audit logging.
- `src/frontend/src/views/AdminView.vue` - New admin interface for permission management and audit viewing.
- `src/frontend/src/views/AdminView.test.ts` - Unit tests for admin view component.
- `src/frontend/src/components/PermissionManager.vue` - New component for managing user permissions.
- `src/frontend/src/components/PermissionManager.test.ts` - Unit tests for permission manager component.
- `src/frontend/src/components/AuditLogViewer.vue` - New component for viewing moderation decision audit logs.
- `src/frontend/src/components/AuditLogViewer.test.ts` - Unit tests for audit log viewer component.
- `src/frontend/src/stores/auth.ts` - Update existing auth store to handle new permission system.
- `src/frontend/src/services/admin.ts` - New API service for admin operations.
- `src/frontend/src/services/admin.test.ts` - Unit tests for admin service.
- `src/frontend/src/router/index.ts` - Update router to include admin routes with proper guards.
- `src/shared/types.ts` - Update shared types to include new permission and audit interfaces.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npm run test` to run all tests in the project.
- The existing ReviewView.vue and review API endpoints will remain largely unchanged, with enhancements for audit logging.

## Tasks

- [x] 1.0 Database Schema Enhancement for Permissions and Audit
  - [x] 1.1 Create migration file `007_permissions_audit_tables.sql` with user_permissions table
  - [x] 1.2 Add moderation_decisions audit table with comprehensive logging fields
  - [x] 1.3 Add admin_actions audit table for permission management tracking
  - [x] 1.4 Include proper foreign key constraints and indexes for performance
  - [x] 1.5 Add sample data for testing permission system functionality
  - [x] 1.6 Test migration with existing database to ensure no conflicts

- [x] 2.0 Backend Permission System Implementation
  - [x] 2.1 Create `src/workers/lib/permissions.ts` with permission management utilities
  - [x] 2.2 Add functions for checking, granting, and revoking permissions
  - [x] 2.3 Implement permission caching layer to optimize database queries
  - [x] 2.4 Update `src/workers/middleware/auth.ts` to use database-backed permissions
  - [x] 2.5 Replace hardcoded reviewer logic with dynamic permission checking
  - [x] 2.6 Add admin permission validation for administrative actions
  - [x] 2.7 Write comprehensive unit tests for permission utilities

- [x] 3.0 Audit Trail System Implementation
  - [x] 3.1 Create `src/workers/lib/audit.ts` with audit logging utilities
  - [x] 3.2 Add functions for logging moderation decisions with metadata
  - [x] 3.3 Implement admin action logging for permission changes
  - [x] 3.4 Add audit log retrieval functions with filtering and pagination
  - [x] 3.5 Update existing review routes to log all moderation decisions
  - [x] 3.6 Include session info (IP, user agent) in audit entries
  - [x] 3.7 Write unit tests for audit logging functionality

- [x] 4.0 Admin API Endpoints Development
  - [x] 4.1 Create `src/workers/routes/admin.ts` with admin-only route handlers
  - [x] 4.2 Implement GET `/api/admin/permissions` endpoint for listing user permissions
  - [x] 4.3 Implement POST `/api/admin/permissions/grant` endpoint for granting permissions
  - [x] 4.4 Implement POST `/api/admin/permissions/revoke` endpoint for revoking permissions
  - [x] 4.5 Implement GET `/api/admin/audit` endpoint for retrieving audit logs
  - [x] 4.6 Add proper admin permission validation to all admin endpoints
  - [x] 4.7 Implement rate limiting and input validation for admin actions
  - [x] 4.8 Write comprehensive unit tests for admin API endpoints

- [x] 5.0 Frontend Admin Interface Development
  - [x] 5.1 Create `src/frontend/src/views/AdminView.vue` with admin dashboard layout
  - [x] 5.2 Create `src/frontend/src/components/PermissionManager.vue` for user permission management
  - [x] 5.3 Create `src/frontend/src/components/AuditLogViewer.vue` for viewing moderation decisions
  - [x] 5.4 Implement permission granting/revoking UI with confirmation dialogs
  - [x] 5.5 Add searchable and filterable audit log display with pagination
  - [x] 5.6 Create `src/frontend/src/services/admin.ts` for admin API service layer
  - [x] 5.7 Update auth store to handle admin permissions and role checking
  - [ ] 5.8 Add admin route to router with proper permission guards
  - [ ] 5.9 Implement responsive design for admin interface components
  - [x] 5.10 Write unit tests for all new admin components and services

- [ ] 6.0 Integration and Testing
  - [ ] 6.1 Run database migration and verify schema changes in development
  - [ ] 6.2 Test permission system end-to-end with different user roles
  - [ ] 6.3 Verify audit logging captures all moderation decisions correctly
  - [ ] 6.4 Test admin interface functionality with permission management
  - [ ] 6.5 Validate that existing moderation workflow remains unchanged
  - [ ] 6.6 Run full test suite to ensure no regressions in existing functionality
  - [ ] 6.7 Test performance impact of new permission checking and audit logging
  - [x] 6.8 Update shared types to include new interfaces and ensure type safety
  - [ ] 6.9 Verify accessibility compliance for new admin interface components
  - [ ] 6.10 Document new admin features and permission system in project docs
