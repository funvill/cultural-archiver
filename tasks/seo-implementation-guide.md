# SEO Implementation Guide - Public Art Registry

**Purpose**: Improve search engine visibility and social media previews by implementing server-side rendering, metadata tags, and structured data.

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
- [ ] File exists at `src/frontend/public/robots.txt`
- [ ] After deploy, accessible at `https://publicartregistry.com/robots.txt`
- [ ] Returns 200 status code

**Testing**:
```powershell
# After deployment
curl https://publicartregistry.com/robots.txt
```

---

## Task 2: Fix Encoding Issues

**Objective**: Remove replacement characters (�, â€™, etc.) that harm readability.

**Steps**:
1. Open each file listed below in VS Code
2. Check encoding in bottom-right status bar
3. If not "UTF-8", click encoding and select "Save with Encoding" → "UTF-8"
4. Search file for: `�`, `â€™`, `â€"`, `â€¢`
5. Replace with correct characters: `'`, `—`, `•`

**Files to check**:
- `src/frontend/src/views/HomeView.vue`
- `src/frontend/public/pages/about.md`
- All `.md` files in `src/frontend/public/pages/`
- All `.vue` files with visible text content

**Acceptance**:
- [ ] No replacement characters in any content files
- [ ] All files saved as UTF-8 (verify in VS Code status bar)

**Testing**:
```powershell
# Search for common encoding problems
Get-ChildItem -Recurse -Include *.vue,*.md | Select-String -Pattern "�|â€™|â€"|â€¢"
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
- [ ] `@vueuse/head` in `package.json` dependencies
- [ ] Head manager registered in `src/frontend/src/main.ts`
- [ ] No errors when running `npm run dev`

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
- [ ] File created at `src/frontend/src/lib/seo-config.ts`
- [ ] Contains metadata for at least: home, map, artwork detail, artist pages
- [ ] All descriptions between 120-160 characters
- [ ] All canonical URLs use production domain

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
- [ ] File created at `src/frontend/src/lib/meta.ts`
- [ ] Exports `useRouteMeta` function
- [ ] Includes Open Graph tags for Slack compatibility
- [ ] Supports optional JSON-LD structured data

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
- [ ] Helper functions added to `src/frontend/src/lib/meta.ts`
- [ ] Functions return valid Schema.org JSON-LD
- [ ] Handle optional fields gracefully (artist, description, etc.)

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
- [ ] Home page has `<title>` tag visible in browser
- [ ] Meta description present
- [ ] Open Graph tags present (verify in browser dev tools)
- [ ] JSON-LD script present with Organization and WebSite types

**Testing**:
```javascript
// In browser console on home page:
document.querySelector('meta[property="og:title"]').content
document.querySelector('script[type="application/ld+json"]').textContent
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
- [ ] Artwork pages show artwork title in browser tab
- [ ] Meta description includes artist name and title
- [ ] `og:image` uses first photo from artwork
- [ ] JSON-LD contains VisualArtwork schema
- [ ] Meta tags update when navigating between artworks

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
- [ ] Map page has descriptive title
- [ ] Meta description present
- [ ] Canonical URL points to `/map`

---

## Task 10: Configure KV Namespaces

**Objective**: Set up Cloudflare KV storage for prerendered HTML.

**Steps**:
1. Create KV namespaces via Cloudflare dashboard or CLI:
   ```powershell
   wrangler kv:namespace create "PRERENDER_SNAPSHOTS"
   wrangler kv:namespace create "PRERENDER_INDEX"
   wrangler kv:namespace create "PRERENDER_JSONLD"
   ```

2. Note the IDs returned (format: `id = "abc123..."`).

3. Update `src/workers/wrangler.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "PRERENDER_SNAPSHOTS"
   id = "<your-snapshots-id>"
   
   [[kv_namespaces]]
   binding = "PRERENDER_INDEX"
   id = "<your-index-id>"
   
   [[kv_namespaces]]
   binding = "PRERENDER_JSONLD"
   id = "<your-jsonld-id>"
   ```

**Acceptance**:
- [ ] Three KV namespaces created in Cloudflare
- [ ] IDs added to `wrangler.toml`
- [ ] `wrangler dev` starts without KV binding errors

**Testing**:
```powershell
wrangler kv:namespace list
wrangler dev
```

---

## Task 11: Create KV Cache Helper Module

**Objective**: Provide utilities for reading/writing prerendered HTML to KV.

