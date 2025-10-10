# SEO Review - Cultural Archiver

## Snapshot
- The public site ships as a Vue single-page application (SPA) with the bare HTML shell defined in `src/frontend/index.html:4` and per-route titles set client-side in `src/frontend/src/router/index.ts:276`, so crawlers, social bots, and unfurlers receive minimal metadata.
- Static content such as legal pages and blog posts loads via client-side `fetch` calls (for example `src/frontend/src/views/PageDetailView.vue:77`), leaving no server-rendered fallback for bots.
- XML sitemap endpoints (`src/workers/index.ts:1159`) and implementation notes (`docs/sitemap.md:1`) already exist, providing a solid foundation once discoverability and page metadata improve.
- Several static pages and UI labels contain replacement characters caused by encoding issues (e.g. `src/frontend/src/views/HomeView.vue:46`, `src/frontend/public/pages/about.md:1`), harming readability and keyword signals.

## Highest-Impact Priorities
- Ship pre-rendered HTML (SSR or prerender) for primary routes (`/`, `/artwork/:id`, `/artists`, `/pages/:slug`) using the existing Cloudflare Worker so bots and social scrapers can see full content.
- Build a cohesive metadata layer: canonical URLs, meta descriptions, Open Graph/Twitter/Slack tags, and share images per entity.
- Clean and normalize copy to remove garbled characters, ensure one descriptive `<h1>` per route, and tighten internal linking for topic clusters.

Update summary: this document expands the original review with concrete implementation notes, JSON-LD examples, meta tag templates, oEmbed suggestions, OpenAPI/dataset readiness, testing/CI checks, and operational guidance for caching and R2 use. Use the "Phase" roadmap below to stage work.

## Technical SEO Foundation
- **SSR / Prerendering**: Use `@vue/server-renderer` or a static prerender step to emit HTML snapshots for crawlers. The Worker can detect known bot user agents or serve cached prerendered HTML stored in R2/KV. This ensures artwork titles, descriptions, and hero content are indexable.
  - Implementation options (tradeoffs):
    - Full SSR with `@vue/server-renderer` in the Worker
      - Pros: exact HTML for every request, dynamic meta injection, easy JSON-LD placement
      - Cons: more CPU at edge, increased complexity for incremental builds
    - Prerender at build time for top N routes + on-demand render
      - Pros: cheap to serve from R2 or KV, predictable performance
      - Cons: needs cache invalidation strategy and regeneration for new content
    - Hybrid: prerender high-traffic pages (home, top artists, top artworks), SSR others on-demand with cache
  - Bot detection: combine UA sniffing with the Accept header and a query param flag (e.g. ?prerender=1) for debugging. Prefer pre-warmed snapshot caches rather than long UA lists where possible.
- **Metadata injection**:
  - Introduce a head manager (e.g. `@vueuse/head`) so each view can declare descriptions, canonical tags, and structured data alongside route logic.
  - Persist meta tags server-side by rendering them into the HTML shell at build time or during Worker response composition.

  - Suggested meta contract (per entity):
    - title (string)
    - description (string, 120-160 chars for search; longer OK for social)
    - canonical (absolute URL)
    - og:title, og:description, og:image, og:type, og:locale, og:site_name
    - twitter:card (summary_large_image), twitter:site, twitter:creator
    - structuredData (JSON-LD object)
- **Canonical & robots**:
  - Add `link rel="canonical"` tags and `meta robots` directives where needed (e.g. pagination, modals) once canonical URLs are final.
  - Publish a `/robots.txt` from `src/frontend/public/robots.txt` pointing to `https://api.publicartregistry.com/sitemap.xml` and explicitly allowing API endpoints that power AI use cases.
- **Routing hygiene**:
  - Eliminate duplicate `name: 'Home'` and `'/'` routes that redirect to one another (see `src/frontend/src/router/index.ts:27` and `src/frontend/src/router/index.ts:225`) to avoid canonical confusion.
  - Ensure 404/500 static pages are reachable without JS so bots can discover the custom messaging.

  - Quick check list for routes:
    - Each public route returns a single, canonical URL.
    - Pagination uses rel=prev/rel=next and canonicalizes to page=1 for the root list.
    - Query parameters that don't change content (tracking, utm) are stripped from canonical tags.
- **Performance & CWV**:
  - Audit largest JS bundles (Map components are ~90 KB+) and use code splitting and `loading="lazy"` on below-the-fold images to keep LCP competitive.
  - Preload the primary font in the head, defer non-critical scripts, and consider serving a static map preview image for first paint before WebGL initializes.

## Headers, Copy, and On-Page Semantics
- Standardize headings so each route exposes one H1 with keyword-rich text derived from content (e.g. the artwork or artist name). Adjust duplicated H1 variants in `ArtworkDetailView.vue` to one heading element and use H2/H3 for subsections.
- Fix encoding issues by re-saving markdown and view templates in UTF-8 without BOM; the replacement characters visible in `HomeView.vue:46` and `about.md:1` currently risk keyword mismatches and poor UX.
- Expand descriptive text in hero sections, index pages, and filters to include target terms such as "public art map", "crowdsourced art archive", and "artwork photos" while keeping readability natural.
- Strengthen internal linking:
  - Add contextual links from blog/tutorial content into artwork, artist, and tag index pages.
  - Surface related content modules (e.g. "Nearby murals" on artwork detail views) to create hub-and-spoke clusters.
- Review component-level accessibility attributes:
  - Replace generic carousel alt text (`src/frontend/src/components/PhotoCarousel.vue:77`) with contextual strings (e.g. `${artworkTitle} - photo ${current} of ${total}`) pulled from artwork metadata.
  - Ensure buttons controlling navigation include `aria-label` values describing destinations, aiding both accessibility and screen-reader indexing.

## Schema.org & Structured Data
- **Site-wide JSON-LD**:
  - Inject `Organization`, `WebSite`, and `WebPage` schema with `SearchAction` support so Google can expose site links search boxes.
  - Declare social profiles and contact points within the `Organization` entity.
- **Entity-level schema**:
  - `VisualArtwork` objects for artwork detail pages including `name`, `creator` (Person/Organization), `locationCreated` (Place with lat/long), `subjectOf` (link to photo assets), `keywords`, and `inLanguage`.
  - `Person` (artists), `CreativeWorkSeries` or `ItemList` for collections and lists, and `BreadcrumbList` for detail pages.
  - Provide `DataCatalog` plus `Dataset` JSON-LD describing downloadable datasets or API endpoints to support AI consumption.
