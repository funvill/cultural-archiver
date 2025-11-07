/**
 * Clerk JWT Authentication middleware for user token validation and permission checking
 * Works alongside existing auth system - adds Clerk authentication capability
 */

import type { Context, Next } from 'hono';
import type { WorkerEnv } from '../types';
import type { AuthContext } from '../types';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { UnauthorizedError, ForbiddenError } from '../lib/errors';
import { getUserPermissions } from '../lib/permissions';
import { isValidUUID } from '../../shared/utils/uuid.js';

/**
 * Generate anonymous user token (UUID)
 */
export function generateAnonymousToken(): string {
  return crypto.randomUUID();
}

/**
 * Initialize Clerk client with environment variables
 */
function getClerkClient(env: WorkerEnv): ReturnType<typeof createClerkClient> {
  if (!env.CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY not configured');
  }
  
  return createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
  });
}

/**
 * Middleware to handle both anonymous and Clerk-authenticated users
 * Validates Clerk JWT tokens and falls back to anonymous tokens
 */
export async function ensureUserToken(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  let userToken = '';
  let clerkUserId: string | undefined;
  let isAuthenticated = false;
  let isNewToken = false;
  let clerkUser: any = null;

  // Try to get Clerk JWT token first
  const authHeader = c.req.header('Authorization');
  let clerkToken: string | undefined;
  
  if (authHeader?.startsWith('Bearer ')) {
    clerkToken = authHeader.replace('Bearer ', '');
  }

  // Verify Clerk token if present
  if (clerkToken) {
    try {
      const clerk = getClerkClient(c.env);
      
      // Verify the JWT token
      const payload = await verifyToken(clerkToken, {
        secretKey: c.env.CLERK_SECRET_KEY,
      });

      if (payload && payload.sub) {
        clerkUserId = payload.sub;
        isAuthenticated = true;

        // Get full user object from Clerk
        try {
          clerkUser = await clerk.users.getUser(clerkUserId);
        } catch (error) {
          console.warn('Failed to fetch Clerk user details:', error);
        }

        // Look up internal user record by Clerk ID
        try {
          const stmt = c.env.DB.prepare(`
            SELECT uuid FROM users WHERE clerk_user_id = ? LIMIT 1
          `);
          const result = await stmt.bind(clerkUserId).first();
          
          if (result) {
            userToken = (result as { uuid: string }).uuid;
          } else {
            // Create new user record for authenticated Clerk user
            userToken = crypto.randomUUID();
            const insertStmt = c.env.DB.prepare(`
              INSERT INTO users (uuid, clerk_user_id, email, created_at, email_verified_at, status)
              VALUES (?, ?, ?, ?, ?, ?)
            `);
            const now = new Date().toISOString();
            await insertStmt.bind(
              userToken,
              clerkUserId,
              clerkUser?.emailAddresses?.[0]?.emailAddress || null,
              now,
              clerkUser?.emailAddresses?.[0]?.verification?.status === 'verified' ? now : null,
              'active'
            ).run();
          }
        } catch (error) {
          console.error('Failed to handle user record for Clerk user:', error);
          // Fall back to anonymous token
          userToken = generateAnonymousToken();
          isNewToken = true;
          isAuthenticated = false;
          clerkUserId = undefined;
        }
      }
    } catch (error) {
      console.warn('Invalid Clerk token:', error);
      // Token is invalid, fall back to anonymous
    }
  }

  // If no valid Clerk token, handle anonymous user
  if (!isAuthenticated) {
    // Check for existing anonymous token
    let anonymousToken = c.req.header('X-User-Token');
    
    if (!anonymousToken) {
      // Check for token in cookie
      const cookieHeader = c.req.header('Cookie');
      anonymousToken = cookieHeader
        ?.split(';')
        .find(cookie => cookie.trim().startsWith('user_token='))
        ?.split('=')[1];
    }

    // Validate anonymous token format (should be UUID v4)
    if (anonymousToken && !isValidUUID(anonymousToken)) {
      anonymousToken = undefined;
    }

    // Generate new anonymous token if needed
    if (!anonymousToken) {
      anonymousToken = generateAnonymousToken();
      isNewToken = true;
    }

    userToken = anonymousToken;
  }

  // Store in context
  c.set('userToken', userToken);
  c.set('isNewToken', isNewToken);

  // Get user permissions - prioritize Clerk org roles, fallback to database
  try {
    let isAdmin = false;
    let isModerator = false;

    // Check Clerk organization memberships for authenticated users
    if (isAuthenticated && clerkUserId) {
      try {
        const clerk = getClerkClient(c.env);
        const orgMemberships = await clerk.users.getOrganizationMembershipList({
          userId: clerkUserId,
        });

        // Check for publicartregistry organization roles
        for (const membership of orgMemberships.data) {
          console.log('[CLERK AUTH DEBUG] Organization membership:', {
            orgId: membership.organization.id,
            orgName: membership.organization.name,
            role: membership.role,
            publicMetadata: membership.publicMetadata,
          });

          // Check if this is the publicartregistry organization
          if (membership.organization.name === 'publicartregistry' || 
              membership.organization.slug === 'publicartregistry') {
            
            // Check for admin role
            if (membership.role === 'org:admin') {
              isAdmin = true;
              isModerator = true; // Admins have all moderator privileges
              console.log('[CLERK AUTH DEBUG] User has org:admin role');
            }
            // Check for moderator role
            else if (membership.role === 'org:member') {
              isModerator = true;
              console.log('[CLERK AUTH DEBUG] User has org:member role');
            }
          }
        }
      } catch (error) {
        console.warn('[CLERK AUTH DEBUG] Failed to get organization memberships:', error);
      }
    }

    // Always check database permissions as fallback
    // This ensures that known admin users (like steven@abluestar.com) can access admin features
    // even when Clerk JWT token retrieval fails due to production minification
    const db = c.env.DB;
    const dbPermissions = await getUserPermissions(db, userToken);
    
    // Use database permissions if Clerk roles weren't found or as override for known admins
    if (!isAdmin && !isModerator) {
      isAdmin = dbPermissions.includes('admin');
      isModerator = dbPermissions.includes('moderator');
      console.log('[CLERK AUTH DEBUG] Using database permissions fallback:', {
        dbPermissions,
        isAdmin,
        isModerator,
        userToken,
      });
    } else {
      console.log('[CLERK AUTH DEBUG] Using Clerk organization permissions:', {
        isAdmin,
        isModerator,
        clerkUserId,
      });
    }

    const canReview = isAdmin || isModerator;

    console.log('[CLERK AUTH DEBUG] Final permissions:', {
      userToken,
      isAuthenticated,
      isAdmin,
      isModerator,
      canReview,
    });

    // Create standard AuthContext
    const authContext: AuthContext = {
      userToken,
      isVerifiedEmail: isAuthenticated && clerkUser?.emailAddresses?.[0]?.verification?.status === 'verified',
      isReviewer: canReview, // deprecated field but still required
      isModerator: isModerator || isAdmin,
      canReview,
      isAdmin,
    };

    c.set('authContext', authContext);
    
    // Store Clerk authentication state in a way that doesn't require extending types
    // We'll add these as properties to the context that can be retrieved later
    (c as any).clerkUserId = clerkUserId;
    (c as any).clerkAuthenticated = isAuthenticated;
    if (clerkUser) {
      (c as any).clerkUserData = clerkUser;
    }
  } catch (error) {
    console.warn('Failed to check user permissions:', error);
    // Fallback to no permissions on error
    const fallbackContext: AuthContext = {
      userToken,
      isVerifiedEmail: false,
      isReviewer: false,
      isModerator: false,
      canReview: false,
      isAdmin: false,
    };
    c.set('authContext', fallbackContext);
  }

  await next();
}

