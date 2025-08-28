/**
 * Database Test Functions for MVP Schema Validation
 * These functions validate CRUD operations on all MVP database tables
 */

import type { 
  ArtworkTypeRecord, 
  ArtworkRecord, 
  LogbookRecord, 
  TagRecord 
} from '../types.js';

// Test interface for database operations
interface DatabaseConnection {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: any[]): any;
    all(...params: any[]): any[];
  };
}

// Test result interface
interface TestResult {
  passed: boolean;
  error?: string;
  details?: string;
}

/**
 * Test CRUD operations on artwork_types table
 */
export function testArtworkTypesCRUD(db: DatabaseConnection): TestResult {
  try {
    // Test INSERT
    const insertStmt = db.prepare(`
      INSERT INTO artwork_types (id, name, description) 
      VALUES (?, ?, ?)
    `);
    
    const testId = 'test-type-' + Date.now();
    const result = insertStmt.run(testId, 'test_type', 'Test artwork type');
    
    if (result.changes !== 1) {
      return { passed: false, error: 'Failed to insert artwork type' };
    }

    // Test SELECT
    const selectStmt = db.prepare('SELECT * FROM artwork_types WHERE id = ?');
    const record = selectStmt.get(testId) as ArtworkTypeRecord;
    
    if (!record || record.name !== 'test_type') {
      return { passed: false, error: 'Failed to retrieve inserted artwork type' };
    }

    // Test UPDATE
    const updateStmt = db.prepare('UPDATE artwork_types SET description = ? WHERE id = ?');
    const updateResult = updateStmt.run('Updated description', testId);
    
    if (updateResult.changes !== 1) {
      return { passed: false, error: 'Failed to update artwork type' };
    }

    // Verify update
    const updatedRecord = selectStmt.get(testId) as ArtworkTypeRecord;
    if (updatedRecord.description !== 'Updated description') {
      return { passed: false, error: 'Update verification failed' };
    }

    // Test DELETE
    const deleteStmt = db.prepare('DELETE FROM artwork_types WHERE id = ?');
    const deleteResult = deleteStmt.run(testId);
    
    if (deleteResult.changes !== 1) {
      return { passed: false, error: 'Failed to delete artwork type' };
    }

    return { passed: true, details: 'All CRUD operations successful' };
  } catch (error) {
    return { passed: false, error: `Unexpected error: ${error}` };
  }
}

/**
 * Test CRUD operations on artwork table including foreign key relationships
 */