**Steps**:
1. Create file: `src/workers/lib/kv-cache.ts`

2. Implement helper functions:
   ```typescript
   import { createHash } from 'crypto';
   
   export interface SnapshotMetadata {
     latest: string;
     generatedAt: number;
     etag: string;
     size?: number;
   }
   
   // Generate content hash for versioning
   export function hashContent(content: string): string {
     return createHash('sha256')
       .update(content)
       .digest('hex')
       .substring(0, 16);
   }
   
   // Remove tracking params and normalize URL
   export function canonicalize(url: URL): string {
     const cleanUrl = new URL(url);
     const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];
     trackingParams.forEach(param => cleanUrl.searchParams.delete(param));
     return cleanUrl.pathname;
   }
   
   // Retrieve snapshot from KV
   export async function getSnapshot(
     canonical: string,
     PRERENDER_INDEX: KVNamespace,
     PRERENDER_SNAPSHOTS: KVNamespace
   ): Promise<{ html: string; etag: string } | null> {
     // Step 1: Look up index to get latest version key
     const indexKey = `prerender:index:${canonical}`;
     const metadata = await PRERENDER_INDEX.get<SnapshotMetadata>(indexKey, { type: 'json' });
     
     if (!metadata?.latest) {
       return null; // No snapshot exists
     }
     
     // Step 2: Fetch snapshot using versioned key
     const snapshot = await PRERENDER_SNAPSHOTS.get(metadata.latest, { type: 'text' });
     
     if (!snapshot) {
       console.warn(`Snapshot missing for key: ${metadata.latest}`);
       return null;
     }
     
     return {
       html: snapshot,
       etag: metadata.etag,
     };
   }
   
   // Save snapshot to KV
   export async function saveSnapshot(
     canonical: string,
     html: string,
     PRERENDER_INDEX: KVNamespace,
     PRERENDER_SNAPSHOTS: KVNamespace,
     PRERENDER_JSONLD?: KVNamespace,
     jsonld?: object
   ): Promise<void> {
     // Step 1: Generate content hash for ETag and versioning
     const contentHash = hashContent(html);
     const versionedKey = `prerender:${canonical}:v${contentHash}`;
     
     // Step 2: Check size limit (KV max is 25MB)
     const sizeBytes = new TextEncoder().encode(html).byteLength;
     if (sizeBytes > 25 * 1024 * 1024) {
       console.warn(`Snapshot too large: ${canonical} (${sizeBytes} bytes)`);
       throw new Error('Snapshot exceeds KV size limit');
     }
     
     // Step 3: Save snapshot with 7-day TTL
     await PRERENDER_SNAPSHOTS.put(versionedKey, html, {
       expirationTtl: 60 * 60 * 24 * 7,
     });
     
     // Step 4: Update index mapping
     const metadata: SnapshotMetadata = {
       latest: versionedKey,
       generatedAt: Date.now(),
       etag: contentHash,
       size: sizeBytes,
     };
     await PRERENDER_INDEX.put(`prerender:index:${canonical}`, JSON.stringify(metadata));
     
     // Step 5: Optionally save JSON-LD separately
     if (PRERENDER_JSONLD && jsonld) {
       await PRERENDER_JSONLD.put(
         `prerender:jsonld:${canonical}:v${contentHash}`,
         JSON.stringify(jsonld)
       );
     }
   }
   ```

**Acceptance**:
- [ ] File created at `src/workers/lib/kv-cache.ts`
- [ ] Exports `getSnapshot`, `saveSnapshot`, `hashContent`, `canonicalize`
- [ ] Handles missing snapshots gracefully
- [ ] Enforces KV size limits

---

## Task 12: Install Vue Server Renderer

**Objective**: Add dependency for server-side rendering Vue components.

**Steps**:
1. Install package:
   ```powershell
   npm install @vue/server-renderer
   ```

2. Verify installation:
   ```powershell
   npm list @vue/server-renderer
   ```

**Acceptance**:
- [ ] `@vue/server-renderer` in `package.json`
- [ ] Version matches Vue version (e.g., both 3.x)

---

## Task 13: Create SSR Renderer Module

**Objective**: Implement server-side rendering logic for Vue app.

**Steps**:
1. Create file: `src/workers/lib/ssr.ts`

