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
  ArtworkEditDiff,
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

      await stmt
        .bind(
          editId,
          request.artwork_id,
          request.user_token,
          edit.field_name,
          edit.field_value_old,
          edit.field_value_new,
          submittedAt
        )
        .run();
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

      const edits = await editsStmt
        .bind(groupData.artwork_id, groupData.user_token, groupData.submitted_at)
        .all();

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
        })),
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
    const edit = (await editStmt.bind(editId).first()) as ArtworkEditRecord | null;

    if (!edit) {
      return null;
    }

    // Get all edits in the same submission
    const groupStmt = this.db.prepare(`
      SELECT * FROM artwork_edits 
      WHERE artwork_id = ? AND user_token = ? AND submitted_at = ? AND status = ?
      ORDER BY field_name
    `);

    const edits = await groupStmt
      .bind(edit.artwork_id, edit.user_token, edit.submitted_at, edit.status)
      .all();

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
      })),
    };
  }

  /**
   * Approve all edits in a submission group (all-or-nothing)
   */
  async approveEditSubmission(
    editIds: string[],
    moderatorToken: string,
    applyToArtwork = true
  ): Promise<void> {
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
      const appliedFields = await this.applyApprovedEditsToArtwork(editIds);

      // Always create logbook entry for approved edits to maintain transparency
      // This ensures users can see the history of all approved changes
      try {
        const editDetails = await this.getEditDetailsForLogbook(editIds, appliedFields);
        await this.createEditLogbookEntry(editDetails, moderatorToken, reviewedAt);
      } catch (error) {
        console.warn('Failed to create logbook entry for approved edits:', error);
        // Don't fail the approval if logbook creation fails
      }
    }
  }

  /**
   * Reject all edits in a submission group (all-or-nothing)
   */
  async rejectEditSubmission(
    editIds: string[],
    moderatorToken: string,
    reason?: string
  ): Promise<void> {
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
   * Note: Only updates fields that exist in the artwork table
   * Returns the list of field names that were actually applied
   */
  private async applyApprovedEditsToArtwork(editIds: string[]): Promise<string[]> {
    // Get all approved edits
    const editsStmt = this.db.prepare(`
      SELECT * FROM artwork_edits 
      WHERE edit_id IN (${editIds.map(() => '?').join(',')}) AND status = 'approved'
    `);

    const edits = await editsStmt.bind(...editIds).all();
    const editRecords = edits.results as unknown as ArtworkEditRecord[];

    if (editRecords.length === 0) {
      return [];
    }

    // Group by artwork_id (should be the same for all edits)
    const firstRecord = editRecords[0];
    if (!firstRecord?.artwork_id) {
      throw new Error('Invalid edit record: missing artwork_id');
    }
    const artworkId = firstRecord.artwork_id;

    // Ensure editable fields exist in artwork table
    await this.ensureEditableFieldsExist();

    // Get artwork table structure to verify which fields exist
    const tableInfo = await this.db.prepare(`PRAGMA table_info(artwork)`).all();
    const artworkColumns = new Set((tableInfo.results as { name: string }[]).map(col => col.name));

    const updatedFields: Record<string, string> = {};

    // Build update query dynamically based on which fields are being edited AND exist in the table
    for (const edit of editRecords) {
      if (edit.field_value_new !== null && artworkColumns.has(edit.field_name)) {
        updatedFields[edit.field_name] = edit.field_value_new;
      } else if (!artworkColumns.has(edit.field_name)) {
        console.error(`Field ${edit.field_name} does not exist in artwork table, skipping update`);
      }
    }

    if (Object.keys(updatedFields).length === 0) {
      console.info('No valid fields to update in artwork table');
      return [];
    }

    // Apply updates to artwork table
    const setClause = Object.keys(updatedFields)
      .map(field => `${field} = ?`)
      .join(', ');
    const values = Object.values(updatedFields);

    const updateArtworkStmt = this.db.prepare(`
      UPDATE artwork 
      SET ${setClause}
      WHERE id = ?
    `);

    await updateArtworkStmt.bind(...values, artworkId).run();
    console.info(
      `Applied ${Object.keys(updatedFields).length} field updates to artwork ${artworkId}`
    );

    // Return the list of field names that were actually applied
    return Object.keys(updatedFields);
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
      let formatted_old: string | undefined = diff.old_value ?? undefined;
      let formatted_new: string | undefined = diff.new_value ?? undefined;

      // Special formatting for different field types
      if (diff.field_name === 'tags') {
        try {
          if (diff.old_value) {
            const oldTags = JSON.parse(diff.old_value);
            formatted_old = Array.isArray(oldTags)
              ? oldTags.join(', ')
              : Object.entries(oldTags)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(', ');
          }
          if (diff.new_value) {
            const newTags = JSON.parse(diff.new_value);
            formatted_new = Array.isArray(newTags)
              ? newTags.join(', ')
              : Object.entries(newTags)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(', ');
          }
        } catch {
          // If JSON parsing fails, use raw values
        }
      }

      const result: ArtworkEditDiff = {
        ...diff,
      };

      if (formatted_old !== undefined) {
        result.formatted_old = formatted_old;
      }

      if (formatted_new !== undefined) {
        result.formatted_new = formatted_new;
      }

      return result;
    });
  }

  /**
   * Get edit details for logbook entry creation
   * Only includes edits for fields that were actually applied
   */
  private async getEditDetailsForLogbook(
    editIds: string[],
    appliedFields: string[]
  ): Promise<{
    artworkId: string;
    userToken: string;
    submittedAt: string;
    edits: Array<{
      field_name: string;
      field_value_old: string;
      field_value_new: string;
      applied: boolean;
    }>;
  }> {
    const editsStmt = this.db.prepare(`
      SELECT artwork_id, user_token, field_name, field_value_old, field_value_new, submitted_at
      FROM artwork_edits 
      WHERE edit_id IN (${editIds.map(() => '?').join(',')})
    `);

    const edits = await editsStmt.bind(...editIds).all();
    const editRecords = edits.results as unknown as ArtworkEditRecord[];

    if (editRecords.length === 0) {
      throw new Error('No edits found for logbook entry');
    }

    const firstRecord = editRecords[0];
    if (!firstRecord?.artwork_id || !firstRecord?.user_token || !firstRecord?.submitted_at) {
      throw new Error('Invalid edit record: missing required fields');
    }

    return {
      artworkId: firstRecord.artwork_id,
      userToken: firstRecord.user_token,
      submittedAt: firstRecord.submitted_at,
      edits: editRecords.map(edit => ({
        field_name: edit.field_name,
        field_value_old: edit.field_value_old ?? '',
        field_value_new: edit.field_value_new ?? '',
        applied: appliedFields.includes(edit.field_name), // Track which edits were actually applied
      })),
    };
  }

  /**
   * Create logbook entry for approved artwork edits
   */
  private async createEditLogbookEntry(
    editDetails: {
      artworkId: string;
      userToken: string;
      submittedAt: string;
      edits: Array<{
        field_name: string;
        field_value_old: string;
        field_value_new: string;
        applied: boolean;
      }>;
    },
    moderatorToken: string,
    approvedAt: string
  ): Promise<void> {
    const logbookId = crypto.randomUUID();

    // Get artwork coordinates for logbook entry
    const artworkStmt = this.db.prepare('SELECT lat, lon FROM artwork WHERE id = ?');
    const artwork = await artworkStmt.bind(editDetails.artworkId).first();

    if (!artwork) {
      console.warn(`Could not find artwork ${editDetails.artworkId} for logbook entry`);
      return;
    }

    // Format the changes for the logbook note
    const appliedEdits = editDetails.edits.filter(edit => edit.applied);
    const unappliedEdits = editDetails.edits.filter(edit => !edit.applied);

    // Create base logbook note
    const fieldNames = editDetails.edits.map(edit => edit.field_name);
    const uniqueFields = [...new Set(fieldNames)];

    let logbookNote = `Artwork edit submission approved on ${new Date(approvedAt).toLocaleDateString()} by user ${editDetails.userToken.slice(0, 8)}... - Fields: ${uniqueFields.join(', ')}`;

    // Create comprehensive change details for note
    const changeDetails: string[] = [];

    if (appliedEdits.length > 0) {
      changeDetails.push('Applied changes:');
      appliedEdits.forEach(edit => {
        let oldValue = edit.field_value_old || '';
        let newValue = edit.field_value_new || '';

        // Truncate long values for readability
        if (oldValue.length > 100) oldValue = oldValue.substring(0, 97) + '...';
        if (newValue.length > 100) newValue = newValue.substring(0, 97) + '...';

        changeDetails.push(`  ${edit.field_name}: "${oldValue}" → "${newValue}"`);
      });
    }

    if (unappliedEdits.length > 0) {
      changeDetails.push('');
      changeDetails.push(
        'Note: Some fields could not be applied (field may not exist in database):'
      );
      unappliedEdits.forEach(edit => {
        let oldValue = edit.field_value_old || '';
        let newValue = edit.field_value_new || '';

        // Truncate long values for readability
        if (oldValue.length > 100) oldValue = oldValue.substring(0, 97) + '...';
        if (newValue.length > 100) newValue = newValue.substring(0, 97) + '...';

        changeDetails.push(`  ${edit.field_name}: "${oldValue}" → "${newValue}" [NOT APPLIED]`);
      });
    }

    const fullNote =
      changeDetails.length > 0 ? `${logbookNote}\n\n${changeDetails.join('\n')}` : logbookNote;

    // Insert logbook entry
    const insertStmt = this.db.prepare(`
      INSERT INTO logbook (id, artwork_id, user_token, note, photos, status, lat, lon, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await insertStmt
      .bind(
        logbookId,
        editDetails.artworkId,
        moderatorToken, // Use moderator token as the logbook entry creator
        fullNote,
        '[]', // No photos for edit entries
        'approved', // Auto-approve logbook entries from edit approvals
        artwork.lat,
        artwork.lon,
        approvedAt
      )
      .run();
  }

  /**
   * Ensure editable fields exist in artwork table
   * This handles cases where the database hasn't had migration 004 applied
   */
  private async ensureEditableFieldsExist(): Promise<void> {
    try {
      // Check which columns currently exist
      const tableInfo = await this.db.prepare(`PRAGMA table_info(artwork)`).all();
      const existingColumns = new Set(
        (tableInfo.results as { name: string }[]).map(col => col.name)
      );

      const requiredColumns = ['title', 'description', 'created_by'];
      const missingColumns = requiredColumns.filter(col => !existingColumns.has(col));

      if (missingColumns.length === 0) {
        return; // All columns exist
      }

      console.info(
        `Adding missing editable columns to artwork table: ${missingColumns.join(', ')}`
      );

      // Add missing columns one by one
      for (const column of missingColumns) {
        try {
          await this.db.prepare(`ALTER TABLE artwork ADD COLUMN ${column} TEXT`).run();
          console.info(`Added column: ${column}`);
        } catch (error) {
          // Column might already exist if another request added it
          console.warn(`Failed to add column ${column}:`, error);
        }
      }

      // Create indexes for new columns (if they don't exist)
      const indexCommands = [
        'CREATE INDEX IF NOT EXISTS idx_artwork_title ON artwork(title)',
        'CREATE INDEX IF NOT EXISTS idx_artwork_description ON artwork(description)',
        'CREATE INDEX IF NOT EXISTS idx_artwork_created_by ON artwork(created_by)',
      ];

      for (const indexCmd of indexCommands) {
        try {
          await this.db.prepare(indexCmd).run();
        } catch (error) {
          console.warn(`Failed to create index:`, error);
        }
      }

      // Update existing records to have empty strings instead of NULL
      try {
        await this.db
          .prepare(
            `
          UPDATE artwork SET 
            title = COALESCE(title, ''),
            description = COALESCE(description, ''),
            created_by = COALESCE(created_by, '')
          WHERE title IS NULL OR description IS NULL OR created_by IS NULL
        `
          )
          .run();
        console.info('Updated existing records with default values');
      } catch (error) {
        console.warn('Failed to update existing records:', error);
      }
    } catch (error) {
      console.error('Failed to ensure editable fields exist:', error);
      // Don't throw - let the edit process continue with available fields
    }
  }
}
