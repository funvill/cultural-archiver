# Sitemap Implementation for SEO

This implementation provides XML sitemaps for search engine optimization (SEO) according to the [sitemaps.org protocol](https://www.sitemaps.org/protocol.html).

## Overview

The sitemap system generates the following sitemaps:

1. **Sitemap Index** (`/sitemap.xml`) - Main index that lists all sub-sitemaps
2. **Artworks Sitemap** (`/sitemap-artworks.xml`) - All approved artwork detail pages
3. **Artists Sitemap** (`/sitemap-artists.xml`) - All approved artist profile pages
4. **Pages Sitemap** (`/sitemap-pages.xml`) - Static pages and main site pages

## URLs Generated

### Sitemap Index
- URL: `https://publicartregistry.com/sitemap.xml`
- Lists all sub-sitemaps with their last modification dates

### Artworks Sitemap
- URL: `https://publicartregistry.com/sitemap-artworks.xml`
- Format: `https://publicartregistry.com/artwork/{artwork_id}`
- Priority: 0.8
- Change frequency: weekly
- Includes `lastmod` timestamp from database

### Artists Sitemap
- URL: `https://publicartregistry.com/sitemap-artists.xml`
- Format: `https://publicartregistry.com/artist/{artist_id}`
- Priority: 0.7
- Change frequency: weekly
- Includes `lastmod` timestamp from database

### Pages Sitemap
- URL: `https://publicartregistry.com/sitemap-pages.xml`
- Includes:
  - Home page (priority: 1.0, daily)
  - Map page (priority: 0.9, daily)
  - Search page (priority: 0.9, daily)
  - Artwork index (priority: 0.8, daily)
  - Artist index (priority: 0.7, weekly)
  - All pages from the pages system (priority: 0.5, monthly)

## Implementation Details

### Files Created

1. **`src/workers/lib/sitemap.ts`**
   - Core sitemap generation logic
   - XML formatting and escaping
   - Database queries for artworks and artists

2. **`src/workers/routes/sitemap.ts`**
   - Route handlers for sitemap endpoints
   - HTTP response formatting
   - Caching headers (1 hour)

3. **`src/workers/lib/__tests__/sitemap.test.ts`**
   - Unit tests for sitemap generation
   - Validates XML structure and content

### Files Modified

1. **`src/workers/index.ts`**
   - Added sitemap route imports
   - Registered 4 new routes for sitemaps

2. **`src/workers/routes/pages.ts`**
   - Added `getPagesService()` export for sitemap access

## Submitting to Google Search Console

### Step 1: Verify Sitemap URLs

Test each sitemap URL in your browser:
- https://publicartregistry.com/sitemap.xml
- https://publicartregistry.com/sitemap-artworks.xml
- https://publicartregistry.com/sitemap-artists.xml
- https://publicartregistry.com/sitemap-pages.xml

### Step 2: Submit to Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select your property (publicartregistry.com)
3. Navigate to **Sitemaps** in the left sidebar
4. Enter the sitemap URL: `https://publicartregistry.com/sitemap.xml`
5. Click **Submit**

Google will automatically discover and crawl the sub-sitemaps listed in the index.

### Step 3: Monitor Sitemap Status

- Check the Sitemaps report in Search Console to verify:
  - Sitemap is discovered
  - URLs are being indexed
  - No errors in sitemap processing

### Step 4: Add to robots.txt (Optional)

Add the following line to your `robots.txt` file:

```
Sitemap: https://publicartregistry.com/sitemap.xml
```

This helps search engines discover your sitemap automatically.

## Caching

All sitemap endpoints include cache headers:
```
Cache-Control: public, max-age=3600
```

Sitemaps are cached for 1 hour to reduce database load while keeping content reasonably fresh.

## Limits

- Artworks sitemap: Limited to 50,000 approved artworks
- Artists sitemap: Limited to 50,000 approved artists
- Total URLs per sitemap: Complies with Google's 50,000 URL limit

If you exceed 50,000 entries in any category, you'll need to implement sitemap pagination (split into multiple numbered sitemaps).

## Technical Notes

### XML Escaping

All URLs and text are properly escaped for XML:
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&apos;`

### Date Formatting

Dates use W3C Datetime format (YYYY-MM-DD) as specified in the sitemap protocol.

### Environment Variables

The base URL is configured via the `FRONTEND_URL` environment variable in the worker configuration. Default: `https://publicartregistry.com`

## Testing

Run the sitemap tests:

```bash
cd src/workers
npm run test -- lib/__tests__/sitemap.test.ts
```

The tests verify:
- XML structure and formatting
- URL generation for all content types
- XML character escaping
- Priority and changefreq values

## Future Enhancements

1. **Sitemap Pagination**: Split large sitemaps into multiple numbered files
2. **Image Sitemaps**: Add `<image:image>` tags for artwork photos
3. **News Sitemap**: Add recent submissions/updates for news crawlers
4. **Video Sitemap**: If video content is added
5. **Gzip Compression**: Compress sitemaps for faster delivery

## References

- [Sitemaps.org Protocol](https://www.sitemaps.org/protocol.html)
- [Google Sitemap Guide](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google Search Console](https://search.google.com/search-console)