- Implement schema using the head manager or server render to ensure JSON-LD is present for first paint. Validate through Search Console's Rich Results tester before deploying.

  - Example JSON-LD snippets (replace placeholders):

    Basic Organization + WebSite:

    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://publicartregistry.com/#org",
          "name": "Public Art Registry",
          "url": "https://publicartregistry.com/",
          "logo": "https://publicartregistry.com/logo-pin-plinth.svg",
          "sameAs": ["https://twitter.com/yourhandle","https://www.facebook.com/yourpage"]
        },
        {
          "@type": "WebSite",
          "@id": "https://publicartregistry.com/#website",
          "url": "https://publicartregistry.com/",
          "name": "Public Art Registry",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://publicartregistry.com/search?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }
      ]
    }

    VisualArtwork example for an artwork detail page:

    {
      "@context": "https://schema.org",
      "@type": "VisualArtwork",
      "name": "{{title}}",
      "url": "{{canonical}}",
      "creator": {
        "@type": "Person",
        "name": "{{artistName}}",
        "url": "{{artistUrl}}"
      },
      "image": ["{{image1}}","{{image2}}"],
      "locationCreated": {
        "@type": "Place",
        "name": "{{city}}",
        "geo": { "@type": "GeoCoordinates", "latitude": {{lat}}, "longitude": {{lon}} }
      },
      "keywords": [{{keywords}}],
      "description": "{{shortDescription}}"
    }

## Social, Slack, and Facebook Previews
- Create a reusable metadata module that outputs Open Graph, Twitter Card, LinkedIn, and Slack-friendly tags:
  - `og:title`, `og:description`, `og:url`, `og:image`, `twitter:card`, `twitter:creator`, plus `og:locale` and `og:site_name`.
  - For Slack unfurls, ensure `og:` tags include HTTPS image URLs around 1200x630 and add `og:type=article` for static pages or `og:type=place`/`profile` for entities.
- Generate dynamic share images (Cloudflare Worker or edge function) using artwork/artist data, stored in R2 or generated on-demand with Satori/Resvg.
- For Facebook embeds, add `fb:app_id` and `facebook-domain-verification` metas once the app is registered, enabling accurate Insights reporting.
- Offer an `oembed.json` endpoint served from the Worker for Slack, Discord, and WordPress compatibility; include captions, author info, and fallback thumbnails.
- Add share buttons that expose copied URLs with query parameters sanitized and canonicalized.

  - oEmbed endpoint best practice:
    - Host at `/oembed.json?url={pageUrl}` and return provider JSON with keys `version`, `type` (photo/rich/article), `provider_name`, `provider_url`, `title`, `author_name`, `html` (for rich embeds), `thumbnail_url`, `thumbnail_width`, `thumbnail_height`, `width`, `height`.
    - Cache responses in R2 and include cache-control headers with an appropriate TTL and an ETag for invalidation.

  - Slack unfurls and preview sizing:
    - Use images around 1200x628 (OG recommended 1.91:1). Provide multiple sizes and an `og:image:alt` describing the image.
    - For Slack/Discord small thumbnails, provide 400x210 and 160x84 fallbacks.

  - Facebook specifics:
    - Ensure the `og:image` is reachable via HTTPS and supports HEAD requests. Facebook prefers images at least 200x200 but will crop to 1200x630 for large previews.
    - Include `og:type` (`article` for pages, `website` for index, `profile` for artists) and `article:published_time` / `article:modified_time` when available.

## AI & Data Distribution Readiness
- The API documentation (`docs/api.md:1`) is extensive but lacks a formal machine-readable spec. Publish an OpenAPI 3.1 definition, host it at `/openapi.json`, and register it with discoverability services (Postman, RapidAPI) to help AI agents integrate.
- Package clean data exports (nightly snapshots) in multiple formats: GeoJSON, CSV, Parquet, and NDJSON to cover GIS, ML, and LLM ingestion needs. List them on a `Data` page with clear licensing.
- Expose embeddings-friendly endpoints:
  - Provide concise textual summaries (title, artist, year, medium, description) in a `/api/artworks/:id/summary` endpoint for retrieval systems.
  - Offer bulk download of text corpora (for example zipped JSON) with consistent field names to bootstrap knowledge bases.
- Add `robots` allowances and rate-limit guidance specifically for AI crawlers, and document usage in `docs/api.md`.
- Consider publishing key datasets to external hubs (Hugging Face, data.gov) with backlinks pointing to the site to strengthen authority.

  - OpenAPI & machine-readable API
    - Create an OpenAPI 3.1 `openapi.json` that includes endpoints for artwork, artists, search, and bulk exports. Include schema examples and rate limit headers.
    - Add an `x-catalog-version` field and `last-modified` header to dataset endpoints so consumers can detect updates.

  - Summary endpoint contract (suggested):
    - GET /api/artworks/{id}/summary -> 200
      - response content-type: application/json
      - body: { id, title, artist: {id,name,url}, year, medium, description, lat, lon, tags: [], photos: [{url, width, height}], canonical }

  - Bulk exports
    - Provide a `GET /data/exports/latest` landing page with links to GeoJSON (feature collection), CSV, Parquet, and NDJSON. Include a `manifest.json` with SHA256 checksums, row counts, and record schema.
    - Recommend partitioning exports by country/city for large data sets to minimize download size and support range retrieval.

## File Formats & Media Management
- Normalize media metadata:
  - Preserve and expose EXIF data where licensing permits; include capture dates and camera info for authenticity.
  - Provide WebP/AVIF derivatives alongside JPEG for faster delivery, declared via `srcset`.
- Organize downloadable packs:
  - Artwork catalogs by city or region in CSV.
  - Geospatial collections in GeoJSON or KML for map integrations.
  - Image bundles with an `images.txt` manifest plus metadata CSV for researchers.
- Document checksum and versioning practices so downstream consumers can automate updates.

  - Image delivery rules:
    - Store originals in R2. Produce derivatives (webp, avif, jpeg) at widths: 320, 480, 768, 1024, 1600, 2400. Serve with `srcset` and `sizes` attributes.
    - Provide an `image-metadata` JSON per photo with EXIF (date taken, camera make/model), dominant color for placeholders, and an aspect ratio to avoid layout shift.
    - For share images (OG), render 1200x630 and 800x418 and store both. Use Cloudflare Images or Worker-generated images for on-demand personalization.

  - Media metadata example (photo JSON):
    {
      "id": "uuid",
      "original": "https://photos.publicartregistry.com/r2/object.jpg",
      "derivatives": {"webp": "...", "avif": "..."},
      "width": 4000,
      "height": 3000,
      "aspect": 1.3333,
      "exif": {"DateTimeOriginal":"2021-04-01T12:34:56","Make":"Canon","Model":"EOS 80D"},
      "dominant_color": "#aabbcc"
    }

## Implementation Roadmap
- **Phase 0 (Quick fixes)**: Add robots.txt, fix encoding problems, inject interim static meta descriptions, and define canonical tags for top routes.
- **Phase 1 (Rendering and metadata)**: Implement head management, server-side rendering or prerendering, and dynamic OG/Twitter meta output. Launch structured data for Organization and VisualArtwork.
- **Phase 2 (Data and social expansion)**: Publish an OpenAPI spec, dataset downloads, and Slack/Facebook integrations (share images plus oEmbed). Add list/listing schema and breadcrumb markup.
- **Phase 3 (AI excellence)**: Release embeddings-ready summaries, integrate with knowledge bases, and automate dataset versioning pipelines with announcements via sitemap or newsfeed.