2. Implement SSR function (pseudocode structure):
   ```typescript
   import { renderToString } from '@vue/server-renderer';
   
   export async function renderSSR(
     canonical: string,
     request: Request,
     env: any
   ): Promise<{ html: string; jsonld?: object }> {
     // Step 1: Determine route from canonical path
     const route = parseRoute(canonical);
     
     // Step 2: Fetch data needed for this route
     // Example: if artwork page, fetch artwork from database
     let pageData = null;
     if (route.type === 'artwork') {
       pageData = await fetchArtwork(route.id, env);
     }
     
     // Step 3: Create Vue app instance
     const app = createSSRApp({
       // Initialize app with route and data
       // Note: This requires extracting app creation logic
       // from src/frontend/src/main.ts into a shared factory
     });
     
     // Step 4: Render app to HTML string
     const appHtml = await renderToString(app);
     
     // Step 5: Build complete HTML with meta tags
     const metadata = buildMetadata(route, pageData);
     const jsonld = buildJSONLD(route, pageData);
     
     const fullHtml = `<!DOCTYPE html>
   <html lang="en">
   <head>
     <meta charset="UTF-8">
     <meta name="viewport" content="width=device-width, initial-scale=1.0">
     <title>${metadata.title}</title>
     <meta name="description" content="${metadata.description}">
     <link rel="canonical" href="${metadata.canonical}">
     
     <!-- Open Graph -->
     <meta property="og:title" content="${metadata.title}">
     <meta property="og:description" content="${metadata.description}">
     <meta property="og:url" content="${metadata.canonical}">
     <meta property="og:type" content="${metadata.ogType || 'website'}">
     <meta property="og:site_name" content="Public Art Registry">
     ${metadata.ogImage ? `<meta property="og:image" content="${metadata.ogImage}">` : ''}
     
     <!-- JSON-LD -->
     ${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
   </head>
   <body>
     <div id="app">${appHtml}</div>
     <script type="module" src="/src/main.ts"></script>
   </body>
   </html>`;
     
     return { html: fullHtml, jsonld };
   }
   
   // Helper: Parse canonical path to determine route type
   function parseRoute(canonical: string) {
     if (canonical === '/') return { type: 'home' };
     if (canonical === '/map') return { type: 'map' };
     
     const artworkMatch = canonical.match(/^\/artwork\/([^/]+)/);
     if (artworkMatch) return { type: 'artwork', id: artworkMatch[1] };
     
     const artistMatch = canonical.match(/^\/artist\/([^/]+)/);
     if (artistMatch) return { type: 'artist', id: artistMatch[1] };
     
     return { type: 'unknown' };
   }
   
   // Helper: Build metadata based on route and data
   function buildMetadata(route: any, pageData: any) {
     if (route.type === 'home') {
       return {
         title: 'Public Art Registry - Discover Street Art & Murals',
         description: 'Explore a crowdsourced archive of public art...',
         canonical: 'https://publicartregistry.com/',
       };
     }
     
     if (route.type === 'artwork' && pageData) {
       return {
         title: `${pageData.title} - Public Art Registry`,
         description: `${pageData.title} by ${pageData.artist_name || 'Unknown'}...`,
         canonical: `https://publicartregistry.com/artwork/${pageData.id}`,
         ogImage: pageData.photos[0]?.url,
         ogType: 'article',
       };
     }
     
     // Default fallback
     return {
       title: 'Public Art Registry',
       description: 'Discover public art around the world',
       canonical: 'https://publicartregistry.com' + route.path,
     };
   }
   
   // Helper: Build JSON-LD schema
   function buildJSONLD(route: any, pageData: any) {
     if (route.type === 'artwork' && pageData) {
       return {
         '@context': 'https://schema.org',
         '@type': 'VisualArtwork',
         name: pageData.title,
         creator: pageData.artist_name ? {
           '@type': 'Person',
           name: pageData.artist_name,
         } : undefined,
         // ... rest of schema
       };
     }
     
     return null;
   }
   
   // Helper: Fetch artwork from database
   async function fetchArtwork(id: string, env: any) {
     const stmt = env.DB.prepare('SELECT * FROM artwork WHERE id = ?');
     const result = await stmt.bind(id).first();
     return result;
   }
   ```

**Important Notes**:
- This is pseudocode structure - actual implementation requires refactoring `src/frontend/src/main.ts` to export an app factory function
- SSR in Workers has limitations - libraries like Leaflet (map) may not work server-side
- Consider rendering simplified HTML for SSR and hydrating on client

**Acceptance**:
- [ ] File created at `src/workers/lib/ssr.ts`
- [ ] Exports `renderSSR` function
- [ ] Returns HTML with meta tags and JSON-LD
- [ ] Handles different route types (home, artwork, artist, etc.)

---

## Task 14: Create Prerender Request Handler

**Objective**: Worker endpoint that serves SSR HTML or KV snapshots.

**Steps**:
1. Create file: `src/workers/lib/prerender.ts`

2. Implement request handler:
   ```typescript
   import { getSnapshot, saveSnapshot, canonicalize } from './kv-cache';
   import { renderSSR } from './ssr';
   
   export interface PrerenderEnv {
     PRERENDER_SNAPSHOTS: KVNamespace;
     PRERENDER_INDEX: KVNamespace;
     PRERENDER_JSONLD?: KVNamespace;
     DB: D1Database;
   }
   
   export async function handlePrerenderRequest(
     request: Request,
     env: PrerenderEnv
   ): Promise<Response> {
     const url = new URL(request.url);
     const canonical = canonicalize(url);
     
     // Step 1: Check if client sent ETag (for 304 responses)
     const ifNoneMatch = request.headers.get('if-none-match');
     
     // Step 2: Try to get snapshot from KV
     const snapshot = await getSnapshot(
       canonical,
       env.PRERENDER_INDEX,
       env.PRERENDER_SNAPSHOTS
     );
     
     // Step 3: If snapshot exists and ETag matches, return 304
     if (snapshot && ifNoneMatch === `"${snapshot.etag}"`) {
       return new Response(null, { 
         status: 304,
         headers: { 'etag': `"${snapshot.etag}"` },
       });
     }
     
     // Step 4: If snapshot exists, serve it
     if (snapshot) {
       return new Response(snapshot.html, {
         headers: {
           'content-type': 'text/html; charset=utf-8',
           'etag': `"${snapshot.etag}"`,
           'cache-control': 'public, max-age=3600',
           'x-prerender-source': 'kv',
         },
       });
     }
     
     // Step 5: No snapshot - render via SSR
     const { html, jsonld } = await renderSSR(canonical, request, env);
     
     // Step 6: Save snapshot to KV (async, don't block response)
     saveSnapshot(
       canonical,
       html,
       env.PRERENDER_INDEX,
       env.PRERENDER_SNAPSHOTS,
       env.PRERENDER_JSONLD,
       jsonld
     ).catch(err => {
       console.error('Failed to save snapshot:', err);
     });
     
     // Step 7: Return SSR HTML
     return new Response(html, {
       headers: {
         'content-type': 'text/html; charset=utf-8',
         'cache-control': 'public, max-age=3600',
         'x-prerender-source': 'ssr',
       },
     });
   }
   ```

**Acceptance**:
- [ ] File created at `src/workers/lib/prerender.ts`
- [ ] Exports `handlePrerenderRequest` function
- [ ] Returns 304 when ETag matches
- [ ] Serves KV snapshot when available
- [ ] Falls back to SSR when no snapshot exists
- [ ] Saves new snapshots to KV asynchronously

---

## Task 15: Integrate Prerender Handler into Worker

**Objective**: Route requests through prerender handler in main Worker.

**Steps**:
1. Open `src/workers/index.ts`

2. Add import:
   ```typescript
   import { handlePrerenderRequest } from './lib/prerender';
   ```

3. Add route handler before static asset serving:
   ```typescript
   // Pseudocode structure - adapt to existing router
   
   // For HTML requests to public routes, use prerender
   if (shouldPrerender(request)) {
     return handlePrerenderRequest(request, env);
   }
   
   // Helper function
   function shouldPrerender(request: Request): boolean {
     const url = new URL(request.url);
     const accept = request.headers.get('accept') || '';
     
     // Only prerender HTML requests
     if (!accept.includes('text/html')) {
       return false;
     }
     
     // Prerender these routes
     const prerenderRoutes = ['/', '/map', '/artwork/', '/artist/', '/pages/'];
     return prerenderRoutes.some(route => url.pathname.startsWith(route));
   }
   ```

**Acceptance**:
- [ ] Worker routes HTML requests through prerender handler
- [ ] Non-HTML requests (API, JSON) bypass prerender
- [ ] Static assets continue to serve normally

**Testing**:
```powershell
wrangler dev
# In browser, visit: http://localhost:8787/
# Check response headers for x-prerender-source
```

---

## Task 16: Add Cache Invalidation on Content Updates

**Objective**: Clear KV snapshots when artwork/artist data changes.

**Steps**:
1. Identify where content is modified:
   - Artwork approval endpoint
   - Artist creation/update endpoints
   - Photo upload/removal

2. Add invalidation function to `src/workers/lib/kv-cache.ts`:
   ```typescript
   export async function invalidateSnapshot(
     canonical: string,
     PRERENDER_INDEX: KVNamespace
   ): Promise<void> {
     // Delete index entry - this will force re-render on next request
     await PRERENDER_INDEX.delete(`prerender:index:${canonical}`);
   }
   ```

3. Call invalidation after content updates:
   ```typescript
   // Example: After artwork approval
   async function approveArtwork(artworkId: string, env: any) {
     // ... existing approval logic ...
     
     // Invalidate cache
     await invalidateSnapshot(
       `/artwork/${artworkId}`,
       env.PRERENDER_INDEX
     );
   }
   ```

**Acceptance**:
- [ ] `invalidateSnapshot` function added to `kv-cache.ts`
- [ ] Called after artwork approval
- [ ] Called after artist updates
- [ ] Called after photo changes

**Testing**:
```powershell
# Approve an artwork
# Visit artwork page - should see x-prerender-source: ssr (first time)
# Refresh - should see x-prerender-source: kv (cached)
# Update artwork
# Visit again - should see ssr (cache invalidated)
```

---

## Task 17: Create Basic Vitest Tests

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
- [ ] Test file created at `src/test/seo.meta.spec.ts`
- [ ] Tests verify title, description, OG tags, canonical for home and map
- [ ] Test verifies JSON-LD on artwork pages
- [ ] Tests pass when running `npm run test`

**Testing**:
```powershell
# Start worker
wrangler dev

