/**
 * Migration-specific test functions for MVP Database Schema
 * These functions validate the migration was executed correctly
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
 * Test that all expected tables were created
 */
export function testTablesCreated(db: DatabaseConnection): TestResult {
  try {
    const tableStmt = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    const tables = tableStmt.all().map((row: { name: string }) => row.name);
    const expectedTables = ['artwork', 'artwork_types', 'logbook', 'tags'];
    
    for (const expectedTable of expectedTables) {
      if (!tables.includes(expectedTable)) {
        return { 
          passed: false, 
          error: `Expected table '${expectedTable}' was not created` 
        };
      }
    }
    
    // Check that old tables were dropped
    const oldTables = ['artworks', 'photos', 'users', 'sessions'];
    for (const oldTable of oldTables) {
      if (tables.includes(oldTable)) {
        return { 
          passed: false, 
          error: `Old table '${oldTable}' was not dropped` 
        };
      }
    }

    return { 
      passed: true, 
      details: `All expected tables created: ${expectedTables.join(', ')}` 
    };
  } catch (error) {
    return { passed: false, error: `Error checking tables: ${error}` };
  }
}

/**
 * Test that all required indexes were created
 */
export function testIndexesCreated(db: DatabaseConnection): TestResult {
  try {
    const indexStmt = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    const indexes = indexStmt.all().map((row: { name: string }) => row.name);
    
    const expectedIndexes = [
      'idx_artwork_types_name',
      'idx_artwork_lat_lon',
      'idx_artwork_status',
      'idx_artwork_type_id',
      'idx_logbook_artwork_id',
      'idx_logbook_status',
      'idx_logbook_user_token',
      'idx_tags_artwork_id',
      'idx_tags_logbook_id',
      'idx_tags_label'
    ];
    
    for (const expectedIndex of expectedIndexes) {
      if (!indexes.includes(expectedIndex)) {
        return { 
          passed: false, 
          error: `Expected index '${expectedIndex}' was not created` 
        };
      }
    }

    return { 
      passed: true, 
      details: `All expected indexes created: ${expectedIndexes.length} indexes` 
    };
  } catch (error) {
    return { passed: false, error: `Error checking indexes: ${error}` };
  }
}

/**
 * Test that foreign key constraints are properly configured
 */
export function testForeignKeyConstraints(db: DatabaseConnection): TestResult {
  try {
    // Check foreign key enforcement is enabled
    const fkStmt = db.prepare('PRAGMA foreign_keys');
    const fkResult = fkStmt.get();
    
    if (!fkResult || fkResult.foreign_keys !== 1) {
      return { 
        passed: false, 
        error: 'Foreign key constraints are not enabled' 
      };
    }

    // Test artwork.type_id -> artwork_types.id constraint
    try {
      const invalidArtworkStmt = db.prepare(`
        INSERT INTO artwork (id, lat, lon, type_id, status) 
        VALUES (?, ?, ?, ?, ?)
      `);
      invalidArtworkStmt.run('test-invalid-fk', 49.2827, -123.1207, 'nonexistent_type', 'pending');
      
      return { 
        passed: false, 
        error: 'Foreign key constraint artwork.type_id -> artwork_types.id not enforced' 
      };
    } catch (error) {
      // This should fail - foreign key constraint working
    }

    // Test logbook.artwork_id -> artwork.id constraint
    try {
      const invalidLogbookStmt = db.prepare(`
        INSERT INTO logbook (id, artwork_id, user_token, status) 
        VALUES (?, ?, ?, ?)
      `);
      invalidLogbookStmt.run('test-invalid-logbook-fk', 'nonexistent_artwork', 'test-user', 'pending');
      
      return { 
        passed: false, 
        error: 'Foreign key constraint logbook.artwork_id -> artwork.id not enforced' 
      };
    } catch (error) {
      // This should fail - foreign key constraint working
    }

    return { 
      passed: true, 
      details: 'Foreign key constraints are properly enforced' 
    };
  } catch (error) {
    return { passed: false, error: `Error testing foreign keys: ${error}` };
  }
}

/**
 * Test that sample data was inserted correctly
 */