Added acceptance criteria and CI checks:

Phase 0 acceptance criteria:
  - `public/robots.txt` present and references `https://api.publicartregistry.com/sitemap.xml`.
  - All `.md` files and Vue templates re-saved in UTF-8; a lint job verifies no replacement characters.
  - Top 10 routes have server-visible `<title>` and `<meta name="description">` when fetched without JavaScript.

Phase 1 acceptance criteria:
  - Automated tests (Vitest) assert presence of `og:title`, `og:description`, `og:image`, `link rel=canonical`, and JSON-LD for sample pages.
  - Prerendered snapshots exist for the home page and top 20 artworks and are served by the Worker to known crawlers.

Phase 2 acceptance criteria:
  - `/openapi.json` is reachable and passes basic validation (swagger-cli or similar).
  - `/oembed.json` returns valid responses for sample pages and Slack unfurls show correct thumbnails.
  - Dataset manifest available with checksums and sample files downloadable.

Phase 3 acceptance criteria:
  - `/api/artworks/{id}/summary` returns stable compact summaries for 1000 sample records; embedding consumers can download a sample bundle.
  - Automated sitemap updates include dataset release notifications.

CI / Test checklist (suggested):
  - Add a Vitest file `src/test/seo.meta.spec.ts` that fetches server responses for routes and asserts meta tags and JSON-LD exist.
  - Add a lightweight script in `scripts/check-meta.js` that can run during CI to curl the Worker endpoint and fail if required tags are missing.
  - Lint checks: `npm run lint:content` that scans `.md` and `.vue` files for non-UTF8 replacement characters and fails CI on detection.

## Development Plan By Phase

### Phase 0 (Quick fixes)
- **Goal**: Establish crawlability basics and clean content so metadata work in later phases has a solid base.
- **Workstreams**:
  - Produce and deploy `public/robots.txt` with sitemap pointer and API allowances.
  - Normalize encoding in `src/frontend/src/views`, `src/frontend/public/pages`, and copy libraries; add lint check to prevent regressions.
  - Draft meta descriptions and canonical URLs for priority routes, storing copy in a shared content file.
- **Owner**: Frontend squad with support from content editor.
- **Dependencies**: Access to production Cloudflare Worker config; confirmation of preferred canonical URL formats from product.
- **Exit criteria**: Robots.txt live, top routes show clean titles/descriptions in lighthouse audit, zero replacement characters in content lint report.

### Phase 1 (Rendering and metadata)
- **Goal**: Deliver indexable HTML and consistent metadata for all public routes.
- **Workstreams**:
  - Evaluate SSR versus prerender path; spike both and document trade-offs for the Worker deployment.
  - Integrate `@vueuse/head` (or alternative) and add meta descriptors, canonical tags, and structured data generation within views.
  - Extend deployment pipeline to render/prerender HTML snapshots and cache them via Worker KV or R2.
  - Add automated tests to verify presence of required meta tags per route.
- **Owner**: Frontend squad partnering with platform/infra engineer for Worker changes.
- **Dependencies**: Build pipeline updates, storage for prerender caches, design approval for fallback HTML.
- **Exit criteria**: Search Console renders primary pages without JS warnings, automated tests pass for metadata, Lighthouse reports populated Open Graph tags.

### Phase 2 (Data and social expansion)
- **Goal**: Turn the site into a shareable and developer-friendly resource with rich previews and open datasets.
- **Workstreams**:
  - Author and publish OpenAPI 3.1 spec, generate docs, and expose `/openapi.json`.
  - Stand up nightly dataset exporters (GeoJSON, CSV, Parquet, NDJSON) with download landing page.
  - Build social preview service (share image generation, oEmbed endpoint) integrated with metadata layer.
  - Roll out additional schema (`BreadcrumbList`, `ItemList`, artist `Person`) and validate via Search Console.
- **Owner**: Platform team with data engineer and design support for share image templates.
- **Dependencies**: Stable data models, storage bucket for dataset exports, design assets for share images.
- **Exit criteria**: OpenAPI spec publicly reachable, datasets downloadable and versioned, Slack/Twitter/Facebook unfurls show branded cards, structured data tests pass.

### Phase 3 (AI excellence)
- **Goal**: Make Cultural Archiver a premium data source for AI ecosystems and external knowledge bases.
- **Workstreams**:
  - Implement `/api/artworks/:id/summary` and bulk summary endpoints optimized for embeddings.
  - Automate dataset versioning, checksums, and changelogs; syndicate updates to data hubs (Hugging Face, data.gov).
  - Publish guidance for AI agents (rate limits, attribution) and monitor usage analytics.
  - Explore partnerships for integration with conversational platforms and digital assistants.
- **Owner**: Platform and partnerships group collaborating with analytics engineer.
- **Dependencies**: Stable summarization schema, legal review for distribution terms, analytics tooling.
- **Exit criteria**: Summaries live with documented schema, external hubs listing datasets with backlinks, AI usage guide published, monitoring dashboards tracking agent traffic.

## Recommended Next Steps
- Audit and rewrite hero copy, FAQs, and tutorials to remove artifacts and align with target keywords.
- Prioritize SSR or prerender spikes for Map, Artwork Detail, Artist Detail, and Page Detail routes, measuring success via Search Console coverage.
- Prototype JSON-LD for one artwork and validate rich result eligibility before scaling to the entire catalog.
- Stand up automated tests ensuring each route renders the required meta tags and schema to prevent regressions.

Next tactical actions (first dev sprint):
 1. Add `public/robots.txt` and ensure `sitemap.xml` reference is `https://api.publicartregistry.com/sitemap.xml`.
 2. Add `@vueuse/head` and create a small meta helper module `src/frontend/src/lib/meta.ts` to centralize tags. (This is low-risk and reversible.)
 3. Implement a prerender pipeline for top 20 artworks: build snapshots into `dist/prerender/` and add Worker logic to serve from R2.
 4. Add `src/test/seo.meta.spec.ts` Vitest tests for 6 canonical routes.

If you'd like, I can implement Phase 0 changes now (create `public/robots.txt`, add a meta helper template, and add the Vitest test scaffold). Tell me which of the four tactical actions you want me to start with and I'll execute it.

## KV-based prerendering plan (appended per choices)

Summary of your selections (questions 1-8):
- 1: KV for prerendered snapshots and metadata (A)
- 2: Per-request SSR with no KV caching (D)
- 3: Write-through invalidation on content change (A)
- 4: Deterministic human-readable keys with version suffix (A)
- 5: Compress HTML before KV write and reference large assets from R2/CDN (A)
- 6: Always serve prerender snapshots to everyone (B)
- 7: Include full JSON-LD and meta tags inside KV snapshot and store JSON-LD separately as KV entry (A)
- 8: CI checks + periodic KV health job (A)

