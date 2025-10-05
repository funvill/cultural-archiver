/**
 * Sitemap route handlers for SEO
 * Provides XML sitemaps for search engines
 */

import type { Context } from 'hono';
import type { WorkerEnv } from '../types';
import {
  generateSitemapIndex,
  generateArtworksSitemap,
  generateArtistsSitemap,
  generatePagesSitemap,
} from '../lib/sitemap';

// Import pages service from pages routes
import { getPagesService } from './pages';

/**
 * GET /sitemap.xml - Sitemap Index
 * Returns the main sitemap index that lists all sub-sitemaps
 */
export async function getSitemapIndex(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  console.log('[SITEMAP DIAGNOSTIC] GET /sitemap.xml requested');
  const baseUrl = c.env.FRONTEND_URL || 'https://publicartregistry.com';
  
  const xml = generateSitemapIndex(baseUrl);
  console.log('[SITEMAP DIAGNOSTIC] Sitemap index generated, length:', xml.length);
  
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
}

/**
 * GET /sitemap-artworks.xml - Artworks Sitemap
 * Returns sitemap of all approved artwork detail pages
 */
export async function getArtworksSitemap(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  console.log('[SITEMAP DIAGNOSTIC] GET /sitemap-artworks.xml requested');
  const baseUrl = c.env.FRONTEND_URL || 'https://publicartregistry.com';
  
  try {
    const xml = await generateArtworksSitemap(c.env.DB, baseUrl);
    console.log('[SITEMAP DIAGNOSTIC] Artworks sitemap generated, length:', xml.length);
    
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('[SITEMAP DIAGNOSTIC] Error generating artworks sitemap:', error);
    return c.json({ error: 'Failed to generate artworks sitemap' }, 500);
  }
}

/**
 * GET /sitemap-artists.xml - Artists Sitemap
 * Returns sitemap of all approved artist profile pages
 */
export async function getArtistsSitemap(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  console.log('[SITEMAP DIAGNOSTIC] GET /sitemap-artists.xml requested');
  const baseUrl = c.env.FRONTEND_URL || 'https://publicartregistry.com';
  
  try {
    const xml = await generateArtistsSitemap(c.env.DB, baseUrl);
    console.log('[SITEMAP DIAGNOSTIC] Artists sitemap generated, length:', xml.length);
    
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('[SITEMAP DIAGNOSTIC] Error generating artists sitemap:', error);
    return c.json({ error: 'Failed to generate artists sitemap' }, 500);
  }
}

/**
 * GET /sitemap-pages.xml - Static Pages Sitemap
 * Returns sitemap of static pages and main site pages
 */
export async function getPagesSitemap(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  console.log('[SITEMAP DIAGNOSTIC] GET /sitemap-pages.xml requested');
  const baseUrl = c.env.FRONTEND_URL || 'https://publicartregistry.com';
  
  try {
    const pagesService = getPagesService();
    const xml = await generatePagesSitemap(pagesService, baseUrl);
    console.log('[SITEMAP DIAGNOSTIC] Pages sitemap generated, length:', xml.length);
    
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('[SITEMAP DIAGNOSTIC] Error generating pages sitemap:', error);
    return c.json({ error: 'Failed to generate pages sitemap' }, 500);
  }
}
