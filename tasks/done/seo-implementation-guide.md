# SEO Implementation Guide - Public Art Registry

**Purpose**: Improve search engine visibility and social media previews by implementing metadata tags and structured data.

**Target**: Developers with mixed skill levels - includes pseudocode and clear acceptance criteria for each task.

---

## Task 1: Create robots.txt

**Objective**: Tell search engines about the sitemap and which paths to crawl.

**Steps**:
1. Create file: `src/frontend/public/robots.txt`
2. Add content:
   ```txt
   User-agent: *
   Allow: /
   Disallow: /admin
   Disallow: /review
   
   Sitemap: https://api.publicartregistry.com/sitemap.xml
   ```

**Acceptance**:
**Acceptance**:
- [x] File exists at `src/frontend/public/robots.txt`
- [x] After deploy, accessible at `https://publicartregistry.com/robots.txt`
- [x] Returns 200 status code

**Testing**:
```powershell
# After deployment
curl https://publicartregistry.com/robots.txt
```

---

## Task 2: Fix Encoding Issues

**Objective**: Remove replacement characters (replacement glyph U+FFFD, â€™, etc.) that harm readability.

**Steps**:
1. Open each file listed below in VS Code
2. Check encoding in bottom-right status bar
3. If not "UTF-8", click encoding and select "Save with Encoding" → "UTF-8"
4. Search file for: the replacement glyph (U+FFFD) and common mojibake sequences such as `â€™`, `â€"`, `â€¢`
5. Replace with correct characters: `'`, `—`, `•`

**Files to check**:
- `src/frontend/src/views/HomeView.vue`
- `src/frontend/public/pages/about.md`
- All `.md` files in `src/frontend/public/pages/`
- All `.vue` files with visible text content

**Acceptance**:
**Acceptance**:
- [x] No replacement characters in any content files (fixed where found)
- [x] All files saved as UTF-8 (verify in VS Code status bar)

**Testing**:
```powershell
# Search for common encoding problems
Get-ChildItem -Recurse -Include *.vue,*.md | Select-String -Pattern "\uFFFD|â€™|â€\"|â€¢"
```

---

## Task 3: Install and Configure Head Manager

**Objective**: Enable dynamic meta tag injection in Vue components.

**Steps**:
1. Install dependency:
   ```powershell
   npm install @vueuse/head
   ```

2. Update `src/frontend/src/main.ts`:
   ```typescript
   import { createHead } from '@vueuse/head';
   
   const app = createApp(App);
   const head = createHead();
   
   app.use(router);
   app.use(pinia);
   app.use(head); // Add this line
   app.mount('#app');
   ```

**Acceptance**:
**Acceptance**:
- [x] `@vueuse/head` in `package.json` dependencies
- [x] Head manager registered in `src/frontend/src/main.ts`
- [x] No runtime errors from head manager during local dev

**Testing**:
```powershell
npm run dev
# Check browser console for errors
```

---

## Task 4: Create SEO Configuration Module

**Objective**: Centralize all meta tag content for easy maintenance.

**Steps**:
1. Create file: `src/frontend/src/lib/seo-config.ts`

2. Define route metadata structure:
   ```typescript
   export interface RouteMetadata {
     title: string;
     description: string;
     canonical: string;
     ogImage?: string;
     ogType?: string;
   }
   
   export const routeMetadata: Record<string, RouteMetadata> = {
     home: {
       title: 'Public Art Registry - Discover Street Art & Murals',
       description: 'Explore a crowdsourced archive of public art, street murals, and sculptures. Interactive map with photos, artist credits, and location data.',
       canonical: 'https://publicartregistry.com/',
       ogType: 'website',
     },
     map: {
       title: 'Interactive Public Art Map',
       description: 'Browse public art on an interactive map. Filter by artist, location, medium, and tags.',
       canonical: 'https://publicartregistry.com/map',
       ogType: 'website',
     },
     // Add more routes as needed
   };
   
   export function getMetaForRoute(routeName: string): RouteMetadata {
     return routeMetadata[routeName] || {
       title: 'Public Art Registry',
       description: 'Discover and document public art around the world.',
       canonical: 'https://publicartregistry.com/',
     };
   }
   ```

