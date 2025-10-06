import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import { PagesService } from '../lib/pages';

// Global pages service instance (initialized at startup)
let pagesService: PagesService | null = null;

/**
 * Initialize the pages service with markdown files
 * This should be called during worker initialization
 */
export function initializePagesService(isDevelopment: boolean): void {
  pagesService = new PagesService(isDevelopment);
  // Pages will be loaded via file system or during deployment
  // For now, service is ready but empty
}

/**
 * Get the pages service instance
 * Used by sitemap generation and other services that need access to pages
 */
export function getPagesService(): PagesService | null {
  return pagesService;
}

/**
 * Load a page into the service
 * This will be called for each .md file found in the pages directory
 */
export function loadPageFile(slug: string, content: string): void {
  if (!pagesService) {
    throw new Error('Pages service not initialized');
  }
  pagesService.loadPage(slug, content);
}

/**
 * Get all pages as a list
 * GET /api/pages
 */
export async function getAllPagesHandler(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  if (!pagesService) {
    return c.json({ error: 'Pages service not initialized' }, 500);
  }

  const pages = pagesService.getAllPages();

  return c.json({
    pages: pages.map(page => ({
      slug: page.slug,
      title: page.title,
      date: page.date,
    })),
    total: pages.length,
  });
}

/**
 * Get a single page by slug
 * GET /api/pages/:slug
 */
export async function getPageHandler(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  if (!pagesService) {
    return c.json({ error: 'Pages service not initialized' }, 500);
  }

  const slug = c.req.param('slug');

  const page = pagesService.getPage(slug);

  if (!page) {
    return c.json({ error: 'Page not found' }, 404);
  }

  return c.json({
    slug: page.slug,
    title: page.title,
    date: page.date,
    html: page.html,
  });
}

/**
 * Render an error page as HTML response
 * This is used for 404, 500, and other error pages
 * Falls back to JSON response if page not found or service not initialized
 */
export function renderErrorPage(
  c: Context,
  errorCode: 404 | 500 | 503,
  fallbackMessage: string
): Response {
  if (!pagesService) {
    return c.json({ error: fallbackMessage }, errorCode);
  }

  const errorPageSlug = String(errorCode);
  const page = pagesService.getPage(errorPageSlug);

  if (!page || !page.html) {
    // Fallback to JSON if error page doesn't exist
    return c.json({ error: fallbackMessage }, errorCode);
  }

  // Return HTML response with proper styling
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title} - Public Art Registry</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1rem;
      background: #f9fafb;
    }
    h1, h2, h3 {
      color: #1f2937;
      margin-top: 2rem;
    }
    h1 {
      font-size: 2rem;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 0.5rem;
    }
    h2 {
      font-size: 1.5rem;
      margin-top: 2rem;
    }
    h3 {
      font-size: 1.25rem;
    }
    a {
      color: #3b82f6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    ul {
      padding-left: 1.5rem;
    }
    li {
      margin: 0.5rem 0;
    }
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 2rem 0;
    }
    .error-code {
      font-size: 4rem;
      font-weight: bold;
      color: #ef4444;
      margin: 0;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 2rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    }
    @media (max-width: 640px) {
      body {
        padding: 1rem 0.5rem;
      }
      .container {
        padding: 1rem;
      }
      h1 {
        font-size: 1.5rem;
      }
      .error-code {
        font-size: 3rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-code">${errorCode}</div>
    <h1>${page.title}</h1>
    ${page.html}
  </div>
</body>
</html>`;

  return c.html(html, errorCode);
}

