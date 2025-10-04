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

