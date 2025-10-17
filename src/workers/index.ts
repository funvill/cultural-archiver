// Polyfill `window` on globalThis for third-party libs that reference `window` during
// local dev bundling (wrangler/miniflare). Cloudflare Workers runtime doesn't provide
// `window`, and some dependencies (eg. piexifjs) reference it which causes a
// ReferenceError. Setting a harmless global prevents those crashes in dev.
if (typeof (globalThis as any).window === 'undefined') {
  try {
    (globalThis as any).window = globalThis;
  } catch (e) {
    // ignore; if assignment fails we'll continue without a window polyfill
  }
}

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { createLogger } from '../shared/logger';

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
  artistSearchSchema,
  validateUnifiedSubmission,
  profileNameUpdateSchema,
  profileNameCheckSchema,
  userUuidSchema,
  notificationListSchema,
  validateCreateList,
  validateAddToList,
  validateRemoveFromList,
  validateListQuery,
  validateListId,
  artworkEditSubmissionSchema,
} from './middleware/validation';
import { withErrorHandling, sendErrorResponse, ApiError } from './lib/errors';

// Import route handlers
import {
  createSubmission,
  createFastArtworkSubmission,
  createUnifiedSubmission,
} from './routes/submissions';
import { createArtworkEditSubmission } from './routes/submissions-new';
import {
  getNearbyArtworks,
  getArtworkDetails,
  getArtworksInBounds,
  checkArtworkSimilarity,
  getArtworkStats,
  getArtworksList,
} from './routes/discovery';
import {
  submitArtworkEdit,
  getUserPendingEdits,
  validateArtworkEdit,
  exportArtworkToOSM,
  getArtworkMembership,
  toggleArtworkListMembership,
  getArtworkCounts,
} from './routes/artwork';
import {
  getArtistsList,
  getArtistProfile,
  createArtist,
  submitArtistEdit,
  getUserPendingArtistEdits,
  searchArtists,
} from './routes/artists';
import { bulkExportToOSM, getExportStats } from './routes/export';
import {
  getUserSubmissions,
  getUserProfile,
  updateUserPreferences,
  sendTestEmail,
  getAllBadges,
  getUserBadges,
  updateProfileName,
  checkProfileNameAvailability,
  getPublicUserProfile,
  getUserNotifications,
  getUserNotificationUnreadCount,
  dismissUserNotification,
  markUserNotificationRead,
} from './routes/user';
import {
  createList,
  getListDetails,
  addArtworkToList,
  removeArtworksFromList,
  deleteList,
  getUserLists,
} from './routes/lists';
import { handleSearchRequest, handleSearchSuggestions } from './routes/search';
import { processMassImportPhotos } from './routes/mass-import-photos';
import { processMassImportV2 } from './routes/mass-import-v2';
import { handleOSMImport, handleOSMValidate } from './routes/mass-import-osm';
import { handleMassImportV3 } from './routes/mass-import-v3';
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
  getArtistEditsForReview,
  getArtistEditForReview,
  approveArtistEdit,
  rejectArtistEdit,
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
  getAdminBadges,
  createAdminBadge,
  updateAdminBadge,
  deactivateAdminBadge,
} from './routes/admin';
import {
  getSocialMediaSuggestions,
  createSocialMediaSchedule,
  getSocialMediaSchedules,
  deleteSocialMediaSchedule,
  updateSocialMediaSchedule,
  getNextAvailableDate,
  testSocialMediaSchedule,
} from './routes/social-media-admin';
import { debugStevenPermissions } from './routes/debug-permissions';
import { fixPermissionsSchema } from './routes/fix-schema';
import { createFeedback } from './routes/feedback';
import { listFeedback, reviewFeedback } from './routes/moderation/feedback';
import { getAllPagesHandler, getPageHandler, renderErrorPage } from './routes/pages';
import { initializePages } from './lib/pages-loader';
import {
  getSitemapIndex,
  getArtworksSitemap,
  getArtistsSitemap,
  getPagesSitemap,
} from './routes/sitemap';
import imagesRouter from './routes/images';

// Initialize Hono app
const app = new Hono<{ Bindings: WorkerEnv }>();
const log = createLogger({ module: 'workers:index' });

// Initialize pages service (called once at worker startup)
const isDevelopment = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
initializePages(isDevelopment);

// Helper function to get the database binding
const getDatabase = (env: WorkerEnv): D1Database | undefined => {
  return env.DB;
};

// Helper function to get the photos bucket binding
const getPhotosBucket = (env: WorkerEnv): R2Bucket | undefined => {
  return env.PHOTOS_BUCKET;
};

