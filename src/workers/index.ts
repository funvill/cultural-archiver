import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';

// Import types
import type { WorkerEnv } from './types';

// Import middleware
import {
  ensureUserToken,
  addUserTokenToResponse,
  checkEmailVerification,
  requireReviewer,
  requireAdmin,
} from './middleware/auth';
import { rateLimitSubmissions, rateLimitQueries, addRateLimitStatus } from './middleware/rateLimit';
import {
  validateSubmissionFormData,
  validateNearbyArtworksQuery,
  validateBoundsQuery,
  validateUserSubmissionsQuery,
  validateFileUploads,
  validateUUID,
  validateMagicLinkRequest,
  validateSchema,
  consumeMagicLinkSchema,
  validateFastArtworkSubmission,
  validateCheckSimilarity,
  artworkListSchema,
  artistListSchema,
  validateUnifiedSubmission,
  profileNameUpdateSchema,
  profileNameCheckSchema,
  userUuidSchema,
} from './middleware/validation';
import { withErrorHandling, sendErrorResponse, ApiError } from './lib/errors';

// Import route handlers
import { createSubmission, createFastArtworkSubmission, createUnifiedSubmission } from './routes/submissions';
import {
  getNearbyArtworks,
  getArtworkDetails,
  getArtworksInBounds,
  checkArtworkSimilarity,
  getArtworkStats,
  getArtworksList,
} from './routes/discovery';
import { submitArtworkEdit, getUserPendingEdits, validateArtworkEdit, exportArtworkToOSM } from './routes/artwork';
import { 
  getArtistsList, 
  getArtistProfile, 
  createArtist, 
  submitArtistEdit, 
  getUserPendingArtistEdits 
} from './routes/artists';
import { bulkExportToOSM, getExportStats } from './routes/export';
import { getUserSubmissions, getUserProfile, sendTestEmail, getAllBadges, getUserBadges, updateProfileName, checkProfileNameAvailability, getPublicUserProfile } from './routes/user';
import { handleSearchRequest, handleSearchSuggestions } from './routes/search';
import { processMassImportPhotos } from './routes/mass-import-photos';
import { processMassImport } from './routes/mass-import';
import { processMassImportV2 } from './routes/mass-import-v2';
import { handleOSMImport, handleOSMValidate } from './routes/mass-import-osm';
import {
  requestMagicLink,
  verifyMagicLink,
  logout,
  getAuthStatus,
  getDevMagicLink,
} from './routes/auth';
import {
  getReviewQueue,
  getSubmissionForReview,
  approveSubmission,
  rejectSubmission,
  getReviewStats,
  processBatchReview,
  getArtworkEditsForReview,
  getArtworkEditForReview,
  approveArtworkEdit,
  rejectArtworkEdit,
} from './routes/review';
import {
  submitConsent,
  getConsentStatus,
  getConsentFormData,
  revokeConsent,
} from './routes/consent';
import {
  getUserPermissions,
  grantUserPermission,
  revokeUserPermission,
  getAuditLogsEndpoint,
  getAdminStatistics,
} from './routes/admin';
import { debugStevenPermissions } from './routes/debug-permissions';
import { fixPermissionsSchema } from './routes/fix-schema';

// Initialize Hono app
const app = new Hono<{ Bindings: WorkerEnv }>();

