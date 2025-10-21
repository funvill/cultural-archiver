import { Hono } from 'hono';
import { requireAuthenticated } from '../middleware/clerk-auth';
import { createLogger } from '../../shared/logger';


const log = createLogger({ module: 'workers:routes:clerk-user' });

const clerkUser = new Hono();

/**
 * POST /api/auth/clerk/user
 * Get or create backend user token for Clerk-authenticated user
 */
clerkUser.post('/', requireAuthenticated, async (c) => {
  try {
    const clerkUserId = (c as any).clerkUserId as string;
    const clerkUserData = (c as any).clerkUserData as any;
    const db = c.env.DB;

    if (!clerkUserId) {
      return c.json({ error: 'Missing Clerk user ID' }, 400);
    }

    // Get user email from Clerk data
    const userEmail = clerkUserData?.emailAddresses?.[0]?.emailAddress || '';

    // Check if user already exists
    let user = await db
      .prepare('SELECT * FROM users WHERE clerk_user_id = ?')
      .bind(clerkUserId)
      .first();

    if (!user) {
      // Create new user
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      await db
        .prepare(`
          INSERT INTO users (uuid, clerk_user_id, email, email_verified_at, created_at, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(userId, clerkUserId, userEmail, now, now, 'active')
        .run();

      user = await db
        .prepare('SELECT * FROM users WHERE uuid = ?')
        .bind(userId)
        .first();

      log.info('Created new user for Clerk ID', { 
        clerkUserId, 
        userId,
        email: userEmail 
      });
    } else {
      // Update existing user info if needed
      if (userEmail && user.email !== userEmail) {
        await db
          .prepare('UPDATE users SET email = ?, updated_at = ? WHERE uuid = ?')
          .bind(userEmail, new Date().toISOString(), user.uuid)
          .run();
        
        log.info('Updated user email', { 
          userId: user.uuid, 
          oldEmail: user.email, 
          newEmail: userEmail 
        });
      }
    }

    // Return the user token (which is the user UUID)
    if (!user) {
      return c.json({ error: 'Failed to create or retrieve user' }, 500);
    }

    return c.json({
      success: true,
      token: user.uuid,
      user: {
        id: user.uuid,
        email: user.email,
        emailVerified: !!user.email_verified_at,
        createdAt: user.created_at,
      }
    });

  } catch (error) {
    log.error('Failed to get/create user', { error });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export { clerkUser };