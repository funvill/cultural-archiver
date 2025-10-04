// Page content loader for Cloudflare Workers
// In production, these would be bundled at build time or loaded from R2
import { initializePagesService, loadPageFile } from '../routes/pages';

/**
 * Initialize the pages service and load all page files
 * This is called during worker initialization
 */
export function initializePages(isDevelopment: boolean): void {
  initializePagesService(isDevelopment);

  // For now, pages are served directly from the frontend's public/pages directory
  // The API endpoints will return empty until we implement file bundling or R2 storage
  
  // TODO: Implement one of these approaches:
  // 1. Bundle markdown files at build time using esbuild or similar
  // 2. Store markdown files in R2 and load them at runtime
  // 3. Use wrangler's asset binding feature to include them in the worker bundle
  
  console.log('[PAGES] Pages service initialized');
}

/**
 * Helper to load pages from a manifest
 * This would be called with bundled page content
 */
export function loadPagesFromManifest(pages: Record<string, string>): void {
  Object.entries(pages).forEach(([slug, content]) => {
    try {
      loadPageFile(slug, content);
      console.log(`[PAGES] Loaded page: ${slug}`);
    } catch (error) {
      console.error(`[PAGES] Failed to load page ${slug}:`, error);
    }
  });
}
