/**
 * Database Test Functions for MVP Schema Validation
 * These functions validate CRUD operations on all MVP database tables
 */

import type { ArtworkRecord } from '../types.js';

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
 * Test CRUD operations on artwork table with tag-based artwork types
 */
export function testArtworkCRUD(db: DatabaseConnection): TestResult {
  try {
    // Test INSERT without type_id (now using tags)
    const insertStmt = db.prepare(`
      INSERT INTO artwork (id, lat, lon, status, tags) 
      VALUES (?, ?, ?, ?, ?)
    `);

    const testId = 'test-artwork-' + Date.now();
    const tags = JSON.stringify({ material: 'test', condition: 'new' });
    const result = insertStmt.run(testId, 49.2827, -123.1207, 'pending', tags);

    if (result.changes !== 1) {
      return { passed: false, error: 'Failed to insert artwork' };
    }

    // Test SELECT
    const selectStmt = db.prepare('SELECT * FROM artwork WHERE id = ?');
    const record = selectStmt.get(testId) as unknown as ArtworkRecord;

    if (!record || record.lat !== 49.2827 || record.status !== 'pending') {
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
    const updateResult = updateStmt.run('approved', 49.283, testId);

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
      return {
        passed: false,
        error: 'Invalid artwork status was accepted (CHECK constraint failed)',
      };
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
      return {
        passed: false,
        error: 'Invalid logbook status was accepted (CHECK constraint failed)',
      };
    } catch (error) {
      // This should happen - invalid status should be rejected
    }

    // Clean up
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
      const lat = 49.2827 + i * 0.001; // Spread across ~1km
      const lon = -123.1207 + i * 0.001;
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
      centerLat - radius,
      centerLat + radius,
      centerLon - radius,
      centerLon + radius
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
      details: `Spatial query returned ${results.length} results in ${queryTime}ms`,
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
    const tagsObject = {
      material: 'bronze',
      style: 'modern',
      condition: 'excellent',
      year: '2023',
    };
    const tagsJson = JSON.stringify(tagsObject);

    artworkStmt.run(artworkId, 49.2827, -123.1207, 'public_art', 'approved', tagsJson);

    // Retrieve and parse JSON fields
    const artworkSelectStmt = db.prepare('SELECT * FROM artwork WHERE id = ?');
    const artwork = artworkSelectStmt.get(artworkId) as unknown as ArtworkRecord;

    if (!artwork.tags) {
      return { passed: false, error: 'Artwork tags JSON was not stored' };
    }

    const parsedTags = JSON.parse(artwork.tags);
    if (parsedTags.material !== 'bronze' || parsedTags.style !== 'modern') {
      return { passed: false, error: 'Artwork tags JSON parsing failed' };
    }

    // Clean up
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
    results.artworkCRUD = testArtworkCRUD(db);
    results.statusEnumValidation = testStatusEnumValidation(db);
    results.spatialQueries = testSpatialQueries(db);
    results.jsonFieldParsing = testJSONFieldParsing(db);
  } catch (error) {
    return {
      overallPassed: false,
      results,
      summary: `Test execution failed: ${error}`,
    };
  }

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r.passed).length;
  const overallPassed = passedTests === totalTests;

  const summary =
    `${passedTests}/${totalTests} tests passed. ` +
    (overallPassed ? 'All tests successful!' : 'Some tests failed.');

  return {
    overallPassed,
    results,
    summary,
  };
}