/**
 * Middleware to require authenticated Clerk user
 */
export async function requireAuthenticated(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  const isClerkAuth = (c as any).clerkAuthenticated as boolean;
  const clerkUserId = (c as any).clerkUserId as string;

  if (!isClerkAuth || !clerkUserId) {
    throw new UnauthorizedError('Authentication required. Please sign in.');
  }

  await next();
}

/**
 * Middleware to check if user has review permissions
 * Requires either moderator or admin role
 * Supports both Clerk authentication and database-based permissions
 */
export async function requireReviewer(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  const authContext = c.get('authContext') as AuthContext;
  const isClerkAuth = (c as any).clerkAuthenticated as boolean;

  // Allow database-based permissions when Clerk auth is not available
  if (!authContext.canReview) {
    if (isClerkAuth) {
      throw new ForbiddenError('Moderator or admin permissions required');
    } else {
      throw new UnauthorizedError('Authentication required for review permissions');
    }
  }

  await next();
}

/**
 * Middleware to check if user has admin permissions
 * Supports both Clerk authentication and database-based permissions
 */
export async function requireAdmin(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  const authContext = c.get('authContext') as AuthContext;
  const isClerkAuth = (c as any).clerkAuthenticated as boolean;
  const clerkUserId = (c as any).clerkUserId as string;

  console.log('[CLERK ADMIN DEBUG] Starting admin check:', {
    isAuthenticated: isClerkAuth,
    clerkUserId: clerkUserId,
    isAdmin: authContext.isAdmin,
    userToken: authContext.userToken,
  });

  // Allow database-based admin permissions when Clerk auth is not available
  if (!authContext.isAdmin) {
    if (isClerkAuth) {
      console.error('[CLERK ADMIN DEBUG] Permission denied - authenticated but not admin:', {
        clerkUserId: clerkUserId,
        isAdmin: authContext.isAdmin,
      });
      throw new ForbiddenError('Administrator permissions required');
    } else {
      console.error('[CLERK ADMIN DEBUG] Permission denied - no authentication or admin permissions:', {
        isAdmin: authContext.isAdmin,
        userToken: authContext.userToken,
      });
      throw new UnauthorizedError('Authentication required for admin access');
    }
  }

  console.log('[CLERK ADMIN DEBUG] Admin check passed via', isClerkAuth ? 'Clerk auth' : 'database permissions');
  await next();
}