# In another terminal, run tests
npm run test -- src/test/seo.meta.spec.ts
```

---

## Task 18: Update Other Key Views

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
- [ ] Artist pages show artist name in title
- [ ] Static pages (About, etc.) have descriptive titles
- [ ] Submit page has appropriate title
- [ ] All pages have canonical URLs

---

## Task 19: Test in Slack

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

**Troubleshooting**:
```
If preview doesn't appear:
1. Check og:image URL is absolute (starts with https://)
2. Verify image is publicly accessible
3. Use Slack's unfurl debugger: https://api.slack.com/docs/unfurling
4. Clear Slack's cache by editing message with new URL
```

---

## Task 20: Production Deployment

**Objective**: Deploy SSR and meta tag improvements to production.

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
- [ ] All tests pass
- [ ] Build completes with 0 errors
- [ ] Production site loads correctly
- [ ] Meta tags present on production
- [ ] Slack unfurls work with production URLs

**Final Verification Checklist**:
```
[ ] robots.txt accessible
[ ] Home page has complete meta tags
[ ] Artwork pages have dynamic titles
[ ] JSON-LD present on artwork pages
[ ] Open Graph images work in Slack
[ ] ETag headers present in responses
[ ] No JavaScript errors in console
[ ] Page load time acceptable (<3s)
```

---

## Maintenance and Monitoring

### Daily Tasks:
- None required - system runs automatically

### Weekly Tasks:
- Review KV storage usage in Cloudflare dashboard
- Check for failed snapshot saves in Worker logs

### When Adding New Routes:
1. Add metadata to `src/frontend/src/lib/seo-config.ts`
2. Call `useRouteMeta()` in view component
3. Update SSR renderer to handle new route type
4. Add test case to `src/test/seo.meta.spec.ts`

### When Content Schema Changes:
1. Update JSON-LD helper functions in `src/lib/meta.ts`
2. Update SSR `buildJSONLD()` function
3. Invalidate existing KV snapshots if needed

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

### KV snapshot not saving:
- Check Worker logs for errors
- Verify KV namespaces are bound in `wrangler.toml`
- Check snapshot size (must be <25MB)
- Ensure KV write permissions are correct

### SSR errors in Worker:
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
- **KV Usage**: <100MB storage for typical site
- **Worker CPU**: <50ms average for cached responses

**Next Steps After Completion**:
- Monitor search rankings over 2-4 weeks
- Submit sitemap to Google Search Console
- Request re-indexing for key pages
- Set up analytics to track organic traffic improvements
