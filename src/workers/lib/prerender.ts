import { canonicalize, getSnapshot, saveSnapshot, hashContent } from './kv-cache';
import { renderUrl } from './ssr';

export interface PrerenderEnv {
  PRERENDER_SNAPSHOTS: KVNamespace;
  PRERENDER_INDEX: KVNamespace;
  PRERENDER_JSONLD?: KVNamespace;
  DB?: D1Database;
}

export async function handlePrerenderRequest(request: Request, env: PrerenderEnv): Promise<Response> {
  const url = new URL(request.url);
  const canonical = canonicalize(url);
  const ifNoneMatch = request.headers.get('if-none-match');

  // Try KV snapshot
  const snapshot = await getSnapshot(canonical, env.PRERENDER_INDEX, env.PRERENDER_SNAPSHOTS);
  if (snapshot) {
    if (ifNoneMatch === `"${snapshot.etag}"`) {
      return new Response(null, { status: 304, headers: { ETag: `"${snapshot.etag}"` } });
    }
    return new Response(snapshot.html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', ETag: `"${snapshot.etag}"`, 'x-prerender-source': 'kv' } });
  }

  // Render via SSR renderer (renders the full app for the URL)
  try {
    const { html } = await renderUrl(url.pathname || '/');

    // Compute ETag from the rendered HTML so we can return it immediately
    const etag = hashContent(html);

    // Save snapshot asynchronously (best-effort)
    saveSnapshot(canonical, html, env.PRERENDER_INDEX, env.PRERENDER_SNAPSHOTS).catch(() => {});

    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        ETag: `"${etag}"`,
        'cache-control': 'public, max-age=60, s-maxage=300',
        'x-prerender-source': 'ssr',
      },
    });
  } catch (err) {
    console.error('SSR render failed, falling back to minimal placeholder', err);
    const fallbackHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Public Art Registry</title></head><body><div id="app">Server rendered snapshot for ${canonical}</div></body></html>`;
    return new Response(fallbackHtml, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'x-prerender-source': 'fallback' } });
  }
}