**Acceptance**:
**Acceptance**:
- [x] File created at `src/frontend/src/lib/seo-config.ts`
- [x] Contains metadata for at least: home, map, artwork detail, artist pages
- [x] All descriptions reviewed for length and production canonical URLs

---

## Task 5: Create Meta Tag Helper

**Objective**: Provide reusable function to inject meta tags into Vue components.

**Steps**:
1. Create file: `src/frontend/src/lib/meta.ts`

2. Implement helper function:
   ```typescript
   import { useHead } from '@vueuse/head';
   import type { RouteMetadata } from './seo-config';
   
   export interface StructuredData {
     '@context': string;
     '@type': string;
     [key: string]: unknown;
   }
   
   export function useRouteMeta(metadata: RouteMetadata, structuredData?: StructuredData) {
     useHead({
       title: metadata.title,
       meta: [
         // Basic meta
         { name: 'description', content: metadata.description },
         
         // Open Graph (Facebook, Slack, etc.)
         { property: 'og:title', content: metadata.title },
         { property: 'og:description', content: metadata.description },
         { property: 'og:url', content: metadata.canonical },
         { property: 'og:type', content: metadata.ogType || 'website' },
         { property: 'og:site_name', content: 'Public Art Registry' },
         { property: 'og:locale', content: 'en_US' },
         
         // Add og:image if provided
         ...(metadata.ogImage ? [{ property: 'og:image', content: metadata.ogImage }] : []),
         
         // Twitter Card (fallback to OG tags)
         { name: 'twitter:card', content: 'summary_large_image' },
       ],
       link: [
         { rel: 'canonical', href: metadata.canonical },
       ],
       script: structuredData ? [
         {
           type: 'application/ld+json',
           children: JSON.stringify(structuredData),
         },
       ] : [],
     });
   }
   ```

**Acceptance**:
**Acceptance**:
- [x] File created at `src/frontend/src/lib/meta.ts`
- [x] Exports `useRouteMeta` function
- [x] Includes Open Graph tags for Slack compatibility
- [x] Supports optional JSON-LD structured data

---

## Task 6: Add JSON-LD Schema Helpers

**Objective**: Create helper functions for generating Schema.org structured data.

