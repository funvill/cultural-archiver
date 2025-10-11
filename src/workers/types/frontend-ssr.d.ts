declare module '../../frontend/dist-ssr/ssr-entry-server' {
  export interface RenderResult {
    html: string;
    headTags?: string;
    htmlAttrs?: string;
    bodyAttrs?: string;
    jsonld?: object | null;
    status?: number;
  }

  export function render(url: string, opts?: { env?: any }): Promise<RenderResult>;
}
