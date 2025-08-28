import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';

// Import types
import type { WorkerEnv } from '../shared/types';

// Import middleware
import { 
  ensureUserToken, 
  addUserTokenToResponse, 
  checkEmailVerification 
} from './middleware/auth';
import { 
  rateLimitSubmissions, 
  rateLimitQueries, 
  addRateLimitStatus 
} from './middleware/rateLimit';
import { 
  validateLogbookSubmission,
  validateNearbyArtworksQuery,
  validateUserSubmissionsQuery,
  validateFileUploads,
  validateUUID
} from './middleware/validation';
import { withErrorHandling, sendErrorResponse } from './lib/errors';

// Import route handlers
import { createLogbookSubmission } from './routes/submissions';
import { getNearbyArtworks, getArtworkDetails } from './routes/discovery';
import { getUserSubmissions, getUserProfile } from './routes/user';

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

// User token middleware for all API routes
app.use('/api/*', ensureUserToken);
app.use('/api/*', checkEmailVerification);

// Health check endpoint
app.get('/health', c => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
    version: '1.0.0',
  });
});

// API status endpoint
app.get('/api/status', c => {
  return c.json({
    message: 'Cultural Archiver API is running',
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ================================
// Submission Endpoints
// ================================

app.post('/api/logbook',
  rateLimitSubmissions,
  validateFileUploads,
  validateLogbookSubmission,
  addUserTokenToResponse,
  withErrorHandling(createLogbookSubmission)
);

// ================================
// Discovery Endpoints
// ================================

app.get('/api/artworks/nearby',
  rateLimitQueries,
  validateNearbyArtworksQuery,
  withErrorHandling(getNearbyArtworks)
);

app.get('/api/artworks/:id',
  rateLimitQueries,
  validateUUID('id'),
  withErrorHandling(getArtworkDetails)
);

// ================================
// User Management Endpoints
// ================================

app.get('/api/me/submissions',
  validateUserSubmissionsQuery,
  addRateLimitStatus,
  addUserTokenToResponse,
  withErrorHandling(getUserSubmissions)
);

app.get('/api/me/profile',
  addRateLimitStatus,
  addUserTokenToResponse,
  withErrorHandling(getUserProfile)
);

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