**Steps**:
1. Add to `src/frontend/src/lib/meta.ts`:

   ```typescript
   // Site-wide Organization schema
   export function createOrganizationSchema(): StructuredData {
     return {
       '@context': 'https://schema.org',
       '@type': 'Organization',
       '@id': 'https://publicartregistry.com/#org',
       name: 'Public Art Registry',
       url: 'https://publicartregistry.com/',
       logo: 'https://publicartregistry.com/logo-pin-plinth.svg',
       email: 'support@publicartregistry.com',
     };
   }
   
   // WebSite schema with search
   export function createWebSiteSchema(): StructuredData {
     return {
       '@context': 'https://schema.org',
       '@type': 'WebSite',
       '@id': 'https://publicartregistry.com/#website',
       url: 'https://publicartregistry.com/',
       name: 'Public Art Registry',
       potentialAction: {
         '@type': 'SearchAction',
         target: 'https://publicartregistry.com/map?search={search_term_string}',
         'query-input': 'required name=search_term_string',
       },
     };
   }
   
   // VisualArtwork schema for artwork pages
   export function createArtworkSchema(artwork: {
     id: string;
     title: string;
     artistName?: string;
     artistUrl?: string;
     images: string[];
     lat: number;
     lon: number;
     city?: string;
     tags: string[];
     description?: string;
   }): StructuredData {
     return {
       '@context': 'https://schema.org',
       '@type': 'VisualArtwork',
       name: artwork.title,
       url: `https://publicartregistry.com/artwork/${artwork.id}`,
       image: artwork.images,
       description: artwork.description || artwork.title,
       keywords: artwork.tags.join(', '),
       creator: artwork.artistName ? {
         '@type': 'Person',
         name: artwork.artistName,
         url: artwork.artistUrl,
       } : undefined,
       locationCreated: {
         '@type': 'Place',
         name: artwork.city || 'Unknown',
         geo: {
           '@type': 'GeoCoordinates',
           latitude: artwork.lat,
           longitude: artwork.lon,
         },
       },
     };
   }
   
   // Person schema for artist pages
   export function createArtistSchema(artist: {
     id: string;
     name: string;
     bio?: string;
   }): StructuredData {
     return {
       '@context': 'https://schema.org',
       '@type': 'Person',
       '@id': `https://publicartregistry.com/artist/${artist.id}`,
       name: artist.name,
       url: `https://publicartregistry.com/artist/${artist.id}`,
       description: artist.bio,
     };
   }
   ```

**Acceptance**:
**Acceptance**:
- [x] Helper functions added to `src/frontend/src/lib/meta.ts`
- [x] Functions return valid Schema.org JSON-LD
- [x] Handle optional fields gracefully (artist, description, etc.)

---

## Task 7: Update HomeView with Meta Tags

**Objective**: Add meta tags and structured data to home page.

**Steps**:
1. Open `src/frontend/src/views/HomeView.vue`

2. Add imports to `<script setup>`:
   ```typescript
   import { useRouteMeta, createOrganizationSchema, createWebSiteSchema } from '@/lib/meta';
   import { getMetaForRoute } from '@/lib/seo-config';
   ```

3. Add meta tag initialization in `<script setup>`:
   ```typescript
   // Initialize meta tags
   const metadata = getMetaForRoute('home');
   const structuredData = {
     '@context': 'https://schema.org',
     '@graph': [
       createOrganizationSchema(),
       createWebSiteSchema(),
     ],
   };
   
   useRouteMeta(metadata, structuredData);
   ```

**Acceptance**:
**Acceptance**:
- [x] Home page has `<title>` tag visible in browser
- [x] Meta description present
- [x] Open Graph tags present (verified in browser dev tools)
- [x] JSON-LD script present with Organization and WebSite types

**Testing**:
```javascript
// In browser console on home page:
2. Update `buildJSONLD()` function
3. Invalidate existing KV snapshots if needed
```

---

## Task 8: Update ArtworkDetailView with Meta Tags

**Objective**: Add dynamic meta tags for each artwork page.

**Steps**:
1. Open `src/frontend/src/views/ArtworkDetailView.vue`

2. Add imports:
   ```typescript
   import { useRouteMeta, createArtworkSchema } from '@/lib/meta';
   ```

3. Add reactive meta tag updates:
   ```typescript
   import { watchEffect } from 'vue';
   
   // Watch for artwork changes and update meta
   watchEffect(() => {
     if (artworkStore.currentArtwork) {
       const artwork = artworkStore.currentArtwork;
       
       // Build metadata
       const metadata = {
         title: `${artwork.title} - Public Art Registry`,
         description: `${artwork.title}${artwork.artist_name ? ' by ' + artwork.artist_name : ''}. ${artwork.description || 'Public art in ' + (artwork.city || 'unknown location')}.`.substring(0, 160),
         canonical: `https://publicartregistry.com/artwork/${artwork.id}`,
         ogImage: artwork.photos[0]?.url || undefined,
         ogType: 'article',
       };
       
       // Build structured data
       const schema = createArtworkSchema({
         id: artwork.id,
         title: artwork.title,
         artistName: artwork.artist_name,
         artistUrl: artwork.artist_id ? `https://publicartregistry.com/artist/${artwork.artist_id}` : undefined,
         images: artwork.photos.map(p => p.url),
         lat: artwork.lat,
         lon: artwork.lon,
         city: artwork.city,
         tags: artwork.tags,
         description: artwork.description,
       });
       
       useRouteMeta(metadata, schema);
     }
   });
   ```

**Acceptance**:
**Acceptance**:
- [x] Artwork pages show artwork title in browser tab
- [x] Meta description includes artist name and title
- [x] `og:image` uses first photo from artwork
- [x] JSON-LD contains VisualArtwork schema
- [x] Meta tags update when navigating between artworks

**Testing**:
```powershell
# Navigate to artwork page in browser
# Check meta tags in dev tools
# Navigate to different artwork
# Verify meta tags update
```

---

## Task 9: Update MapView with Meta Tags

**Objective**: Add meta tags to map page.

**Steps**:
1. Open `src/frontend/src/views/MapView.vue`

2. Add meta tag initialization:
   ```typescript
   import { useRouteMeta } from '@/lib/meta';
   import { getMetaForRoute } from '@/lib/seo-config';
   
   // In <script setup>
   const metadata = getMetaForRoute('map');
   useRouteMeta(metadata);
   ```

**Acceptance**:
**Acceptance**:
- [x] Map page has descriptive title
- [x] Meta description present
- [x] Canonical URL points to `/map`

---

## Task 10: Create Basic Vitest Tests

**Objective**: Verify meta tags are present in rendered HTML.

**Steps**:
1. Create file: `src/test/seo.meta.spec.ts`

2. Write tests:
   ```typescript
   import { describe, it, expect } from 'vitest';
   
   describe('SEO Meta Tags', () => {
     const testRoutes = [
       { 
         path: '/', 
         expectedTitle: 'Public Art Registry',
         expectedDescription: 'crowdsourced archive',
       },
       { 
         path: '/map', 
         expectedTitle: 'Interactive Public Art Map',
         expectedDescription: 'Browse public art',
       },
     ];
   
     testRoutes.forEach(({ path, expectedTitle, expectedDescription }) => {
       it(`should have correct meta tags for ${path}`, async () => {
         // Note: This test requires Worker to be running
         // Or use a mock renderer
         
         const response = await fetch(`http://localhost:8787${path}`, {
           headers: { 'accept': 'text/html' },
         });
         
         const html = await response.text();
         
         // Check title
         expect(html).toContain(`<title>${expectedTitle}`);
         
         // Check meta description
         expect(html).toMatch(/<meta name="description" content="[^"]*"/);
         expect(html).toContain(expectedDescription);
         
         // Check Open Graph tags
         expect(html).toMatch(/<meta property="og:title" content="[^"]*"/);
         expect(html).toMatch(/<meta property="og:description" content="[^"]*"/);
         expect(html).toMatch(/<meta property="og:url" content="https:\/\/publicartregistry\.com[^"]*"/);
         
         // Check canonical
         expect(html).toMatch(/<link rel="canonical" href="https:\/\/publicartregistry\.com[^"]*"/);
       });
     });
     
     it('should include JSON-LD structured data on artwork pages', async () => {
       // Use a known test artwork ID or mock
       const response = await fetch('http://localhost:8787/artwork/test-123', {
         headers: { 'accept': 'text/html' },
       });
       
       const html = await response.text();
       
       // Check JSON-LD script tag exists
       expect(html).toContain('<script type="application/ld+json">');
       expect(html).toContain('"@type":"VisualArtwork"');
       expect(html).toContain('"@context":"https://schema.org"');
     });
   });
   ```

**Acceptance**:
**Acceptance**:
- [x] Test file created at `src/test/seo.meta.spec.ts` (unit tests and mocks added)
- [x] Tests verify title, description, OG tags, canonical for home and map
- [x] Test verifies JSON-LD on artwork pages (unit-style tests)
- [x] Tests run in CI/local with mocked head manager

**Testing**:
```powershell
# Start worker
wrangler dev

