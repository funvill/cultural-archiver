import { renderToString } from '@vue/server-renderer';
import { createAppFactory } from './entry-server';

export interface RenderResult {
  html: string;
  headTags?: string;
  htmlAttrs?: string;
  bodyAttrs?: string;
  jsonld?: object | null;
  status?: number;
}

/**
 * Render the app for a given URL. This function is intended to be built by Vite
 * into a server bundle (dist-ssr) which the Worker will import at runtime.
 */
export async function render(url: string, _opts?: { env?: unknown }): Promise<RenderResult> {
  const { app, head } = await createAppFactory(url);

  const appHtml = await renderToString(app);

  // @vueuse/head exposes renderHeadToString in SSR builds
  const headResult = (head as any).renderHeadToString?.() || {};

  return {
    html: appHtml,
    headTags: headResult.headTags || '',
    htmlAttrs: headResult.htmlAttrs || '',
    bodyAttrs: headResult.bodyAttrs || '',
    jsonld: null,
    status: 200,
  };
}