Notes on apparent tradeoffs / reconciliation
- You chose KV as the authoritative store (Q1) but also chose per-request SSR with no KV caching (Q2). These can coexist: generate SSR output per-request (to guarantee freshness) and use KV primarily for metadata, pointers, and optional snapshot copies for debugging/history. If you later want to reduce CPU at the edge, the same KV layout supports switching to snapshot-serving with minimal changes.
- You also chose to always serve prerender snapshots to everyone (Q6:B). If the Worker is always doing SSR per-request, serving snapshots to everyone implies you will perform SSR on every request and return the generated HTML. This is the most accurate but most expensive approach. The plan below provides an easy switch to serve stored KV snapshots to reduce load later.

Concrete implementation plan

1) KV namespaces and data model
- KV namespaces:
  - `PRERENDER_SNAPSHOTS` — keyed snapshot HTML and small metadata (compressed)
  - `PRERENDER_INDEX` — mapping from canonical URL -> latest version key and metadata (ETag, contentHash, generatedAt)
  - Optionally: `PRERENDER_JSONLD` — JSON-LD blobs for quick API/monitoring access

- Key naming (Q4:A):
  - Snapshot key: `prerender:/artwork/{id}:v{contentHash}`
  - Index key: `prerender:index:/artwork/{id}` -> JSON: { latest: "prerender:/artwork/{id}:v{contentHash}", generatedAt, etag }
  - JSON-LD key: `prerender:jsonld:/artwork/{id}:v{contentHash}`

2) Generation & write-through invalidation (Q3:A)
- On content change (authoring UI, migration, import pipeline):
  - Recompute contentHash (for example SHA256 of canonical fields: title+body+photos+updated_at).
  - Generate SSR HTML (server-renderer) and compressed payload (gzip or brotli).
  - PUT compressed HTML to `PRERENDER_SNAPSHOTS` under versioned key; also PUT JSON-LD into `PRERENDER_JSONLD`.
  - Update `PRERENDER_INDEX` mapping for the canonical URL to point to the new versioned key.
  - Optionally: send a purge event to CDN if you're fronting with a CDN layer.

3) Request-time Worker flow (honoring Q2:D & Q6:B)
- Because you chose per-request SSR with no KV caching as default, the Worker will: always generate SSR HTML for incoming requests and return it. However, to support the "always serve prerender snapshots to everyone" choice while keeping options to evolve, implement the Worker to first check `PRERENDER_INDEX` and optionally serve the stored snapshot when a specific feature flag is set. Concrete flow:

  pseudo-Worker (TypeScript-like):

  async function handleRequest(req) {
    const url = new URL(req.url);
    const canonical = canonicalize(url);

    // Look up index record (fast KV read)
    const index = await PRERENDER_INDEX.get(`prerender:index:${canonical}`, { type: 'json' });

    // If a runtime config flag 'FORCE_SNAPSHOT' is true, serve KV snapshot when available.
    if (index && getRuntimeFlag('FORCE_SNAPSHOT')) {
      const snapKey = index.latest;
      const compressed = await PRERENDER_SNAPSHOTS.get(snapKey, { type: 'arrayBuffer' });
      if (compressed) {
        // Return compressed HTML with appropriate headers
        return new Response(decompress(compressed), {
          headers: { 'content-type': 'text/html; charset=utf-8', 'x-prerender-key': snapKey }
        });
      }
    }

    // Default: per-request SSR generation (expensive but fresh)
    const ssrHtml = await renderVueToStringForUrl(canonical);
    // Optionally compress and write to KV for diagnostics/history, but do NOT rely on it for reads.
    const contentHash = hashContent(ssrHtml);
    const versionedKey = `prerender:${canonical}:v${contentHash}`;
    const compressed = compress(ssrHtml);
    // Fire-and-forget write to KV (non-blocking if you want)
    PRERENDER_SNAPSHOTS.put(versionedKey, compressed, { expirationTtl: 60 * 60 * 24 * 7 }).catch(err => {
      // log error but don't block response
      console.warn('KV write failed', err);
    });

    // Update index mapping to point to latest version (write-through invalidation pattern)
    PRERENDER_INDEX.put(`prerender:index:${canonical}`, JSON.stringify({ latest: versionedKey, generatedAt: Date.now(), etag: contentHash })).catch(() => {});

    return new Response(ssrHtml, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

Notes:
- The worker default above implements per-request SSR as you requested (Q2:D). The KV writes are optional, asynchronous, and help with debugging, point-in-time snapshots, and make it simple to flip to serving stored KV snapshots later.

4) Compression and large assets (Q5:A)
- Compress HTML payloads (brotli preferred, gzip fallback) before writing to KV. Store a small metadata JSON with the snapshot describing compression, contentHash, generatedAt, size, and referenced large assets.
- Do NOT inline large images or binaries into KV. Reference them by canonical R2 URLs or CDN URLs.

5) Serving strategy (Q6:B) and progressive rollout
- You asked to always serve prerender snapshots to everyone (Q6:B). The Worker supports this via the runtime flag `FORCE_SNAPSHOT`. To avoid sudden performance/cost surprises:
  - Start with per-request SSR (current default) and a short monitoring window.
  - If desired, flip `FORCE_SNAPSHOT=true` for a canary zone or a subset of origins. When flipped globally, the Worker will serve stored snapshots from KV (if available) instead of always regenerating.

6) JSON-LD and metadata (Q7:A)
- Include full JSON-LD and meta tags inside the rendered HTML that is written to KV so first-paint for crawlers contains structured data.
- Also write the JSON-LD to `PRERENDER_JSONLD` so tests and API consumers can fetch the structured data quickly without parsing HTML.

7) Monitoring and CI (Q8:A)
- Tests to add to CI:
  - A Vitest job that fetches sample canonical URLs and asserts 200, presence of `<title>`, `<meta name="description">`, `og:` tags, and JSON-LD script present in the HTML returned by the Worker.
  - A periodic job (cron) that reads the KV index size and number of keys, alerts if storage grows beyond thresholds, and validates the latest `N` snapshots decompress correctly and contain required meta.
  - A smoke test that generates an SSR HTML for a random recent content update and verifies that write-through invalidation updated the `PRERENDER_INDEX` record.

Operational notes and fallback
- KV has per-key size limits (currently 25 MB). Keep snapshots small by stripping heavy inline assets and referencing R2/CDN for images.
- Use chunked storage patterns only if you must store extremely large outputs (avoid if possible).
- Maintain a small TTL or retention policy (via metadata and cron) to prune older snapshot versions and reduce KV bill.

Acceptance checklist (KV variant)
- The Worker returns valid HTML for sample routes in a no-JS fetch.
- The `PRERENDER_INDEX` provides a stable mapping from canonical URL to the latest snapshot key.
- JSON-LD is present in the snapshot HTML and as a JSON blob in `PRERENDER_JSONLD`.
- CI tests verify snapshot integrity and meta presence.