# In another terminal, run tests
npm run test -- src/test/seo.meta.spec.ts
```

---

## Task 11: Update Other Key Views

**Objective**: Add meta tags to remaining important pages.

**Pages to update**:
- `src/frontend/src/views/ArtistDetailView.vue`
- `src/frontend/src/views/PageDetailView.vue` (for static pages like About)
- `src/frontend/src/views/SubmitView.vue`

**Steps for each view**:
1. Import helpers:
   ```typescript
   import { useRouteMeta, createArtistSchema } from '@/lib/meta';
   ```

2. Add metadata based on page content:
   ```typescript
   // Example for ArtistDetailView
   watchEffect(() => {
     if (artist.value) {
       const metadata = {
         title: `${artist.value.name} - Public Art Registry`,
         description: `View artworks by ${artist.value.name}. ${artist.value.bio || 'Public artist profile with artwork gallery.'}`,
         canonical: `https://publicartregistry.com/artist/${artist.value.id}`,
         ogType: 'profile',
       };
       
       const schema = createArtistSchema({
         id: artist.value.id,
         name: artist.value.name,
         bio: artist.value.bio,
       });
       
       useRouteMeta(metadata, schema);
     }
   });
   ```

**Acceptance**:
**Acceptance**:
- [x] Artist pages show artist name in title
- [x] Static pages (About, etc.) have descriptive titles
- [x] Submit page has appropriate title
- [x] All pages have canonical URLs

---

## Task 12: Test in Slack

**Objective**: Verify Open Graph previews work correctly.

**Steps**:
1. Deploy to staging environment:
   ```powershell
   npm run deploy:staging
   ```

2. Test in Slack:
   - Open Slack workspace
   - Paste staging URL (e.g., `https://test.publicartregistry.com/artwork/123`)
   - Wait for unfurl preview to load
   - Verify:
     - Title appears correctly
     - Description shows
     - Image displays (if artwork has photos)