// Add binding validation middleware - CRITICAL for deployment diagnosis
app.use('*', async (c, next) => {
  const missingBindings = [];

  // Check critical bindings
  if (!c.env.DB) missingBindings.push('DB (D1 Database)');
  if (!c.env.SESSIONS) missingBindings.push('SESSIONS (KV)');
  if (!c.env.CACHE) missingBindings.push('CACHE (KV)');
  if (!c.env.RATE_LIMITS) missingBindings.push('RATE_LIMITS (KV)');
  if (!c.env.MAGIC_LINKS) missingBindings.push('MAGIC_LINKS (KV)');
  if (!c.env.PHOTOS_BUCKET) missingBindings.push('PHOTOS_BUCKET (R2)');

  // If critical bindings are missing, return a helpful error instead of "hello world"
  if (missingBindings.length > 0) {
    console.error('❌ CRITICAL: Missing Cloudflare bindings:', missingBindings);

    // Return a helpful error response instead of failing silently
    return c.json(
      {
        error: 'Deployment Configuration Error',
        message:
          'Cultural Archiver API worker is deployed but missing critical Cloudflare bindings',
        missing_bindings: missingBindings,
        environment: c.env.ENVIRONMENT || 'unknown',
        worker_name: 'cultural-archiver-workers',
        timestamp: new Date().toISOString(),
        diagnosis: {
          issue: 'The worker is deployed correctly but missing required Cloudflare bindings',
          likely_cause:
            'Placeholder values in wrangler.toml or incomplete deployment configuration',
          solution: [
            '1. Check wrangler.toml for placeholder values (PLACEHOLDER_*)',
            '2. Fill in actual resource IDs from Cloudflare dashboard',
            '3. Redeploy with: wrangler deploy --env production',
            '4. Verify custom domain points to correct worker',
          ],
          next_steps: [
            'Run: node verify-deployment.js production',
            'Check Cloudflare Dashboard > Workers & Pages',
            'Verify D1, KV, and R2 resource configurations',
          ],
        },
        debug_info: {
          note: 'This error proves the Cultural Archiver worker is deployed, not a "hello world" worker',
          request_url: c.req.url,
          user_agent: c.req.header('User-Agent'),
          cf_ray: c.req.header('CF-Ray'),
        },
      },
      500
    );
  }

  // Continue to next middleware if all bindings are present
  return await next();
});

// Global middleware
app.use('*', secureHeaders());
app.use('*', logger());
app.use('*', prettyJSON());

// CORS configuration (applies to all routes)
app.use('*', async (c, next) => {
  // Support both comma-separated string and array for origins
  let origins: string[] = [];
  if (typeof c.env.CORS_ORIGINS === 'string') {
    origins = c.env.CORS_ORIGINS.split(',')
      .map((o: string) => o.trim())
      .filter(Boolean);
  } else if (Array.isArray(c.env.CORS_ORIGINS)) {
    origins = c.env.CORS_ORIGINS;
  } else {
    // Default to production origins if not set
    origins = [
      'https://art.abluestar.com',
      'https://art-api.abluestar.com',
      'https://art-photos.abluestar.com',
      'https://cultural-archiver.broad-bird-0934.workers.dev',
    ];
  }
  const corsOptions = cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-User-Token'],
    credentials: true,
  });
  return corsOptions(c, next);
});

// Health check result interface
interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  error?: string;
  test_time: number;
  [key: string]: unknown;
}