// Add binding validation middleware - CRITICAL for deployment diagnosis
app.use('*', async (c, next) => {
  const missingBindings = [];

  // Check critical bindings using helper functions
  const db = getDatabase(c.env);
  const photosBucket = getPhotosBucket(c.env);
  
  if (!db) missingBindings.push('DB (D1 Database)');
  if (!c.env.SESSIONS) missingBindings.push('SESSIONS (KV)');
  if (!c.env.CACHE) missingBindings.push('CACHE (KV)');
  if (!c.env.RATE_LIMITS) missingBindings.push('RATE_LIMITS (KV)');
  if (!c.env.MAGIC_LINKS) missingBindings.push('MAGIC_LINKS (KV)');
  if (!photosBucket) missingBindings.push('PHOTOS_BUCKET (R2)');

  // Continue with request processing - bindings are validated above

  // If critical bindings are missing, return a helpful error instead of "hello world"
  if (missingBindings.length > 0) {
    log.error('❌ CRITICAL: Missing Cloudflare bindings', { missingBindings });

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
app.use('*', secureHeaders({
  crossOriginResourcePolicy: 'cross-origin', // Allow cross-origin for images
}));
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
      'https://publicartregistry.com',
      'https://api.publicartregistry.com',
      'https://photos.publicartregistry.com',
      'https://test.publicartregistry.com',
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
    log.info('[HEALTH] Testing D1 database…');
    const dbResult = await c.env.DB.prepare('SELECT 1 as test, datetime() as current_time').first();
    checks.database = {
      status: 'healthy',
      test_query: dbResult,
      test_time: Date.now() - startTime,
    };
    log.info('[HEALTH] D1 database: OK');
  } catch (error) {
    log.error('[HEALTH] D1 database failed', { error });
    checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error',
      test_time: Date.now() - startTime,
    };
    allHealthy = false;
  }

  // Test 2: Database statistics
  try {
    log.info('[HEALTH] Getting database statistics…');
    const stats = await getArtworkStats(c.env.DB);
    checks.database_stats = {
      status: 'healthy',
      stats,
      test_time: Date.now() - startTime,
    };
    log.info('[HEALTH] Database stats: OK');
  } catch (error) {
    log.warn('[HEALTH] Database stats failed', { error });
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
      log.info(`[HEALTH] Testing KV namespace: ${name}…`);
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
      log.info(`[HEALTH] KV ${name}: OK`);
    } catch (error) {
      log.error(`[HEALTH] KV ${name} failed`, { error });
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
    log.info('[HEALTH] Testing R2 bucket…');
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
    log.info('[HEALTH] R2 storage: OK');
  } catch (error) {
    log.error('[HEALTH] R2 storage failed', { error });
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
      log.info(`[HEALTH] Testing endpoint: ${path}…`);

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
      log.info(`[HEALTH] Endpoint ${path}: OK`);
    } catch (error) {
      log.error(`[HEALTH] Endpoint ${path} failed`, { error });
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
  log.warn('[HEALTH] Missing bindings', { missingBindings });
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
      'GET /api/artwork/:id/membership',
      'POST /api/artwork/:id/lists/:listType',
      'GET /api/artwork/:id/counts',
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

log.info(`[HEALTH] Health check completed in ${totalTestTime}ms: ${healthResponse.status}`);

  return c.json(healthResponse, allHealthy ? 200 : 503);
});

