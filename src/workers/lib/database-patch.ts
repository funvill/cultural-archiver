/**
 * Database Service Patch - New Schema Compatibility
 * 
 * This provides replacement functions for the database service that use
 * the new submissions table instead of the legacy logbook table.
 * 
 * IMPORTANT: This is a compatibility layer - the full database service
 * will be replaced in a future update.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { LogbookRecord } from '../types';
import { getLogbookEntries as getSubmissionLogbookEntries } from './submissions.js';

/**
 * Get logbook entries from the new submissions table
 * This replaces the old db.getLogbookEntriesForArtwork() method
 */
export async function getLogbookEntriesForArtworkFromSubmissions(
  db: D1Database,
  artworkId: string,
  limit: number = 10,
  offset: number = 0
): Promise<LogbookRecord[]> {
  // Get submissions that are logbook entries for this artwork
  const submissions = await getSubmissionLogbookEntries(db, artworkId, 'approved', limit, offset);
  
  // Convert submissions to LogbookRecord format for compatibility
  return submissions.map(submission => {
    const logbookRecord: LogbookRecord = {
      id: submission.id,
      artwork_id: submission.artwork_id || artworkId,
      user_token: submission.user_token,
      lat: submission.lat || null,
      lon: submission.lon || null,
      notes: submission.note, // Fixed: Map from SubmissionRecord.note to LogbookRecord.notes
      // submission.photos is already stored as a JSON string in the submissions table.
      // Avoid double-stringifying here; preserve the original JSON string for compatibility.
      photos: submission.photos ? submission.photos : null,
      status: submission.status as 'pending' | 'approved' | 'rejected',
      created_at: submission.created_at
    };
    return logbookRecord;
  });
}

/**
 * Get all logbook entries for similarity/photo aggregation
 * This is used by discovery routes for photo collection
 */
export async function getAllLogbookEntriesForArtworkFromSubmissions(
  db: D1Database,
  artworkId: string
): Promise<LogbookRecord[]> {
  // Get all approved submissions for this artwork (no limit)
  const submissions = await getSubmissionLogbookEntries(db, artworkId, 'approved', 1000, 0);
  
  // Convert submissions to LogbookRecord format for compatibility
  return submissions.map(submission => {
    const logbookRecord: LogbookRecord = {
      id: submission.id,
      artwork_id: submission.artwork_id || artworkId,
      user_token: submission.user_token,
      lat: submission.lat || null,
      lon: submission.lon || null,
      notes: submission.note, // Fixed: Map from SubmissionRecord.note to LogbookRecord.notes
      // Preserve the JSON string stored in submissions.photos; do not stringify again.
      photos: submission.photos ? submission.photos : null,
      status: submission.status as 'pending' | 'approved' | 'rejected',
      created_at: submission.created_at
    };
    return logbookRecord;
  });
}
