/**
 * Fix Artwork Coordinates Migration
 * 
 * This script fixes artworks that were created with incorrect coordinates
 * due to a bug in the parseSubmissionData function that defaulted to 
 * Vancouver coordinates (49.2827, -123.1207) when JSON parsing failed.
 */

// Type definitions for Cloudflare D1
declare global {
  interface D1Database {
    prepare(sql: string): D1PreparedStatement;
  }
  
  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first(): Promise<Record<string, unknown> | null>;
    all(): Promise<{ results: Record<string, unknown>[] }>;
    run(): Promise<{ changes: number; last_row_id: number }>;
  }
}

interface PreviewResult {
  id: string;
  current_lat: number;
  current_lon: number;
  logbook_lat: number;
  logbook_lon: number;
  logbook_created: string;
}

export async function fixArtworkCoordinates(db: D1Database): Promise<void> {
  console.log('🔧 Starting artwork coordinates fix...');
  
  // First, let's see how many artworks have the default coordinates
  const checkStmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM artwork 
    WHERE lat = 49.2827 AND lon = -123.1207
  `);
  
  const checkResult = await checkStmt.first() as { count: number } | null;
  const affectedCount = checkResult?.count || 0;
  
  console.log(`📍 Found ${affectedCount} artworks with default Vancouver coordinates`);
  
  if (affectedCount === 0) {
    console.log('✅ No artworks need coordinate fixes');
    return;
  }
  
  // Show which artworks will be affected
  const previewStmt = db.prepare(`
    SELECT 
      a.id,
      a.lat as current_lat,
      a.lon as current_lon,
      l.lat as logbook_lat,
      l.lon as logbook_lon,
      l.created_at as logbook_created
    FROM artwork a
    JOIN logbook l ON a.id = l.artwork_id
    WHERE 
      a.lat = 49.2827 
      AND a.lon = -123.1207
      AND l.lat IS NOT NULL 
      AND l.lon IS NOT NULL
      AND l.status = 'approved'
      AND NOT (l.lat = 49.2827 AND l.lon = -123.1207)
    ORDER BY a.id, l.created_at ASC
  `);
  
  const previewResults = await previewStmt.all();
  
  console.log('📋 Artworks to be fixed:');
  for (const row of previewResults.results || []) {
    const r = row as unknown as PreviewResult;
    console.log(`  - ${r.id}: (${r.current_lat}, ${r.current_lon}) → (${r.logbook_lat}, ${r.logbook_lon})`);
  }
  
  // Apply the fix
  const updateStmt = db.prepare(`
    UPDATE artwork 
    SET 
        lat = (
            SELECT l.lat 
            FROM logbook l 
            WHERE l.artwork_id = artwork.id 
            AND l.lat IS NOT NULL 
            AND l.status = 'approved'
            ORDER BY l.created_at ASC 
            LIMIT 1
        ),
        lon = (
            SELECT l.lon 
            FROM logbook l 
            WHERE l.artwork_id = artwork.id 
            AND l.lon IS NOT NULL 
            AND l.status = 'approved'
            ORDER BY l.created_at ASC 
            LIMIT 1
        )
    WHERE 
        artwork.lat = 49.2827 
        AND artwork.lon = -123.1207
        AND EXISTS (
            SELECT 1 
            FROM logbook l 
            WHERE l.artwork_id = artwork.id 
            AND l.lat IS NOT NULL 
            AND l.lon IS NOT NULL
            AND l.status = 'approved'
            AND NOT (l.lat = 49.2827 AND l.lon = -123.1207)
        )
  `);
  
  const updateResult = await updateStmt.run();
  
  console.log(`✅ Fixed coordinates for ${updateResult.changes} artworks`);
  
  // Verify the fix
  const verifyStmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM artwork 
    WHERE lat = 49.2827 AND lon = -123.1207
  `);
  
  const verifyResult = await verifyStmt.first() as { count: number } | null;
  const remainingCount = verifyResult?.count || 0;
  
  console.log(`📍 ${remainingCount} artworks still have default coordinates`);
  
  if (remainingCount < affectedCount) {
    console.log('🎉 Artwork coordinates fix completed successfully!');
  } else {
    console.log('⚠️  No coordinates were updated. Check if logbook entries have valid coordinates.');
  }
}

// For standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('This migration needs to be run through the migration system.');
  console.log('Use: npm run migrate:up or run through the Cloudflare dashboard.');
}
