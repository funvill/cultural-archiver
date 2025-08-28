import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';

// Types for Cloudflare Workers environment
interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  PHOTOS: R2Bucket;
  ENVIRONMENT: string;
  FRONTEND_URL: string;
  LOG_LEVEL: string;
}

// Initialize Hono app
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', secureHeaders());
app.use('*', logger());
app.use('*', prettyJSON());

// CORS configuration
app.use('/api/*', async (c, next) => {
  const corsOptions = cors({
    origin: [c.env.FRONTEND_URL, 'http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
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

// API routes
app.get('/api/status', c => {
  return c.json({
    message: 'Cultural Archiver API is running',
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  });
});

// Placeholder API routes for future implementation
app.get('/api/artworks', async c => {
  // TODO: Implement artwork listing from D1 database
  return c.json({
    artworks: [],
    message: 'Artworks endpoint - implementation pending',
  });
});

app.get('/api/events', async c => {
  // TODO: Implement event listing from D1 database
  return c.json({
    events: [],
    message: 'Events endpoint - implementation pending',
  });
});

app.get('/api/logbook', async c => {
  // TODO: Implement logbook entries from D1 database
  return c.json({
    entries: [],
    message: 'Logbook endpoint - implementation pending',
  });
});

// 404 handler
app.notFound(c => {
  return c.json(
    {
      error: 'Not Found',
      message: 'The requested resource was not found',
      path: c.req.path,
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: c.env.ENVIRONMENT === 'development' ? err.message : 'Something went wrong',
    },
    500
  );
});

// Export for Cloudflare Workers
export default app;

// Export for Node.js v23+ native TypeScript execution (development)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = app;
}

// Development server for local testing with Node.js v23+
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting development server...');
  console.log('Note: Use "npm run dev" or "wrangler dev" for full Cloudflare Workers environment');
}
