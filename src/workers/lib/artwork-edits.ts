/**
 * Artwork Edits Database Operations
 * 
 * Handles database operations for artwork editing system including:
 * - Submitting edit proposals
 * - Checking user pending edits
 * - Retrieving edits for moderation
 * - Applying approved edits to artwork records
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { 
  ArtworkEditRecord,
  CreateArtworkEditRequest,
  ArtworkEditReviewData,
  ArtworkEditDiff
} from '../../shared/types';

import { randomUUID } from 'crypto';

export class ArtworkEditsService {
  constructor(private db: D1Database) {}

  /**
   * Submit artwork edit proposals in key-value format
   * Creates one row per field being edited
   */
  async submitArtworkEdit(request: CreateArtworkEditRequest): Promise<string[]> {
    const editIds: string[] = [];
    const submittedAt = new Date().toISOString();

    // Validate that artwork exists
    const artworkExists = await this.db
      .prepare('SELECT id FROM artwork WHERE id = ?')
      .bind(request.artwork_id)
      .first();

    if (!artworkExists) {
      throw new Error(`Artwork not found: ${request.artwork_id}`);
    }

    // Begin transaction for all edits
    const stmt = this.db.prepare(`
      INSERT INTO artwork_edits (
        edit_id, artwork_id, user_token, field_name, 
        field_value_old, field_value_new, status, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `);

    for (const edit of request.edits) {
      const editId = randomUUID();
      editIds.push(editId);

      await stmt.bind(
        editId,
        request.artwork_id,
        request.user_token,
        edit.field_name,
        edit.field_value_old,
        edit.field_value_new,
        submittedAt
      ).run();
    }

    return editIds;
  }

  /**
   * Get user's pending edits for a specific artwork
   */
  async getUserPendingEdits(userToken: string, artworkId: string): Promise<ArtworkEditRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM artwork_edits 
      WHERE user_token = ? AND artwork_id = ? AND status = 'pending'
      ORDER BY submitted_at DESC
    `);

    const results = await stmt.bind(userToken, artworkId).all();
    return results.results as unknown as ArtworkEditRecord[];
  }

  /**
   * Get artwork edit by ID for moderation queue integration
   */
  async getArtworkEditById(editId: string): Promise<ArtworkEditRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM artwork_edits WHERE edit_id = ?');
    const result = await stmt.bind(editId).first();
    return result as unknown as ArtworkEditRecord | null;
  }

  /**
   * Get all pending edits for moderation queue, grouped by submission
   */
  async getPendingEditsForReview(limit = 50, offset = 0): Promise<ArtworkEditReviewData[]> {
    // Get grouped submissions by artwork_id + user_token + submitted_at
    const groupsStmt = this.db.prepare(`
      SELECT 
        artwork_id, user_token, submitted_at,
        COUNT(*) as edit_count
      FROM artwork_edits 
      WHERE status = 'pending'
      GROUP BY artwork_id, user_token, submitted_at
      ORDER BY submitted_at ASC
      LIMIT ? OFFSET ?
    `);

    const groups = await groupsStmt.bind(limit, offset).all();
    const reviewData: ArtworkEditReviewData[] = [];

    for (const group of groups.results) {
      const groupData = group as {
        artwork_id: string;
        user_token: string;
        submitted_at: string;
        edit_count: number;
      };

      // Get all edits for this group
      const editsStmt = this.db.prepare(`
        SELECT * FROM artwork_edits 
        WHERE artwork_id = ? AND user_token = ? AND submitted_at = ? AND status = 'pending'
        ORDER BY field_name
      `);

      const edits = await editsStmt.bind(
        groupData.artwork_id,
        groupData.user_token,
        groupData.submitted_at
      ).all();

      const editRecords = edits.results as unknown as ArtworkEditRecord[];
      
      reviewData.push({
        edit_ids: editRecords.map(e => e.edit_id),
        artwork_id: groupData.artwork_id,
        user_token: groupData.user_token,
        submitted_at: groupData.submitted_at,
        diffs: editRecords.map(edit => ({
          field_name: edit.field_name,
          old_value: edit.field_value_old,
          new_value: edit.field_value_new,
        }))
      });
    }

    return reviewData;
  }

  /**
   * Get artwork edit submission for review by providing one edit_id from the group
   */
  async getEditSubmissionForReview(editId: string): Promise<ArtworkEditReviewData | null> {
    // First get the edit to find the submission group
    const editStmt = this.db.prepare('SELECT * FROM artwork_edits WHERE edit_id = ?');
    const edit = await editStmt.bind(editId).first() as ArtworkEditRecord | null;
    
    if (!edit) {
      return null;
    }

    // Get all edits in the same submission
    const groupStmt = this.db.prepare(`
      SELECT * FROM artwork_edits 
      WHERE artwork_id = ? AND user_token = ? AND submitted_at = ? AND status = ?
      ORDER BY field_name
    `);

    const edits = await groupStmt.bind(
      edit.artwork_id,
      edit.user_token,
      edit.submitted_at,
      edit.status
    ).all();

    const editRecords = edits.results as unknown as ArtworkEditRecord[];

    return {
      edit_ids: editRecords.map(e => e.edit_id),
      artwork_id: edit.artwork_id,
      user_token: edit.user_token,
      submitted_at: edit.submitted_at,
      diffs: editRecords.map(e => ({
        field_name: e.field_name,
        old_value: e.field_value_old,
        new_value: e.field_value_new,
      }))
    };
  }

  /**
   * Approve all edits in a submission group (all-or-nothing)
   */
  async approveEditSubmission(editIds: string[], moderatorToken: string, applyToArtwork = true): Promise<void> {
    const reviewedAt = new Date().toISOString();

    // Update all edits to approved status
    const updateStmt = this.db.prepare(`
      UPDATE artwork_edits 
      SET status = 'approved', reviewed_at = ?, reviewed_by = ?
      WHERE edit_id = ?
    `);

    for (const editId of editIds) {
      await updateStmt.bind(reviewedAt, moderatorToken, editId).run();
    }

    if (applyToArtwork) {
      await this.applyApprovedEditsToArtwork(editIds);
    }
  }

  /**
   * Reject all edits in a submission group (all-or-nothing)
   */
  async rejectEditSubmission(editIds: string[], moderatorToken: string, reason?: string): Promise<void> {
    const reviewedAt = new Date().toISOString();

    const updateStmt = this.db.prepare(`
      UPDATE artwork_edits 
      SET status = 'rejected', reviewed_at = ?, reviewed_by = ?, moderator_notes = ?
      WHERE edit_id = ?
    `);

    for (const editId of editIds) {
      await updateStmt.bind(reviewedAt, moderatorToken, reason || null, editId).run();
    }
  }

  /**
   * Apply approved edits to the original artwork record
   * Note: This assumes artwork table has the fields being edited
   */
  private async applyApprovedEditsToArtwork(editIds: string[]): Promise<void> {
    // Get all approved edits
    const editsStmt = this.db.prepare(`
      SELECT * FROM artwork_edits 
      WHERE edit_id IN (${editIds.map(() => '?').join(',')}) AND status = 'approved'
    `);

    const edits = await editsStmt.bind(...editIds).all();
    const editRecords = edits.results as unknown as ArtworkEditRecord[];

    if (editRecords.length === 0) {
      return;
    }

    // Group by artwork_id (should be the same for all edits)
    const artworkId = editRecords[0].artwork_id;
    const updatedFields: Record<string, string> = {};

    // Build update query dynamically based on which fields are being edited
    for (const edit of editRecords) {
      if (edit.field_value_new !== null) {
        updatedFields[edit.field_name] = edit.field_value_new;
      }
    }

    if (Object.keys(updatedFields).length === 0) {
      return;
    }

    // Apply updates to artwork table
    // Note: This is a simplified version - in reality you might need more complex logic
    // depending on the actual artwork table schema
    const setClause = Object.keys(updatedFields).map(field => `${field} = ?`).join(', ');
    const values = Object.values(updatedFields);

    const updateArtworkStmt = this.db.prepare(`
      UPDATE artwork 
      SET ${setClause}
      WHERE id = ?
    `);

    await updateArtworkStmt.bind(...values, artworkId).run();
  }

  /**
   * Check if user has pending edits for any artwork (rate limiting)
   */
  async getUserPendingEditCount(userToken: string, hoursWindow = 24): Promise<number> {
    const windowStart = new Date(Date.now() - hoursWindow * 60 * 60 * 1000).toISOString();

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM artwork_edits 
      WHERE user_token = ? AND submitted_at >= ?
    `);

    const result = await stmt.bind(userToken, windowStart).first();
    return (result as { count: number })?.count || 0;
  }

  /**
   * Get edit statistics for analytics
   */
  async getEditStatistics(): Promise<{
    total_edits: number;
    pending_edits: number;
    approved_edits: number;
    rejected_edits: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_edits,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_edits,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_edits,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_edits
      FROM artwork_edits
    `);

    const result = await stmt.first();
    return result as {
      total_edits: number;
      pending_edits: number;
      approved_edits: number;
      rejected_edits: number;
    };
  }

  /**
   * Format diffs for display in moderation UI
   */
  formatDiffsForDisplay(diffs: ArtworkEditDiff[]): ArtworkEditDiff[] {
    return diffs.map(diff => {
      let formatted_old = diff.old_value;
      let formatted_new = diff.new_value;

      // Special formatting for different field types
      if (diff.field_name === 'tags') {
        try {
          if (diff.old_value) {
            const oldTags = JSON.parse(diff.old_value);
            formatted_old = Array.isArray(oldTags) 
              ? oldTags.join(', ') 
              : Object.entries(oldTags).map(([k, v]) => `${k}: ${v}`).join(', ');
          }
          if (diff.new_value) {
            const newTags = JSON.parse(diff.new_value);
            formatted_new = Array.isArray(newTags) 
              ? newTags.join(', ')
              : Object.entries(newTags).map(([k, v]) => `${k}: ${v}`).join(', ');
          }
        } catch {
          // If JSON parsing fails, use raw values
        }
      }

      return {
        ...diff,
        formatted_old,
        formatted_new,
      };
    });
  }
}