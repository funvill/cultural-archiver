// Minimal SSR fallback renderer used during type-check and early development.
// WARNING: This is a placeholder that does not run the actual Vue app. It
// intentionally avoids importing frontend sources (SFCs) so the workers
// TypeScript build does not pull the frontend code during compilation.

export interface RenderResult {
  html: string;
  headTags?: string;
  htmlAttrs?: string;
  bodyAttrs?: string;
  jsonld?: object | null;
  status?: number;
}

export async function renderUrl(path: string): Promise<RenderResult> {
  // Dynamically import the compiled SSR bundle produced by the frontend
  // build. We load it at runtime so TypeScript doesn't try to resolve
  // the frontend source files during the workers type-check step.
  let result: any;
  try {
    // @ts-ignore - allow dynamic runtime import of build artifact
    const mod = await import('../../frontend/dist-ssr/ssr-entry-server');
    const ssrRender = (mod as any).render;
    result = await ssrRender(path, {});
  } catch (e) {
    console.error('Failed to import SSR bundle', e);
    throw e;
  }
  // ssrRender returns { html, headTags, htmlAttrs, bodyAttrs, jsonld?, status }
  return {
    html: `<!doctype html><html ${result.htmlAttrs || ''}><head>${result.headTags || ''}</head><body ${result.bodyAttrs || ''}><div id="app">${result.html}</div></body></html>`,
    headTags: result.headTags,
    htmlAttrs: result.htmlAttrs,
    bodyAttrs: result.bodyAttrs,
    jsonld: result.jsonld ?? null,
    status: result.status ?? 200,
  };
}

