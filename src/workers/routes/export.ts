/**
 * Export route handlers
 * Provides endpoints for exporting artwork data in various formats
 */

import type { Context } from 'hono';
import type { WorkerEnv, ArtworkRecord } from '../types'; // Use local workers type
import { createSuccessResponse, ValidationApiError } from '../lib/errors';
import { createDatabaseService } from '../lib/database';
import { createExportResponse, generateOSMXMLFile, validateOSMExportData } from '../lib/osm-export';

/**
 * GET /api/export/osm - Export multiple artworks in OpenStreetMap format
 * Supports bulk export with filtering options
 */
export async function bulkExportToOSM(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const query = c.req.query();

  // Parse query parameters
  const format = query.format || 'json'; // json, xml
  const bounds = query.bounds; // "north,south,east,west"
  const limit = parseInt(query.limit || '1000');
  const artworkIds = query.artwork_ids?.split(',').filter(Boolean);

  // Validate parameters
  if (!['json', 'xml'].includes(format)) {
    throw new ValidationApiError([
      {
        field: 'format',
        message: 'Invalid format. Supported: json, xml',
        code: 'INVALID_PARAMETER',
      },
    ]);
  }

  if (limit > 10000) {
    throw new ValidationApiError([
      {
        field: 'limit',
        message: 'Limit cannot exceed 10,000 artworks',
        code: 'LIMIT_EXCEEDED',
      },
    ]);
  }

  const db = createDatabaseService(c.env.DB);
  let artworks: ArtworkRecord[] = [];

  try {
    if (artworkIds && artworkIds.length > 0) {
      // Export specific artworks by ID
      if (artworkIds.length > 100) {
        throw new ValidationApiError([
          {
            field: 'artwork_ids',
            message: 'Cannot export more than 100 artworks by ID at once',
            code: 'LIMIT_EXCEEDED',
          },
        ]);
      }

      const placeholders = artworkIds.map(() => '?').join(',');
      const stmt = db.db.prepare(`
        SELECT * FROM artwork 
        WHERE id IN (${placeholders}) AND status = 'approved'
        ORDER BY created_at DESC
      `);

      const result = await stmt.bind(...artworkIds).all();
      artworks = result.results as ArtworkRecord[];
    } else if (bounds) {
      // Export artworks within geographic bounds
      const boundsArray = bounds.split(',').map(Number);
      if (boundsArray.length !== 4 || boundsArray.some(isNaN)) {
        throw new ValidationApiError([
          {
            field: 'bounds',
            message: 'Bounds must be in format: north,south,east,west',
            code: 'INVALID_FORMAT',
          },
        ]);
      }

      const [north, south, east, west] = boundsArray;

      // Validate bounds
      if (north! <= south! || east! <= west!) {
        throw new ValidationApiError([
          {
            field: 'bounds',
            message: 'Invalid bounds: north > south and east > west required',
            code: 'INVALID_BOUNDS',
          },
        ]);
      }

      const stmt = db.db.prepare(`
        SELECT * FROM artwork
        WHERE status = 'approved'
          AND lat BETWEEN ? AND ?
          AND lon BETWEEN ? AND ?
        ORDER BY created_at DESC
        LIMIT ?
      `);

      const result = await stmt.bind(south, north, west, east, limit).all();
      artworks = result.results as ArtworkRecord[];
    } else {
      // Export all approved artworks (with limit)
      const stmt = db.db.prepare(`
        SELECT * FROM artwork
        WHERE status = 'approved'
        ORDER BY created_at DESC
        LIMIT ?
      `);

      const result = await stmt.bind(limit).all();
      artworks = result.results as ArtworkRecord[];
    }

    // Handle XML export
    if (format === 'xml') {
      const xmlContent = generateOSMXMLFile(artworks);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      return new Response(xmlContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="cultural-archiver-export-${timestamp}.osm"`,
        },
      });
    }

    // Handle JSON export (default)
    const exportRequest = {
      ...(artworkIds && { artwork_ids: artworkIds }),
      ...(bounds && { bounds }),
      limit: limit,
    };

    const response = createExportResponse(artworks, exportRequest);

    return c.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Bulk export error:', error);

    if (error instanceof ValidationApiError) {
      throw error;
    }

    throw new ValidationApiError([
      {
        field: 'export',
        message: 'Failed to export artworks',
        code: 'EXPORT_ERROR',
      },
    ]);
  }
}

/**
 * GET /api/export/osm/stats - Get export statistics and validation summary
 */
export async function getExportStats(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const query = c.req.query();
  const bounds = query.bounds; // Optional bounds filtering

  const db = createDatabaseService(c.env.DB);

  try {
    let whereClause = "WHERE status = 'approved'";
    let bindings: (string | number)[] = [];

    // Add bounds filtering if provided
    if (bounds) {
      const boundsArray = bounds.split(',').map(Number);
      if (boundsArray.length !== 4 || boundsArray.some(isNaN)) {
        throw new ValidationApiError([
          {
            field: 'bounds',
            message: 'Bounds must be in format: north,south,east,west',
            code: 'INVALID_FORMAT',
          },
        ]);
      }

      const [north, south, east, west] = boundsArray;
      whereClause += ` AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?`;
      bindings = [south as number, north as number, west as number, east as number];
    }

    // Get total count
    const countStmt = db.db.prepare(`SELECT COUNT(*) as total FROM artwork ${whereClause}`);
    const countResult = (await countStmt.bind(...bindings).first()) as { total: number };

    // Get sample of artworks for validation statistics
    const sampleStmt = db.db.prepare(`
      SELECT * FROM artwork ${whereClause}
      ORDER BY RANDOM()
      LIMIT 1000
    `);
    const sampleResult = await sampleStmt.bind(...bindings).all();
    const sampleArtworks = sampleResult.results as ArtworkRecord[];

    // Analyze validation results
    const validationResults = sampleArtworks.map(validateOSMExportData);
    const validCount = validationResults.filter(r => r.valid).length;
    const warningCount = validationResults.filter(r => r.warnings.length > 0).length;
    const errorCount = validationResults.filter(r => !r.valid).length;

    // Count common issues
    const allErrors = validationResults.flatMap(r => r.errors);
    const allWarnings = validationResults.flatMap(r => r.warnings);

    const errorCounts: Record<string, number> = {};
    const warningCounts: Record<string, number> = {};

    allErrors.forEach(error => {
      errorCounts[error] = (errorCounts[error] || 0) + 1;
    });

    allWarnings.forEach(warning => {
      warningCounts[warning] = (warningCounts[warning] || 0) + 1;
    });

    const stats = {
      total_artworks: countResult.total,
      sample_size: sampleArtworks.length,
      validation_summary: {
        valid_artworks: validCount,
        artworks_with_warnings: warningCount,
        artworks_with_errors: errorCount,
        valid_percentage: Math.round((validCount / sampleArtworks.length) * 100),
      },
      common_issues: {
        errors: Object.entries(errorCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10),
        warnings: Object.entries(warningCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10),
      },
      export_estimates: {
        estimated_valid_exports: Math.round(
          countResult.total * (validCount / sampleArtworks.length)
        ),
        estimated_file_size_mb: Math.round((countResult.total * 0.5) / 1024), // Rough estimate
      },
    };

    return c.json(createSuccessResponse(stats));
  } catch (error) {
    console.error('Export stats error:', error);

    if (error instanceof ValidationApiError) {
      throw error;
    }

    throw new ValidationApiError([
      {
        field: 'stats',
        message: 'Failed to generate export statistics',
        code: 'STATS_ERROR',
      },
    ]);
  }
}
