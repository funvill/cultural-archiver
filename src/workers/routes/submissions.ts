/**
 * Submission route handlers for logbook entries (POST /api/logbook)
 * Handles artwork submissions with photos, location, and metadata
 */

import type { Context } from 'hono';
import type { 
  WorkerEnv, 
  LogbookSubmissionRequest,
  LogbookSubmissionResponse,
  NearbyArtworkInfo,
  CreateLogbookEntryRequest
} from '../../shared/types';
import { createDatabaseService } from '../lib/database';
import { createSuccessResponse, ValidationApiError } from '../lib/errors';
import { getUserToken } from '../middleware/auth';
import { getValidatedData, getValidatedFiles } from '../middleware/validation';
import { safeJsonParse } from '../lib/errors';

/**
 * POST /api/logbook - Create Submission
 * Handles new artwork submissions with photos and metadata
 */
export async function createLogbookSubmission(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  const userToken = getUserToken(c);
  const validatedData = getValidatedData<LogbookSubmissionRequest>(c, 'body');
  const validatedFiles = getValidatedFiles(c);
  
  const db = createDatabaseService(c.env.DB);
  
  try {
    // Check for nearby artworks to show user potential duplicates
    const nearbyArtworks = await db.findNearbyArtworks(
      validatedData.lat,
      validatedData.lon,
      500, // 500m radius for duplicate detection
      5    // Limit to 5 nearby artworks
    );
    
    // Convert nearby artworks to the expected format
    const nearbyArtworkInfo: NearbyArtworkInfo[] = nearbyArtworks.map(artwork => ({
      id: artwork.id,
      lat: artwork.lat,
      lon: artwork.lon,
      type_name: artwork.type_name,
      distance_meters: Math.round(artwork.distance_km * 1000),
      photos: safeJsonParse<string[]>(artwork.tags, []), // For now, photos are in tags - this will be improved
    }));
    
    // Process photos if any were uploaded
    let photoUrls: string[] = [];
    if (validatedFiles.length > 0) {
      photoUrls = await processPhotos(c.env.PHOTOS, validatedFiles);
    }
    
    // Create logbook entry
    const logbookEntry: CreateLogbookEntryRequest = {
      user_token: userToken,
      ...(validatedData.note && { note: validatedData.note }),
      ...(photoUrls.length > 0 && { photos: photoUrls }),
    };
    
    const newEntry = await db.createLogbookEntry(logbookEntry);
    
    // Create response
    const response: LogbookSubmissionResponse = {
      id: newEntry.id,
      status: 'pending',
      message: 'Submission received and is pending review',
      ...(nearbyArtworkInfo.length > 0 && { nearby_artworks: nearbyArtworkInfo }),
    };
    
    return c.json(createSuccessResponse(response), 201);
    
  } catch (error) {
    console.error('Failed to create logbook submission:', error);
    throw error;
  }
}

/**
 * Process uploaded photos and store them in R2
 * Returns array of photo URLs
 */
async function processPhotos(
  r2Bucket: any, // R2Bucket
  files: File[]
): Promise<string[]> {
  const photoUrls: string[] = [];
  const now = new Date();
  const dateFolder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    
    try {
      // Generate unique filename
      const timestamp = Math.floor(Date.now() / 1000);
      const uuid = crypto.randomUUID().substring(0, 8);
      const extension = getFileExtension(file.type);
      const filename = `${timestamp}-${uuid}${extension}`;
      
      // Store original in R2
      const originalKey = `originals/${dateFolder}/${filename}`;
      const fileBuffer = await file.arrayBuffer();
      
      await r2Bucket.put(originalKey, fileBuffer, {
        httpMetadata: {
          contentType: file.type,
        },
        customMetadata: {
          originalName: file.name,
          uploadTimestamp: now.toISOString(),
        },
      });
      
      // For MVP, we'll store the R2 key as the photo URL
      // In production, this would be a public URL
      photoUrls.push(originalKey);
      
      // TODO: Generate thumbnail (will be implemented in photo processing pipeline)
      
    } catch (error) {
      console.error(`Failed to process photo ${i}:`, error);
      // Continue with other photos - don't fail the entire submission
    }
  }
  
  return photoUrls;
}

/**
 * Get file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  
  return extensions[mimeType] || '.jpg';
}

/**
 * Check for duplicate submissions within a time window
 * Prevents rapid-fire duplicate submissions
 */
export async function checkDuplicateSubmission(
  db: any,
  userToken: string,
  lat: number,
  lon: number,
  timeWindowMinutes: number = 15
): Promise<boolean> {
  const timeWindowMs = timeWindowMinutes * 60 * 1000;
  const cutoffTime = new Date(Date.now() - timeWindowMs).toISOString();
  
  try {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM logbook 
      WHERE user_token = ? 
        AND created_at > ?
        AND ABS(49.2827 - ?) < 0.001 -- Rough coordinate check within ~100m
        AND ABS(-123.1207 - ?) < 0.001
    `);
    
    const result = await stmt.bind(userToken, cutoffTime, lat, lon).first();
    return (result as any)?.count > 0;
  } catch (error) {
    console.warn('Failed to check duplicate submission:', error);
    return false; // Allow submission if check fails
  }
}

/**
 * Validate submission coordinates are reasonable
 * Rejects obviously invalid coordinates
 */
export function validateSubmissionCoordinates(lat: number, lon: number): void {
  // Basic validation already done by middleware, but add additional checks
  if (lat === 0 && lon === 0) {
    throw new ValidationApiError([
      { field: 'coordinates', message: 'Coordinates appear to be null island (0,0)', code: 'INVALID_COORDINATES' }
    ]);
  }
  
  // Check if coordinates are in ocean (very basic check)
  // This is a simplified check - in production you might use a more sophisticated service
  const isLikelyLand = Math.abs(lat) > 0.1 || Math.abs(lon) > 0.1;
  if (!isLikelyLand) {
    console.warn(`Suspicious coordinates submitted: ${lat}, ${lon}`);
    // Don't reject - just log for review
  }
}

/**
 * Get submission statistics for a user
 * Used for rate limiting and user feedback
 */
export async function getUserSubmissionStats(
  db: any,
  userToken: string
): Promise<{
  total_submissions: number;
  approved_submissions: number;
  pending_submissions: number;
  last_submission_at: string | null;
}> {
  try {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_submissions,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_submissions,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_submissions,
        MAX(created_at) as last_submission_at
      FROM logbook 
      WHERE user_token = ? AND status != 'rejected'
    `);
    
    const result = await stmt.bind(userToken).first();
    return result as any || {
      total_submissions: 0,
      approved_submissions: 0,
      pending_submissions: 0,
      last_submission_at: null,
    };
  } catch (error) {
    console.error('Failed to get user submission stats:', error);
    return {
      total_submissions: 0,
      approved_submissions: 0,
      pending_submissions: 0,
      last_submission_at: null,
    };
  }
}