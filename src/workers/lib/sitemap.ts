/**
 * Sitemap Generation Service
 * Generates XML sitemaps for SEO according to sitemaps.org protocol
 * https://www.sitemaps.org/protocol.html
 */

import type { D1Database } from '@cloudflare/workers-types';
// import narrow types from shared if needed in future
import { createDatabaseService } from './database';
import type { PagesService } from './pages';

interface SitemapUrl {
  loc: string;
  // exactOptionalPropertyTypes is enabled in tsconfig; make undefined explicit
  lastmod?: string | undefined;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format date to W3C Datetime format (YYYY-MM-DD)
 */
function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0] ?? '';
}

/**
 * Generate sitemap XML from URLs
 */
function generateSitemapXml(urls: SitemapUrl[]): string {
  const urlEntries = urls
    .map(url => {
      let entry = `  <url>\n    <loc>${escapeXml(url.loc)}</loc>\n`;
      
      if (url.lastmod) {
        entry += `    <lastmod>${url.lastmod}</lastmod>\n`;
      }
      
      if (url.changefreq) {
        entry += `    <changefreq>${url.changefreq}</changefreq>\n`;
      }
      
      if (url.priority !== undefined) {
        entry += `    <priority>${url.priority.toFixed(1)}</priority>\n`;
      }
      
      entry += '  </url>';
      return entry;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

/**
 * Generate sitemap index XML
 */
function generateSitemapIndexXml(sitemaps: { loc: string; lastmod?: string }[]): string {
  const sitemapEntries = sitemaps
    .map(sitemap => {
      let entry = `  <sitemap>\n    <loc>${escapeXml(sitemap.loc)}</loc>\n`;
      
      if (sitemap.lastmod) {
        entry += `    <lastmod>${sitemap.lastmod}</lastmod>\n`;
      }
      
      entry += '  </sitemap>';
      return entry;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;
}

/**
 * Generate sitemap for artworks
 */
export async function generateArtworksSitemap(
  db: D1Database,
  baseUrl: string
): Promise<string> {
  const dbService = createDatabaseService(db);
  
  // Get all approved artworks
  const query = `
    SELECT id, updated_at
    FROM artwork
    WHERE status = 'approved'
    ORDER BY updated_at DESC
    LIMIT 50000
  `;
  
  const result = await dbService.db.prepare(query).all();
  // D1 returns rows with id and updated_at; ArtworkRecord doesn't include updated_at
  // so use a narrow result type here to reflect the query shape.
  const artworks = result.results as Array<{ id: string; updated_at?: string | null }>;
  
  const urls: SitemapUrl[] = artworks.map(artwork => ({
    loc: `${baseUrl}/artwork/${artwork.id}`,
    lastmod: artwork.updated_at ? formatDate(artwork.updated_at) : undefined,
    changefreq: 'monthly',
    priority: 0.8,
  }));
  
  return generateSitemapXml(urls);
}

/**
 * Generate sitemap for artists
 */
export async function generateArtistsSitemap(
  db: D1Database,
  baseUrl: string
): Promise<string> {
  const dbService = createDatabaseService(db);
  
  // Get all approved artists
  const query = `
    SELECT id, updated_at
    FROM artists
    WHERE status = 'approved'
    ORDER BY updated_at DESC
    LIMIT 50000
  `;
  
  const result = await dbService.db.prepare(query).all();
  const artists = result.results as Array<{ id: string; updated_at?: string | null }>;
  
  const urls: SitemapUrl[] = artists.map(artist => ({
    loc: `${baseUrl}/artist/${artist.id}`,
    lastmod: artist.updated_at ? formatDate(artist.updated_at) : undefined,
    changefreq: 'yearly',
    priority: 0.7,
  }));
  
  return generateSitemapXml(urls);
}

/**
 * Generate sitemap for static pages
 */
export async function generatePagesSitemap(
  pagesService: PagesService | null,
  baseUrl: string
): Promise<string> {
  const urls: SitemapUrl[] = [
    // Home page
    {
      loc: baseUrl,
      changefreq: 'daily',
      priority: 1.0,
    },
    // Map page
    {
      loc: `${baseUrl}/map`,
      changefreq: 'daily',
      priority: 0.9,
    },
    // Search page
    {
      loc: `${baseUrl}/search`,
      changefreq: 'daily',
      priority: 0.9,
    },
    // Artwork index
    {
      loc: `${baseUrl}/artworks`,
      changefreq: 'daily',
      priority: 0.8,
    },
    // Artist index
    {
      loc: `${baseUrl}/artists`,
      changefreq: 'weekly',
      priority: 0.7,
    },
  ];
  
  // Add pages from the pages service
  if (pagesService) {
    const pages = pagesService.getAllPages();
    pages.forEach(page => {
      urls.push({
        loc: `${baseUrl}/page/${page.slug}`,
        lastmod: page.date ? formatDate(page.date) : undefined,
        changefreq: 'monthly',
        priority: 0.5,
      });
    });
  }
  
  return generateSitemapXml(urls);
}

/**
 * Generate sitemap index
 */
/**
 * Generate sitemap index. The sitemap index itself should point at the
 * API-hosted sitemap files (api.publicartregistry.com) because the Worker
 * exposes sitemap endpoints on the API domain.
 *
 * If a specific sitemapHost is provided it will be used; otherwise
 * defaults to 'https://api.publicartregistry.com'.
 */
export function generateSitemapIndex(_baseUrl: string, sitemapHost?: string): string {
  const now = formatDate(new Date());
  const host = (sitemapHost || 'https://api.publicartregistry.com').replace(/\/$/, '');

  const sitemaps = [
    {
      loc: `${host}/sitemap-pages.xml`,
      lastmod: now,
    },
    {
      loc: `${host}/sitemap-artworks.xml`,
      lastmod: now,
    },
    {
      loc: `${host}/sitemap-artists.xml`,
      lastmod: now,
    },
  ];

  return generateSitemapIndexXml(sitemaps);
}
