/**
 * Cloudflare Worker for frontend asset serving with sitemap redirect
 * 
 * This worker intercepts requests to /sitemap*.xml and redirects them
 * to the API subdomain where the backend worker generates the actual XML.
 * Also ensures static files like robots.txt are served correctly.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Redirect common typo: /robot.txt → /robots.txt
    if (url.pathname === '/robot.txt') {
      const correctUrl = new URL(request.url);
      correctUrl.pathname = '/robots.txt';
      return Response.redirect(correctUrl.toString(), 301);
    }
    
    // Redirect sitemap requests to the API subdomain
    if (url.pathname === '/sitemap.xml' || url.pathname.match(/^\/sitemap-.*\.xml$/)) {
      const apiUrl = `https://api.publicartregistry.com${url.pathname}`;
      return Response.redirect(apiUrl, 301); // Permanent redirect for SEO
    }
    
    // List of static files that should bypass SPA fallback
    const staticFiles = ['/robots.txt', '/favicon.svg', '/favicon.ico', '/.well-known/'];
    const isStaticFile = staticFiles.some(file => url.pathname === file || url.pathname.startsWith(file));
    
    if (isStaticFile) {
      // Try to fetch the static file directly
      const assetResponse = await env.ASSETS.fetch(request);
      
      // If the file exists, return it; otherwise return 404 without SPA fallback
      if (assetResponse.status === 404) {
        return new Response('404 Not Found', { status: 404 });
      }
      return assetResponse;
    }
    
    // For all other requests, return the asset with SPA fallback
    return env.ASSETS.fetch(request);
  }
};