export function testArtworkCRUD(db: DatabaseConnection): TestResult {
  try {
    // Test INSERT with foreign key
    const insertStmt = db.prepare(`
      INSERT INTO artwork (id, lat, lon, type_id, status, tags) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const testId = 'test-artwork-' + Date.now();
    const tags = JSON.stringify({ material: 'test', condition: 'new' });
    const result = insertStmt.run(testId, 49.2827, -123.1207, 'public_art', 'pending', tags);
    
    if (result.changes !== 1) {
      return { passed: false, error: 'Failed to insert artwork' };
    }

    // Test SELECT
    const selectStmt = db.prepare('SELECT * FROM artwork WHERE id = ?');
    const record = selectStmt.get(testId) as ArtworkRecord;
    
    if (!record || record.lat !== 49.2827 || record.type_id !== 'public_art') {
      return { passed: false, error: 'Failed to retrieve inserted artwork' };
    }

    // Test JSON parsing
    if (record.tags) {
      const parsedTags = JSON.parse(record.tags);
      if (parsedTags.material !== 'test') {
        return { passed: false, error: 'JSON tags not properly stored/retrieved' };
      }
    }

    // Test UPDATE
    const updateStmt = db.prepare('UPDATE artwork SET status = ?, lat = ? WHERE id = ?');
    const updateResult = updateStmt.run('approved', 49.2830, testId);
    
    if (updateResult.changes !== 1) {
      return { passed: false, error: 'Failed to update artwork' };
    }

    // Test DELETE
    const deleteStmt = db.prepare('DELETE FROM artwork WHERE id = ?');
    const deleteResult = deleteStmt.run(testId);
    
    if (deleteResult.changes !== 1) {
      return { passed: false, error: 'Failed to delete artwork' };
    }

    return { passed: true, details: 'All CRUD operations and JSON handling successful' };
  } catch (error) {
    return { passed: false, error: `Unexpected error: ${error}` };
  }
}

/**
 * Test CRUD operations on logbook table
 */
export function testLogbookCRUD(db: DatabaseConnection): TestResult {
  try {
    // First create a test artwork to reference
    const artworkStmt = db.prepare(`
      INSERT INTO artwork (id, lat, lon, type_id, status) 
      VALUES (?, ?, ?, ?, ?)
    `);
    const artworkId = 'test-artwork-for-logbook-' + Date.now();
    artworkStmt.run(artworkId, 49.2827, -123.1207, 'public_art', 'approved');

    // Test INSERT
    const insertStmt = db.prepare(`
      INSERT INTO logbook (id, artwork_id, user_token, note, photos, status) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const testId = 'test-logbook-' + Date.now();
    const photos = JSON.stringify(['https://test-url.com/photo1.jpg', 'https://test-url.com/photo2.jpg']);
    const result = insertStmt.run(testId, artworkId, 'test-user-token', 'Test note', photos, 'pending');
    
    if (result.changes !== 1) {
      return { passed: false, error: 'Failed to insert logbook entry' };
    }

    // Test SELECT
    const selectStmt = db.prepare('SELECT * FROM logbook WHERE id = ?');
    const record = selectStmt.get(testId) as LogbookRecord;
    
    if (!record || record.artwork_id !== artworkId || record.note !== 'Test note') {
      return { passed: false, error: 'Failed to retrieve inserted logbook entry' };
    }

    // Test JSON array parsing
    if (record.photos) {
      const parsedPhotos = JSON.parse(record.photos);
      if (!Array.isArray(parsedPhotos) || parsedPhotos.length !== 2) {
        return { passed: false, error: 'JSON photos array not properly stored/retrieved' };
      }
    }

    // Test UPDATE
    const updateStmt = db.prepare('UPDATE logbook SET status = ?, note = ? WHERE id = ?');
    const updateResult = updateStmt.run('approved', 'Updated test note', testId);
    
    if (updateResult.changes !== 1) {
      return { passed: false, error: 'Failed to update logbook entry' };
    }

    // Clean up
    const deleteLogbookStmt = db.prepare('DELETE FROM logbook WHERE id = ?');
    deleteLogbookStmt.run(testId);
    
    const deleteArtworkStmt = db.prepare('DELETE FROM artwork WHERE id = ?');
    deleteArtworkStmt.run(artworkId);

    return { passed: true, details: 'All CRUD operations and foreign key relationships successful' };
  } catch (error) {
    return { passed: false, error: `Unexpected error: ${error}` };
  }
}

/**
 * Test CRUD operations on tags table with foreign key relationships
 */
export function testTagsCRUD(db: DatabaseConnection): TestResult {
  try {
    // Create test artwork and logbook entries to reference
    const artworkStmt = db.prepare(`
      INSERT INTO artwork (id, lat, lon, type_id, status) 
      VALUES (?, ?, ?, ?, ?)
    `);
    const artworkId = 'test-artwork-for-tags-' + Date.now();
    artworkStmt.run(artworkId, 49.2827, -123.1207, 'public_art', 'approved');

    const logbookStmt = db.prepare(`
      INSERT INTO logbook (id, artwork_id, user_token, note, status) 
      VALUES (?, ?, ?, ?, ?)
    `);
    const logbookId = 'test-logbook-for-tags-' + Date.now();
    logbookStmt.run(logbookId, artworkId, 'test-user', 'Test note', 'approved');

    // Test INSERT for artwork tag
    const insertArtworkTagStmt = db.prepare(`
      INSERT INTO tags (id, artwork_id, logbook_id, label, value) 
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const artworkTagId = 'test-artwork-tag-' + Date.now();
    const result1 = insertArtworkTagStmt.run(artworkTagId, artworkId, null, 'material', 'bronze');
    
    if (result1.changes !== 1) {
      return { passed: false, error: 'Failed to insert artwork tag' };
    }

    // Test INSERT for logbook tag
    const logbookTagId = 'test-logbook-tag-' + Date.now();
    const result2 = insertArtworkTagStmt.run(logbookTagId, null, logbookId, 'condition', 'excellent');
    
    if (result2.changes !== 1) {
      return { passed: false, error: 'Failed to insert logbook tag' };
    }

    // Test SELECT
    const selectStmt = db.prepare('SELECT * FROM tags WHERE id = ?');
    const artworkTag = selectStmt.get(artworkTagId) as TagRecord;
    const logbookTag = selectStmt.get(logbookTagId) as TagRecord;
    
    if (!artworkTag || artworkTag.artwork_id !== artworkId || artworkTag.label !== 'material') {
      return { passed: false, error: 'Failed to retrieve artwork tag' };
    }
    
    if (!logbookTag || logbookTag.logbook_id !== logbookId || logbookTag.label !== 'condition') {
      return { passed: false, error: 'Failed to retrieve logbook tag' };
    }

    // Test UPDATE
    const updateStmt = db.prepare('UPDATE tags SET value = ? WHERE id = ?');
    const updateResult = updateStmt.run('silver', artworkTagId);
    
    if (updateResult.changes !== 1) {
      return { passed: false, error: 'Failed to update tag' };
    }

    // Clean up
    const deleteTagStmt = db.prepare('DELETE FROM tags WHERE id IN (?, ?)');
    deleteTagStmt.run(artworkTagId, logbookTagId);
    
    const deleteLogbookStmt = db.prepare('DELETE FROM logbook WHERE id = ?');
    deleteLogbookStmt.run(logbookId);
    
    const deleteArtworkStmt = db.prepare('DELETE FROM artwork WHERE id = ?');
    deleteArtworkStmt.run(artworkId);

    return { passed: true, details: 'All CRUD operations with foreign keys successful' };
  } catch (error) {
    return { passed: false, error: `Unexpected error: ${error}` };
  }
}

/**
 * Test foreign key integrity and cascade deletes
 */
export function testForeignKeyIntegrity(db: DatabaseConnection): TestResult {
  try {
    // Create test data
    const artworkStmt = db.prepare(`
      INSERT INTO artwork (id, lat, lon, type_id, status) 
      VALUES (?, ?, ?, ?, ?)
    `);
    const artworkId = 'test-fk-artwork-' + Date.now();
    artworkStmt.run(artworkId, 49.2827, -123.1207, 'public_art', 'approved');

    const logbookStmt = db.prepare(`
      INSERT INTO logbook (id, artwork_id, user_token, note, status) 
      VALUES (?, ?, ?, ?, ?)
    `);
    const logbookId = 'test-fk-logbook-' + Date.now();
    logbookStmt.run(logbookId, artworkId, 'test-user', 'Test note', 'approved');

    const tagStmt = db.prepare(`
      INSERT INTO tags (id, artwork_id, logbook_id, label, value) 
      VALUES (?, ?, ?, ?, ?)
    `);
    const artworkTagId = 'test-fk-artwork-tag-' + Date.now();
    const logbookTagId = 'test-fk-logbook-tag-' + Date.now();
    tagStmt.run(artworkTagId, artworkId, null, 'material', 'bronze');
    tagStmt.run(logbookTagId, null, logbookId, 'condition', 'good');

    // Verify data exists
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM tags WHERE artwork_id = ? OR logbook_id = ?');
    const beforeCount = countStmt.get(artworkId, logbookId).count;
    
    if (beforeCount !== 2) {
      return { passed: false, error: 'Test data not properly created' };
    }

    // Test CASCADE DELETE - delete artwork should delete related logbook and tags
    const deleteArtworkStmt = db.prepare('DELETE FROM artwork WHERE id = ?');
    deleteArtworkStmt.run(artworkId);

    // Verify cascade delete worked
    const afterCount = countStmt.get(artworkId, logbookId).count;
    const logbookCount = db.prepare('SELECT COUNT(*) as count FROM logbook WHERE id = ?').get(logbookId).count;
    
    if (afterCount !== 0 || logbookCount !== 0) {
      return { passed: false, error: 'CASCADE DELETE did not work properly' };
    }

    return { passed: true, details: 'Foreign key constraints and cascade deletes working correctly' };
  } catch (error) {
    return { passed: false, error: `Unexpected error: ${error}` };
  }
}

/**
 * Test status enum validation with CHECK constraints
 */
export function testStatusEnumValidation(db: DatabaseConnection): TestResult {
  try {
    // Test valid artwork status
    const validArtworkStmt = db.prepare(`
      INSERT INTO artwork (id, lat, lon, type_id, status) 
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const validId = 'test-valid-status-' + Date.now();
    const validResult = validArtworkStmt.run(validId, 49.2827, -123.1207, 'public_art', 'pending');
    
    if (validResult.changes !== 1) {
      return { passed: false, error: 'Failed to insert artwork with valid status' };
    }

    // Test invalid artwork status (should fail)
    try {
      const invalidId = 'test-invalid-status-' + Date.now();
      validArtworkStmt.run(invalidId, 49.2827, -123.1207, 'public_art', 'invalid_status');
      return { passed: false, error: 'Invalid artwork status was accepted (CHECK constraint failed)' };
    } catch (error) {
      // This should happen - invalid status should be rejected
    }

    // Test valid logbook status
    const validLogbookStmt = db.prepare(`
      INSERT INTO logbook (id, artwork_id, user_token, status) 
      VALUES (?, ?, ?, ?)
    `);
    
    const logbookId = 'test-valid-logbook-status-' + Date.now();
    const logbookResult = validLogbookStmt.run(logbookId, validId, 'test-user', 'approved');
    
    if (logbookResult.changes !== 1) {
      return { passed: false, error: 'Failed to insert logbook with valid status' };
    }

    // Test invalid logbook status (should fail)
    try {
      const invalidLogbookId = 'test-invalid-logbook-status-' + Date.now();
      validLogbookStmt.run(invalidLogbookId, validId, 'test-user', 'invalid_status');
      return { passed: false, error: 'Invalid logbook status was accepted (CHECK constraint failed)' };
    } catch (error) {
      // This should happen - invalid status should be rejected
    }

    // Clean up
    const deleteLogbookStmt = db.prepare('DELETE FROM logbook WHERE id = ?');
    deleteLogbookStmt.run(logbookId);
    
    const deleteArtworkStmt = db.prepare('DELETE FROM artwork WHERE id = ?');
    deleteArtworkStmt.run(validId);

    return { passed: true, details: 'Status enum validation working correctly' };
  } catch (error) {
    return { passed: false, error: `Unexpected error: ${error}` };
  }
}

/**
 * Test spatial queries and index performance
 */
export function testSpatialQueries(db: DatabaseConnection): TestResult {
  try {
    // Insert test data with Vancouver coordinates
    const insertStmt = db.prepare(`
      INSERT INTO artwork (id, lat, lon, type_id, status) 
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const testIds = [];
    // Insert artworks in a grid around Vancouver
    for (let i = 0; i < 10; i++) {
      const id = `test-spatial-${i}-${Date.now()}`;
      const lat = 49.2827 + (i * 0.001); // Spread across ~1km
      const lon = -123.1207 + (i * 0.001);
      insertStmt.run(id, lat, lon, 'public_art', 'approved');
      testIds.push(id);
    }

    // Test spatial range query (within ~500m of center point)
    const spatialStmt = db.prepare(`
      SELECT * FROM artwork 
      WHERE lat BETWEEN ? AND ? 
      AND lon BETWEEN ? AND ? 
      AND status = 'approved'
    `);
    
    const centerLat = 49.2827;
    const centerLon = -123.1207;
    const radius = 0.0045; // Approximately 500m in degrees
    
    const startTime = Date.now();
    const results = spatialStmt.all(
      centerLat - radius, centerLat + radius,
      centerLon - radius, centerLon + radius
    );
    const queryTime = Date.now() - startTime;
    
    if (queryTime > 100) {
      return { passed: false, error: `Spatial query took ${queryTime}ms, expected under 100ms` };
    }
    
    if (results.length < 5) {
      return { passed: false, error: 'Spatial query did not return expected results' };
    }

    // Clean up
    const deleteStmt = db.prepare(`DELETE FROM artwork WHERE id LIKE 'test-spatial-%'`);
    deleteStmt.run();

    return { 
      passed: true, 
      details: `Spatial query returned ${results.length} results in ${queryTime}ms` 
    };
  } catch (error) {
    return { passed: false, error: `Unexpected error: ${error}` };
  }
}

/**
 * Test JSON field parsing for tags objects and photos arrays
 */
export function testJSONFieldParsing(db: DatabaseConnection): TestResult {
  try {
    // Test artwork tags JSON object
    const artworkStmt = db.prepare(`
      INSERT INTO artwork (id, lat, lon, type_id, status, tags) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const artworkId = 'test-json-artwork-' + Date.now();
    const tagsObject = { material: 'bronze', style: 'modern', condition: 'excellent', year: '2023' };
    const tagsJson = JSON.stringify(tagsObject);
    
    artworkStmt.run(artworkId, 49.2827, -123.1207, 'public_art', 'approved', tagsJson);

    // Test logbook photos JSON array
    const logbookStmt = db.prepare(`
      INSERT INTO logbook (id, artwork_id, user_token, note, photos, status) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const logbookId = 'test-json-logbook-' + Date.now();
    const photosArray = [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
      'https://example.com/photo3.jpg'
    ];
    const photosJson = JSON.stringify(photosArray);
    
    logbookStmt.run(logbookId, artworkId, 'test-user', 'Test note', photosJson, 'approved');

    // Retrieve and parse JSON fields
    const artworkSelectStmt = db.prepare('SELECT * FROM artwork WHERE id = ?');
    const artwork = artworkSelectStmt.get(artworkId) as ArtworkRecord;
    
    if (!artwork.tags) {
      return { passed: false, error: 'Artwork tags JSON was not stored' };
    }
    
    const parsedTags = JSON.parse(artwork.tags);
    if (parsedTags.material !== 'bronze' || parsedTags.style !== 'modern') {
      return { passed: false, error: 'Artwork tags JSON parsing failed' };
    }

    const logbookSelectStmt = db.prepare('SELECT * FROM logbook WHERE id = ?');
    const logbook = logbookSelectStmt.get(logbookId) as LogbookRecord;
    
    if (!logbook.photos) {
      return { passed: false, error: 'Logbook photos JSON was not stored' };
    }
    
    const parsedPhotos = JSON.parse(logbook.photos);
    if (!Array.isArray(parsedPhotos) || parsedPhotos.length !== 3) {
      return { passed: false, error: 'Logbook photos JSON parsing failed' };
    }
    
    if (parsedPhotos[0] !== 'https://example.com/photo1.jpg') {
      return { passed: false, error: 'Logbook photos array content incorrect' };
    }

    // Clean up
    const deleteLogbookStmt = db.prepare('DELETE FROM logbook WHERE id = ?');
    deleteLogbookStmt.run(logbookId);
    
    const deleteArtworkStmt = db.prepare('DELETE FROM artwork WHERE id = ?');
    deleteArtworkStmt.run(artworkId);

    return { passed: true, details: 'JSON field parsing for objects and arrays successful' };
  } catch (error) {
    return { passed: false, error: `Unexpected error: ${error}` };
  }
}

/**
 * Run all database tests and return combined results
 */
export function runAllDatabaseTests(db: DatabaseConnection): {
  overallPassed: boolean;
  results: Record<string, TestResult>;
  summary: string;
} {
  const results: Record<string, TestResult> = {};
  
  try {
    results.artworkTypesCRUD = testArtworkTypesCRUD(db);
    results.artworkCRUD = testArtworkCRUD(db);
    results.logbookCRUD = testLogbookCRUD(db);
    results.tagsCRUD = testTagsCRUD(db);
    results.foreignKeyIntegrity = testForeignKeyIntegrity(db);
    results.statusEnumValidation = testStatusEnumValidation(db);
    results.spatialQueries = testSpatialQueries(db);
    results.jsonFieldParsing = testJSONFieldParsing(db);
  } catch (error) {
    return {
      overallPassed: false,
      results,
      summary: `Test execution failed: ${error}`
    };
  }

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r.passed).length;
  const overallPassed = passedTests === totalTests;
  
  const summary = `${passedTests}/${totalTests} tests passed. ` +
    (overallPassed ? 'All tests successful!' : 'Some tests failed.');

  return {
    overallPassed,
    results,
    summary
  };
}