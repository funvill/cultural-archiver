# Progress: Clerk User ID vs User UUID Integration

## Issue Overview

Currently, the database uses `uuid` as the primary key for the `users` table, but we're integrating Clerk authentication which provides its own `clerk_user_id`. We need to establish a proper mapping between these two identifiers.

## Current State

### Database Schema

The `users` table has both identifiers:
- `uuid TEXT PRIMARY KEY` - Our internal user identifier
- `clerk_user_id TEXT NULL` - Clerk's external identifier

```sql
CREATE TABLE users (
  uuid TEXT PRIMARY KEY CHECK (...),
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT,
  email_verified_at TEXT,
  status TEXT CHECK (status IN ('active','suspended')),
  profile_name TEXT CHECK (...),
  clerk_user_id TEXT NULL
);
```

### Current References

Other tables reference the `uuid` field:
- **submissions**: `user_token TEXT NOT NULL` (references users.uuid)
- **artwork**: likely has creator/submitter references
- **user_lists**: user ownership
- **user_permissions**: permission assignments

## Problem Statement

When a user authenticates via Clerk:
1. Browser receives `clerk_user_id` from Clerk
2. On page refresh, we only have `clerk_user_id` available
3. We need to map `clerk_user_id` → `uuid` to access:
   - User permissions
   - User lists
   - Submission history
   - Any other user-associated data

## Proposed Solution

### 1. Add Database Index

Create an index on `clerk_user_id` for efficient lookups:

```sql
CREATE INDEX idx_users_clerk_id ON users(clerk_user_id);
```

**Rationale**: 
- Enables fast lookup: `SELECT uuid FROM users WHERE clerk_user_id = ?`
- Required for every authenticated request
- clerk_user_id should be unique (one Clerk user = one app user)

### 2. Consider Adding UNIQUE Constraint

```sql
ALTER TABLE users ADD CONSTRAINT unique_clerk_id UNIQUE (clerk_user_id);
```

**Benefits**:
- Enforces one-to-one mapping
- Prevents duplicate Clerk accounts
- Database-level integrity

**Considerations**:
- Handle NULL values (users created before Clerk integration)
- Migration strategy for existing data

### 3. API Layer Changes

**External Interface** (Clerk-facing):
- Accept `clerk_user_id` in authentication headers
- Convert to internal `uuid` early in middleware
- Return `clerk_user_id` in public responses

**Internal Use** (Application code):
- Always use `uuid` for database operations
- Store `uuid` in session/context after authentication
- Use `uuid` for foreign key references

## Implementation Plan

### Phase 1: Database Schema ✓ (Check Current State)
- [ ] Review existing `users` table structure
- [ ] Check if `clerk_user_id` is already indexed
- [ ] Verify data integrity (any NULL values, duplicates)
- [ ] Review migration history

### Phase 2: Create Migration
- [ ] Create migration file: `src/workers/migrations/000X_add_clerk_user_id_index.sql`
- [ ] Add index: `CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_user_id);`
- [ ] Consider UNIQUE constraint (or separate migration)
- [ ] Test on development database
- [ ] Document in `docs/database.md`

### Phase 3: Code Review
- [ ] Identify all authentication flows
- [ ] Find where `clerk_user_id` is received
- [ ] Locate user lookup/creation logic
- [ ] Review middleware/authentication layer
- [ ] Check API endpoints that accept user identifiers

### Phase 4: Implementation
- [ ] Create utility function: `getUserByClerkId(clerk_user_id) -> uuid`
- [ ] Update authentication middleware to map clerk_user_id → uuid
- [ ] Store `uuid` in request context/session
- [ ] Ensure all internal operations use `uuid`
- [ ] Update API responses to return `clerk_user_id` externally

### Phase 5: Testing
- [ ] Test user creation with Clerk ID
- [ ] Test login flow (clerk_user_id → uuid mapping)
- [ ] Test session persistence across refresh
- [ ] Test permission checks
- [ ] Test user list access
- [ ] Verify submission attribution

### Phase 6: Documentation
- [ ] Update `docs/authentication.md`
- [ ] Update `docs/database.md`
- [ ] Document the ID mapping strategy
- [ ] Add troubleshooting section

## Technical Considerations

### Performance
- Index on `clerk_user_id` is critical for auth performance
- Consider caching clerk_user_id → uuid mapping
- Measure query performance on production data

### Data Integrity
- Ensure clerk_user_id uniqueness
- Handle edge cases (NULL values, missing Clerk IDs)
- Migration strategy for legacy users

