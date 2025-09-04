/**
 * Artwork Edits Migration Test Functions
 * Tests for the 003_create_artwork_edits_table.sql migration
 */

// Test interface for database operations
interface DatabaseConnection {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  };
}

// Test result interface  
interface TestResult {
  passed: boolean;
  error?: string;
  details?: string;
}

/**
 * Test that artwork_edits table was created with correct structure
 */
export function testArtworkEditsTableCreated(db: DatabaseConnection): TestResult {
  try {
    // Check table exists
    const tableStmt = db.prepare(`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='artwork_edits'
    `);
    const table = tableStmt.get();
    
    if (!table) {
      return { passed: false, error: 'artwork_edits table was not created' };
    }

    const sql = (table as { sql: string }).sql;
    
    // Check required columns exist
    const requiredColumns = [
      'edit_id TEXT PRIMARY KEY',
      'artwork_id TEXT NOT NULL', 
      'user_token TEXT NOT NULL',
      'field_name TEXT NOT NULL',
      'field_value_old TEXT',
      'field_value_new TEXT',
      'status TEXT NOT NULL DEFAULT \'pending\'',
      'moderator_notes TEXT',
      'reviewed_at TEXT',
      'reviewed_by TEXT',
      'submitted_at TEXT NOT NULL DEFAULT'
    ];

    for (const column of requiredColumns) {
      if (!sql.includes(column)) {
        return { 
          passed: false, 
          error: `Required column not found: ${column}`,
          details: sql 
        };
      }
    }

    // Check foreign key constraint exists
    if (!sql.includes('FOREIGN KEY (artwork_id) REFERENCES artwork(id)')) {
      return {
        passed: false,
        error: 'Foreign key constraint to artwork table missing',
        details: sql
      };
    }

    // Check status constraint exists
    if (!sql.includes("CHECK (status IN ('pending', 'approved', 'rejected'))")) {
      return {
        passed: false,
        error: 'Status enum constraint missing',
        details: sql
      };
    }

    return { passed: true };
  } catch (error) {
    return { 
      passed: false, 
      error: `Test failed: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Test that all required indexes were created
 */
export function testArtworkEditsIndexesCreated(db: DatabaseConnection): TestResult {
  try {
    const indexStmt = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='artwork_edits' 
      ORDER BY name
    `);
    const indexes = indexStmt.all().map(row => (row as { name: string }).name);

    const expectedIndexes = [
      'idx_artwork_edits_artwork_id',
      'idx_artwork_edits_user_token', 
      'idx_artwork_edits_status',
      'idx_artwork_edits_submitted_at',
      'idx_artwork_edits_moderation_queue',
      'idx_artwork_edits_user_pending'
    ];

    for (const expectedIndex of expectedIndexes) {
      if (!indexes.includes(expectedIndex)) {
        return {
          passed: false,
          error: `Required index not found: ${expectedIndex}`,
          details: `Found indexes: ${indexes.join(', ')}`
        };
      }
    }

    return { passed: true };
  } catch (error) {
    return { 
      passed: false, 
      error: `Test failed: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Test artwork edits CRUD operations
 */
export function testArtworkEditsCRUD(db: DatabaseConnection): TestResult {
  try {
    // First ensure we have test data
    const artworkTypeId = 'test-type-' + Date.now();
    const artworkId = 'test-artwork-' + Date.now();
    const userToken = 'test-user-' + Date.now();
    const editId = 'test-edit-' + Date.now();

    // Insert artwork type and artwork for foreign key
    db.prepare(`
      INSERT OR IGNORE INTO artwork_types (id, name, description) 
      VALUES (?, 'Test Type', 'Test artwork type')
    `).run(artworkTypeId);

    db.prepare(`
      INSERT INTO artwork (id, lat, lon, type_id, status) 
      VALUES (?, 49.2827, -123.1207, ?, 'approved')
    `).run(artworkId, artworkTypeId);

    // Test INSERT
    const insertResult = db.prepare(`
      INSERT INTO artwork_edits (edit_id, artwork_id, user_token, field_name, field_value_old, field_value_new, status)
      VALUES (?, ?, ?, 'title', 'Old Title', 'New Title', 'pending')
    `).run(editId, artworkId, userToken);

    if (insertResult.changes !== 1) {
      return { passed: false, error: 'Failed to insert artwork edit' };
    }

    // Test SELECT
    const selectResult = db.prepare(`
      SELECT * FROM artwork_edits WHERE edit_id = ?
    `).get(editId) as Record<string, unknown>;

    if (!selectResult) {
      return { passed: false, error: 'Failed to select inserted artwork edit' };
    }

    if (selectResult.field_name !== 'title' || selectResult.status !== 'pending') {
      return { 
        passed: false, 
        error: 'Retrieved artwork edit has incorrect values',
        details: JSON.stringify(selectResult)
      };
    }

    // Test UPDATE
    const updateResult = db.prepare(`
      UPDATE artwork_edits 
      SET status = 'approved', reviewed_at = datetime('now'), reviewed_by = ?
      WHERE edit_id = ?
    `).run(userToken, editId);

    if (updateResult.changes !== 1) {
      return { passed: false, error: 'Failed to update artwork edit status' };
    }

    // Verify update
    const updatedResult = db.prepare(`
      SELECT status, reviewed_by FROM artwork_edits WHERE edit_id = ?
    `).get(editId) as Record<string, unknown>;

    if (!updatedResult || updatedResult.status !== 'approved') {
      return { passed: false, error: 'Artwork edit status was not updated correctly' };
    }

    return { passed: true };
  } catch (error) {
    return { 
      passed: false, 
      error: `Test failed: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Test foreign key constraint enforcement
 */
export function testArtworkEditsForeignKeyIntegrity(db: DatabaseConnection): TestResult {
  try {
    const editId = 'test-edit-fk-' + Date.now();
    const invalidArtworkId = 'nonexistent-artwork';
    const userToken = 'test-user';

    // This should fail due to foreign key constraint
    try {
      db.prepare(`
        INSERT INTO artwork_edits (edit_id, artwork_id, user_token, field_name, field_value_old, field_value_new)
        VALUES (?, ?, ?, 'title', 'Old Title', 'New Title')
      `).run(editId, invalidArtworkId, userToken);

      // If we get here, the constraint didn't work
      return { 
        passed: false, 
        error: 'Foreign key constraint was not enforced - insert should have failed' 
      };
    } catch (constraintError) {
      // This is expected - foreign key constraint should prevent the insert
      return { passed: true };
    }
  } catch (error) {
    return { 
      passed: false, 
      error: `Test failed: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Test status enum constraint enforcement
 */
export function testArtworkEditsStatusEnumValidation(db: DatabaseConnection): TestResult {
  try {
    // First create test data
    const artworkTypeId = 'test-type-enum-' + Date.now();
    const artworkId = 'test-artwork-enum-' + Date.now();
    const userToken = 'test-user';
    const editId = 'test-edit-enum-' + Date.now();

    db.prepare(`
      INSERT OR IGNORE INTO artwork_types (id, name, description) 
      VALUES (?, 'Test Type', 'Test artwork type')
    `).run(artworkTypeId);

    db.prepare(`
      INSERT INTO artwork (id, lat, lon, type_id, status) 
      VALUES (?, 49.2827, -123.1207, ?, 'approved')
    `).run(artworkId, artworkTypeId);

    // This should fail due to invalid status
    try {
      db.prepare(`
        INSERT INTO artwork_edits (edit_id, artwork_id, user_token, field_name, field_value_old, field_value_new, status)
        VALUES (?, ?, ?, 'title', 'Old Title', 'New Title', 'invalid_status')
      `).run(editId, artworkId, userToken);

      // If we get here, the constraint didn't work
      return { 
        passed: false, 
        error: 'Status enum constraint was not enforced - insert should have failed' 
      };
    } catch (constraintError) {
      // This is expected - status constraint should prevent the insert
      return { passed: true };
    }
  } catch (error) {
    return { 
      passed: false, 
      error: `Test failed: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}