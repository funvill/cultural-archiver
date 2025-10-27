# Debug Status Page

## Overview

The debug status page (`/status`) provides comprehensive user and system information for troubleshooting authentication, permissions, and data issues.

## Access

- **Frontend URL**: `https://publicartregistry.com/status`
- **Backend API**: `https://api.publicartregistry.com/api/debug/status`

## Features

### User Information Display

The status page shows the following information based on the user's Clerk authentication:

#### 1. Authentication Status
- User Token (internal UUID)
- Clerk User ID (external identifier)
- Clerk Authentication Status
- Email Address
- Email Verification Status

#### 2. User Database Record
Full JSON representation of the user's database record from the `users` table, including:
- `uuid` - Internal user identifier
- `clerk_user_id` - Clerk authentication ID
- `email` - User's email address
- `created_at` - Account creation timestamp
- `email_verified_at` - Email verification timestamp
- `status` - Account status (active/suspended)
- `profile_name` - User's profile name

#### 3. Permissions & Roles
- **Permission Flags**:
  - Is Admin
  - Is Moderator
  - Can Review
  
- **Role Details**:
  - Role name (admin, moderator, user, etc.)
  - Granted by (which admin granted the role)
  - Granted at (timestamp)
  - Active status
  - Notes (reason for assignment)

#### 4. Recent Submissions (Last 3)
For each submission:
- Submission ID
- Type (logbook_entry, artwork_edit, etc.)
- Status (pending, approved, rejected)
- Created timestamp
- Associated artwork/artist ID
- Location data presence
- Notes presence

#### 5. User Lists
For each list:
- List ID
- Name
- Visibility (private, unlisted)
- Item count
- System list flag
- Read-only flag
- Created timestamp

#### 6. Debug Metadata
- Has Clerk token
- Has database user record
- User lookup method (clerk_user_id vs uuid)
- Active roles count
- Total submissions count
- Total lists count

#### 7. System Information
- Environment (production, development)
- Timestamp
- API version
- Database connection status

## Implementation

### Backend Endpoint

**File**: `src/workers/routes/debug-status.ts`

**Route**: `GET /api/debug/status`

**Authentication**: Requires user token (anonymous or authenticated)

**Process**:
1. Extract authentication context from middleware
2. Get Clerk user ID if authenticated via Clerk
3. Look up user record by `clerk_user_id` or `uuid`
4. Fetch user roles from `user_roles` table
5. Fetch last 3 submissions from `submissions` table
6. Fetch user lists with item counts
7. Return comprehensive JSON response

### Frontend Component

**File**: `src/frontend/src/views/StatusView.vue`

**Features**:
- "Load Debug Data" button to fetch information on demand
- Organized card-based layout
- JSON viewers for raw data
- Color-coded status indicators
- Responsive design

### Database Queries

The endpoint performs the following queries:

```sql
-- 1. Get user by Clerk ID
SELECT * FROM users WHERE clerk_user_id = ?

-- 2. Get user by UUID (fallback)
SELECT * FROM users WHERE uuid = ?

-- 3. Get user roles
SELECT role, granted_by, granted_at, is_active, notes
FROM user_roles
WHERE user_token = ?
ORDER BY granted_at DESC

-- 4. Get recent submissions
SELECT id, submission_type, artwork_id, artist_id, status, created_at, notes, lat, lon
FROM submissions
WHERE user_token = ?
ORDER BY created_at DESC
LIMIT 3

-- 5. Get user lists
SELECT l.id, l.name, l.visibility, l.is_readonly, l.is_system_list, 
       l.created_at, l.updated_at, COUNT(li.id) as item_count
FROM lists l
LEFT JOIN list_items li ON l.id = li.list_id
WHERE l.owner_user_id = ?
GROUP BY l.id
ORDER BY l.created_at DESC
```

## Usage Examples

### Troubleshooting Authentication Issues

1. Navigate to `/status`
2. Click "Load Debug Data"
3. Check "Authentication Status" section:
   - Verify Clerk User ID is present
   - Confirm email verification status
   - Check user token mapping

### Verifying Permissions

1. Load debug data
2. Check "Permissions & Roles" section:
   - Verify admin/moderator flags
   - Review role assignments
   - Check who granted the role and when

### Checking User Activity

1. Load debug data
2. Review "Recent Submissions" section:
   - See last 3 submissions
   - Check submission status
   - Verify data completeness

### Debugging List Issues

1. Load debug data
2. Check "User Lists" section:
   - View all user lists
   - Check item counts
   - Verify system lists are present

## Security Considerations

- The debug endpoint uses standard authentication middleware
- Users can only see their own data
- No sensitive information (passwords, tokens) is exposed
- Admin/moderator status is read-only
- Database credentials and secrets are not shown

## Error Handling

The endpoint handles errors gracefully:
- Missing user records (anonymous users)
- Database query failures
- Missing Clerk authentication
- Permission lookup failures

Error responses include:
- Error message
- Timestamp
- HTTP status code

## Future Enhancements

Potential improvements:
- Admin-only mode to view other users' debug data
- Export debug data as JSON
- Session history view
- Login attempt logs
- API call history
- Cache hit/miss statistics

## Related Files

- Backend: `src/workers/routes/debug-status.ts`
- Frontend: `src/frontend/src/views/StatusView.vue`
- Middleware: `src/workers/middleware/clerk-auth.ts`
- Types: `src/shared/types.ts`
- Database: `docs/database.md`
- Authentication: `docs/authentication.md`

## Testing

To test the debug status page:

1. **Anonymous User**:
   - Open `/status` without logging in
   - Click "Load Debug Data"
   - Should see anonymous token, no Clerk ID, no permissions

2. **Authenticated User**:
   - Log in via Clerk
   - Navigate to `/status`
   - Click "Load Debug Data"
   - Should see Clerk user ID, email, and any assigned roles

3. **Admin/Moderator**:
   - Log in as admin/moderator
   - Navigate to `/status`
   - Verify permission flags are correct
   - Check role assignments

## Maintenance

When adding new user-related features:
- Update the debug endpoint to include new data
- Add corresponding UI sections in StatusView
- Update this documentation
- Test with different user types
