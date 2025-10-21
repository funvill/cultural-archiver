/**
 * Clerk Webhook Handler
 * 
 * Handles Clerk webhook events for user lifecycle management
 * Includes signature verification and comprehensive event handling
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import { Webhook } from 'svix';
import { ApiError } from '../lib/errors';
import { createApiErrorResponse } from '../../shared/types';

// Clerk webhook event types
interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{
      email_address: string;
      verification?: {
        status: string;
      };
    }>;
    primary_email_address_id?: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    public_metadata?: Record<string, unknown>;
    private_metadata?: Record<string, unknown>;
    created_at?: number;
    updated_at?: number;
  };
  object: string;
}

/**
 * Verify Clerk webhook signature
 */
function verifyWebhookSignature(
  payload: string,
  headers: Record<string, string>,
  secret: string
): ClerkWebhookEvent {
  try {
    const wh = new Webhook(secret);
    
    const svixId = headers['svix-id'];
    const svixTimestamp = headers['svix-timestamp'];
    const svixSignature = headers['svix-signature'];

    if (!svixId || !svixTimestamp || !svixSignature) {
      throw new Error('Missing required webhook headers');
    }

    const svixHeaders = {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    };

    // Verify and parse the webhook
    const evt = wh.verify(payload, svixHeaders) as ClerkWebhookEvent;
    return evt;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    throw new ApiError('Invalid webhook signature', 'INVALID_SIGNATURE', 401);
  }
}

/**
 * Handle user.created event
 */