---
If this matches what you want, I can append these KV details into a small implementation checklist in the repo (scripts to generate snapshots, a Worker code scaffold to read/write KV, and a Vitest test file). Tell me which of the following you'd like me to do next and I'll start it immediately:
A) Create `public/robots.txt` + add a lightweight Worker scaffold `src/workers/prerender.ts` that implements the flow above (non-blocking KV writes).
B) Add a Vitest test `src/test/seo.prerender.spec.ts` that asserts meta & JSON-LD for 6 sample pages using the Worker endpoint.
C) Add a small script `scripts/generate-prerender.ts` that can be used by the import pipeline to perform write-through invalidation and push snapshots to KV.
D) Implement `src/frontend/src/lib/meta.ts` helpers and examples for injecting JSON-LD and OG tags into views.

## Operational choices (questions 9–16) — user's selections and implications

You answered the operational questions with the following choices. Below each answer I note consequences and recommended mitigations (where applicable).

1. Question 9 — KV consistency & read-after-write (chosen: B)

- Choice: Assume KV is strongly consistent and rely on index reads everywhere.

- Implication: Cloudflare Workers KV is actually eventually consistent for writes in many regions. Assuming strong consistency can cause hard-to-diagnose stale-read issues shortly after writes. Because you selected this option, important to note the real-world behavior and add small mitigations:

  - Mitigation: For authoring flows that require read-after-write guarantees, perform a direct read of the versioned snapshot key immediately after writing, or read from the origin component that generated the content. Avoid relying solely on index reads immediately after an update.
  - If you still prefer the simplicity of index reads everywhere, consider adding a brief retry/backoff in the authoring UI for verification reads.

2. Question 10 — Snapshot retention / pruning policy (chosen: C)

- Choice: Only keep the single latest snapshot per URL.

- Implication: This keeps KV storage small and simple. It removes historical snapshots for rollback/debugging. Combined with write-through invalidation this is cheap and predictable.

  - Mitigation: If you later need history for audits, add an optional archival path to R2 for longer-term snapshots before cleaning KV.

3. Question 11 — Handling pages that exceed KV size limits (chosen: D)

- Choice: Fail prerender generation for too-large pages and fall back to per-request SSR.

- Implication: This is straightforward: if the generator detects the compressed snapshot exceeds KV limits, it will skip the KV write and return the SSR response. You lose a stored snapshot but keep availability.

  - Recommendation: Log these events and consider storing a compact pointer/manifest in KV that indicates the page is served via SSR and why (size, candidate assets). Optionally schedule a job to attempt a trimmed snapshot or store the full snapshot in R2 if needed.

4. Question 12 — ETag and conditional GET handling (chosen: A)

- Choice: Include an ETag header derived from contentHash and support If-None-Match to return 304 responses.

- Implication: This is best practice for crawlers and reduces bandwidth. Ensure the Worker sets `ETag` consistently and that `PRERENDER_INDEX` stores the same contentHash for quick comparison.

5. Question 13 — Security for KV writes (chosen: B)

- Choice: Allow internal network-only writes without additional signing (assumes infra isolation).

- Implication: Simpler to implement, but relies heavily on network-level controls. If your CI/CD or authoring services are within a trusted network, this may be acceptable. However, it is less secure than signed service tokens.

  - Mitigation: Limit exposure by:

    - Only accepting writes from internal IPs/subnets or private VPC-connected runners.
    - Logging and auditing all writes to KV, with alerts on unusual patterns.
    - Using short-lived tokens or ephemeral SSH tunnels for any ad-hoc external write processes.

6. Question 14 — Canary / progressive rollout strategy (chosen: B)

- Choice: Enable globally in one deploy (fast but risky).

- Implication: This is the fastest path but increases risk; if snapshots are missing or malformed in KV, global traffic can be affected.

  - Recommendation: Even if you plan to enable globally, add at least one quick smoke test immediately post-deploy to validate snapshots are served and that the Worker still returns expected meta tags. Consider at minimum a staged rollout for the first production-enabled release.

7. Question 15 — KV snapshot health and storage metrics (chosen: D)

- Choice: No monitoring initially; add if/when issues appear.

- Implication: This keeps initial work minimal but is risky—issues will be detected only after user reports or crawler problems appear.

  - Strong suggestion: Add lightweight monitoring even if minimal: a cron that checks `PRERENDER_INDEX` size and a tiny smoke test to fetch a handful of important routes. These can be simple scripts that run once per day and email or Slack on failures. It prevents major outages and is small dev effort.

8. Question 16 — Developer ergonomics (chosen: C)

- Choice: Only support ad-hoc dev-time SSR rendering (no snapshot writes) — simpler but less accurate.

- Implication: Developers can render previews locally quickly but cannot reproduce exact KV-snapshot-serving behavior without writing to a staging KV. This reduces risk of accidental writes to production KV but can obscure how the Worker will behave when serving stored snapshots.

  - Recommendation: Add a small optional local mode during development that can write to a staging KV namespace or write to a local file for inspection. That keeps your chosen policy (no prod writes from dev) while improving debugability.

---

Append action: based on your answers I will not change the previous KV plan structural choices (namespaces, versioned keys, write-through invalidation, compression, ETag handling). I will append these operational decisions to the `tasks/seo.md` file (this section) so the team and future contributors can see the exact chosen behavior and the mitigations we recommend.

Would you like me to now:

- A) Append a short Worker scaffold in `src/workers/prerender.ts` that implements the chosen semantics (per-request SSR by default, falls back to KV-write failures, sets ETag, no write signing).
- B) Create a minimal cron monitoring script `scripts/check-prerender-kv.js` even though you opted for no monitoring, as a recommended safety net (you can disable it later).
- C) Add the Vitest test scaffold `src/test/seo.prerender.spec.ts` to assert ETag behavior and verify the fallback-to-SSR for oversized pages.
- D) Do nothing further and leave `tasks/seo.md` as-is (you can request changes later).

With these improvements, Cultural Archiver can become both highly discoverable in traditional search and a dependable data source for AI assistants, social platforms, and integrators.

---

## Developer Implementation Plan

This section provides concrete, step-by-step implementation guidance for developers working on SEO improvements. Each phase includes specific files to create/modify, code examples, testing steps, and acceptance criteria.

### Phase 0: Quick Fixes (1-2 days)

**Objective**: Establish crawlability basics and clean content for metadata work.

#### Task 0.1: Create robots.txt

**Files to create**:

- `src/frontend/public/robots.txt`

**Implementation**:

```txt
# Public Art Registry - Robots.txt
User-agent: *
Allow: /
Allow: /api/
Disallow: /admin
Disallow: /review

# Sitemap
Sitemap: https://api.publicartregistry.com/sitemap.xml

# AI Crawlers - specific guidance
User-agent: GPTBot
Allow: /
Allow: /api/

User-agent: Claude-Web
Allow: /
Allow: /api/

# Crawl-delay for polite bots
Crawl-delay: 1
```

