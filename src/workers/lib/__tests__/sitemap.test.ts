import { describe, it, expect, vi } from 'vitest';
import {
  generateSitemapIndex,
  generateArtworksSitemap,
  generateArtistsSitemap,
  generatePagesSitemap,
} from '../sitemap';

describe('Sitemap Generation', () => {
  it('should generate sitemap index XML', () => {
    const baseUrl = 'https://publicartregistry.com';
    const xml = generateSitemapIndex(baseUrl);
    
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<sitemapindex');
    expect(xml).toContain(`${baseUrl}/sitemap-pages.xml`);
    expect(xml).toContain(`${baseUrl}/sitemap-artworks.xml`);
    expect(xml).toContain(`${baseUrl}/sitemap-artists.xml`);
  });

  it('should generate artworks sitemap', async () => {
    // Mock database
    const mockDb: any = {
      prepare: vi.fn(() => ({
        all: vi.fn(async () => ({
          results: [
            { id: 'artwork-1', updated_at: '2024-01-01' },
            { id: 'artwork-2', updated_at: '2024-01-02' },
          ],
        })),
      })),
    };

    const baseUrl = 'https://publicartregistry.com';
    const xml = await generateArtworksSitemap(mockDb, baseUrl);
    
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset');
    expect(xml).toContain(`${baseUrl}/artwork/artwork-1`);
    expect(xml).toContain(`${baseUrl}/artwork/artwork-2`);
    expect(xml).toContain('<priority>0.8</priority>');
    expect(xml).toContain('<changefreq>weekly</changefreq>');
  });

  it('should generate artists sitemap', async () => {
    // Mock database
    const mockDb: any = {
      prepare: vi.fn(() => ({
        all: vi.fn(async () => ({
          results: [
            { id: 'artist-1', updated_at: '2024-01-01' },
            { id: 'artist-2', updated_at: '2024-01-02' },
          ],
        })),
      })),
    };

    const baseUrl = 'https://publicartregistry.com';
    const xml = await generateArtistsSitemap(mockDb, baseUrl);
    
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset');
    expect(xml).toContain(`${baseUrl}/artist/artist-1`);
    expect(xml).toContain(`${baseUrl}/artist/artist-2`);
    expect(xml).toContain('<priority>0.7</priority>');
  });

  it('should generate pages sitemap', async () => {
    // Mock pages service
    const mockPagesService: any = {
      getAllPages: vi.fn(() => [
        { slug: 'about', title: 'About', date: '2024-01-01' },
        { slug: 'contact', title: 'Contact', date: '2024-01-02' },
      ]),
    };

    const baseUrl = 'https://publicartregistry.com';
    const xml = await generatePagesSitemap(mockPagesService, baseUrl);
    
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset');
    expect(xml).toContain(baseUrl); // Home page
    expect(xml).toContain(`${baseUrl}/map`);
    expect(xml).toContain(`${baseUrl}/page/about`);
    expect(xml).toContain(`${baseUrl}/page/contact`);
    expect(xml).toContain('<priority>1.0</priority>'); // Home page priority
  });

  it('should escape XML special characters', async () => {
    const mockDb: any = {
      prepare: vi.fn(() => ({
        all: vi.fn(async () => ({
          results: [
            { id: 'test&<>"\'', updated_at: '2024-01-01' },
          ],
        })),
      })),
    };

    const baseUrl = 'https://publicartregistry.com';
    const xml = await generateArtworksSitemap(mockDb, baseUrl);
    
    // XML special characters should be escaped
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
    expect(xml).toContain('&quot;');
    expect(xml).toContain('&apos;');
  });
});
