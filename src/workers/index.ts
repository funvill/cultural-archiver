import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';

// Import types
import type { WorkerEnv } from './types';

// Import middleware
import { ensureUserToken, addUserTokenToResponse, checkEmailVerification } from './middleware/auth';
import { rateLimitSubmissions, rateLimitQueries, addRateLimitStatus } from './middleware/rateLimit';
import {
  validateLogbookFormData,
  validateNearbyArtworksQuery,
  validateBoundsQuery,
  validateUserSubmissionsQuery,
  validateFileUploads,
  validateUUID,
  validateMagicLinkRequest,
  validateSchema,
  consumeMagicLinkSchema,
} from './middleware/validation';
import { withErrorHandling, sendErrorResponse, ApiError } from './lib/errors';

// Import route handlers
import { createLogbookSubmission } from './routes/submissions';
import { getNearbyArtworks, getArtworkDetails, getArtworksInBounds } from './routes/discovery';
import { getUserSubmissions, getUserProfile } from './routes/user';
import {
  requestMagicLink,
  consumeMagicLinkToken,
  getVerificationStatus,
  removeEmailVerification,
  resendVerificationEmail,
  getDevMagicLinkEndpoint,
} from './routes/auth';
import {
  getReviewQueue,
  getSubmissionForReview,
  approveSubmission,
  rejectSubmission,
  getReviewStats,
  processBatchReview,
} from './routes/review';
import {
  submitConsent,
  getConsentStatus,
  getConsentFormData,
  revokeConsent,
} from './routes/consent';

// Initialize Hono app
const app = new Hono<{ Bindings: WorkerEnv }>();

// Global middleware
app.use('*', secureHeaders());
app.use('*', logger());
app.use('*', prettyJSON());

// CORS configuration
app.use('/api/*', async (c, next) => {
  const corsOptions = cors({
    origin: [c.env.FRONTEND_URL, 'http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-User-Token'],
    credentials: true,
  });
  return corsOptions(c, next);
});

// Health check endpoint
app.get('/health', c => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
    version: '1.0.0',
  });
});

// Simple test endpoint
app.get('/test', c => {
  console.log('Test endpoint called');
  return c.json({ message: 'Test endpoint working' });
});

// API status endpoint (no auth required)
app.get('/api/status', c => {
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
app.use('/api/consent', ensureUserToken);
app.use('/api/consent', addUserTokenToResponse);

// ================================
// Submission Endpoints
// ================================

app.post(
  '/api/logbook',
  rateLimitSubmissions,
  validateFileUploads,
  validateLogbookFormData,
  addUserTokenToResponse,
  withErrorHandling(createLogbookSubmission)
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

// ================================
// Consent Management Endpoints
// ================================

app.post(
  '/api/consent',
  rateLimitSubmissions,
  withErrorHandling(submitConsent)
);

app.get(
  '/api/consent',
  rateLimitQueries,
  withErrorHandling(getConsentStatus)
);

app.get(
  '/api/consent/form-data',
  rateLimitQueries,
  withErrorHandling(getConsentFormData)
);

app.delete(
  '/api/consent',
  rateLimitQueries,
  withErrorHandling(revokeConsent)
);

// ================================
// Authentication Endpoints
// ================================

app.post(
  '/api/auth/magic-link',
  rateLimitQueries, // Use query rate limit for auth requests
  validateMagicLinkRequest,
  addUserTokenToResponse,
  withErrorHandling(requestMagicLink)
);

app.post(
  '/api/auth/consume',
  validateSchema(consumeMagicLinkSchema, 'body'),
  addUserTokenToResponse,
  withErrorHandling(consumeMagicLinkToken)
);

app.get(
  '/api/auth/verify-status',
  addUserTokenToResponse,
  withErrorHandling(getVerificationStatus)
);

app.delete(
  '/api/auth/unverify',
  addUserTokenToResponse,
  withErrorHandling(removeEmailVerification)
);

app.post(
  '/api/auth/resend',
  rateLimitQueries,
  validateMagicLinkRequest,
  addUserTokenToResponse,
  withErrorHandling(resendVerificationEmail)
);

// Development only - get magic link for email
app.get('/api/auth/dev/magic-link', withErrorHandling(getDevMagicLinkEndpoint));

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
app.get('/api/artworks', async c => {
  // Redirect to nearby with default Vancouver coordinates
  const defaultLat = 49.2827;
  const defaultLon = -123.1207;
  const url = new URL(c.req.url);
  url.pathname = '/api/artworks/nearby';
  url.searchParams.set('lat', defaultLat.toString());
  url.searchParams.set('lon', defaultLon.toString());

  return c.redirect(url.toString(), 302);
});

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
        'POST /api/logbook',
        'GET /api/artworks/nearby',
        'GET /api/artworks/:id',
        'GET /api/me/submissions',
        'GET /api/me/profile',
        'POST /api/consent',
        'GET /api/consent',
        'GET /api/consent/form-data',
        'DELETE /api/consent',
        'POST /api/auth/magic-link',
        'POST /api/auth/consume',
        'GET /api/auth/verify-status',
        'GET /api/review/queue',
        'POST /api/review/approve/:id',
        'POST /api/review/reject/:id',
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
