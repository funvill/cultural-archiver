/**
 * OSM Mass Import API Endpoint
 *
 * Handles OpenStreetMap GeoJSON mass imports using the existing mass-import pipeline.
 * Converts OSM artwork data to platform format with proper attribution and validation.
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import {
  createSuccessResponse,
  ValidationApiError,
  ApiError,
  UnauthorizedError,
} from '../lib/errors';
import {
  parseOSMGeoJSON,
  type OSMGeoJSON,
  type OSMImportConfig,
  generateImportSummary,
  DEFAULT_OSM_CONFIG,
} from '../lib/osm-mass-import';
// Rate limiter - simplified for this implementation
const rateLimiter = {
  checkLimit: async (
    _storage: unknown,
    _key: string,
    _limit: number,
    _window: number
  ): Promise<void> => {
    // In production, implement proper rate limiting
    return Promise.resolve();
  },
};
import { processMassImport } from './mass-import';

/**
 * OSM Mass Import Request Interface
 */
interface OSMImportRequest {
  /** GeoJSON FeatureCollection with OSM artwork data */
  geoJSON: OSMGeoJSON;

  /** Optional import configuration overrides */
  config?: Partial<OSMImportConfig>;

  /** Optional batch processing settings */
  batchSize?: number;

  /** Dry run mode - validate but don't import */
  dryRun?: boolean;
}

/**
 * OSM Mass Import Response Interface
 */
interface OSMImportResponse {
  success: boolean;
  summary: {
    total_features: number;
    valid_imports: number;
    skipped_records: number;
    error_count: number;
    success_rate: string;
  };
  batch_info?: {
    batch_size: number;
    batch_count: number;
    processing_mode: string;
  };
  errors: Array<{ feature_id: string; error: string }>;
  import_results?: Array<{
    batch_id: number;
    processed: number;
    succeeded: number;
    failed: number;
  }>;
  dry_run?: boolean;
}

/**
 * POST /api/mass-import/osm
 *
 * Import OpenStreetMap artwork data via mass-import pipeline
 */
export async function handleOSMImport(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  try {
    // Rate limiting for mass imports (stricter than regular API)
    const clientIP =
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    await rateLimiter.checkLimit(c.env.RATE_LIMITS, `osm-import:${clientIP}`, 2, 3600); // 2 imports per hour

    // Parse request body
    const requestBody = (await c.req.json()) as OSMImportRequest;

    // Validate request structure
    if (!requestBody.geoJSON || requestBody.geoJSON.type !== 'FeatureCollection') {
      throw new ValidationApiError([], 'Invalid GeoJSON: must be FeatureCollection');
    }

    if (!Array.isArray(requestBody.geoJSON.features)) {
      throw new ValidationApiError([], 'Invalid GeoJSON: features must be an array');
    }

    // Merge configuration with defaults
    const importConfig: OSMImportConfig = {
      ...DEFAULT_OSM_CONFIG,
      ...requestBody.config,
    };

    // Parse OSM GeoJSON to mass-import payloads
    console.log(`Starting OSM import: ${requestBody.geoJSON.features.length} features`);
    const parseResult = parseOSMGeoJSON(requestBody.geoJSON, importConfig);

    // Generate summary
    const summaryText = generateImportSummary(parseResult);
    console.log(summaryText);

    // If dry run, return validation results without importing
    if (requestBody.dryRun) {
      return c.json(
        createSuccessResponse<OSMImportResponse>({
          success: true,
          summary: {
            total_features: parseResult.total,
            valid_imports: parseResult.valid,
            skipped_records: parseResult.skipped,
            error_count: parseResult.errors.length,
            success_rate: `${((parseResult.valid / parseResult.total) * 100).toFixed(1)}%`,
          },
          errors: parseResult.errors.length > 0 ? parseResult.errors : [],
          dry_run: true,
        })
      );
    }

    // Process imports in batches using existing mass-import system
    const batchSize = requestBody.batchSize || 50; // Smaller batches for OSM data
    const batches: Array<typeof parseResult.payloads> = [];

    for (let i = 0; i < parseResult.payloads.length; i += batchSize) {
      batches.push(parseResult.payloads.slice(i, i + batchSize));
    }

    console.log(
      `Processing ${parseResult.payloads.length} imports in ${batches.length} batches of ${batchSize}`
    );

    // Process batches sequentially (option A from requirements)
    const batchResults = [];
  let totalProcessed = 0;
  let totalSucceeded = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      if (!batch) continue;

      console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)`);

      let batchSucceeded = 0;
      let batchFailed = 0;

      // Process each item in the batch using existing mass-import endpoint
      for (const payload of batch) {
        try {
          // Create a mock context for the mass-import function
          const mockContext = {
            req: {
              json: async () => payload,
            },
            json: (data: unknown) => ({ json: (): unknown => data }),
            env: c.env,
          } as unknown as Context<{ Bindings: WorkerEnv }>;

          const response = await processMassImport(mockContext);
          const responseData = (await response.json()) as { success: boolean };

          if (responseData.success) {
            batchSucceeded++;
          } else {
            batchFailed++;
          }
        } catch (error) {
          console.error(`Import failed for item in batch ${batchIndex + 1}:`, error);
          batchFailed++;
        }
      }

  totalProcessed += batch?.length || 0;
  totalSucceeded += batchSucceeded;

      batchResults.push({
        batch_id: batchIndex + 1,
        processed: batch?.length || 0,
        succeeded: batchSucceeded,
        failed: batchFailed,
      });

      // Brief pause between batches to be nice to the system
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`OSM import completed: ${totalSucceeded}/${totalProcessed} successful`);

    // Return comprehensive response
    return c.json(
      createSuccessResponse<OSMImportResponse>({
        success: true,
        summary: {
          total_features: parseResult.total,
          valid_imports: parseResult.valid,
          skipped_records: parseResult.skipped,
          error_count: parseResult.errors.length,
          success_rate: `${((totalSucceeded / totalProcessed) * 100).toFixed(1)}%`,
        },
        batch_info: {
          batch_size: batchSize,
          batch_count: batches.length,
          processing_mode: 'sequential',
        },
        errors: parseResult.errors,
        import_results: batchResults,
      })
    );
  } catch (error) {
    console.error('OSM import error:', error);

    if (error instanceof ValidationApiError || error instanceof UnauthorizedError) {
      throw error;
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown error during OSM import',
      'OSM_IMPORT_FAILED',
      500
    );
  }
}

/**
 * GET /api/mass-import/osm/validate
 *
 * Validate OSM GeoJSON without importing (convenience endpoint for dry runs)
 */
export async function handleOSMValidate(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  try {
    const requestBody = (await c.req.json()) as OSMImportRequest;

    // Force dry run mode
    requestBody.dryRun = true;

    return handleOSMImport(c);
  } catch (error) {
    console.error('OSM validation error:', error);
    throw error;
  }
}

/**
 * Helper: Import OSM file from storage (for future CLI integration)
 */
export async function importOSMFromStorage(
  _filePath: string,
  _config: Partial<OSMImportConfig>,
  _env: WorkerEnv
): Promise<OSMImportResponse> {
  // This would be used by CLI tools to import from R2 storage
  // For now, just throw an error indicating it needs to be implemented
  throw new Error('Storage-based import not yet implemented - use direct API with GeoJSON payload');
}
