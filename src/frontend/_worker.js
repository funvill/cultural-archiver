/**
 * Cloudflare Worker for frontend asset serving with sitemap redirect
 * 
 * This worker intercepts requests to /sitemap*.xml and redirects them
 * to the API subdomain where the backend worker generates the actual XML.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Redirect sitemap requests to the API subdomain
    if (url.pathname === '/sitemap.xml' || url.pathname.match(/^\/sitemap-.*\.xml$/)) {
      const apiUrl = `https://api.publicartregistry.com${url.pathname}`;
      return Response.redirect(apiUrl, 301); // Permanent redirect for SEO
    }
    
    // For all other requests, return the asset from the environment
    return env.ASSETS.fetch(request);
  }
};