async function handleUserCreated(
  env: WorkerEnv,
  userData: ClerkWebhookEvent['data']
): Promise<void> {
  console.log('[CLERK WEBHOOK] Processing user.created event:', userData.id);

  const primaryEmail = userData.email_addresses?.find(
    (email) => email.email_address
  )?.email_address;

  if (!primaryEmail) {
    console.warn('[CLERK WEBHOOK] No primary email found for user:', userData.id);
    return;
  }

  // Check if user already exists
  const existingUser = await env.DB.prepare(`
    SELECT uuid FROM users WHERE clerk_user_id = ? LIMIT 1
  `).bind(userData.id).first();

  if (existingUser) {
    console.log('[CLERK WEBHOOK] User already exists:', userData.id);
    return;
  }

  // Create new user record
  const userUuid = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const isEmailVerified = userData.email_addresses?.find(
    (email) => email.email_address === primaryEmail
  )?.verification?.status === 'verified';

  await env.DB.prepare(`
    INSERT INTO users (
      uuid, 
      clerk_user_id, 
      email, 
      created_at, 
      email_verified_at, 
      status,
      profile_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    userUuid,
    userData.id,
    primaryEmail,
    now,
    isEmailVerified ? now : null,
    'active',
    userData.username || userData.first_name || null
  ).run();

  console.log('[CLERK WEBHOOK] Created user record:', {
    uuid: userUuid,
    clerkUserId: userData.id,
    email: primaryEmail,
    verified: isEmailVerified,
  });
}

/**
 * Handle user.updated event
 */
async function handleUserUpdated(
  env: WorkerEnv,
  userData: ClerkWebhookEvent['data']
): Promise<void> {
  console.log('[CLERK WEBHOOK] Processing user.updated event:', userData.id);

  const primaryEmail = userData.email_addresses?.find(
    (email) => email.email_address
  )?.email_address;

  if (!primaryEmail) {
    console.warn('[CLERK WEBHOOK] No primary email found for user:', userData.id);
    return;
  }

  const isEmailVerified = userData.email_addresses?.find(
    (email) => email.email_address === primaryEmail
  )?.verification?.status === 'verified';

  // Update user record
  const result = await env.DB.prepare(`
    UPDATE users 
    SET 
      email = ?,
      email_verified_at = CASE 
        WHEN ? AND email_verified_at IS NULL THEN datetime('now')
        WHEN NOT ? THEN NULL
        ELSE email_verified_at
      END,
      last_login = datetime('now'),
      profile_name = COALESCE(?, profile_name)
    WHERE clerk_user_id = ?
  `).bind(
    primaryEmail,
    isEmailVerified,
    isEmailVerified,
    userData.username || userData.first_name || null,
    userData.id
  ).run();

  if (result.meta.changes === 0) {
    console.warn('[CLERK WEBHOOK] User not found for update:', userData.id);
  } else {
    console.log('[CLERK WEBHOOK] Updated user record:', userData.id);
  }
}

/**
 * Handle user.deleted event
 */
async function handleUserDeleted(
  env: WorkerEnv,
  userData: ClerkWebhookEvent['data']
): Promise<void> {
  console.log('[CLERK WEBHOOK] Processing user.deleted event:', userData.id);

  // Start transaction for cleanup
  const batch = [
    // Delete user record (CASCADE will handle related records)
    env.DB.prepare(`DELETE FROM users WHERE clerk_user_id = ?`).bind(userData.id),
    
    // Clean up any orphaned sessions
    env.DB.prepare(`DELETE FROM auth_sessions WHERE user_token IN (
      SELECT uuid FROM users WHERE clerk_user_id = ?
    )`).bind(userData.id),
    
    // Clean up user roles
    env.DB.prepare(`DELETE FROM user_roles WHERE user_token IN (
      SELECT uuid FROM users WHERE clerk_user_id = ?
    )`).bind(userData.id),
  ];

  try {
    await env.DB.batch(batch);
    console.log('[CLERK WEBHOOK] Cleaned up user data for:', userData.id);
  } catch (error) {
    console.error('[CLERK WEBHOOK] Failed to clean up user data:', error);
    throw new ApiError('Failed to clean up user data', 'CLEANUP_FAILED', 500);
  }
}

/**
 * Handle session.created event
 */
async function handleSessionCreated(
  _env: WorkerEnv,
  sessionData: ClerkWebhookEvent['data']
): Promise<void> {
  console.log('[CLERK WEBHOOK] Processing session.created event:', sessionData.id);
  
  // Update last_login for the user
  // Note: We'd need the user_id from the session data to link this properly
  // For now, just log the event
  console.log('[CLERK WEBHOOK] User login recorded via session creation');
}

/**
 * Handle organizationMembership.created event
 */
async function handleOrganizationMembershipCreated(
  _env: WorkerEnv,
  _membershipData: ClerkWebhookEvent['data']
): Promise<void> {
  console.log('[CLERK WEBHOOK] Processing organizationMembership.created event');
  
  // This would handle role assignment from organization membership
  // Implementation depends on how we structure organization roles
  console.log('[CLERK WEBHOOK] Organization membership created - role management may be needed');
}

/**
 * POST /api/webhooks/clerk
 * Handle Clerk webhook events
 */
export async function handleClerkWebhook(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  try {
    // Verify webhook secret is configured
    if (!c.env.CLERK_WEBHOOK_SECRET) {
      throw new ApiError('Webhook secret not configured', 'MISSING_WEBHOOK_SECRET', 500);
    }

    // Get request body and headers
    const payload = await c.req.text();
    const headers = {
      'svix-id': c.req.header('svix-id') || '',
      'svix-timestamp': c.req.header('svix-timestamp') || '',
      'svix-signature': c.req.header('svix-signature') || '',
    };

    // Verify signature and parse event
    const event = verifyWebhookSignature(payload, headers, c.env.CLERK_WEBHOOK_SECRET);

    console.log('[CLERK WEBHOOK] Received event:', {
      type: event.type,
      userId: event.data.id,
      timestamp: new Date().toISOString(),
    });

    // Handle different event types
    switch (event.type) {
      case 'user.created':
        await handleUserCreated(c.env, event.data);
        break;

      case 'user.updated':
        await handleUserUpdated(c.env, event.data);
        break;

      case 'user.deleted':
        await handleUserDeleted(c.env, event.data);
        break;

      case 'session.created':
        await handleSessionCreated(c.env, event.data);
        break;

      case 'organizationMembership.created':
        await handleOrganizationMembershipCreated(c.env, event.data);
        break;

      default:
        console.log('[CLERK WEBHOOK] Unhandled event type:', event.type);
        break;
    }

    return c.json({
      success: true,
      message: 'Webhook processed successfully',
      event_type: event.type,
      user_id: event.data.id,
    });

  } catch (error) {
    console.error('[CLERK WEBHOOK] Error processing webhook:', error);

    if (error instanceof ApiError) {
      return c.json(createApiErrorResponse(error.message), error.statusCode as any);
    }

    return c.json(
      createApiErrorResponse('Internal webhook processing error'),
      500
    );
  }
}