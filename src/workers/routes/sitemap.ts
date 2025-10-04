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
  const baseUrl = c.env.FRONTEND_URL || 'https://publicartregistry.com';
  
  const xml = generateSitemapIndex(baseUrl);
  
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
  const baseUrl = c.env.FRONTEND_URL || 'https://publicartregistry.com';
  
  try {
    const xml = await generateArtworksSitemap(c.env.DB, baseUrl);
    
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating artworks sitemap:', error);
    return c.json({ error: 'Failed to generate artworks sitemap' }, 500);
  }
}

/**
 * GET /sitemap-artists.xml - Artists Sitemap
 * Returns sitemap of all approved artist profile pages
 */
export async function getArtistsSitemap(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const baseUrl = c.env.FRONTEND_URL || 'https://publicartregistry.com';
  
  try {
    const xml = await generateArtistsSitemap(c.env.DB, baseUrl);
    
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating artists sitemap:', error);
    return c.json({ error: 'Failed to generate artists sitemap' }, 500);
  }
}

/**
 * GET /sitemap-pages.xml - Static Pages Sitemap
 * Returns sitemap of static pages and main site pages
 */
export async function getPagesSitemap(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const baseUrl = c.env.FRONTEND_URL || 'https://publicartregistry.com';
  
  try {
    const pagesService = getPagesService();
    const xml = await generatePagesSitemap(pagesService, baseUrl);
    
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating pages sitemap:', error);
    return c.json({ error: 'Failed to generate pages sitemap' }, 500);
  }
}