**Testing**:

```powershell
# Verify robots.txt is accessible
curl https://publicartregistry.com/robots.txt
```

**Acceptance**: `robots.txt` is deployed and references sitemap; returns 200 status.

#### Task 0.2: Fix encoding issues

**Files to audit and fix**:

- `src/frontend/src/views/HomeView.vue`
- `src/frontend/public/pages/about.md`
- All `.md` files in `src/frontend/public/pages/`

**Implementation steps**:

1. Open each file in VS Code
2. Check encoding (bottom-right status bar)
3. If not "UTF-8", click and select "Save with Encoding" → "UTF-8"
4. Search for replacement characters: `�`, `â€™`, `â€"`, etc.
5. Replace with correct characters: `'`, `—`, etc.

**Add lint check** - create `scripts/check-encoding.js`:

```javascript
#!/usr/bin/env node
const fs = require('fs');
const glob = require('glob');

const replacementChars = /[�]|â€™|â€"|â€¢/g;
const files = glob.sync('{src/frontend/src/**/*.vue,src/frontend/public/pages/**/*.md}');

let hasErrors = false;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  if (replacementChars.test(content)) {
    console.error(`❌ Encoding issue in ${file}`);
    hasErrors = true;
  }
});

if (hasErrors) {
  process.exit(1);
} else {
  console.log('✅ All files have correct encoding');
}
```

**Add to `package.json`**:

```json
"scripts": {
  "lint:encoding": "node scripts/check-encoding.js"
}
```

**Testing**:

```powershell
npm run lint:encoding
```

**Acceptance**: Zero replacement characters in all `.md` and `.vue` files; lint check passes in CI.

#### Task 0.3: Add canonical URLs and meta descriptions

**Files to modify**:

- `src/frontend/src/router/index.ts` - add meta fields
- Create `src/frontend/src/lib/seo-config.ts` - centralized SEO content

**Implementation** - `src/frontend/src/lib/seo-config.ts`:

```typescript
export interface RouteMetadata {
  title: string;
  description: string;
  canonical: string;
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
    description: 'Browse public art on an interactive map. Filter by artist, location, medium, and tags to discover nearby murals and sculptures.',
    canonical: 'https://publicartregistry.com/map',
    ogType: 'website',
  },
  // Add more routes as needed
};

export function getMetaForRoute(routeName: string, params?: Record<string, string>): RouteMetadata {
  return routeMetadata[routeName] || {
    title: 'Public Art Registry',
    description: 'Discover and document public art around the world.',
    canonical: 'https://publicartregistry.com/',
  };
}
```

**Testing**: Verify meta tags appear in browser dev tools for top 10 routes.

**Acceptance**: Top 10 routes have unique titles and descriptions defined; canonical URLs match production domain.

---

### Phase 1: Rendering and Metadata (1-2 weeks)

**Objective**: Deliver indexable HTML with structured data for all public routes.

#### Task 1.1: Install and configure head manager

**Dependencies to install**:

```powershell
npm install @vueuse/head
```

**Files to modify**:

- `src/frontend/src/main.ts` - initialize head manager
- Create `src/frontend/src/lib/meta.ts` - meta tag helper

**Implementation** - `src/frontend/src/main.ts`:

```typescript
import { createHead } from '@vueuse/head';

const app = createApp(App);
const head = createHead();

app.use(router);
app.use(pinia);
app.use(head);
app.mount('#app');
```

**Implementation** - `src/frontend/src/lib/meta.ts`:

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
      { name: 'description', content: metadata.description },
      { property: 'og:title', content: metadata.title },
      { property: 'og:description', content: metadata.description },
      { property: 'og:url', content: metadata.canonical },
      { property: 'og:type', content: metadata.ogType || 'website' },
      { property: 'og:site_name', content: 'Public Art Registry' },
      { property: 'og:locale', content: 'en_US' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: metadata.title },
      { name: 'twitter:description', content: metadata.description },
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

// Helper to generate VisualArtwork schema
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
    creator: artwork.artistName ? {
      '@type': 'Person',
      name: artwork.artistName,
      url: artwork.artistUrl || undefined,
    } : undefined,
    image: artwork.images,
    locationCreated: {
      '@type': 'Place',
      name: artwork.city || 'Unknown',
      geo: {
        '@type': 'GeoCoordinates',
        latitude: artwork.lat,
        longitude: artwork.lon,
      },
    },
    keywords: artwork.tags,
    description: artwork.description || artwork.title,
  };
}
```

**Usage example** - update `src/frontend/src/views/ArtworkDetailView.vue`:

```typescript
import { useRouteMeta, createArtworkSchema } from '@/lib/meta';
import { getMetaForRoute } from '@/lib/seo-config';

// In setup():
const artwork = computed(() => artworkStore.currentArtwork);

watchEffect(() => {
  if (artwork.value) {
    const meta = {
      title: `${artwork.value.title} - Public Art Registry`,
      description: `${artwork.value.title} by ${artwork.value.artist_name || 'Unknown Artist'}. ${artwork.value.description || ''}`.substring(0, 160),
      canonical: `https://publicartregistry.com/artwork/${artwork.value.id}`,
      ogType: 'article',
    };
    
    const schema = createArtworkSchema({
      id: artwork.value.id,
      title: artwork.value.title,
      artistName: artwork.value.artist_name,
      images: artwork.value.photos.map(p => p.url),
      lat: artwork.value.lat,
      lon: artwork.value.lon,
      city: artwork.value.city,
      tags: artwork.value.tags,
      description: artwork.value.description,
    });
    
    useRouteMeta(meta, schema);
  }
});
```

**Testing**:

```powershell
# Run dev server
npm run dev

# Check meta tags in browser console:
# document.querySelector('meta[property="og:title"]').content
# document.querySelector('script[type="application/ld+json"]').textContent
```

**Acceptance**: All primary views use `useRouteMeta`; JSON-LD validates in Google Rich Results Test.

#### Task 1.2: Implement KV-based prerendering

**Files to create**:

- `src/workers/lib/prerender.ts` - prerender logic
- `src/workers/lib/kv-cache.ts` - KV helpers
- `src/workers/routes/prerender.ts` - prerender endpoints

**Wrangler configuration** - update `src/workers/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "PRERENDER_SNAPSHOTS"
id = "your-snapshots-kv-id"

[[kv_namespaces]]
binding = "PRERENDER_INDEX"
id = "your-index-kv-id"

[[kv_namespaces]]
binding = "PRERENDER_JSONLD"
id = "your-jsonld-kv-id"
```

**Implementation** - `src/workers/lib/kv-cache.ts`:

```typescript
import { createHash } from 'crypto';

