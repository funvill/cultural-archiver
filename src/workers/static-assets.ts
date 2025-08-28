/**
 * Static Assets Worker for Cultural Archiver Frontend
 * This worker serves the Vue.js frontend assets using Cloudflare Workers Static Assets
 * with enhanced features like SPA routing and security headers
 */

interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Try to serve the static asset first
    let response = await env.ASSETS.fetch(request);
    
    // If the asset is not found and it's not an API request, serve index.html for SPA routing
    if (response.status === 404 && !url.pathname.startsWith('/api/')) {
      // Serve index.html for SPA routing (Vue Router)
      const indexRequest = new Request(new URL('/', request.url), request);
      response = await env.ASSETS.fetch(indexRequest);
    }
    
    // Add security headers
    if (response.status === 200) {
      const newResponse = new Response(response.body, response);
      
      // Add security headers
      newResponse.headers.set('X-Content-Type-Options', 'nosniff');
      newResponse.headers.set('X-Frame-Options', 'DENY');
      newResponse.headers.set('X-XSS-Protection', '1; mode=block');
      newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Add cache headers for assets
      if (url.pathname.includes('/assets/')) {
        newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (url.pathname.endsWith('.html')) {
        newResponse.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
      }
      
      return newResponse;
    }
    
    return response;
  },
} satisfies ExportedHandler<Env>;