// Health check endpoint
app.get('/health', async c => {
  const startTime = Date.now();
  const checks: Record<string, HealthCheckResult> = {};
  let allHealthy = true;

  // Environment info
  const envInfo = {
    environment: c.env.ENVIRONMENT || 'unknown',
    version: c.env.API_VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
    nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
  };

  // Test 1: Database (D1) connectivity
  try {
    console.log('[HEALTH] Testing D1 database...');
    const dbResult = await c.env.DB.prepare('SELECT 1 as test, datetime() as current_time').first();
    checks.database = {
      status: 'healthy',
      test_query: dbResult,
      test_time: Date.now() - startTime,
    };
    console.log('[HEALTH] D1 database: OK');
  } catch (error) {
    console.error('[HEALTH] D1 database failed:', error);
    checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error',
      test_time: Date.now() - startTime,
    };
    allHealthy = false;
  }

  // Test 2: Database statistics
  try {
    console.log('[HEALTH] Getting database statistics...');
    const stats = await getArtworkStats(c.env.DB);
    checks.database_stats = {
      status: 'healthy',
      stats,
      test_time: Date.now() - startTime,
    };
    console.log('[HEALTH] Database stats: OK');
  } catch (error) {
    console.error('[HEALTH] Database stats failed:', error);
    checks.database_stats = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Stats query failed',
      test_time: Date.now() - startTime,
    };
    // Don't mark as unhealthy since this is secondary
  }

  // Test 3: KV Namespaces
  const kvTests = [
    { name: 'SESSIONS', binding: c.env.SESSIONS },
    { name: 'CACHE', binding: c.env.CACHE },
    { name: 'RATE_LIMITS', binding: c.env.RATE_LIMITS },
    { name: 'MAGIC_LINKS', binding: c.env.MAGIC_LINKS },
  ];

  for (const { name, binding } of kvTests) {
    try {
      console.log(`[HEALTH] Testing KV namespace: ${name}...`);
      const testKey = `health-check-${Date.now()}`;
      const testValue = 'health-test';

      // Test write and read
      await binding.put(testKey, testValue, { expirationTtl: 60 });
      const readValue = await binding.get(testKey);

      // Clean up
      await binding.delete(testKey);

      checks[`kv_${name.toLowerCase()}`] = {
        status: readValue === testValue ? 'healthy' : 'degraded',
        test_write: true,
        test_read: readValue === testValue,
        test_time: Date.now() - startTime,
      };
      console.log(`[HEALTH] KV ${name}: OK`);
    } catch (error) {
      console.error(`[HEALTH] KV ${name} failed:`, error);
      checks[`kv_${name.toLowerCase()}`] = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'KV operation failed',
        test_time: Date.now() - startTime,
      };
      allHealthy = false;
    }
  }

  // Test 4: R2 Storage
  try {
    console.log('[HEALTH] Testing R2 bucket...');
    const testKey = `health-check-${Date.now()}.txt`;
    const testContent = 'health-test';

    // Test write
    await c.env.PHOTOS_BUCKET.put(testKey, testContent);

    // Test read
    const object = await c.env.PHOTOS_BUCKET.get(testKey);
    const readContent = object ? await object.text() : null;

    // Clean up
    await c.env.PHOTOS_BUCKET.delete(testKey);

    checks.r2_storage = {
      status: readContent === testContent ? 'healthy' : 'degraded',
      test_write: true,
      test_read: readContent === testContent,
      test_time: Date.now() - startTime,
    };
    console.log('[HEALTH] R2 storage: OK');
  } catch (error) {
    console.error('[HEALTH] R2 storage failed:', error);
    checks.r2_storage = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'R2 operation failed',
      test_time: Date.now() - startTime,
    };
    allHealthy = false;
  }

  // Test 5: API Endpoints Internal Testing
  const endpointTests = [
    { name: 'test_endpoint', path: '/test' },
    { name: 'api_status', path: '/api/status' },
  ];

  for (const { name, path } of endpointTests) {
    try {
      console.log(`[HEALTH] Testing endpoint: ${path}...`);

      // Test the endpoint based on path
      let result: Record<string, unknown>;
      if (path === '/test') {
        result = { message: 'Test endpoint working' };
      } else if (path === '/api/status') {
        result = {
          message: 'Cultural Archiver API is running',
          environment: c.env.ENVIRONMENT || 'development',
          timestamp: new Date().toISOString(),
          version: c.env.API_VERSION || '1.0.0',
        };
      } else {
        result = { message: 'Unknown endpoint' };
      }

      checks[`endpoint_${name}`] = {
        status: 'healthy',
        path,
        response_preview: typeof result === 'object' ? Object.keys(result) : 'non-object',
        test_time: Date.now() - startTime,
      };
      console.log(`[HEALTH] Endpoint ${path}: OK`);
    } catch (error) {
      console.error(`[HEALTH] Endpoint ${path} failed:`, error);
      checks[`endpoint_${name}`] = {
        status: 'unhealthy',
        path,
        error: error instanceof Error ? error.message : 'Endpoint test failed',
        test_time: Date.now() - startTime,
      };
      // Don't mark overall as unhealthy for endpoint tests
    }
  }

  // Test 6: Configuration validation
  const configTests = {
    has_db: !!c.env.DB,
    has_sessions_kv: !!c.env.SESSIONS,
    has_cache_kv: !!c.env.CACHE,
    has_rate_limits_kv: !!c.env.RATE_LIMITS,
    has_magic_links_kv: !!c.env.MAGIC_LINKS,
    has_photos_bucket: !!c.env.PHOTOS_BUCKET,
    environment_set: !!c.env.ENVIRONMENT,
    frontend_url_set: !!c.env.FRONTEND_URL,
    api_version_set: !!c.env.API_VERSION,
  };

  const missingBindings = Object.entries(configTests)
    .filter(([_, hasBinding]) => !hasBinding)
    .map(([name, _]) => name);

  checks.configuration = {
    status: missingBindings.length === 0 ? 'healthy' : 'degraded',
    bindings: configTests,
    missing_bindings: missingBindings,
    test_time: Date.now() - startTime,
  };

  if (missingBindings.length > 0) {
    console.warn('[HEALTH] Missing bindings:', missingBindings);
  }

  // Overall health assessment
  const totalTestTime = Date.now() - startTime;
  const healthyChecks = Object.values(checks).filter(check => check.status === 'healthy').length;
  const totalChecks = Object.values(checks).length;

  const healthResponse = {
    status: allHealthy ? 'healthy' : 'degraded',
    environment: envInfo,
    summary: {
      healthy_checks: healthyChecks,
      total_checks: totalChecks,
      test_duration_ms: totalTestTime,
      overall_health: `${healthyChecks}/${totalChecks} checks passing`,
    },
    checks,
    available_endpoints: [
      'GET /health',
      'GET /test',
      'GET /api/status',
      'POST /api/logbook',
      'GET /api/artworks/nearby',
      'GET /api/artworks/bounds',
      'GET /api/artworks/:id',
      'POST /api/artwork/:id/edit',
      'GET /api/artwork/:id/pending-edits',
      'POST /api/artwork/:id/edit/validate',
      'GET /api/artwork/:id/export/osm',
      'GET /api/export/osm',
      'GET /api/export/osm/stats',
      'GET /api/search',
      'GET /api/search/suggestions',
      'GET /api/me/submissions',
      'GET /api/me/profile',
      'POST /api/consent',
      'GET /api/consent',
      'GET /api/consent/form-data',
      'DELETE /api/consent',
      'POST /api/auth/request-magic-link',
      'POST /api/auth/verify-magic-link',
      'POST /api/auth/logout',
      'GET /api/auth/status',
      'POST /api/auth/magic-link',
      'GET /api/review/queue',
      'GET /api/review/stats',
      'GET /api/review/submission/:id',
      'POST /api/review/approve/:id',
      'POST /api/review/reject/:id',
      'POST /api/review/batch',
      'GET /api/review/artwork-edits',
      'GET /api/review/artwork-edits/:editId',
      'POST /api/review/artwork-edits/:editId/approve',
      'POST /api/review/artwork-edits/:editId/reject',
    ],
    debug_info: {
      request_url: c.req.url,
      request_method: c.req.method,
      user_agent: c.req.header('User-Agent'),
      cf_ray: c.req.header('CF-Ray'),
      deployment_info: 'If this returns "hello world" in production, wrong worker is deployed',
    },
  };

  console.log(`[HEALTH] Health check completed in ${totalTestTime}ms: ${healthResponse.status}`);

  return c.json(healthResponse, allHealthy ? 200 : 503);
});

