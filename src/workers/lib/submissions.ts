// ================================
// Submissions Service - New Unified Schema
// ================================
// Replaces logbook and artwork_edits tables with unified submissions

import type { D1Database } from '@cloudflare/workers-types';
import type { SubmissionRecord, NewArtworkRecord, NewArtistRecord } from '../../shared/types.js';
import { generateUUID } from '../../shared/constants.js';

// ================================
// Core Submission Operations
// ================================

export async function createSubmission(
  db: D1Database,
  submissionData: {
    submissionType: 'logbook_entry' | 'artwork_edit' | 'artist_edit' | 'new_artwork' | 'new_artist';
    userToken: string;
    email?: string;
    submitterName?: string;
    artworkId?: string;
    artistId?: string;
    lat?: number;
    lon?: number;
    notes?: string;
    photos?: string[];
    tags?: Record<string, string>;
    oldData?: Record<string, unknown>;
    newData?: Record<string, unknown>;
    verificationStatus?: 'pending' | 'verified' | 'unverified';
  }
): Promise<string> {
  const id = generateUUID();
  const now = new Date().toISOString();
  
  await db.prepare(`
    INSERT INTO submissions (
      id, submission_type, user_token, email, submitter_name,
      artwork_id, artist_id, lat, lon, notes, photos, tags,
      old_data, new_data, verification_status, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    submissionData.submissionType,
    submissionData.userToken,
    submissionData.email || null,
    submissionData.submitterName || null,
    submissionData.artworkId || null,
    submissionData.artistId || null,
    submissionData.lat || null,
    submissionData.lon || null,
    submissionData.notes || null,
    submissionData.photos ? JSON.stringify(submissionData.photos) : null,
    submissionData.tags ? JSON.stringify(submissionData.tags) : null,
    submissionData.oldData ? JSON.stringify(submissionData.oldData) : null,
    submissionData.newData ? JSON.stringify(submissionData.newData) : null,
    submissionData.verificationStatus || 'pending',
    'pending',
    now,
    now
  ).run();

  return id;
}

export async function getSubmission(
  db: D1Database,
  id: string
): Promise<SubmissionRecord | null> {
  const result = await db.prepare(`
    SELECT * FROM submissions WHERE id = ?
  `).bind(id).first<SubmissionRecord>();

  return result || null;
}

export async function updateSubmission(
  db: D1Database,
  id: string,
  updates: Partial<SubmissionRecord>
): Promise<boolean> {
  const setClause = Object.keys(updates)
    .map(key => `${key} = ?`)
    .join(', ');
  
  const values = Object.values(updates);
  
  const result = await db.prepare(`
    UPDATE submissions 
    SET ${setClause}, updated_at = datetime('now')
    WHERE id = ?
  `).bind(...values, id).run();

  return result.success;
}

export async function deleteSubmission(
  db: D1Database,
  id: string
): Promise<boolean> {
  const result = await db.prepare(`
    DELETE FROM submissions WHERE id = ?
  `).bind(id).run();

  return result.success;
}

// ================================
// Logbook Entry Functions
// ================================

export async function createLogbookEntry(
  db: D1Database,
  entryData: {
    userToken: string;
    email?: string;
    submitterName?: string;
    artworkId: string;
    lat?: number;
    lon?: number;
    notes?: string;
    photos?: string[];
    tags?: Record<string, string>;
    verificationStatus?: 'pending' | 'verified' | 'unverified';
  }
): Promise<string> {
  return createSubmission(db, {
    submissionType: 'logbook_entry',
    ...entryData
  });
}

export async function getLogbookEntries(
  db: D1Database,
  artworkId: string,
  status?: 'pending' | 'approved' | 'rejected',
  limit: number = 50,
  offset: number = 0
): Promise<SubmissionRecord[]> {
  let query = `
    SELECT * FROM submissions 
    WHERE submission_type = 'logbook_entry' AND artwork_id = ?
  `;
  const params: (string | number)[] = [artworkId];
  
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const results = await db.prepare(query).bind(...params).all<SubmissionRecord>();
  return results.results || [];
}

export async function getLogbookEntriesByUser(
  db: D1Database,
  userToken: string,
  status?: 'pending' | 'approved' | 'rejected',
  limit: number = 50,
  offset: number = 0
): Promise<SubmissionRecord[]> {
  let query = `
    SELECT * FROM submissions 
    WHERE submission_type = 'logbook_entry' AND user_token = ?
  `;
  const params: (string | number)[] = [userToken];
  
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const results = await db.prepare(query).bind(...params).all<SubmissionRecord>();
  return results.results || [];
}

// ================================
// Artwork Edit Functions
// ================================

export async function createArtworkEdit(
  db: D1Database,
  editData: {
    userToken: string;
    email?: string;
    submitterName?: string;
    artworkId: string;
    oldData: Record<string, unknown>;
    newData: Record<string, unknown>;
    notes?: string;
  }
): Promise<string> {
  return createSubmission(db, {
    submissionType: 'artwork_edit',
    ...editData
  });
}

export async function getArtworkEdits(
  db: D1Database,
  artworkId: string,
  status?: 'pending' | 'approved' | 'rejected',
  limit: number = 50,
  offset: number = 0
): Promise<SubmissionRecord[]> {
  let query = `
    SELECT * FROM submissions 
    WHERE submission_type = 'artwork_edit' AND artwork_id = ?
  `;
  const params: (string | number)[] = [artworkId];
  
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const results = await db.prepare(query).bind(...params).all<SubmissionRecord>();
  return results.results || [];
}

// ================================
// Artist Edit Functions
// ================================

export async function createArtistEdit(
  db: D1Database,
  editData: {
    userToken: string;
    email?: string;
    submitterName?: string;
    artistId: string;
    oldData: Record<string, unknown>;
    newData: Record<string, unknown>;
    notes?: string;
  }
): Promise<string> {
  return createSubmission(db, {
    submissionType: 'artist_edit',
    ...editData
  });
}

export async function getArtistEdits(
  db: D1Database,
  artistId: string,
  status?: 'pending' | 'approved' | 'rejected',
  limit: number = 50,
  offset: number = 0
): Promise<SubmissionRecord[]> {
  let query = `
    SELECT * FROM submissions 
    WHERE submission_type = 'artist_edit' AND artist_id = ?
  `;
  const params: (string | number)[] = [artistId];
  
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const results = await db.prepare(query).bind(...params).all<SubmissionRecord>();
  return results.results || [];
}

// ================================
// New Submission Functions
// ================================

export async function createNewArtworkSubmission(
  db: D1Database,
  submissionData: {
    userToken: string;
    email?: string;
    submitterName?: string;
    lat: number;
    lon: number;
    notes?: string;
    photos?: string[];
    tags?: Record<string, string>;
    newData: Record<string, unknown>; // Proposed artwork data
  }
): Promise<string> {
  return createSubmission(db, {
    submissionType: 'new_artwork',
    ...submissionData
  });
}

export async function createNewArtistSubmission(
  db: D1Database,
  submissionData: {
    userToken: string;
    email?: string;
    submitterName?: string;
    newData: Record<string, unknown>; // Proposed artist data
    notes?: string;
  }
): Promise<string> {
  return createSubmission(db, {
    submissionType: 'new_artist',
    ...submissionData
  });
}

// ================================
// Approval and Review Functions
// ================================

export async function approveSubmission(
  db: D1Database,
  submissionId: string,
  reviewerToken?: string,
  reviewNotes?: string
): Promise<boolean> {
  const submission = await getSubmission(db, submissionId);
  if (!submission) return false;

  // Update submission status
  const updateSuccess = await updateSubmission(db, submissionId, {
    status: 'approved',
    reviewed_by: reviewerToken || null, // Fixed: was reviewer_token, should be reviewed_by
    moderator_notes: reviewNotes || null, // Fixed: was review_notes, should be moderator_notes
    reviewed_at: new Date().toISOString()
  });

  if (!updateSuccess) return false;

  // Apply changes based on submission type
  return await applySubmissionChanges(db, submission);
}

export async function rejectSubmission(
  db: D1Database,
  submissionId: string,
  reviewerToken?: string,
  reviewNotes?: string
): Promise<boolean> {
  return updateSubmission(db, submissionId, {
    status: 'rejected',
    reviewed_by: reviewerToken || null, // Fixed: was reviewer_token, should be reviewed_by
    moderator_notes: reviewNotes || null, // Fixed: was review_notes, should be moderator_notes
    reviewed_at: new Date().toISOString()
  });
}

async function applySubmissionChanges(
  db: D1Database,
  submission: SubmissionRecord
): Promise<boolean> {
  try {
    switch (submission.submission_type) {
      case 'new_artwork':
        // Create new artwork from submission data
        if (!submission.new_data) return false;
        return await createArtworkFromSubmission(db, submission);

      case 'artwork_edit':
        if (!submission.artwork_id || !submission.new_data) return false;
        return await applyArtworkChanges(db, submission.artwork_id, JSON.parse(submission.new_data as string));

      case 'artist_edit':
        if (!submission.artist_id || !submission.new_data) return false;
        return await applyArtistChanges(db, submission.artist_id, JSON.parse(submission.new_data as string));

      case 'new_artist':
        if (!submission.new_data) return false;
        return await createArtistFromSubmission(db, submission);

      default:
        return false;
    }
  } catch (error) {
    console.error('Error applying submission changes:', error);
    return false;
  }
}

async function applyArtworkChanges(
  db: D1Database,
  artworkId: string,
  newData: Record<string, unknown>
): Promise<boolean> {
  const setClause = Object.keys(newData)
    .filter(key => key !== 'id') // Don't allow ID changes
    .map(key => `${key} = ?`)
    .join(', ');
  
  const values = Object.keys(newData)
    .filter(key => key !== 'id')
    .map(key => newData[key]);
  
  const result = await db.prepare(`
    UPDATE artwork 
    SET ${setClause}, updated_at = datetime('now')
    WHERE id = ?
  `).bind(...values, artworkId).run();

  return result.success;
}

async function applyArtistChanges(
  db: D1Database,
  artistId: string,
  newData: Record<string, unknown>
): Promise<boolean> {
  const setClause = Object.keys(newData)
    .filter(key => key !== 'id')
    .map(key => `${key} = ?`)
    .join(', ');
  
  const values = Object.keys(newData)
    .filter(key => key !== 'id')
    .map(key => newData[key]);
  
  const result = await db.prepare(`
    UPDATE artists 
    SET ${setClause}, updated_at = datetime('now')
    WHERE id = ?
  `).bind(...values, artistId).run();

  return result.success;
}

async function createArtworkFromSubmission(
  db: D1Database,
  submission: SubmissionRecord
): Promise<boolean> {
  const newData = JSON.parse(submission.new_data as string) as Partial<NewArtworkRecord>;
  const artworkId = generateUUID();
  const now = new Date().toISOString();
  
  const result = await db.prepare(`
    INSERT INTO artwork (
      id, title, year_created, medium, dimensions,
      lat, lon, address, neighborhood, city, region, country,
      photos, tags, description, status, source_type, source_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    artworkId,
    newData.title || 'Untitled',
    newData.year_created || null,
    newData.medium || null,
    newData.dimensions || null,
    submission.lat || newData.lat || null,
    submission.lon || newData.lon || null,
    newData.address || null,
    newData.neighborhood || null,
    newData.city || null,
    newData.region || null,
    newData.country || null,
    submission.photos || newData.photos || null,
    submission.tags || newData.tags || null,
    newData.description || submission.note || null, // Fixed: was submission.notes, should be submission.note
    'approved',
    'user_submission',
    submission.id,
    now,
    now
  ).run();

  // Update submission with the created artwork ID
  if (result.success) {
    await updateSubmission(db, submission.id, { artwork_id: artworkId });
  }

  return result.success;
}

async function createArtistFromSubmission(
  db: D1Database,
  submission: SubmissionRecord
): Promise<boolean> {
  const newData = JSON.parse(submission.new_data as string) as Partial<NewArtistRecord>;
  const artistId = generateUUID();
  const now = new Date().toISOString();
  
  const result = await db.prepare(`
    INSERT INTO artists (
      id, name, biography, birth_year, death_year, nationality,
      website, social_media, notes, status, source_type, source_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    artistId,
    newData.name || 'Unknown Artist',
    newData.biography || null,
    newData.birth_year || null,
    newData.death_year || null,
    newData.nationality || null,
    newData.website || null,
    newData.social_media || null,
    newData.notes || submission.note || null, // Fixed: was submission.notes, should be submission.note
    'approved',
    'user_submission',
    submission.id,
    now,
    now
  ).run();

  // Update submission with the created artist ID
  if (result.success) {
    await updateSubmission(db, submission.id, { artist_id: artistId });
  }

  return result.success;
}

// ================================
// Query and Statistics Functions
// ================================

export async function getSubmissionsByStatus(
  db: D1Database,
  status: 'pending' | 'approved' | 'rejected',
  submissionType?: 'logbook_entry' | 'artwork_edit' | 'artist_edit' | 'new_artwork' | 'new_artist',
  limit: number = 50,
  offset: number = 0
): Promise<SubmissionRecord[]> {
  let query = `SELECT * FROM submissions WHERE status = ?`;
  const params: (string | number)[] = [status];
  
  if (submissionType) {
    query += ` AND submission_type = ?`;
    params.push(submissionType);
  }
  
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const results = await db.prepare(query).bind(...params).all<SubmissionRecord>();
  return results.results || [];
}

export async function getSubmissionStats(
  db: D1Database,
  dateRange?: { start: string; end: string }
): Promise<{
  totalSubmissions: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  submissionsByType: Record<string, number>;
}> {
  let query = `SELECT status, submission_type, COUNT(*) as count FROM submissions`;
  const params: string[] = [];
  
  if (dateRange) {
    query += ` WHERE created_at BETWEEN ? AND ?`;
    params.push(dateRange.start, dateRange.end);
  }
  
  query += ` GROUP BY status, submission_type`;
  
  const results = await db.prepare(query).bind(...params).all<{
    status: string;
    submission_type: string;
    count: number;
  }>();

  const stats = {
    totalSubmissions: 0,
    pendingSubmissions: 0,
    approvedSubmissions: 0,
    rejectedSubmissions: 0,
    submissionsByType: {} as Record<string, number>
  };

  for (const row of results.results || []) {
    stats.totalSubmissions += row.count;
    
    switch (row.status) {
      case 'pending':
        stats.pendingSubmissions += row.count;
        break;
      case 'approved':
        stats.approvedSubmissions += row.count;
        break;
      case 'rejected':
        stats.rejectedSubmissions += row.count;
        break;
    }
    
    stats.submissionsByType[row.submission_type] = 
      (stats.submissionsByType[row.submission_type] || 0) + row.count;
  }

  return stats;
}

/**
 * Get user's pending edits for a specific artwork
 */
export async function getUserPendingArtworkEdits(
  db: D1Database,
  userToken: string,
  artworkId: string
): Promise<SubmissionRecord[]> {
  const results = await db.prepare(`
    SELECT * FROM submissions 
    WHERE user_token = ? AND artwork_id = ? AND submission_type = 'artwork_edit' AND status = 'pending'
    ORDER BY created_at DESC
  `).bind(userToken, artworkId).all<SubmissionRecord>();
  
  return results.results || [];
}

/**
 * Get user's submission count for rate limiting
 */
export async function getUserSubmissionCount(
  db: D1Database,
  userToken: string,
  submissionType?: 'logbook_entry' | 'artwork_edit' | 'artist_edit' | 'new_artwork' | 'new_artist',
  hoursWindow: number = 24
): Promise<number> {
  const windowStart = new Date(Date.now() - hoursWindow * 60 * 60 * 1000).toISOString();

  let query = `
    SELECT COUNT(*) as count FROM submissions 
    WHERE user_token = ? AND created_at >= ?
  `;
  const params: (string | number)[] = [userToken, windowStart];

  if (submissionType) {
    query += ` AND submission_type = ?`;
    params.push(submissionType);
  }

  const result = await db.prepare(query).bind(...params).first<{ count: number }>();
  return result?.count || 0;
}

/**
 * Create artwork edit from legacy edit format (field-by-field edits)
 * Compatible with the old ArtworkEditsService format
 */
export async function createArtworkEditFromFields(
  db: D1Database,
  editData: {
    userToken: string;
    artworkId: string;
    edits: Array<{
      field_name: string;
      field_value_old: string | null;
      field_value_new: string | null;
    }>;
  }
): Promise<string> {
  // Get current artwork data to build oldData
  const artwork = await db.prepare(`
    SELECT * FROM artwork WHERE id = ?
  `).bind(editData.artworkId).first();

  if (!artwork) {
    throw new Error('Artwork not found');
  }

  // Build oldData and newData objects from the field edits
  const oldData: Record<string, unknown> = {};
  const newData: Record<string, unknown> = {};

  for (const edit of editData.edits) {
    oldData[edit.field_name] = edit.field_value_old;
    newData[edit.field_name] = edit.field_value_new;
  }

  return createArtworkEdit(db, {
    userToken: editData.userToken,
    artworkId: editData.artworkId,
    oldData,
    newData
  });
}