### Security
- Validate clerk_user_id format
- Prevent clerk_user_id spoofing
- Verify Clerk JWT signatures

### Backwards Compatibility
- Support users without Clerk IDs (legacy)
- Handle transition period
- Provide migration path

## Questions to Resolve

1. **Should clerk_user_id be UNIQUE?**
   - Recommendation: Yes, enforce one-to-one mapping

2. **How to handle existing users without Clerk IDs?**
   - Migration strategy needed
   - Link existing users to Clerk accounts

3. **Should we expose uuid externally or only clerk_user_id?**
   - Recommendation: Only expose clerk_user_id
   - Keep uuid as internal identifier

4. **Caching strategy?**
   - Cache clerk_user_id → uuid mapping
   - Cache duration and invalidation

5. **What happens if Clerk account is deleted?**
   - Soft delete user?
   - Maintain data attribution?

## Related Files

- Database schema: `_backup_database/database_production_2025-10-26-22-28-03.sql`
- Database docs: `docs/database.md`
- Auth docs: `docs/authentication.md`
- Migrations: `src/workers/migrations/`
- API routes: `src/workers/routes/auth.ts`
- Types: `src/shared/types.ts`

## Code Analysis Findings

### Current Implementation State

**Migration 0037** already added `clerk_user_id` column to users table with:

- ✅ Column: `clerk_user_id TEXT NULL`
- ✅ Index: `idx_users_clerk_user_id` for lookups
- ✅ Unique constraint: `unique_users_clerk_user_id` (with NULL handling)

**Key Files:**

- `src/workers/routes/clerk-user.ts` - Handles Clerk user creation/lookup
- `src/workers/routes/clerk-webhooks.ts` - Processes Clerk lifecycle events
- `src/workers/middleware/clerk-auth.ts` - Authentication middleware
- `src/workers/lib/auth.ts` - Core auth utilities

### Current Clerk → UUID Mapping Flow

**Middleware (`clerk-auth.ts`):**

1. Extract Clerk JWT from `Authorization: Bearer <token>` header
2. Verify token and extract `clerkUserId` from `payload.sub`
3. Query: `SELECT uuid FROM users WHERE clerk_user_id = ?`
4. If found: use existing `uuid` as `userToken`
5. If not found: create new user with `uuid` + `clerk_user_id`
6. Store `userToken` (uuid) in context for internal use

**User Creation (`clerk-user.ts`):**

```typescript
// POST /api/auth/clerk/user
// Check if user exists
let user = await db
  .prepare('SELECT * FROM users WHERE clerk_user_id = ?')
  .bind(clerkUserId)
  .first();

if (!user) {
  // Create new user
  const userId = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO users (uuid, clerk_user_id, email, email_verified_at, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(userId, clerkUserId, userEmail, now, now, 'active').run();
}

return { token: user.uuid }; // Returns UUID as token
```

**Webhook Handling (`clerk-webhooks.ts`):**

- `user.created`: Creates user record with `clerk_user_id`
- `user.updated`: Updates email and verification status
- `user.deleted`: Removes user and cascades to related tables

### Good News: Index Already Exists! ✅

The database **already has** the required index:

```sql
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_users_clerk_user_id ON users(clerk_user_id) WHERE clerk_user_id IS NOT NULL;
```

### Current Architecture is Correct

The system **already implements** the desired pattern:

- **External**: Uses `clerk_user_id` for Clerk authentication
- **Internal**: Uses `uuid` for all database operations
- **Mapping**: Middleware converts `clerk_user_id` → `uuid` early
- **Storage**: Context stores `uuid` as `userToken`

### What's Working

1. ✅ Clerk JWT verification extracts `clerkUserId`
2. ✅ Database lookup: `WHERE clerk_user_id = ?` returns `uuid`
3. ✅ All internal operations use `uuid` (stored as `userToken`)
4. ✅ Foreign keys reference `users.uuid`
5. ✅ Session persistence across page refresh
6. ✅ Webhook lifecycle management

### Identified Issues

**Problem 1: No Utility Function**

- Current code duplicates lookup logic across files
- Need centralized `getUserByClerkId(clerk_user_id) -> uuid` function

**Problem 2: Type Safety**

- No TypeScript interface for Clerk → UUID mapping
- Casting to `(c as any).clerkUserId` is type-unsafe

**Problem 3: Error Handling**

- Missing error handling for database lookup failures
- No logging for mapping failures

