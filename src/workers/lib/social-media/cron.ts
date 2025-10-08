/**
 * Social Media Cron Job Handler
 *
 * Processes scheduled social media posts and publishes them to the appropriate platforms.
 * This handler runs on a scheduled basis (cron trigger) to check for posts that are due
 * to be published and processes them.
 */

import type { WorkerEnv } from '../../types';
import { createSocialMediaService } from './factory';

/**
 * Process scheduled social media posts
 *
 * Finds all posts scheduled for today or earlier that haven't been posted yet,
 * and attempts to publish them to their respective platforms.
 */
export async function processSocialMediaSchedules(env: WorkerEnv): Promise<void> {
  const db = env.DB;
  
  try {
    // Get current date in YYYY-MM-DD format (America/Vancouver timezone)
    const now = new Date();
    const vancouverOffset = -8; // PST/PDT offset (simplified - would need proper timezone handling)
    const vancouverTime = new Date(now.getTime() + vancouverOffset * 60 * 60 * 1000);
    const today = vancouverTime.toISOString().split('T')[0];

    console.log(`[CRON] Processing social media schedules for ${today}`);

    // Find all scheduled posts that are due (scheduled_date <= today and status = 'scheduled')
    const scheduledPosts = await db
      .prepare(
        `SELECT 
          s.id,
          s.artwork_id,
          s.social_type,
          s.body,
          s.photos,
          s.scheduled_date,
          a.title,
          a.description,
          a.location_lat,
          a.location_lon,
          a.tags,
          a.photos as artwork_photos
        FROM social_media_schedules s
        JOIN artworks a ON s.artwork_id = a.id
        WHERE s.status = 'scheduled' 
          AND s.scheduled_date <= ?
        ORDER BY s.scheduled_date ASC
        LIMIT 10`
      )
      .bind(today)
      .all();

    if (!scheduledPosts.results || scheduledPosts.results.length === 0) {
      console.log('[CRON] No scheduled posts found');
      return;
    }

    console.log(`[CRON] Found ${scheduledPosts.results.length} post(s) to process`);

    // Process each scheduled post
    for (const post of scheduledPosts.results as any[]) {
      try {
        // Create service for this platform
        const service = createSocialMediaService(post.social_type, {
          ...(env.BSKY_IDENTIFIER && { BSKY_IDENTIFIER: env.BSKY_IDENTIFIER }),
          ...(env.BSKY_APP_PASSWORD && { BSKY_APP_PASSWORD: env.BSKY_APP_PASSWORD }),
          ...(env.INSTAGRAM_ACCESS_TOKEN && { INSTAGRAM_ACCESS_TOKEN: env.INSTAGRAM_ACCESS_TOKEN }),
          ...(env.INSTAGRAM_ACCOUNT_ID && { INSTAGRAM_ACCOUNT_ID: env.INSTAGRAM_ACCOUNT_ID }),
        });

        if (!service) {
          console.warn(`[CRON] No service available for ${post.social_type}, skipping post ${post.id}`);
          
          // Mark as failed
          await db
            .prepare(
              `UPDATE social_media_schedules 
              SET status = 'failed', 
                  error_message = ?, 
                  last_attempt_at = CURRENT_TIMESTAMP 
              WHERE id = ?`
            )
            .bind(`No service configured for ${post.social_type}`, post.id)
            .run();
          
          continue;
        }

        // Parse photos from JSON
        let photos: string[] = [];
        try {
          photos = post.photos ? JSON.parse(post.photos) : [];
        } catch (err) {
          console.error(`[CRON] Failed to parse photos for post ${post.id}:`, err);
        }

        // Attempt to post to social media
        console.log(`[CRON] Posting to ${post.social_type} for artwork ${post.artwork_id}`);
        
        const result = await service.post({
          body: post.body,
          photos: photos.slice(0, service.maxPhotos), // Limit to platform max
        });

        if (result.success) {
          // Mark as posted
          await db
            .prepare(
              `UPDATE social_media_schedules 
              SET status = 'posted', 
                  error_message = NULL, 
                  last_attempt_at = CURRENT_TIMESTAMP 
              WHERE id = ?`
            )
            .bind(post.id)
            .run();

          console.log(`[CRON] ✓ Successfully posted ${post.id} to ${post.social_type}`);
          
          if (result.post_url) {
            console.log(`[CRON] Post URL: ${result.post_url}`);
          }
        } else {
          // Mark as failed with error message
          await db
            .prepare(
              `UPDATE social_media_schedules 
              SET status = 'failed', 
                  error_message = ?, 
                  last_attempt_at = CURRENT_TIMESTAMP 
              WHERE id = ?`
            )
            .bind(result.error || 'Unknown error', post.id)
            .run();

          console.error(`[CRON] ✗ Failed to post ${post.id} to ${post.social_type}: ${result.error}`);
        }

      } catch (error) {
        console.error(`[CRON] Error processing post ${post.id}:`, error);
        
        // Mark as failed
        await db
          .prepare(
            `UPDATE social_media_schedules 
            SET status = 'failed', 
                error_message = ?, 
                last_attempt_at = CURRENT_TIMESTAMP 
            WHERE id = ?`
          )
          .bind(error instanceof Error ? error.message : 'Unknown error', post.id)
          .run();
      }
    }

    console.log('[CRON] Social media schedule processing complete');

  } catch (error) {
    console.error('[CRON] Fatal error in processSocialMediaSchedules:', error);
    throw error;
  }
}