export interface SnapshotMetadata {
  latest: string;
  generatedAt: number;
  etag: string;
  size?: number;
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

export function canonicalize(url: URL): string {
  // Remove tracking params
  const cleanUrl = new URL(url);
  ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'].forEach(param => {
    cleanUrl.searchParams.delete(param);
  });
  return cleanUrl.pathname;
}

export async function getSnapshot(
  canonical: string,
  PRERENDER_INDEX: KVNamespace,
  PRERENDER_SNAPSHOTS: KVNamespace
): Promise<{ html: string; etag: string } | null> {
  const indexKey = `prerender:index:${canonical}`;
  const metadata = await PRERENDER_INDEX.get<SnapshotMetadata>(indexKey, { type: 'json' });
  
  if (!metadata?.latest) return null;
  
  const compressed = await PRERENDER_SNAPSHOTS.get(metadata.latest, { type: 'arrayBuffer' });
  if (!compressed) return null;
  
  // Decompress (assuming gzip)
  const decompressed = new TextDecoder().decode(
    // Use DecompressionStream if available in Workers
    new Uint8Array(compressed)
  );
  
  return {
    html: decompressed,
    etag: metadata.etag,
  };
}

export async function saveSnapshot(
  canonical: string,
  html: string,
  PRERENDER_INDEX: KVNamespace,
  PRERENDER_SNAPSHOTS: KVNamespace,
  PRERENDER_JSONLD?: KVNamespace,
  jsonld?: object
): Promise<void> {
  const contentHash = hashContent(html);
  const versionedKey = `prerender:${canonical}:v${contentHash}`;
  
  // Compress HTML (simplified - use proper compression in production)
  const compressed = new TextEncoder().encode(html);
  
  // Check size limit (25MB for KV)
  if (compressed.byteLength > 25 * 1024 * 1024) {
    console.warn(`Snapshot too large for KV: ${canonical} (${compressed.byteLength} bytes)`);
    return;
  }
  
  // Save snapshot
  await PRERENDER_SNAPSHOTS.put(versionedKey, compressed, {
    expirationTtl: 60 * 60 * 24 * 7, // 7 days
  });
  
  // Update index
  const metadata: SnapshotMetadata = {
    latest: versionedKey,
    generatedAt: Date.now(),
    etag: contentHash,
    size: compressed.byteLength,
  };
  
  await PRERENDER_INDEX.put(`prerender:index:${canonical}`, JSON.stringify(metadata));
  
  // Optionally save JSON-LD
  if (PRERENDER_JSONLD && jsonld) {
    await PRERENDER_JSONLD.put(`prerender:jsonld:${canonical}:v${contentHash}`, JSON.stringify(jsonld));
  }
}
```

**Implementation** - `src/workers/lib/prerender.ts`:

```typescript
import { getSnapshot, saveSnapshot, canonicalize } from './kv-cache';

export interface PrerenderEnv {
  PRERENDER_SNAPSHOTS: KVNamespace;
  PRERENDER_INDEX: KVNamespace;
  PRERENDER_JSONLD?: KVNamespace;
  FORCE_SNAPSHOT?: string; // Feature flag
}

export async function handlePrerenderRequest(
  request: Request,
  env: PrerenderEnv
): Promise<Response> {
  const url = new URL(request.url);
  const canonical = canonicalize(url);
  
  // Check If-None-Match for 304 responses
  const ifNoneMatch = request.headers.get('if-none-match');
  
  // Try to serve from KV if FORCE_SNAPSHOT is enabled
  if (env.FORCE_SNAPSHOT === 'true') {
    const snapshot = await getSnapshot(canonical, env.PRERENDER_INDEX, env.PRERENDER_SNAPSHOTS);
    
    if (snapshot) {
      // Return 304 if ETag matches
      if (ifNoneMatch === `"${snapshot.etag}"`) {
        return new Response(null, { status: 304 });
      }
      
      return new Response(snapshot.html, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'etag': `"${snapshot.etag}"`,
          'cache-control': 'public, max-age=3600',
          'x-prerender-source': 'kv',
        },
      });
    }
  }
  
  // Fallback: per-request SSR
  const ssrHtml = await renderSSR(canonical);
  
  // Async KV write (fire-and-forget)
  saveSnapshot(canonical, ssrHtml, env.PRERENDER_INDEX, env.PRERENDER_SNAPSHOTS).catch(err => {
    console.error('KV save failed:', err);
  });
  
  return new Response(ssrHtml, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-prerender-source': 'ssr',
    },
  });
}

async function renderSSR(canonical: string): Promise<string> {
  // TODO: Implement SSR with @vue/server-renderer
  // For now, return a placeholder
  return `<!DOCTYPE html>
<html>
<head>
  <title>Public Art Registry</title>
  <meta name="description" content="Loading...">
</head>
<body>
  <div id="app">Loading ${canonical}...</div>
</body>
</html>`;
}
```

**Testing**:

```powershell
# Deploy to staging
npm run deploy:staging

# Test prerender endpoint
curl -H "If-None-Match: \"abc123\"" https://test.publicartregistry.com/artwork/123

# Verify KV writes
wrangler kv:key list --namespace-id=your-index-kv-id
```

**Acceptance**: Worker serves HTML with meta tags; KV writes succeed; ETag headers work; 304 responses returned when appropriate.

#### Task 1.3: Add Vitest tests for SEO meta

**Files to create**:

- `src/test/seo.meta.spec.ts`

**Implementation**:

```typescript
import { describe, it, expect } from 'vitest';

describe('SEO Meta Tags', () => {
  const testRoutes = [
    { path: '/', expectedTitle: 'Public Art Registry' },
    { path: '/map', expectedTitle: 'Interactive Public Art Map' },
    { path: '/artwork/123', expectedTitle: 'artwork' },
  ];

  testRoutes.forEach(({ path, expectedTitle }) => {
    it(`should have correct meta tags for ${path}`, async () => {
      // Fetch from Worker
      const response = await fetch(`https://test.publicartregistry.com${path}`);
      const html = await response.text();
      
      // Check title
      expect(html).toContain(`<title>`);
      expect(html).toContain(expectedTitle);
      
      // Check meta description
      expect(html).toMatch(/<meta name="description" content=".+"/);
      
      // Check OG tags
      expect(html).toMatch(/<meta property="og:title" content=".+"/);
      expect(html).toMatch(/<meta property="og:description" content=".+"/);
      expect(html).toMatch(/<meta property="og:url" content="https:\/\/publicartregistry\.com.+"/);
      
      // Check canonical
      expect(html).toMatch(/<link rel="canonical" href="https:\/\/publicartregistry\.com.+"/);
      
      // Check JSON-LD (if applicable)
      if (path.includes('/artwork/')) {
        expect(html).toContain('<script type="application/ld+json">');
        expect(html).toContain('"@type":"VisualArtwork"');
      }
    });
  });
});
```

**Run tests**:

```powershell
npm run test -- src/test/seo.meta.spec.ts
```

**Acceptance**: All tests pass; meta tags present in SSR responses.

---

### Phase 2: Social and Data Expansion (1 week)

#### Task 2.1: Implement OpenAPI spec

**Files to create**:

- `src/workers/openapi.json` - OpenAPI 3.1 spec
- `src/workers/routes/openapi.ts` - serve spec endpoint

**Implementation** - `src/workers/openapi.json` (abbreviated):

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Public Art Registry API",
    "version": "1.0.0",
    "description": "API for discovering and managing public art data",
    "contact": {
      "email": "support@publicartregistry.com"
    }
  },
  "servers": [
    {
      "url": "https://api.publicartregistry.com",
      "description": "Production API"
    }
  ],
  "paths": {
    "/api/artworks/{id}": {
      "get": {
        "summary": "Get artwork by ID",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": {
            "description": "Artwork details",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Artwork" }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "Artwork": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "artist_name": { "type": "string" },
          "lat": { "type": "number" },
          "lon": { "type": "number" }
        }
      }
    }
  }
}
```

