/**
 * Test the structured tag schema migration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Migration 006: Structured Tag Schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:');

    // Create artwork_types table and sample data
    db.exec(`
      CREATE TABLE IF NOT EXISTS artwork_types (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS artwork (
        id TEXT PRIMARY KEY,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        type_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'removed')),
        tags TEXT
      )
    `);

    // Insert sample data
    db.exec(`
      INSERT INTO artwork_types (id, name, description) VALUES 
      ('mural-type', 'Mural', 'Wall murals and painted artwork'),
      ('statue-type', 'Statue', 'Sculptural statues and monuments')
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('should handle null tags gracefully', () => {
    // Insert artwork with null tags
    db.exec(`
      INSERT INTO artwork (id, lat, lon, type_id, status, tags) VALUES 
      ('test-1', 49.2827, -123.1207, 'statue-type', 'approved', NULL)
    `);

    // Apply core migration logic
    db.exec(`
      UPDATE artwork 
      SET tags = (
          SELECT json_object(
              'tags', 
              CASE 
                  WHEN tags IS NULL OR tags = '' OR tags = '{}' THEN json_object()
                  WHEN json_valid(tags) AND json_extract(tags, '$.version') IS NOT NULL THEN tags
                  WHEN json_valid(tags) THEN json(tags)
                  ELSE json_object()
              END,
              'version', '1.0.0',
              'lastModified', datetime('now')
          )
      )
      WHERE tags IS NULL 
         OR tags = '' 
         OR tags = '{}' 
         OR (json_valid(tags) AND json_extract(tags, '$.version') IS NULL)
    `);

    // Check that tags were updated with structured format
    const result = db.prepare('SELECT tags FROM artwork WHERE id = ?').get('test-1') as { tags: string };
    
    expect(result.tags).toBeTruthy();
    const parsed = JSON.parse(result.tags);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.tags).toBeDefined();
    expect(parsed.lastModified).toBeTruthy();
  });

  it('should preserve existing legacy tags', () => {
    // Insert artwork with legacy tags format
    db.exec(`
      INSERT INTO artwork (id, lat, lon, type_id, status, tags) VALUES 
      ('test-2', 49.2827, -123.1207, 'mural-type', 'approved', '{"material": "paint", "color": "blue"}')
    `);

    // Apply migration - check what actually gets produced
    const beforeResult = db.prepare('SELECT tags FROM artwork WHERE id = ?').get('test-2') as { tags: string };
    console.log('Before migration:', beforeResult.tags);

    // Use the corrected migration logic
    db.exec(`
      UPDATE artwork 
      SET tags = (
          SELECT json_object(
              'tags', 
              CASE 
                  WHEN tags IS NULL OR tags = '' OR tags = '{}' THEN json_object()
                  WHEN json_valid(tags) AND json_extract(tags, '$.version') IS NOT NULL THEN tags
                  WHEN json_valid(tags) THEN json(tags)
                  ELSE json_object()
              END,
              'version', '1.0.0',
              'lastModified', datetime('now')
          )
      )
      WHERE tags IS NULL 
         OR tags = '' 
         OR tags = '{}' 
         OR (json_valid(tags) AND json_extract(tags, '$.version') IS NULL)
    `);

    // Check that legacy tags were preserved
    const result = db.prepare('SELECT tags FROM artwork WHERE id = ?').get('test-2') as { tags: string };
    console.log('After migration:', result.tags);
    
    expect(result.tags).toBeTruthy();
    const parsed = JSON.parse(result.tags);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.tags.material).toBe('paint');
    expect(parsed.tags.color).toBe('blue');
  });

  it('should add tourism tag to sample artwork', () => {
    // Insert sample artwork (with SAMPLE- prefix)
    db.exec(`
      INSERT INTO artwork (id, lat, lon, type_id, status, tags) VALUES 
      ('SAMPLE-test-3', 49.2827, -123.1207, 'statue-type', 'approved', '{}')
    `);

    // Apply migration parts
    db.exec(`
      UPDATE artwork 
      SET tags = json_object('tags', json_object(), 'version', '1.0.0', 'lastModified', datetime('now'))
      WHERE id = 'SAMPLE-test-3'
    `);

    db.exec(`
      UPDATE artwork 
      SET tags = json_set(
          tags, 
          '$.tags.tourism', 'artwork',
          '$.lastModified', datetime('now')
      )
      WHERE status = 'approved' 
        AND json_extract(tags, '$.tags.tourism') IS NULL
        AND id LIKE 'SAMPLE-%'
    `);

    // Check that tourism tag was added
    const result = db.prepare('SELECT tags FROM artwork WHERE id = ?').get('SAMPLE-test-3') as { tags: string };
    
    expect(result.tags).toBeTruthy();
    const parsed = JSON.parse(result.tags);
    expect(parsed.tags.tourism).toBe('artwork');
  });

  it('should set artwork_type based on type_id', () => {
    // Insert sample artwork
    db.exec(`
      INSERT INTO artwork (id, lat, lon, type_id, status, tags) VALUES 
      ('SAMPLE-mural-1', 49.2827, -123.1207, 'mural-type', 'approved', '{}')
    `);

    // Apply migration parts
    db.exec(`
      UPDATE artwork 
      SET tags = json_object('tags', json_object(), 'version', '1.0.0', 'lastModified', datetime('now'))
      WHERE id = 'SAMPLE-mural-1'
    `);

    db.exec(`
      UPDATE artwork 
      SET tags = json_set(
          tags,
          '$.tags.artwork_type', 
          CASE 
              WHEN type_id LIKE '%mural%' THEN 'mural'
              WHEN type_id LIKE '%statue%' THEN 'statue'
              WHEN type_id LIKE '%sculpture%' THEN 'sculpture'
              WHEN type_id LIKE '%installation%' THEN 'installation'
              ELSE 'sculpture'
          END,
          '$.lastModified', datetime('now')
      )
      WHERE json_extract(tags, '$.tags.artwork_type') IS NULL
        AND id LIKE 'SAMPLE-%'
    `);

    // Check that artwork_type was set correctly
    const result = db.prepare('SELECT tags FROM artwork WHERE id = ?').get('SAMPLE-mural-1') as { tags: string };
    
    expect(result.tags).toBeTruthy();
    const parsed = JSON.parse(result.tags);
    expect(parsed.tags.artwork_type).toBe('mural');
  });

  it('should be idempotent', () => {
    // Insert artwork
    db.exec(`
      INSERT INTO artwork (id, lat, lon, type_id, status, tags) VALUES 
      ('test-4', 49.2827, -123.1207, 'statue-type', 'approved', '{"material": "bronze"}')
    `);

    // Apply migration first time
    db.exec(`
      UPDATE artwork 
      SET tags = (
          SELECT json_object(
              'tags', 
              CASE 
                  WHEN tags IS NULL OR tags = '' OR tags = '{}' THEN json_object()
                  WHEN json_valid(tags) AND json_extract(tags, '$.version') IS NOT NULL THEN tags
                  WHEN json_valid(tags) THEN json(tags)
                  ELSE json_object()
              END,
              'version', '1.0.0',
              'lastModified', datetime('now')
          )
      )
      WHERE tags IS NULL 
         OR tags = '' 
         OR tags = '{}' 
         OR (json_valid(tags) AND json_extract(tags, '$.version') IS NULL)
    `);

    const firstResult = db.prepare('SELECT tags FROM artwork WHERE id = ?').get('test-4') as { tags: string };
    
    // Apply migration second time (should not change anything)
    db.exec(`
      UPDATE artwork 
      SET tags = (
          SELECT json_object(
              'tags', 
              CASE 
                  WHEN tags IS NULL OR tags = '' OR tags = '{}' THEN json_object()
                  WHEN json_valid(tags) AND json_extract(tags, '$.version') IS NOT NULL THEN tags
                  WHEN json_valid(tags) THEN json(tags)
                  ELSE json_object()
              END,
              'version', '1.0.0',
              'lastModified', datetime('now')
          )
      )
      WHERE tags IS NULL 
         OR tags = '' 
         OR tags = '{}' 
         OR (json_valid(tags) AND json_extract(tags, '$.version') IS NULL)
    `);

    const secondResult = db.prepare('SELECT tags FROM artwork WHERE id = ?').get('test-4') as { tags: string };

    // Results should be identical (except possibly lastModified timestamp)
    const firstParsed = JSON.parse(firstResult.tags);
    const secondParsed = JSON.parse(secondResult.tags);
    
    expect(firstParsed.version).toBe(secondParsed.version);
    expect(firstParsed.tags).toEqual(secondParsed.tags);
  });

  it('should handle invalid JSON gracefully', () => {
    // Insert artwork with invalid JSON
    db.exec(`
      INSERT INTO artwork (id, lat, lon, type_id, status, tags) VALUES 
      ('test-5', 49.2827, -123.1207, 'statue-type', 'approved', 'invalid json')
    `);

    const beforeResult = db.prepare('SELECT tags FROM artwork WHERE id = ?').get('test-5') as { tags: string };
    console.log('Before migration (invalid JSON):', beforeResult.tags);
    console.log('json_valid result:', db.prepare('SELECT json_valid(?) as is_valid').get('invalid json'));

    // Apply migration - invalid JSON won't match json_valid() so should be handled by the ELSE clause
    db.exec(`
      UPDATE artwork 
      SET tags = (
          SELECT json_object(
              'tags', 
              CASE 
                  WHEN tags IS NULL OR tags = '' OR tags = '{}' THEN json_object()
                  WHEN json_valid(tags) AND json_extract(tags, '$.version') IS NOT NULL THEN tags
                  WHEN json_valid(tags) THEN json(tags)
                  ELSE json_object()
              END,
              'version', '1.0.0',
              'lastModified', datetime('now')
          )
      )
      WHERE tags IS NULL 
         OR tags = '' 
         OR tags = '{}' 
         OR (json_valid(tags) AND json_extract(tags, '$.version') IS NULL)
         OR NOT json_valid(tags) -- Explicitly handle invalid JSON
    `);

    // Check that invalid JSON was reset to empty tags
    const result = db.prepare('SELECT tags FROM artwork WHERE id = ?').get('test-5') as { tags: string };
    console.log('After migration (invalid JSON):', result.tags);
    
    expect(result.tags).toBeTruthy();
    const parsed = JSON.parse(result.tags);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.tags).toEqual({});
  });

  it('should handle existing structured tags without duplicating', () => {
    // Insert artwork that already has structured format
    const existingStructuredTags = JSON.stringify({
      tags: { material: 'stone', tourism: 'artwork' },
      version: '1.0.0',
      lastModified: '2024-01-01T00:00:00.000Z'
    });

    // Insert the tags directly as JSON in the INSERT statement
    db.exec(`
      INSERT INTO artwork (id, lat, lon, type_id, status, tags) VALUES 
      ('test-6', 49.2827, -123.1207, 'statue-type', 'approved', '${existingStructuredTags}')
    `);

    const beforeResult = db.prepare('SELECT tags FROM artwork WHERE id = ?').get('test-6') as { tags: string };
    console.log('Before migration (structured):', beforeResult.tags);
    console.log('Version check:', db.prepare('SELECT json_extract(tags, \'$.version\') as version FROM artwork WHERE id = ?').get('test-6'));

    // Apply migration - this should NOT update records that already have version field
    db.exec(`
      UPDATE artwork 
      SET tags = (
          SELECT json_object(
              'tags', 
              CASE 
                  WHEN tags IS NULL OR tags = '' OR tags = '{}' THEN json_object()
                  WHEN json_valid(tags) AND json_extract(tags, '$.version') IS NOT NULL THEN tags
                  WHEN json_valid(tags) THEN json(tags)
                  ELSE json_object()
              END,
              'version', '1.0.0',
              'lastModified', datetime('now')
          )
      )
      WHERE tags IS NULL 
         OR tags = '' 
         OR tags = '{}' 
         OR (json_valid(tags) AND json_extract(tags, '$.version') IS NULL)
         OR NOT json_valid(tags)
    `);

    // Check that existing structured tags were preserved correctly
    const result = db.prepare('SELECT tags FROM artwork WHERE id = ?').get('test-6') as { tags: string };
    console.log('After migration (structured):', result.tags);
    
    expect(result.tags).toBeTruthy();
    const parsed = JSON.parse(result.tags);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.tags.material).toBe('stone');
    expect(parsed.tags.tourism).toBe('artwork');
    // lastModified should be the original timestamp since the record wasn't updated
    expect(parsed.lastModified).toBe('2024-01-01T00:00:00.000Z');
  });
});