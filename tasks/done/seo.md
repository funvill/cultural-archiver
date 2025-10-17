# SEO Implementation Summary

> **For detailed step-by-step instructions, see: `seo-implementation-guide.md`

## Overview

This document summarizes the SEO improvements needed. The complete implementation guide is in `seo-implementation-guide.md`.

## Problem

- No server-rendered HTML for search crawlers
- Missing meta tags (Open Graph, descriptions, canonical URLs)
- No structured data (JSON-LD)
- Encoding issues in content files

## Solution

Server-side rendering (SSR) with Cloudflare Workers KV caching, metadata, and Schema.org structured data.

## Tasks

See `seo-implementation-guide.md` for 20 detailed tasks.

## Success Metrics

- Pages indexed with metadata
- Rich Slack previews
- No performance regression







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