**Problem 4: Documentation Gap**

- `docs/authentication.md` doesn't explain Clerk integration
- `docs/database.md` doesn't document clerk_user_id column

## Revised Implementation Plan

### Phase 1: Code Organization ✅ (Enhancement)

Create centralized utility functions in `src/workers/lib/clerk-utils.ts`:

```typescript
// Get user UUID by Clerk ID with proper error handling
export async function getUserByClerkId(
  db: D1Database, 
  clerkUserId: string
): Promise<string | null>

// Create or update user from Clerk data
export async function syncUserFromClerk(
  db: D1Database,
  clerkUserId: string,
  clerkUserData: ClerkUserData
): Promise<UserRecord>
```

### Phase 2: Type Safety Improvements

Add TypeScript interfaces to `src/shared/types.ts`:

```typescript
export interface ClerkAuthContext extends AuthContext {
  clerkUserId?: string;
  clerkAuthenticated: boolean;
  clerkUserData?: ClerkUser;
}

export interface ClerkUserMapping {
  clerk_user_id: string;
  uuid: string;
  email: string;
  synced_at: string;
}
```

### Phase 3: Refactor Existing Code

- Update middleware to use new utility functions
- Replace direct queries with centralized lookups
- Add comprehensive error handling and logging

### Phase 4: Testing

- Unit tests for `getUserByClerkId`
- Integration tests for Clerk → UUID mapping
- Test session persistence across refresh
- Test webhook user creation flow

### Phase 5: Documentation

Update documentation files:

- `docs/authentication.md` - Add Clerk integration section
- `docs/database.md` - Document clerk_user_id column and indexes
- Add architecture diagram showing Clerk → UUID mapping flow

## Questions Resolved

### 1. Should clerk_user_id be UNIQUE?

**Answer**: ✅ Already implemented via `unique_users_clerk_user_id` index (with NULL handling)

### 2. How to handle existing users without Clerk IDs?

**Answer**: Current system supports mixed authentication:

- Existing users: `clerk_user_id IS NULL` (legacy magic link)
- New users: `clerk_user_id NOT NULL` (Clerk authenticated)
- Transition: Webhook updates existing users when they authenticate via Clerk

### 3. Should we expose uuid externally or only clerk_user_id?

**Answer**: Current implementation is correct:

- **External API**: Returns `uuid` as `token` (for backward compatibility)
- **Internal**: Always uses `uuid` for database operations
- **Clerk Integration**: `clerk_user_id` stored but not exposed in public APIs

### 4. Caching strategy?

**Answer**: Not needed currently:

- Database index makes lookup fast (< 1ms)
- Middleware does single lookup per request
- Context stores result for request lifecycle
- Consider caching if performance issues arise

### 5. What happens if Clerk account is deleted?

**Answer**: ✅ Already handled via webhooks:

```typescript
// clerk-webhooks.ts - user.deleted event
await env.DB.prepare(`DELETE FROM users WHERE clerk_user_id = ?`).bind(userData.id);
// CASCADE deletes related records (sessions, roles, submissions)
```

## Next Steps

### Immediate Actions

1. ✅ **No migration needed** - Index already exists
2. 🔨 Create utility library `src/workers/lib/clerk-utils.ts`
3. 🔨 Add TypeScript types for Clerk authentication
4. 🔨 Refactor middleware to use centralized functions
5. 🔨 Add comprehensive unit tests
6. 📝 Update documentation

### Optional Enhancements

- Add Clerk user sync audit logging
- Implement user merge functionality (legacy → Clerk)
- Add admin endpoint to view Clerk → UUID mappings
- Create monitoring dashboard for auth flow

## Related Files

- Database schema: `_backup_database/database_production_2025-10-26-22-28-03.sql`
- Database docs: `docs/database.md`
- Auth docs: `docs/authentication.md`
- Migration: `src/workers/migrations/0037_add_clerk_user_id_to_users.sql`
- Middleware: `src/workers/middleware/clerk-auth.ts`
- User creation: `src/workers/routes/clerk-user.ts`
- Webhooks: `src/workers/routes/clerk-webhooks.ts`
- Core auth: `src/workers/lib/auth.ts`
- Types: `src/shared/types.ts`

---

**Status**: Analysis Complete - Implementation Ready  
**Created**: 2025-10-26  
**Last Updated**: 2025-10-26

**Summary**: The database index and mapping system are already in place and working correctly. The main tasks are code organization, type safety improvements, and documentation updates.