// Enhanced test endpoint with debug information
app.get('/test', c => {
log.debug('Test endpoint called');
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
log.debug('[DEBUG] Permissions diagnostic endpoint called');

  const userToken = c.req.param('userToken');
  log.debug('[DEBUG] Testing permissions for user', { userToken });

  try {
    // Test 1: Basic database connection
    const dbTest = await c.env.DB.prepare('SELECT 1 as test').first();
    log.debug('[DEBUG] Database test result', { dbTest });

    // Test 2: Check user_permissions table
    const permStmt = c.env.DB.prepare(`
      SELECT * FROM user_permissions 
      WHERE user_uuid = ? AND is_active = 1
    `);
    const permissions = await permStmt.bind(userToken).all();
    log.debug('[DEBUG] Direct permissions query result', { permissions });

    // Test 3: Check legacy logbook count
    const logbookStmt = c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM submissions 
      WHERE user_token = ? AND status = 'approved' AND submission_type = 'logbook_entry'
    `);
    const logbookResult = await logbookStmt.bind(userToken).first();
    log.debug('[DEBUG] Legacy logbook count', { logbookResult });

    // Test 4: Import and test isModerator function
    const { isModerator } = await import('./lib/permissions');
    const isModeratorResult = await isModerator(c.env.DB, userToken);
    log.debug('[DEBUG] isModerator function result', { isModeratorResult });

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
    log.error('[DEBUG] Permissions diagnostic error', { error });
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
  log.debug('API status endpoint called'); // Add logging
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
app.use('/api/moderation/*', ensureUserToken);
app.use('/api/moderation/*', checkEmailVerification);
app.use('/api/moderation/*', requireReviewer);
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
    log.debug(`[PHOTO DEBUG] Looking for key: ${key}`);

    // Get object from R2
    const object = await c.env.PHOTOS_BUCKET.get(key);
    log.debug(`[PHOTO DEBUG] Object found: ${!!object}`);

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
    log.error('Photo serving error', { error });
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
// Dynamic Image Resizing Endpoint
// ================================

// Mount the images router for on-demand resizing
app.route('/api/images', imagesRouter);

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

// Artwork edit submission endpoint
app.post(
  '/api/submissions/artwork-edit',
  ensureUserToken,
  rateLimitSubmissions,
  validateSchema(artworkEditSubmissionSchema, 'body'),
  addUserTokenToResponse,
  withErrorHandling(createArtworkEditSubmission)
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

app.get(
  '/api/artwork/:id/membership',
  rateLimitQueries,
  validateUUID('id'),
  ensureUserToken,
  withErrorHandling(getArtworkMembership)
);

app.post(
  '/api/artwork/:id/lists/:listType',
  rateLimitSubmissions,
  validateUUID('id'),
  ensureUserToken,
  checkEmailVerification,
  withErrorHandling(toggleArtworkListMembership)
);

app.get(
  '/api/artwork/:id/counts',
  rateLimitQueries,
  validateUUID('id'),
  withErrorHandling(getArtworkCounts)
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

// Artist search endpoint for typeahead (must come before /:id route)
app.get(
  '/api/artists/search',
  rateLimitQueries,
  validateSchema(artistSearchSchema, 'query'),
  withErrorHandling(searchArtists)
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
// Pages Endpoints
// ================================

app.get('/api/pages', rateLimitQueries, withErrorHandling(getAllPagesHandler));

app.get('/api/pages/:slug', rateLimitQueries, withErrorHandling(getPageHandler));

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

app.put(
  '/api/me/preferences',
  ensureUserToken,
  addUserTokenToResponse,
  withErrorHandling(updateUserPreferences)
);

// ================================
// User Lists Endpoints (MVP)
// ================================

app.post(
  '/api/lists',
  ensureUserToken,
  validateCreateList,
  addUserTokenToResponse,
  withErrorHandling(createList)
);

app.get(
  '/api/lists/:id',
  ensureUserToken,
  validateListId,
  validateListQuery,
  addUserTokenToResponse,
  withErrorHandling(getListDetails)
);

app.post(
  '/api/lists/:id/items',
  ensureUserToken,
  validateListId,
  validateAddToList,
  addUserTokenToResponse,
  withErrorHandling(addArtworkToList)
);

app.delete(
  '/api/lists/:id/items',
  ensureUserToken,
  validateListId,
  validateRemoveFromList,
  addUserTokenToResponse,
  withErrorHandling(removeArtworksFromList)
);

app.delete(
  '/api/lists/:id',
  ensureUserToken,
  validateListId,
  addUserTokenToResponse,
  withErrorHandling(deleteList)
);

app.get(
  '/api/me/lists',
  ensureUserToken,
  addUserTokenToResponse,
  withErrorHandling(getUserLists)
);

// Badge System Endpoints
// ================================

// Public badge definitions endpoint
app.get('/api/badges', withErrorHandling(getAllBadges));

// User badge endpoints (require email verification)
app.get('/api/me/badges', addUserTokenToResponse, withErrorHandling(getUserBadges));

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

// ================================
// NOTIFICATION SYSTEM ENDPOINTS
// ================================

// Get user notifications (requires email verification)
app.get(
  '/api/me/notifications',
  validateSchema(notificationListSchema, 'query'),
  addUserTokenToResponse,
  withErrorHandling(getUserNotifications)
);

// Get unread notification count (requires email verification)
app.get(
  '/api/me/notifications/unread-count',
  addUserTokenToResponse,
  withErrorHandling(getUserNotificationUnreadCount)
);

// Dismiss notification (requires email verification)
app.post(
  '/api/me/notifications/:id/dismiss',
  validateUUID('id'),
  addUserTokenToResponse,
  withErrorHandling(dismissUserNotification)
);

// Mark notification as read (alias for dismiss)
app.post(
  '/api/me/notifications/:id/read',
  validateUUID('id'),
  addUserTokenToResponse,
  withErrorHandling(markUserNotificationRead)
);

// ================================
// Sitemap Endpoints (SEO)
// ================================

// Sitemap index - lists all sitemaps
app.get('/sitemap.xml', getSitemapIndex);

// Individual sitemaps
app.get('/sitemap-artworks.xml', getArtworksSitemap);
app.get('/sitemap-artists.xml', getArtistsSitemap);
app.get('/sitemap-pages.xml', getPagesSitemap);

// ================================
// 404 Handler
// ================================

// Development/testing endpoint for email configuration
app.post('/api/test-email', withErrorHandling(sendTestEmail));

// ================================
// Mass Import Endpoints
// ================================

// Mass Import V3 - Stateless endpoint for individual artwork/artist items
app.post('/api/mass-import/v3', withErrorHandling(handleMassImportV3));

// Mass Import V2 - Primary endpoint for CLI plugin system
app.post('/api/mass-import/v2', withErrorHandling(processMassImportV2));

// Legacy endpoints (kept for backward compatibility)
app.post('/api/mass-import/submit', withErrorHandling(processMassImportPhotos)); // JSON endpoint for photo URLs
app.post(
  '/api/mass-import/photos',
  validateFileUploads,
  withErrorHandling(processMassImportPhotos)
);

// OpenStreetMap-specific endpoints
app.post('/api/mass-import/osm', withErrorHandling(handleOSMImport));
app.post('/api/mass-import/osm/validate', withErrorHandling(handleOSMValidate));

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

// Artist Edit Review Endpoints
app.get('/api/review/artist-edits', withErrorHandling(getArtistEditsForReview));

app.get(
  '/api/review/artist-edits/:editId',
  validateUUID('editId'),
  withErrorHandling(getArtistEditForReview)
);

app.post(
  '/api/review/artist-edits/:editId/approve',
  validateUUID('editId'),
  withErrorHandling(approveArtistEdit)
);

app.post(
  '/api/review/artist-edits/:editId/reject',
  validateUUID('editId'),
  withErrorHandling(rejectArtistEdit)
);

// ================================
// Feedback Endpoints
// ================================

// POST /api/feedback - Public endpoint for user feedback
app.post('/api/feedback', ensureUserToken, withErrorHandling(createFeedback));

// GET /api/moderation/feedback - Moderator list feedback
app.get('/api/moderation/feedback', withErrorHandling(listFeedback));

// POST /api/moderation/feedback/:id/review - Moderator review feedback
app.post(
  '/api/moderation/feedback/:id/review',
  validateUUID('id'),
  withErrorHandling(reviewFeedback)
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

// Badge management endpoints for administrators
// GET /api/admin/badges - List all badges with statistics
app.get('/api/admin/badges', withErrorHandling(getAdminBadges));

// POST /api/admin/badges - Create a new badge
app.post('/api/admin/badges', withErrorHandling(createAdminBadge));

// PUT /api/admin/badges/:id - Update an existing badge
app.put('/api/admin/badges/:id', withErrorHandling(updateAdminBadge));

// DELETE /api/admin/badges/:id - Deactivate a badge
app.delete('/api/admin/badges/:id', withErrorHandling(deactivateAdminBadge));

// Social media scheduling endpoints for administrators
// GET /api/admin/social-media/suggestions - Get artwork suggestions for posts
app.get('/api/admin/social-media/suggestions', withErrorHandling(getSocialMediaSuggestions));

// POST /api/admin/social-media/schedule - Schedule a new post
app.post('/api/admin/social-media/schedule', withErrorHandling(createSocialMediaSchedule));

// GET /api/admin/social-media/schedule - Get list of scheduled posts
app.get('/api/admin/social-media/schedule', withErrorHandling(getSocialMediaSchedules));

// DELETE /api/admin/social-media/schedule/:id - Unschedule a post
app.delete('/api/admin/social-media/schedule/:id', withErrorHandling(deleteSocialMediaSchedule));

// PATCH /api/admin/social-media/schedule/:id - Update a scheduled post
app.patch('/api/admin/social-media/schedule/:id', withErrorHandling(updateSocialMediaSchedule));

// GET /api/admin/social-media/next-available-date - Find next available posting date
app.get('/api/admin/social-media/next-available-date', withErrorHandling(getNextAvailableDate));

// POST /api/admin/social-media/schedule/:id/test - Manual test trigger for a scheduled post
app.post(
  '/api/admin/social-media/schedule/:id/test',
  withErrorHandling(testSocialMediaSchedule)
);

// Temporarily commented out - missing admin-update route file
// app.post('/api/dev/update-steven-permissions', ensureUserToken, withErrorHandling(updateStevenPermissions));

// GET /api/dev/debug-steven-permissions - Debug endpoint to check permission logic
app.get(
  '/api/dev/debug-steven-permissions',
  ensureUserToken,
  requireAdmin,
  withErrorHandling(debugStevenPermissions)
);

// POST /api/dev/fix-permissions-schema - Fix missing is_active column
app.post(
  '/api/dev/fix-permissions-schema',
  ensureUserToken,
  requireAdmin,
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

    log.info('Permalink redirect', { artworkId, redirectUrl });

    return c.redirect(redirectUrl, 302);
  } catch (error) {
    log.error('Permalink redirect error', { error });
    return sendErrorResponse(c, new ApiError('INVALID_PERMALINK', 'Invalid permalink', 400));
  }
});

// ================================
// Legacy/Compatibility Endpoints
// ================================

// Keep some legacy endpoints for backwards compatibility
app.get(
  '/api/artworks',
  rateLimitQueries,
  validateSchema(artworkListSchema, 'query'),
  withErrorHandling(getArtworksList)
);

app.get('/api/logbook', async c => {
  // Redirect to user submissions
  return c.redirect('/api/me/submissions', 302);
});

// ================================
// Error Handling
// ================================

// 404 handler
app.notFound(c => {
  const path = c.req.path;
  
  // For API routes, return JSON with endpoint list
  if (path.startsWith('/api/')) {
    return c.json(
      {
        error: 'Not Found',
        message: 'The requested resource was not found',
        path: path,
        available_endpoints: [
          'GET /photos/*',
          'POST /api/logbook',
          'GET /api/artworks/nearby',
          'GET /api/artworks/:id',
          'POST /api/artwork/:id/edit',
          'GET /api/artwork/:id/pending-edits',
          'POST /api/artwork/:id/edit/validate',
          'GET /api/artwork/:id/export/osm',
          'GET /api/artwork/:id/membership',
          'POST /api/artwork/:id/lists/:listType',
          'GET /api/artwork/:id/counts',
          'GET /api/artists',
          'GET /api/artists/search',
          'GET /api/artists/:id',
          'POST /api/artists',
          'PUT /api/artists/:id',
          'GET /api/artists/:id/pending-edits',
          'GET /api/export/osm',
          'GET /api/export/osm/stats',
          'GET /api/search',
          'GET /api/search/suggestions',
          'GET /api/pages',
          'GET /api/pages/:slug',
          'GET /api/me/submissions',
          'GET /api/me/profile',
          'PUT /api/me/preferences',
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
          'GET /api/admin/badges',
          'POST /api/admin/badges',
          'PUT /api/admin/badges/:id',
          'DELETE /api/admin/badges/:id',
        ],
      },
      404
    );
  }

  // For non-API routes, return HTML error page
  return renderErrorPage(c, 404, 'The requested page was not found');
});

// Global error handler
app.onError((err, c) => {
  log.error('Worker error', { error: err });

  const path = c.req.path;
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  
  // For API routes, return JSON error response
  if (path.startsWith('/api/')) {
    return sendErrorResponse(c, err);
  }

  // For non-API routes, return HTML error page
  // Use 503 for service unavailable errors, 500 for everything else
  const errorCode = statusCode === 503 ? 503 : 500;
  const fallbackMessage = errorCode === 503 
    ? 'Service temporarily unavailable' 
    : 'An internal server error occurred';
  
  return renderErrorPage(c, errorCode, fallbackMessage);
});

// Export for Cloudflare Workers
export default app;

/**
 * Scheduled event handler for cron triggers
 * 
 * This handler processes scheduled social media posts when the cron trigger fires.
 * To enable, uncomment the [triggers] section in wrangler.toml.
 */
export async function scheduled(
  event: ScheduledEvent,
  env: WorkerEnv,
  _ctx: ExecutionContext
): Promise<void> {
  try {
    log.info('[SCHEDULED] Social media cron job triggered', {
      scheduledAt: new Date(event.scheduledTime).toISOString(),
    });
    
    // Import the cron handler
    const { processSocialMediaSchedules } = await import('./lib/social-media/cron');
    
    // Process scheduled posts
    await processSocialMediaSchedules(env);
    
    log.info('[SCHEDULED] Social media cron job completed successfully');
  } catch (error) {
    log.error('[SCHEDULED] Error in scheduled handler', { error });
    throw error; // Re-throw to mark the job as failed
  }
}