export function testSampleDataInserted(db: DatabaseConnection): TestResult {
  try {
    // Check artwork_types sample data
    const artworkTypesStmt = db.prepare('SELECT COUNT(*) as count FROM artwork_types');
    const artworkTypesCount = artworkTypesStmt.get().count;
    
    if (artworkTypesCount < 5) {
      return { 
        passed: false, 
        error: `Expected at least 5 artwork types, found ${artworkTypesCount}` 
      };
    }

    // Check that required artwork types exist
    const requiredTypes = ['public_art', 'street_art', 'monument', 'sculpture', 'other'];
    const typeCheckStmt = db.prepare('SELECT COUNT(*) as count FROM artwork_types WHERE name = ?');
    
    for (const type of requiredTypes) {
      const count = typeCheckStmt.get(type).count;
      if (count !== 1) {
        return { 
          passed: false, 
          error: `Required artwork type '${type}' not found or duplicated` 
        };
      }
    }

    // Check sample artworks
    const artworkStmt = db.prepare(`SELECT COUNT(*) as count FROM artwork WHERE id LIKE 'SAMPLE-%'`);
    const artworkCount = artworkStmt.get().count;
    
    if (artworkCount < 6) {
      return { 
        passed: false, 
        error: `Expected at least 6 sample artworks, found ${artworkCount}` 
      };
    }

    // Check sample logbook entries
    const logbookStmt = db.prepare(`SELECT COUNT(*) as count FROM logbook WHERE id LIKE 'SAMPLE-%'`);
    const logbookCount = logbookStmt.get().count;
    
    if (logbookCount < 9) {
      return { 
        passed: false, 
        error: `Expected at least 9 sample logbook entries, found ${logbookCount}` 
      };
    }

    // Check sample tags
    const tagsStmt = db.prepare(`SELECT COUNT(*) as count FROM tags WHERE id LIKE 'SAMPLE-%'`);
    const tagsCount = tagsStmt.get().count;
    
    if (tagsCount < 5) {
      return { 
        passed: false, 
        error: `Expected at least 5 sample tags, found ${tagsCount}` 
      };
    }

    return { 
      passed: true, 
      details: `Sample data: ${artworkTypesCount} types, ${artworkCount} artworks, ${logbookCount} logbook entries, ${tagsCount} tags` 
    };
  } catch (error) {
    return { passed: false, error: `Error checking sample data: ${error}` };
  }
}

/**
 * Test that status combinations are properly represented in sample data
 */
export function testStatusCombinations(db: DatabaseConnection): TestResult {
  try {
    // Check artwork status combinations
    const artworkStatusStmt = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM artwork 
      WHERE id LIKE 'SAMPLE-%' 
      GROUP BY status
    `);
    const artworkStatuses = artworkStatusStmt.all();
    
    const expectedArtworkStatuses = ['pending', 'approved', 'removed'];
    for (const status of expectedArtworkStatuses) {
      const found = artworkStatuses.find((s: { status: string; count: number }) => s.status === status);
      if (!found || found.count < 2) {
        return { 
          passed: false, 
          error: `Insufficient sample artworks with status '${status}' (need at least 2)` 
        };
      }
    }

    // Check logbook status combinations
    const logbookStatusStmt = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM logbook 
      WHERE id LIKE 'SAMPLE-%' 
      GROUP BY status
    `);
    const logbookStatuses = logbookStatusStmt.all();
    
    const expectedLogbookStatuses = ['pending', 'approved', 'rejected'];
    for (const status of expectedLogbookStatuses) {
      const found = logbookStatuses.find((s: { status: string; count: number }) => s.status === status);
      if (!found || found.count < 3) {
        return { 
          passed: false, 
          error: `Insufficient sample logbook entries with status '${status}' (need at least 3)` 
        };
      }
    }

    return { 
      passed: true, 
      details: 'All required status combinations present in sample data' 
    };
  } catch (error) {
    return { passed: false, error: `Error checking status combinations: ${error}` };
  }
}

/**
 * Test that Vancouver coordinates are realistic
 */
