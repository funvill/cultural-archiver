# Frontend SPA Routing Documentation

## Overview

The Cultural Archiver frontend is deployed as a Cloudflare Worker with static assets using the built-in Single Page Application (SPA) configuration. This provides automatic client-side routing without requiring custom worker scripts.

## Architecture

### Deployment Structure
- **Static Assets**: `src/frontend/dist/` - Built Vue.js application assets
- **Configuration**: `src/frontend/wrangler.jsonc` - Worker deployment configuration
- **No Custom Worker**: Uses Cloudflare's built-in SPA routing

### Worker Configuration

The `wrangler.jsonc` file specifies:
```jsonc
{
  "name": "cultural-archiver",
  "compatibility_date": "2025-04-01", 
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

Key points:
- `assets.directory`: Specifies where static files are served from
- `assets.not_found_handling`: Set to `"single-page-application"` for automatic SPA routing
- No `main` worker script needed - Cloudflare handles SPA routing automatically

## SPA Routing Solution

### Problem
When users navigate directly to URLs like `/verify?token=...` or `/artwork/123`, traditional static hosting would return 404 because these routes don't exist as physical files - they're client-side Vue Router routes.

### Solution
Cloudflare's built-in SPA configuration automatically:

1. **Serves static assets normally** - CSS, JS, images are served directly
2. **Detects navigation requests** - Uses `Sec-Fetch-Mode: navigate` header from browsers  
3. **Serves index.html for missing routes** - Returns `index.html` with 200 status for SPA routes
4. **Reduces billable invocations** - No custom worker script needed for basic SPA routing

### Automatic Route Handling
With `"not_found_handling": "single-page-application"`, Cloudflare automatically serves `/index.html` for any request that doesn't match a static asset, allowing Vue Router to handle client-side navigation.

## Benefits

1. **Simplicity**: No custom worker script to maintain
2. **Performance**: Optimized routing built into Cloudflare's edge
3. **Cost Effective**: Reduced billable Worker invocations  
4. **Reliability**: Uses Cloudflare's tested SPA routing logic
5. **Standards Compliant**: Follows browser navigation request standards

## Worker Script Logic

```javascript
export default {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url)
    
    // Try to get static asset first
    const response = await env.ASSETS.fetch(request)
    
    // If not found, check if it's a SPA route
    if (response.status === 404) {
      const pathname = url.pathname
      const spaRoutes = ['/verify', '/artwork', '/submit', ...]
      
      const isSpaRoute = spaRoutes.some(route => 
        pathname === route || pathname.startsWith(route + '/')
      )
      
      if (isSpaRoute) {
        // Serve index.html for SPA routes
        const indexRequest = new Request(url.origin + '/index.html', request)
        return await env.ASSETS.fetch(indexRequest)
      }
    }
    
    return response
  }
}
```

## Benefits

1. **Full Control**: Custom logic for handling requests
2. **SEO Friendly**: Can add server-side rendering or metadata in the future
3. **Performance**: Static assets served efficiently from Cloudflare's edge
4. **Flexibility**: Can handle API routes, redirects, or other custom logic
5. **Cost Effective**: More predictable pricing than Cloudflare Pages for high traffic

## Development vs Production

### Development
- Frontend: `npm run dev` serves on `localhost:5173` with Vite dev server
- Backend: `wrangler dev` serves API on `localhost:8787`
- Vite proxy handles API requests during development

### Production  
- Frontend: Worker at `art.abluestar.com` serves static assets and handles routing
- Backend: Worker at `art-api.abluestar.com` handles API requests
- Worker script ensures proper SPA routing for direct URL access

## Deployment Process

1. **Build**: `npm run build` creates optimized static assets in `dist/`
2. **Deploy**: `wrangler deploy` uploads both worker script and static assets
3. **Verify**: Test direct access to SPA routes (e.g., `/verify?token=...`)

## Troubleshooting

### Common Issues

**404 on Direct Route Access**:
- Check that `_worker.js` is in the frontend root directory
- Verify `main: "_worker.js"` is in `wrangler.jsonc`
- Ensure the route is listed in the `spaRoutes` array

**Worker Script in Assets Error**:
- Remove `_worker.js` from `dist/` directory if it gets copied during build
- Add `_worker.js` to `.assetsignore` if needed

**CORS Issues**:
- Worker script includes CORS headers for OPTIONS requests
- API requests go to separate worker domain (`art-api.abluestar.com`)

## Future Enhancements

- Server-side rendering for improved SEO
- Custom caching strategies for different asset types
- A/B testing capabilities
- Enhanced security headers
- Analytics and performance monitoring
