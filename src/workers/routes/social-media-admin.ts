/**
 * Social Media Admin Route Handlers
 *
 * Provides admin-only endpoints for scheduling and managing social media posts
 */

import type { Context } from 'hono';
import type { WorkerEnv, AuthContext } from '../types';
import type {
  ArtworkApiResponse,
  ArtistApiResponse,
  CreateSocialMediaScheduleRequest,
  UpdateSocialMediaScheduleRequest,
  SocialMediaScheduleApiResponse,
} from '../../shared/types';
import { ApiError } from '../lib/errors';
import { hasPermission } from '../lib/permissions';
import { generatePostText } from '../lib/social-media/templates';
import { isValidSocialMediaType } from '../../shared/types';

// Constants
const MAX_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 1;
const DEFAULT_PAGE_SIZE = 10;
const BASE_URL = 'https://publicartregistry.com';

/**
 * GET /api/admin/social-media/suggestions
 * Get artwork suggestions for social media posts
 */
export async function getSocialMediaSuggestions(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const db = c.env.DB;

    // DEBUG: Log authContext details
    console.log('[SOCIAL MEDIA DEBUG] authContext:', {
      userToken: authContext.userToken,
      isAdmin: authContext.isAdmin,
      isModerator: authContext.isModerator,
      isVerifiedEmail: authContext.isVerifiedEmail,
    });

    // Check admin permissions
    const adminCheck = await hasPermission(db, authContext.userToken, 'admin');
    console.log('[SOCIAL MEDIA DEBUG] adminCheck result:', adminCheck);
    
    if (!adminCheck.hasPermission) {
      console.error('[SOCIAL MEDIA DEBUG] Permission denied for user:', authContext.userToken);
      throw new ApiError('Administrator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // Get pagination parameters
    const page = parseInt(c.req.query('page') || '1', 10);
    const perPage = Math.min(
      Math.max(parseInt(c.req.query('per_page') || String(DEFAULT_PAGE_SIZE), 10), MIN_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const offset = (page - 1) * perPage;

    // Find artworks that:
    // - Have at least one photo
    // - Have at least one associated artist
    // - Have at least one logbook entry (updated since mass import)
    // - Have NOT been successfully posted to social media
    const query = `
      SELECT DISTINCT a.*
      FROM artwork a
      INNER JOIN artwork_artists aa ON a.id = aa.artwork_id
      INNER JOIN submissions s ON a.id = s.artwork_id
      WHERE a.status = 'approved'
        AND a.photos IS NOT NULL
        AND json_array_length(a.photos) > 0
        AND s.submission_type = 'logbook_entry'
        AND NOT EXISTS (
          SELECT 1 FROM social_media_schedules sms
          WHERE sms.artwork_id = a.id AND sms.status = 'posted'
        )
      ORDER BY a.created_at ASC
      LIMIT ? OFFSET ?
    `;

    const artworksResult = await db.prepare(query).bind(perPage, offset).all();
    const artworks = artworksResult.results as unknown as ArtworkApiResponse[];

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT a.id) as total
      FROM artwork a
      INNER JOIN artwork_artists aa ON a.id = aa.artwork_id
      INNER JOIN submissions s ON a.id = s.artwork_id
      WHERE a.status = 'approved'
        AND a.photos IS NOT NULL
        AND json_array_length(a.photos) > 0
        AND s.submission_type = 'logbook_entry'
        AND NOT EXISTS (
          SELECT 1 FROM social_media_schedules sms
          WHERE sms.artwork_id = a.id AND sms.status = 'posted'
        )
    `;

    const countResult = await db.prepare(countQuery).first<{ total: number }>();
    const total = countResult?.total || 0;

    // Build suggestions with generated post text
    const suggestions = await Promise.all(
      artworks.map(async (artwork) => {
        // Get artists for this artwork
        const artistsQuery = `
          SELECT ar.* FROM artists ar
          INNER JOIN artwork_artists aa ON ar.id = aa.artist_id
          WHERE aa.artwork_id = ?
          ORDER BY aa.created_at ASC
        `;
        const artistsResult = await db.prepare(artistsQuery).bind(artwork.id).all();
        const artists = artistsResult.results as unknown as ArtistApiResponse[];

        // Parse photos
        let photos: string[] = [];
        if (artwork.photos) {
          try {
            const parsed = typeof artwork.photos === 'string' ? JSON.parse(artwork.photos) : artwork.photos;
            photos = Array.isArray(parsed)
              ? parsed.slice(0, 4).map((p: string | { url: string }) => typeof p === 'string' ? p : p.url)
              : [];
          } catch (e) {
            console.error('Error parsing photos:', e);
          }
        }

        // Generate suggested post text for each platform
        const blueskyText = await generatePostText('bluesky', artwork, artists, BASE_URL);
        const instagramText = await generatePostText('instagram', artwork, artists, BASE_URL);

        return {
          artwork,
          artists,
          suggested_posts: {
            bluesky: {
              body: blueskyText,
              photos,
            },
            instagram: {
              body: instagramText,
              photos,
            },
          },
        };
      })
    );

    return c.json({
      success: true,
      data: {
        suggestions,
        total,
        page,
        per_page: perPage,
        has_more: offset + artworks.length < total,
      },
    });
  } catch (error) {
    console.error('Get social media suggestions error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to retrieve suggestions', 'SUGGESTIONS_RETRIEVAL_ERROR', 500);
  }
}

/**
 * POST /api/admin/social-media/schedule
 * Schedule a new social media post
 */
export async function createSocialMediaSchedule(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const db = c.env.DB;

    // Check admin permissions
    const adminCheck = await hasPermission(db, authContext.userToken, 'admin');
    if (!adminCheck.hasPermission) {
      throw new ApiError('Administrator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // Parse request body
    const body: CreateSocialMediaScheduleRequest = await c.req.json();
    const { artwork_id, scheduled_date, social_type, body: postBody, photos } = body;

    // Validate required fields
    if (!artwork_id || !scheduled_date || !social_type || !postBody) {
      throw new ApiError('Missing required fields', 'INVALID_REQUEST', 400);
    }

    if (!isValidSocialMediaType(social_type)) {
      throw new ApiError('Invalid social media type', 'INVALID_SOCIAL_TYPE', 400);
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduled_date)) {
      throw new ApiError('Invalid date format. Use YYYY-MM-DD', 'INVALID_DATE_FORMAT', 400);
    }

    // Check if artwork exists
    const artwork = await db
      .prepare('SELECT id FROM artwork WHERE id = ?')
      .bind(artwork_id)
      .first();

    if (!artwork) {
      throw new ApiError('Artwork not found', 'ARTWORK_NOT_FOUND', 404);
    }

    // Check for existing posts on the same date
    const existingCount = await db
      .prepare('SELECT COUNT(*) as count FROM social_media_schedules WHERE scheduled_date = ? AND status = ?')
      .bind(scheduled_date, 'scheduled')
      .first<{ count: number }>();

    if (existingCount && existingCount.count > 0) {
      // Return a warning but allow the scheduling
      console.warn(`Multiple posts scheduled for ${scheduled_date}`);
    }

    // Create schedule record
    const id = crypto.randomUUID();
    const photosJson = photos && photos.length > 0 ? JSON.stringify(photos) : null;

    await db
      .prepare(
        `INSERT INTO social_media_schedules 
        (id, user_id, artwork_id, scheduled_date, social_type, status, body, photos, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(id, authContext.userToken, artwork_id, scheduled_date, social_type, 'scheduled', postBody, photosJson)
      .run();

    // Fetch the created schedule
    const created = await db
      .prepare('SELECT * FROM social_media_schedules WHERE id = ?')
      .bind(id)
      .first<SocialMediaScheduleApiResponse>();

    return c.json({
      success: true,
      data: created,
      warning: existingCount && existingCount.count > 0 ? 'Multiple posts scheduled for this date' : undefined,
    });
  } catch (error) {
    console.error('Create social media schedule error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to create schedule', 'SCHEDULE_CREATION_ERROR', 500);
  }
}

/**
 * GET /api/admin/social-media/schedule
 * Get list of scheduled posts
 */
export async function getSocialMediaSchedules(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const db = c.env.DB;

    // Check admin permissions
    const adminCheck = await hasPermission(db, authContext.userToken, 'admin');
    if (!adminCheck.hasPermission) {
      throw new ApiError('Administrator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // Get query parameters
    const page = parseInt(c.req.query('page') || '1', 10);
    const perPage = Math.min(
      Math.max(parseInt(c.req.query('per_page') || '50', 10), MIN_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const offset = (page - 1) * perPage;
    const status = c.req.query('status') || 'scheduled';
    const socialType = c.req.query('social_type');

    // Build query
    let query = `
      SELECT sms.* 
      FROM social_media_schedules sms
      WHERE sms.status = ?
    `;
    const params: unknown[] = [status];

    if (socialType && isValidSocialMediaType(socialType)) {
      query += ' AND sms.social_type = ?';
      params.push(socialType);
    }

    query += ' ORDER BY sms.scheduled_date ASC, sms.created_at DESC LIMIT ? OFFSET ?';
    params.push(perPage, offset);

    const schedulesResult = await db.prepare(query).bind(...params).all();
    const schedules = schedulesResult.results as unknown as SocialMediaScheduleApiResponse[];

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM social_media_schedules WHERE status = ?';
    const countParams: unknown[] = [status];

    if (socialType && isValidSocialMediaType(socialType)) {
      countQuery += ' AND social_type = ?';
      countParams.push(socialType);
    }

    const countResult = await db.prepare(countQuery).bind(...countParams).first<{ total: number }>();
    const total = countResult?.total || 0;

    // Fetch artwork details for each schedule
    const enrichedSchedules = await Promise.all(
      schedules.map(async (schedule) => {
        if (!schedule.artwork_id) return schedule;

        const artwork = await db
          .prepare('SELECT * FROM artwork WHERE id = ?')
          .bind(schedule.artwork_id)
          .first<ArtworkApiResponse>();

        return {
          ...schedule,
          artwork,
        };
      })
    );

    return c.json({
      success: true,
      data: {
        schedules: enrichedSchedules,
        total,
        page,
        per_page: perPage,
        has_more: offset + schedules.length < total,
      },
    });
  } catch (error) {
    console.error('Get social media schedules error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to retrieve schedules', 'SCHEDULES_RETRIEVAL_ERROR', 500);
  }
}

/**
 * DELETE /api/admin/social-media/schedule/:id
 * Unschedule a post
 */
export async function deleteSocialMediaSchedule(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const db = c.env.DB;

    // Check admin permissions
    const adminCheck = await hasPermission(db, authContext.userToken, 'admin');
    if (!adminCheck.hasPermission) {
      throw new ApiError('Administrator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    const id = c.req.param('id');
    if (!id) {
      throw new ApiError('Schedule ID is required', 'INVALID_REQUEST', 400);
    }

    // Check if schedule exists
    const schedule = await db
      .prepare('SELECT * FROM social_media_schedules WHERE id = ?')
      .bind(id)
      .first();

    if (!schedule) {
      throw new ApiError('Schedule not found', 'SCHEDULE_NOT_FOUND', 404);
    }

    // Delete the schedule
    await db
      .prepare('DELETE FROM social_media_schedules WHERE id = ?')
      .bind(id)
      .run();

    return c.json({
      success: true,
      message: 'Schedule deleted successfully',
    });
  } catch (error) {
    console.error('Delete social media schedule error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to delete schedule', 'SCHEDULE_DELETION_ERROR', 500);
  }
}

/**
 * PATCH /api/admin/social-media/schedule/:id
 * Update a scheduled post
 */
export async function updateSocialMediaSchedule(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const db = c.env.DB;

    // Check admin permissions
    const adminCheck = await hasPermission(db, authContext.userToken, 'admin');
    if (!adminCheck.hasPermission) {
      throw new ApiError('Administrator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    const id = c.req.param('id');
    if (!id) {
      throw new ApiError('Schedule ID is required', 'INVALID_REQUEST', 400);
    }

    // Parse request body
    const body: Partial<UpdateSocialMediaScheduleRequest> = await c.req.json();
    const { scheduled_date, body: postBody, photos } = body;

    // Check if schedule exists
    const schedule = await db
      .prepare('SELECT * FROM social_media_schedules WHERE id = ?')
      .bind(id)
      .first();

    if (!schedule) {
      throw new ApiError('Schedule not found', 'SCHEDULE_NOT_FOUND', 404);
    }

    // Build update query
    const updates: string[] = [];
    const params: unknown[] = [];

    if (scheduled_date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduled_date)) {
        throw new ApiError('Invalid date format. Use YYYY-MM-DD', 'INVALID_DATE_FORMAT', 400);
      }
      updates.push('scheduled_date = ?');
      params.push(scheduled_date);
    }

    if (postBody) {
      updates.push('body = ?');
      params.push(postBody);
    }

    if (photos !== undefined) {
      updates.push('photos = ?');
      params.push(photos && photos.length > 0 ? JSON.stringify(photos) : null);
    }

    if (updates.length === 0) {
      throw new ApiError('No updates provided', 'INVALID_REQUEST', 400);
    }

    // Perform update
    params.push(id);
    await db
      .prepare(`UPDATE social_media_schedules SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();

    // Fetch updated schedule
    const updated = await db
      .prepare('SELECT * FROM social_media_schedules WHERE id = ?')
      .bind(id)
      .first<SocialMediaScheduleApiResponse>();

    return c.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Update social media schedule error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to update schedule', 'SCHEDULE_UPDATE_ERROR', 500);
  }
}

/**
 * GET /api/admin/social-media/next-available-date
 * Find the next available date with no scheduled posts
 */
export async function getNextAvailableDate(
  c: Context<{ Bindings: WorkerEnv; Variables: { authContext: AuthContext } }>
): Promise<Response> {
  try {
    const authContext = c.get('authContext');
    const db = c.env.DB;

    // Check admin permissions
    const adminCheck = await hasPermission(db, authContext.userToken, 'admin');
    if (!adminCheck.hasPermission) {
      throw new ApiError('Administrator permissions required', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    // Start from tomorrow
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check each day for the next 365 days
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(tomorrow);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];

      const count = await db
        .prepare('SELECT COUNT(*) as count FROM social_media_schedules WHERE scheduled_date = ? AND status = ?')
        .bind(dateStr, 'scheduled')
        .first<{ count: number }>();

      if (!count || count.count === 0) {
        return c.json({
          success: true,
          data: {
            date: dateStr,
          },
        });
      }
    }

    // If no available date found in next year, return tomorrow anyway
    const fallbackDate = tomorrow.toISOString().split('T')[0];
    return c.json({
      success: true,
      data: {
        date: fallbackDate,
      },
      warning: 'No empty dates found in next 365 days. Returning tomorrow.',
    });
  } catch (error) {
    console.error('Get next available date error:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to find next available date', 'NEXT_DATE_ERROR', 500);
  }
}