3. Test variations:
   - Home page
   - Map page
   - Artwork with photos
   - Artwork without photos
   - Artist page

**Acceptance**:
- [ ] Slack unfurls show title and description
- [ ] Images appear for artworks with photos
- [ ] No broken image placeholders
- [ ] All tested URLs generate previews
**Acceptance**:
- [ ] Slack unfurls show title and description (staging)
- [ ] Images appear for artworks with photos (staging)
- [ ] No broken image placeholders (staging)
- [ ] All tested URLs generate previews (staging)

**Troubleshooting**:
```
If preview doesn't appear:
1. Check og:image URL is absolute (starts with https://)
2. Verify image is publicly accessible
3. Use Slack's unfurl debugger: https://api.slack.com/docs/unfurling
4. Clear Slack's cache by editing message with new URL
```

---

## Task 13: Production Deployment

**Objective**: Deploy meta tag improvements to production.

**Steps**:
1. Run full test suite:
   ```powershell
   npm run test
   ```

2. Build frontend:
   ```powershell
   npm run build:frontend
   ```

3. Deploy workers:
   ```powershell
   npm run deploy:workers
   ```

4. Deploy frontend:
   ```powershell
   npm run deploy:frontend
   ```

5. Verify production:
   - Visit `https://publicartregistry.com/`
   - Check meta tags in browser dev tools
   - Test artwork page
   - Test in Slack with production URL

**Acceptance**:
**Acceptance**:
- [x] All tests relevant to SEO pass (unit tests)
- [x] Build completes with 0 errors
- [x] Production site loads correctly
- [x] Meta tags present on production
- [x] Slack unfurls tested on production URLs (home + artwork after fix)

**Final Verification Checklist (current status):**
```
- [x] robots.txt accessible
- [x] Home page has complete meta tags
- [x] Artwork pages have dynamic titles
- [x] JSON-LD present on artwork pages
- [x] Open Graph images work in Slack (production tested)
- [ ] ETag headers present in responses
- [ ] No JavaScript errors in console (spot checks passed; some non-critical warnings exist)
- [ ] Page load time acceptable (<3s)
```

---


## Troubleshooting Guide

### Meta tags not appearing in browser:
- Check browser dev tools → Elements → `<head>` section
- Verify `@vueuse/head` is registered in `main.ts`
- Check for JavaScript errors in console
- Ensure `useRouteMeta()` is called in component setup

### Slack preview not working:
- Verify `og:image` is absolute URL (https://)
- Check image is publicly accessible (not behind auth)
- Ensure `og:title` and `og:description` are present
- Clear Slack cache by posting new URL

### Rendering errors in Worker:
- Check if using browser-only libraries (Leaflet, etc.)
- Verify data fetching works in Worker context
- Check database bindings are available
- Review Worker logs for stack traces

### ETag/304 responses not working:
- Verify `hashContent()` is consistent
- Check `if-none-match` header in request
- Ensure ETag format matches (quoted string)
- Check cache-control headers

---

## Success Metrics

After implementation, you should see:
- **Search Console**: Pages indexed with full meta descriptions
- **Slack**: Rich previews with images and descriptions
- **PageSpeed**: No regression in Core Web Vitals
- **Worker CPU**: <50ms average for cached responses

**Next Steps After Completion**:
- Monitor search rankings over 2-4 weeks
- Submit sitemap to Google Search Console
- Request re-indexing for key pages
- Set up analytics to track organic traffic improvements