// Enhanced test endpoint with debug information
app.get('/test', c => {
  console.log('Test endpoint called');
  return c.json({
    message: 'Test endpoint working',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'unknown',
    version: c.env.API_VERSION || '1.0.0',
    request_info: {
      url: c.req.url,
      method: c.req.method,
      headers: Object.fromEntries(c.req.raw.headers.entries()),
    },
    worker_info: {
      has_db: !!c.env.DB,
      has_kv_bindings: !!(c.env.SESSIONS && c.env.CACHE && c.env.RATE_LIMITS && c.env.MAGIC_LINKS),
      has_r2: !!c.env.PHOTOS_BUCKET,
      frontend_url: c.env.FRONTEND_URL,
    },
    debug_note:
      'If you see "hello world" instead of this JSON in production, the wrong worker is deployed',
  });
});

// Permissions diagnostic endpoint for debugging reviewer access
app.get('/api/debug/permissions/:userToken', async c => {
  console.log('[DEBUG] Permissions diagnostic endpoint called');

  const userToken = c.req.param('userToken');
  console.log('[DEBUG] Testing permissions for user:', userToken);

  try {
    // Test 1: Basic database connection
    const dbTest = await c.env.DB.prepare('SELECT 1 as test').first();
    console.log('[DEBUG] Database test result:', dbTest);

    // Test 2: Check user_permissions table
    const permStmt = c.env.DB.prepare(`
      SELECT * FROM user_permissions 
      WHERE user_uuid = ? AND is_active = 1
    `);
    const permissions = await permStmt.bind(userToken).all();
    console.log('[DEBUG] Direct permissions query result:', permissions);

    // Test 3: Check legacy logbook count
    const logbookStmt = c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM submissions 
      WHERE user_token = ? AND status = 'approved' AND submission_type = 'logbook_entry'
    `);
    const logbookResult = await logbookStmt.bind(userToken).first();
    console.log('[DEBUG] Legacy logbook count:', logbookResult);

    // Test 4: Import and test isModerator function
    const { isModerator } = await import('./lib/permissions');
    const isModeratorResult = await isModerator(c.env.DB, userToken);
    console.log('[DEBUG] isModerator function result:', isModeratorResult);

    // Test 5: Test requireReviewer middleware logic manually
    let legacyReviewerCheck = false;
    if (!isModeratorResult) {
      const approvedCount = (logbookResult as { count: number } | null)?.count || 0;
      legacyReviewerCheck = approvedCount >= 5;
    }

    const finalReviewerStatus = isModeratorResult || legacyReviewerCheck;

    return c.json({
      user_token: userToken,
      timestamp: new Date().toISOString(),
      tests: {
        database_connection: !!dbTest,
        direct_permissions: {
          count: permissions.results?.length || 0,
          permissions: permissions.results || [],
        },
        legacy_logbook: {
          approved_count: (logbookResult as { count: number } | null)?.count || 0,
          meets_threshold: ((logbookResult as { count: number } | null)?.count || 0) >= 5,
        },
        is_moderator_function: isModeratorResult,
        legacy_reviewer_check: legacyReviewerCheck,
        final_reviewer_status: finalReviewerStatus,
      },
      debug_info: {
        middleware_should_pass: finalReviewerStatus,
        expected_auth_context: {
          isReviewer: finalReviewerStatus,
        },
      },
    });
  } catch (error) {
    console.error('[DEBUG] Permissions diagnostic error:', error);
    return c.json(
      {
        error: 'Permissions diagnostic failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        user_token: userToken,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// API status endpoint (no auth required)
app.get('/api/status', ensureUserToken, addUserTokenToResponse, c => {
  console.log('API status endpoint called'); // Add logging
  return c.json({
    message: 'Cultural Archiver API is running',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    debug: 'This is the API status endpoint',
  });
});

// User token middleware for authenticated API routes
app.use('/api/logbook', ensureUserToken);
app.use('/api/logbook', checkEmailVerification);
app.use('/api/me/*', ensureUserToken);
app.use('/api/me/*', checkEmailVerification);
app.use('/api/auth/*', ensureUserToken);
app.use('/api/auth/*', checkEmailVerification);
app.use('/api/review/*', ensureUserToken);
app.use('/api/review/*', checkEmailVerification);
app.use('/api/review/*', requireReviewer);
app.use('/api/admin/*', ensureUserToken);
app.use('/api/admin/*', checkEmailVerification);
app.use('/api/admin/*', requireAdmin);
app.use('/api/consent', ensureUserToken);
app.use('/api/consent', addUserTokenToResponse);
app.use('/api/artwork/*/edit*', ensureUserToken);
app.use('/api/artwork/*/edit*', checkEmailVerification);

// ================================
// Photo Serving Endpoint
// ================================

// Serve photos from R2 storage
app.get('/photos/*', async c => {
  try {
    // Remove /photos/ prefix from path to get the actual R2 key
    // URL: /photos/originals/2025/09/14/file.jpg -> Key: originals/2025/09/14/file.jpg
    const fullPath = c.req.path; // /photos/originals/2025/09/14/file.jpg
    const key = fullPath.substring('/photos/'.length); // originals/2025/09/14/file.jpg
    console.log(`[PHOTO DEBUG] Looking for key: ${key}`);

    // Get object from R2
    const object = await c.env.PHOTOS_BUCKET.get(key);
    console.log(`[PHOTO DEBUG] Object found: ${!!object}`);

    if (!object) {
      return c.json(
        {
          error: 'Photo not found',
          message: 'The requested photo does not exist',
          key,
        },
        404
      );
    }

    // Get the content type based on file extension
    const getContentType = (filename: string): string => {
      const ext = filename.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'jpg':
        case 'jpeg':
          return 'image/jpeg';
        case 'png':
          return 'image/png';
        case 'webp':
          return 'image/webp';
        case 'heic':
          return 'image/heic';
        case 'heif':
          return 'image/heif';
        default:
          return 'application/octet-stream';
      }
    };

    const contentType = getContentType(key);

    // Set appropriate headers
    c.header('Content-Type', contentType);
    c.header('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year
    c.header('ETag', object.etag || 'unknown');

    // Add object metadata as headers if available
    if (object.customMetadata) {
      for (const [metaKey, metaValue] of Object.entries(object.customMetadata)) {
        c.header(`X-Photo-${metaKey}`, metaValue);
      }
    }

    // Return the image
    return new Response(object.body, {
      headers: c.res.headers,
    });
  } catch (error) {
    console.error('Photo serving error:', error);
    return c.json(
      {
        error: 'Photo serving failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

// ================================
// Submission Endpoints
// ================================

app.post(
  '/api/logbook',
  rateLimitSubmissions,
  validateFileUploads,
  validateSubmissionFormData,
  addUserTokenToResponse,
  withErrorHandling(createSubmission)
);

// Fast photo-first workflow - new artwork submission endpoint
app.post(
  '/api/artworks/fast',
  ensureUserToken,
  rateLimitSubmissions,
  validateFileUploads,
  validateFastArtworkSubmission,
  addUserTokenToResponse,
  withErrorHandling(createFastArtworkSubmission)
);

// Unified submissions endpoint (PRD requirement)
app.post(
  '/api/submissions',
  ensureUserToken,
  rateLimitSubmissions,
  validateFileUploads,
  validateUnifiedSubmission,
  addUserTokenToResponse,
  withErrorHandling(createUnifiedSubmission)
);

// ================================
// Discovery Endpoints
// ================================

app.get(
  '/api/artworks/nearby',
  rateLimitQueries,
  validateNearbyArtworksQuery,
  withErrorHandling(getNearbyArtworks)
);

app.get(
  '/api/artworks/bounds',
  rateLimitQueries,
  validateBoundsQuery,
  withErrorHandling(getArtworksInBounds)
);

app.get(
  '/api/artworks/:id',
  rateLimitQueries,
  validateUUID('id'),
  withErrorHandling(getArtworkDetails)
);

// Fast photo-first workflow - similarity checking endpoint
app.post(
  '/api/artworks/check-similarity',
  rateLimitQueries,
  validateCheckSimilarity,
  withErrorHandling(checkArtworkSimilarity)
);

// ================================
// Artwork Editing Endpoints
// ================================

app.post(
  '/api/artwork/:id/edit',
  rateLimitSubmissions,
  validateUUID('id'),
  withErrorHandling(submitArtworkEdit)
);

app.get(
  '/api/artwork/:id/pending-edits',
  rateLimitQueries,
  validateUUID('id'),
  withErrorHandling(getUserPendingEdits)
);

app.post(
  '/api/artwork/:id/edit/validate',
  rateLimitQueries,
  validateUUID('id'),
  withErrorHandling(validateArtworkEdit)
);

app.get(
  '/api/artwork/:id/export/osm',
  rateLimitQueries,
  validateUUID('id'),
  withErrorHandling(exportArtworkToOSM)
);

// ================================
// Artist Management Endpoints
// ================================

app.get(
  '/api/artists',
  rateLimitQueries,
  validateSchema(artistListSchema, 'query'),
  withErrorHandling(getArtistsList)
);

app.get(
  '/api/artists/:id',
  rateLimitQueries,
  validateUUID('id'),
  withErrorHandling(getArtistProfile)
);

app.post(
  '/api/artists',
  ensureUserToken,
  checkEmailVerification,
  rateLimitSubmissions,
  withErrorHandling(createArtist)
);

app.put(
  '/api/artists/:id',
  ensureUserToken,
  checkEmailVerification,
  rateLimitSubmissions,
  validateUUID('id'),
  withErrorHandling(submitArtistEdit)
);

app.get(
  '/api/artists/:id/pending-edits',
  ensureUserToken,
  checkEmailVerification,
  rateLimitQueries,
  validateUUID('id'),
  withErrorHandling(getUserPendingArtistEdits)
);

// ================================
// Export Endpoints
// ================================

app.get('/api/export/osm', rateLimitQueries, withErrorHandling(bulkExportToOSM));

app.get('/api/export/osm/stats', rateLimitQueries, withErrorHandling(getExportStats));

// ================================
// Search Endpoints
// ================================

app.get('/api/search', rateLimitQueries, withErrorHandling(handleSearchRequest));

app.get('/api/search/suggestions', rateLimitQueries, withErrorHandling(handleSearchSuggestions));

// ================================
// User Management Endpoints
// ================================

app.get(
  '/api/me/submissions',
  validateUserSubmissionsQuery,
  addRateLimitStatus,
  addUserTokenToResponse,
  withErrorHandling(getUserSubmissions)
);

app.get(
  '/api/me/profile',
  addRateLimitStatus,
  addUserTokenToResponse,
  withErrorHandling(getUserProfile)
);

// Badge System Endpoints
// ================================

// Public badge definitions endpoint
app.get('/api/badges', withErrorHandling(getAllBadges));

// User badge endpoints (require email verification)
app.get(
  '/api/me/badges',
  addUserTokenToResponse,
  withErrorHandling(getUserBadges)
);

// Profile management endpoints (require email verification)
app.patch(
  '/api/me/profile',
  validateSchema(profileNameUpdateSchema),
  addUserTokenToResponse,
  withErrorHandling(updateProfileName)
);

app.get(
  '/api/me/profile-check',
  validateSchema(profileNameCheckSchema, 'query'),
  addUserTokenToResponse,
  withErrorHandling(checkProfileNameAvailability)
);

// Public profile viewing endpoint
app.get(
  '/api/users/:uuid',
  validateSchema(userUuidSchema, 'params'),
  withErrorHandling(getPublicUserProfile)
);

// Development/testing endpoint for email configuration
app.post('/api/test-email', withErrorHandling(sendTestEmail));

// Mass import photo processing endpoint
// Mass import endpoints
app.post('/api/mass-import/v2', withErrorHandling(processMassImportV2)); // NEW V2 endpoint for CLI plugin system
app.post('/api/mass-import', withErrorHandling(processMassImport)); // Legacy V1 endpoint
app.post('/api/mass-import/submit', withErrorHandling(processMassImportPhotos)); // JSON endpoint for photo URLs
app.post('/api/mass-import/photos', validateFileUploads, withErrorHandling(processMassImportPhotos)); // Keep for backward compatibility
app.post('/api/mass-import/osm', withErrorHandling(handleOSMImport)); // OSM GeoJSON mass import
app.post('/api/mass-import/osm/validate', withErrorHandling(handleOSMValidate)); // OSM validation endpoint

// ================================
// Consent Management Endpoints
// ================================

app.post('/api/consent', rateLimitSubmissions, withErrorHandling(submitConsent));

app.get('/api/consent', rateLimitQueries, withErrorHandling(getConsentStatus));

app.get('/api/consent/form-data', rateLimitQueries, withErrorHandling(getConsentFormData));

app.delete('/api/consent', rateLimitQueries, withErrorHandling(revokeConsent));

// ================================
// Authentication Endpoints
// ================================
// Authentication Endpoints
// UUID-based authentication with magic links
// ================================

// POST /api/auth/request-magic-link - Request magic link for signup or login
app.post(
  '/api/auth/request-magic-link',
  rateLimitQueries, // Use query rate limit for auth requests
  validateMagicLinkRequest,
  addUserTokenToResponse,
  withErrorHandling(requestMagicLink)
);

// POST /api/auth/verify-magic-link - Verify magic link token
app.post(
  '/api/auth/verify-magic-link',
  validateSchema(consumeMagicLinkSchema, 'body'),
  addUserTokenToResponse,
  withErrorHandling(verifyMagicLink)
);

// POST /api/auth/logout - Logout and get new anonymous UUID
app.post('/api/auth/logout', addUserTokenToResponse, withErrorHandling(logout));

// GET /api/auth/status - Get current authentication status
app.get('/api/auth/status', addUserTokenToResponse, withErrorHandling(getAuthStatus));

// Legacy endpoints for backward compatibility
app.post(
  '/api/auth/magic-link',
  rateLimitQueries,
  validateMagicLinkRequest,
  addUserTokenToResponse,
  withErrorHandling(requestMagicLink)
);


// Development helper endpoint (Resend fallback)
app.get('/api/auth/dev-magic-link', withErrorHandling(getDevMagicLink));

// ================================
// Review/Moderation Endpoints
// ================================

app.get('/api/review/queue', withErrorHandling(getReviewQueue));

app.get(
  '/api/review/submission/:id',
  validateUUID('id'),
  withErrorHandling(getSubmissionForReview)
);

app.post('/api/review/approve/:id', validateUUID('id'), withErrorHandling(approveSubmission));

app.post('/api/review/reject/:id', validateUUID('id'), withErrorHandling(rejectSubmission));

app.get('/api/review/stats', withErrorHandling(getReviewStats));

app.put('/api/review/batch', withErrorHandling(processBatchReview));

// Artwork Edit Review Endpoints
app.get('/api/review/artwork-edits', withErrorHandling(getArtworkEditsForReview));

app.get(
  '/api/review/artwork-edits/:editId',
  validateUUID('editId'),
  withErrorHandling(getArtworkEditForReview)
);

app.post(
  '/api/review/artwork-edits/:editId/approve',
  validateUUID('editId'),
  withErrorHandling(approveArtworkEdit)
);

app.post(
  '/api/review/artwork-edits/:editId/reject',
  validateUUID('editId'),
  withErrorHandling(rejectArtworkEdit)
);

// ================================
// Admin Endpoints
// ================================
// Permission management and audit logs for administrators
// Requires admin permissions for all operations

// GET /api/admin/permissions - List users with permissions
app.get('/api/admin/permissions', withErrorHandling(getUserPermissions));

// POST /api/admin/permissions/grant - Grant permission to user
app.post('/api/admin/permissions/grant', withErrorHandling(grantUserPermission));

// POST /api/admin/permissions/revoke - Revoke permission from user
app.post('/api/admin/permissions/revoke', withErrorHandling(revokeUserPermission));

// GET /api/admin/audit - Get audit logs with filtering
app.get('/api/admin/audit', withErrorHandling(getAuditLogsEndpoint));

// GET /api/admin/statistics - Get system and audit statistics
app.get('/api/admin/statistics', withErrorHandling(getAdminStatistics));

// Temporarily commented out - missing admin-update route file
// app.post('/api/dev/update-steven-permissions', ensureUserToken, withErrorHandling(updateStevenPermissions));

// GET /api/dev/debug-steven-permissions - Debug endpoint to check permission logic
app.get(
  '/api/dev/debug-steven-permissions',
  ensureUserToken,
  withErrorHandling(debugStevenPermissions)
);

// POST /api/dev/fix-permissions-schema - Fix missing is_active column
app.post(
  '/api/dev/fix-permissions-schema',
  ensureUserToken,
  withErrorHandling(fixPermissionsSchema)
);

// ================================
// Permalink Redirects
// ================================

// Permalink redirect for shared artwork URLs
app.get('/p/artwork/:id', validateUUID('id'), async c => {
  try {
    const artworkId = c.req.param('id');
    const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173';

    // Redirect to frontend artwork detail page
    const redirectUrl = `${frontendUrl}/artwork/${artworkId}`;

    console.info('Permalink redirect:', { artworkId, redirectUrl });

    return c.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('Permalink redirect error:', error);
    return sendErrorResponse(c, new ApiError('INVALID_PERMALINK', 'Invalid permalink', 400));
  }
});

// ================================
// Legacy/Compatibility Endpoints
// ================================

// Keep some legacy endpoints for backwards compatibility
app.get('/api/artworks', rateLimitQueries, validateSchema(artworkListSchema, 'query'), withErrorHandling(getArtworksList));

app.get('/api/logbook', async c => {
  // Redirect to user submissions
  return c.redirect('/api/me/submissions', 302);
});

// ================================
// Error Handling
// ================================

// 404 handler
app.notFound(c => {
  return c.json(
    {
      error: 'Not Found',
      message: 'The requested resource was not found',
      path: c.req.path,
      available_endpoints: [
        'GET /photos/*',
        'POST /api/logbook',
        'GET /api/artworks/nearby',
        'GET /api/artworks/:id',
        'POST /api/artwork/:id/edit',
        'GET /api/artwork/:id/pending-edits',
        'POST /api/artwork/:id/edit/validate',
        'GET /api/artwork/:id/export/osm',
        'GET /api/artists',
        'GET /api/artists/:id',
        'POST /api/artists',
        'PUT /api/artists/:id',
        'GET /api/artists/:id/pending-edits',
        'GET /api/export/osm',
        'GET /api/export/osm/stats',
        'GET /api/search',
        'GET /api/search/suggestions',
        'GET /api/me/submissions',
        'GET /api/me/profile',
        'POST /api/consent',
        'GET /api/consent',
        'GET /api/consent/form-data',
        'DELETE /api/consent',
        'POST /api/auth/request-magic-link',
        'POST /api/auth/verify-magic-link',
        'POST /api/auth/logout',
        'GET /api/auth/status',
        'POST /api/auth/magic-link',
        'GET /api/review/queue',
        'POST /api/review/approve/:id',
        'POST /api/review/reject/:id',
        'GET /api/review/artwork-edits',
        'GET /api/review/artwork-edits/:editId',
        'POST /api/review/artwork-edits/:editId/approve',
        'POST /api/review/artwork-edits/:editId/reject',
        'GET /api/admin/permissions',
        'POST /api/admin/permissions/grant',
        'POST /api/admin/permissions/revoke',
        'GET /api/admin/audit',
        'GET /api/admin/statistics',
      ],
    },
    404
  );
});

// Global error handler
app.onError((err, c) => {
  console.error('Worker error:', err);

  // Use our error handling system
  return sendErrorResponse(c, err);
});

// Export for Cloudflare Workers
export default app;