export function testVancouverCoordinates(db: DatabaseConnection): TestResult {
  try {
    const coordStmt = db.prepare(`
      SELECT lat, lon FROM artwork 
      WHERE id LIKE 'SAMPLE-%'
    `);
    const coordinates = coordStmt.all();
    
    const vancouverBounds = {
      minLat: 49.2,
      maxLat: 49.35,
      minLon: -123.3,
      maxLon: -123.0
    };
    
    for (const coord of coordinates) {
      if (coord.lat < vancouverBounds.minLat || coord.lat > vancouverBounds.maxLat ||
          coord.lon < vancouverBounds.minLon || coord.lon > vancouverBounds.maxLon) {
        return { 
          passed: false, 
          error: `Coordinates ${coord.lat}, ${coord.lon} are outside Vancouver area` 
        };
      }
    }

    const avgLat = coordinates.reduce((sum: number, c: { lat: number }) => sum + c.lat, 0) / coordinates.length;
    const avgLon = coordinates.reduce((sum: number, c: { lon: number }) => sum + c.lon, 0) / coordinates.length;

    return { 
      passed: true, 
      details: `All coordinates within Vancouver bounds. Average: ${avgLat.toFixed(4)}, ${avgLon.toFixed(4)}` 
    };
  } catch (error) {
    return { passed: false, error: `Error checking coordinates: ${error}` };
  }
}

/**
 * Test table schema structure matches requirements
 */
export function testTableSchemas(db: DatabaseConnection): TestResult {
  try {
    // Test artwork_types table structure
    const artworkTypesSchemaStmt = db.prepare('PRAGMA table_info(artwork_types)');
    const artworkTypesSchema = artworkTypesSchemaStmt.all();
    
    const requiredArtworkTypesFields = ['id', 'name', 'description', 'created_at'];
    for (const field of requiredArtworkTypesFields) {
      if (!artworkTypesSchema.find((col: { name: string }) => col.name === field)) {
        return { 
          passed: false, 
          error: `artwork_types table missing required field: ${field}` 
        };
      }
    }

    // Test artwork table structure
    const artworkSchemaStmt = db.prepare('PRAGMA table_info(artwork)');
    const artworkSchema = artworkSchemaStmt.all();
    
    const requiredArtworkFields = ['id', 'lat', 'lon', 'type_id', 'created_at', 'status', 'tags'];
    for (const field of requiredArtworkFields) {
      if (!artworkSchema.find((col: { name: string }) => col.name === field)) {
        return { 
          passed: false, 
          error: `artwork table missing required field: ${field}` 
        };
      }
    }

    // Test logbook table structure
    const logbookSchemaStmt = db.prepare('PRAGMA table_info(logbook)');
    const logbookSchema = logbookSchemaStmt.all();
    
    const requiredLogbookFields = ['id', 'artwork_id', 'user_token', 'note', 'photos', 'status', 'created_at'];
    for (const field of requiredLogbookFields) {
      if (!logbookSchema.find((col: { name: string }) => col.name === field)) {
        return { 
          passed: false, 
          error: `logbook table missing required field: ${field}` 
        };
      }
    }

    // Test tags table structure
    const tagsSchemaStmt = db.prepare('PRAGMA table_info(tags)');
    const tagsSchema = tagsSchemaStmt.all();
    
    const requiredTagsFields = ['id', 'artwork_id', 'logbook_id', 'label', 'value', 'created_at'];
    for (const field of requiredTagsFields) {
      if (!tagsSchema.find((col: { name: string }) => col.name === field)) {
        return { 
          passed: false, 
          error: `tags table missing required field: ${field}` 
        };
      }
    }

    return { 
      passed: true, 
      details: 'All table schemas match requirements' 
    };
  } catch (error) {
    return { passed: false, error: `Error checking table schemas: ${error}` };
  }
}

/**
 * Run all migration-specific tests
 */
export function runAllMigrationTests(db: DatabaseConnection): {
  overallPassed: boolean;
  results: Record<string, TestResult>;
  summary: string;
} {
  const results: Record<string, TestResult> = {};
  
  try {
    results.tablesCreated = testTablesCreated(db);
    results.indexesCreated = testIndexesCreated(db);
    results.foreignKeyConstraints = testForeignKeyConstraints(db);
    results.sampleDataInserted = testSampleDataInserted(db);
    results.statusCombinations = testStatusCombinations(db);
    results.vancouverCoordinates = testVancouverCoordinates(db);
    results.tableSchemas = testTableSchemas(db);
  } catch (error) {
    return {
      overallPassed: false,
      results,
      summary: `Migration test execution failed: ${error}`
    };
  }

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r.passed).length;
  const overallPassed = passedTests === totalTests;
  
  const summary = `Migration Tests: ${passedTests}/${totalTests} passed. ` +
    (overallPassed ? 'Migration successful!' : 'Migration issues detected.');

  return {
    overallPassed,
    results,
    summary
  };
}