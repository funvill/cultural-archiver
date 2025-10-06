// Page content loader for Cloudflare Workers
// In production, these would be bundled at build time or loaded from R2
import { initializePagesService, loadPageFile } from '../routes/pages';
import { BUNDLED_PAGES, PAGE_COUNT } from './bundled-pages.js';

/**
 * Initialize the pages service and load all page files
 * This is called during worker initialization
 */
export function initializePages(isDevelopment: boolean): void {
  initializePagesService(isDevelopment);

  // Load bundled pages
  console.log(`[PAGES] Loading ${PAGE_COUNT} bundled pages...`);
  loadPagesFromManifest(BUNDLED_PAGES);
  console.log('[PAGES] Pages service initialized with bundled content');
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
