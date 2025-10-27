# Clerk User ID Fix for Production

## Problem
Production minification breaks Clerk SDK property access, preventing user ID extraction.

## Immediate Fix (One-Time Setup)

### Step 1: Set Your Clerk User ID in Browser

1. Go to https://publicartregistry.com
2. Sign in with Clerk (steven@abluestar.com)
3. Open browser console (F12)
4. Run this command:

```javascript
localStorage.setItem('clerk-user-id', 'user_34MfKoXVsLDz0usdiPsMS6JW9jT');
localStorage.setItem('user-token', 'user_34MfKoXVsLDz0usdiPsMS6JW9jT');
location.reload();
```

### Step 2: Verify Admin Access

After reload, you should:
- ✅ See admin badge on `/profile`
- ✅ Access `/admin` page
- ✅ Access `/review` page

## How It Works

1. Frontend checks localStorage for `clerk-user-id` when Clerk property extraction fails
2. Uses that ID as the backend token
3. Backend looks up permissions for that token in `user_roles` table
4. Returns admin/moderator flags

## Permanent Fix Needed

This localStorage workaround works but isn't ideal. Long-term solutions:

### Option A: Fix Clerk Property Access
- Investigate Vite/Rollup build config to preserve Clerk SDK methods
- May require custom build optimization settings

### Option B: Backend JWT Validation
- Have backend validate Clerk JWTs directly
- Extract user ID from JWT claims on backend
- Requires Clerk public key and JWT verification library

### Option C: Clerk Webhooks
- Use Clerk webhooks to sync user data to database
- Store Clerk ID in `users` table on account creation
- Look up by email or other identifier

## Current Database State

✅ Production database has these permissions:
- `user_34MfKoXVsLDz0usdiPsMS6JW9jT` → admin, moderator roles
- Granted via `scripts/grant-admin.ts`
- Active and ready to use

## Testing

```bash
# Verify in production database
npx tsx scripts/grant-admin.ts user_34MfKoXVsLDz0usdiPsMS6JW9jT --env prod

# Should show:
# ✅ User already has admin role
# ✅ User already has moderator role
```