/**
 * Middleware to add user token to response headers/cookies for anonymous users
 */
export async function addUserTokenToResponse(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  await next();

  const authContext = c.get('authContext') as AuthContext;
  const isNewToken = c.get('isNewToken') as boolean;
  const isClerkAuth = (c as any).clerkAuthenticated as boolean;

  // Only set token headers/cookies for anonymous users with new tokens
  if (!isClerkAuth && authContext.userToken && isNewToken) {
    // Add token to response headers
    c.res.headers.set('X-User-Token', authContext.userToken);

    // Add as secure cookie for browser requests
    const isProduction = c.env.ENVIRONMENT === 'production';
    const cookieOptions = [
      'HttpOnly',
      'SameSite=Strict',
      'Path=/',
      'Max-Age=31536000', // 1 year
      ...(isProduction ? ['Secure'] : []),
    ].join('; ');

    c.res.headers.set('Set-Cookie', `user_token=${authContext.userToken}; ${cookieOptions}`);
    console.log(`[CLERK AUTH DEBUG] Set cookie for new anonymous token: ${authContext.userToken}`);
  }
}

/**
 * Get auth context from request context
 */
export function getAuthContext(c: Context): AuthContext {
  const context = c.get('authContext');
  
  // Ensure the context has all required fields from types.ts AuthContext
  if (context) {
    return {
      userToken: context.userToken || '',
      isVerifiedEmail: context.isVerifiedEmail || false,
      isReviewer: context.canReview || false, // map canReview to deprecated isReviewer
      isModerator: context.isModerator || false,
      canReview: context.canReview || false,
      isAdmin: context.isAdmin || false,
    };
  }
  
  // Fallback context with all required fields
  return {
    userToken: '',
    isVerifiedEmail: false,
    isReviewer: false, // deprecated but required
    isModerator: false,
    canReview: false,
    isAdmin: false,
  };
}

/**
 * Get user token from request context
 */
export function getUserToken(c: Context): string {
  const authContext = getAuthContext(c);
  return authContext.userToken || '';
}

/**
 * Check if user is authenticated with Clerk
 */
export function isAuthenticated(c: Context): boolean {
  return (c as any).clerkAuthenticated as boolean || false;
}

/**
 * Check if user is a moderator
 */
export function isModeratorUser(c: Context): boolean {
  const authContext = getAuthContext(c);
  return authContext.isModerator || authContext.isAdmin || false;
}

/**
 * Check if user can review submissions
 */
export function canReview(c: Context): boolean {
  const authContext = getAuthContext(c);
  return authContext.canReview || authContext.isModerator || authContext.isAdmin || false;
}

/**
 * Check if current user has verified email
 */
export function hasVerifiedEmail(c: Context): boolean {
  const authContext = getAuthContext(c);
  return authContext.isVerifiedEmail;
}

/**
 * Get Clerk user ID if authenticated
 */
export function getClerkUserId(c: Context): string | undefined {
  return (c as any).clerkUserId as string | undefined;
}