**Add route** - `src/workers/routes/openapi.ts`:

```typescript
import openApiSpec from '../openapi.json';

export function handleOpenAPI(): Response {
  return new Response(JSON.stringify(openApiSpec, null, 2), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
    },
  });
}
```

**Testing**:

```powershell
# Validate spec
npx @redocly/cli lint src/workers/openapi.json

# Test endpoint
curl https://api.publicartregistry.com/openapi.json | jq .
```

**Acceptance**: `/openapi.json` is accessible; spec validates; includes all major endpoints.

#### Task 2.2: Implement oEmbed endpoint

**Files to create**:

- `src/workers/routes/oembed.ts`

**Implementation**:

```typescript
export async function handleOEmbed(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  
  // Parse target URL to determine type
  const target = new URL(targetUrl);
  const artworkMatch = target.pathname.match(/^\/artwork\/(\w+)/);
  
  if (artworkMatch) {
    const artworkId = artworkMatch[1];
    // Fetch artwork data
    const artwork = await getArtwork(artworkId, env);
    
    if (!artwork) {
      return new Response(JSON.stringify({ error: 'Artwork not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }
    
    const oembedResponse = {
      version: '1.0',
      type: 'photo',
      provider_name: 'Public Art Registry',
      provider_url: 'https://publicartregistry.com',
      title: artwork.title,
      author_name: artwork.artist_name || 'Unknown Artist',
      url: targetUrl,
      thumbnail_url: artwork.photos[0]?.url || '',
      thumbnail_width: 800,
      thumbnail_height: 600,
      width: 1200,
      height: 630,
    };
    
    return new Response(JSON.stringify(oembedResponse), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=3600',
      },
    });
  }
  
  return new Response(JSON.stringify({ error: 'Unsupported URL' }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });
}
```

**Testing**:

```powershell
# Test oEmbed
curl "https://publicartregistry.com/oembed.json?url=https://publicartregistry.com/artwork/123" | jq .
```

**Acceptance**: `/oembed.json` returns valid oEmbed JSON; Slack/Discord preview works.

---

### Phase 3: AI Excellence (ongoing)

#### Task 3.1: Implement summary endpoint

**Files to create**:

- `src/workers/routes/summary.ts`

**Implementation**:

```typescript
export async function handleArtworkSummary(artworkId: string, env: any): Promise<Response> {
  const artwork = await getArtwork(artworkId, env);
  
  if (!artwork) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
  
  const summary = {
    id: artwork.id,
    title: artwork.title,
    artist: {
      id: artwork.artist_id,
      name: artwork.artist_name,
      url: `https://publicartregistry.com/artist/${artwork.artist_id}`,
    },
    year: artwork.year,
    medium: artwork.medium,
    description: artwork.description,
    lat: artwork.lat,
    lon: artwork.lon,
    tags: artwork.tags,
    photos: artwork.photos.map(p => ({
      url: p.url,
      width: p.width,
      height: p.height,
    })),
    canonical: `https://publicartregistry.com/artwork/${artwork.id}`,
  };
  
  return new Response(JSON.stringify(summary), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
    },
  });
}
```

**Testing**:

```powershell
curl https://api.publicartregistry.com/api/artworks/123/summary | jq .
```

**Acceptance**: Summary endpoint returns compact, embeddings-friendly JSON.

---

### CI/CD Integration

**Add to `.github/workflows/test.yml`**:

```yaml
- name: Run SEO meta tests
  run: npm run test -- src/test/seo.meta.spec.ts

- name: Check encoding
  run: npm run lint:encoding

- name: Validate OpenAPI spec
  run: npx @redocly/cli lint src/workers/openapi.json
```

---

### Monitoring and Operations

**Create** `scripts/check-prerender-kv.js`:

```javascript
#!/usr/bin/env node
// Quick health check for KV prerender system

const testRoutes = ['/', '/map', '/artwork/123'];

async function checkHealth() {
  let failures = 0;
  
  for (const route of testRoutes) {
    const url = `https://publicartregistry.com${route}`;
    try {
      const response = await fetch(url);
      const html = await response.text();
      
      if (!html.includes('<title>')) {
        console.error(`❌ Missing title tag: ${url}`);
        failures++;
      }
      if (!html.includes('og:title')) {
        console.error(`❌ Missing OG tags: ${url}`);
        failures++;
      }
      
      console.log(`✅ ${url} - OK`);
    } catch (err) {
      console.error(`❌ ${url} - Error:`, err.message);
      failures++;
    }
  }
  
  if (failures > 0) {
    console.error(`\n❌ ${failures} check(s) failed`);
    process.exit(1);
  } else {
    console.log('\n✅ All checks passed');
  }
}

checkHealth();
```

**Run daily via cron**:

```powershell
# Add to wrangler.toml
[[triggers]]
crons = ["0 9 * * *"]  # 9 AM daily
```

---

### Summary Checklist

**Phase 0 Complete when**:

- [ ] `robots.txt` deployed and accessible
- [ ] All encoding issues fixed
- [ ] `npm run lint:encoding` passes
- [ ] Top 10 routes have unique meta descriptions

**Phase 1 Complete when**:

- [ ] `@vueuse/head` installed and configured
- [ ] All primary views use `useRouteMeta`
- [ ] JSON-LD validates for artworks, artists, and home page
- [ ] KV namespaces created and configured
- [ ] Worker serves HTML with ETag support
- [ ] `npm run test` passes for `seo.meta.spec.ts`

**Phase 2 Complete when**:

- [ ] `/openapi.json` endpoint live and validated
- [ ] `/oembed.json` endpoint working
- [ ] Slack/Discord unfurls show correct previews
- [ ] Dataset exports available (GeoJSON, CSV)

**Phase 3 Complete when**:

- [ ] `/api/artworks/{id}/summary` endpoint live
- [ ] Bulk summary download available
- [ ] API usage documentation published
- [ ] External data hubs listing datasets

---

This developer plan provides concrete, actionable steps with code examples and testing commands. Each task includes acceptance criteria to validate completion.
