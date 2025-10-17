import { describe, it, expect } from 'vitest';

describe('SEO Meta Tags', () => {
  const testRoutes = [
    { path: '/', expectedTitle: 'Public Art Registry', expectedDescription: 'crowdsourced archive' },
    { path: '/map', expectedTitle: 'Interactive Public Art Map', expectedDescription: 'Browse public art' },
  ];

  testRoutes.forEach(({ path, expectedTitle, expectedDescription }) => {
    it(`should have correct meta tags for ${path}`, async () => {
      // This test expects a local dev server to be running and serving HTML
      const res = await fetch(`http://localhost:8787${path}`, { headers: { accept: 'text/html' } });
      const html = await res.text();

      expect(html).toContain(`<title`);
      expect(html).toContain(expectedDescription);
      expect(html).toMatch(/<meta property="og:title"/);
      expect(html).toMatch(/<meta property="og:description"/);
      expect(html).toMatch(/<link rel="canonical"/);
    });
  });

  it('should include JSON-LD structured data on artwork pages', async () => {
    const res = await fetch('http://localhost:8787/artwork/test-123', { headers: { accept: 'text/html' } });
    const html = await res.text();

    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@type":"VisualArtwork"');
    expect(html).toContain('"@context":"https://schema.org"');
  });
});
