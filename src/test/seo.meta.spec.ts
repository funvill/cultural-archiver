import { describe, it, expect } from 'vitest';

// These tests assume the dev server / worker is running locally at http://localhost:8787
// They are lightweight smoke checks for presence of meta tags.

describe('SEO meta smoke tests', () => {
  const base = 'http://localhost:8787';

  it('home page has title and meta description', async () => {
    const res = await fetch(base + '/');
    const html = await res.text();
    expect(html).toContain('<title');
    expect(html).toMatch(/<meta name="description" content="[^"]+"/);
  });

  it('map page has OG tags', async () => {
    const res = await fetch(base + '/map');
    const html = await res.text();
    expect(html).toMatch(/<meta property="og:title" content="[^"]+"/);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/publicartregistry\.com[^"]*"/);
  });
});
