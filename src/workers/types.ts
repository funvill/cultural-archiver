/**
 * Worker-specific types that extend the shared types with Cloudflare Worker types
 */

import type { WorkerEnv as BaseWorkerEnv } from '../shared/types';

// Cloudflare Workers Environment with proper types
export interface WorkerEnv
  extends Omit<
    BaseWorkerEnv,
    'DB' | 'SESSIONS' | 'CACHE' | 'RATE_LIMITS' | 'MAGIC_LINKS' | 'PHOTOS_BUCKET'
  > {
  DB: D1Database;
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  RATE_LIMITS: KVNamespace;
  MAGIC_LINKS: KVNamespace;
  PHOTOS_BUCKET: R2Bucket;
}

// Re-export everything from shared types for convenience
export * from '../shared/types';
