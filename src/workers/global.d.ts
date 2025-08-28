/**
 * Global type declarations for Cloudflare Workers
 * This file ensures worker types are available during compilation
 */

// Re-export Cloudflare Worker types
import '@cloudflare/workers-types';

// Ensure global types are available
declare global {
  // Extend global scope with Worker types if needed
}

export {};
