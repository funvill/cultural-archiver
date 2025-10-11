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
/**
 * Global type declarations for Cloudflare Workers
 * This file ensures worker types are available during compilation
 */

// Re-export Cloudflare Worker types
import '@cloudflare/workers-types';

// Ensure global types are available
declare global {
  // Extend global scope with Worker types if needed
  // Minimal D1Database interface (subset used in tests/library)
  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(): Promise<T | null>;
    run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
    all<T = unknown>(): Promise<{ success: boolean; results: T[] }>;
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    exec?(query: string): Promise<unknown>;
  }
}

export {};
