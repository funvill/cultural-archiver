/**
 * Rate limiting middleware using Cloudflare KV
 * Implements per-user-token limits for submissions and queries
 */

import type { Context, Next } from 'hono';
import type { WorkerEnv } from '../../shared/types';
import { 
  RATE_LIMIT_SUBMISSIONS_PER_DAY, 
  RATE_LIMIT_QUERIES_PER_HOUR 
} from '../../shared/types';
import { RateLimitError } from '../lib/errors';

export interface RateLimitData {
  count: number;
  resetTime: number;
}

export interface RateLimitInfo {
  submissions_remaining: number;
  submissions_reset_at: string;
  queries_remaining: number;
  queries_reset_at: string;
}

/**
 * Get rate limit key for KV storage
 */
function getRateLimitKey(userToken: string, type: 'submissions' | 'queries'): string {
  const now = new Date();
  
  if (type === 'submissions') {
    // Daily limit - key includes date
    const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
    return `rate_limit:submissions:${userToken}:${dateKey}`;
  } else {
    // Hourly limit - key includes date and hour
    const hourKey = now.toISOString().split(':')[0]; // YYYY-MM-DDTHH
    return `rate_limit:queries:${userToken}:${hourKey}`;
  }
}

/**
 * Get rate limit data from KV
 */
async function getRateLimitData(
  kv: any, // KVNamespace
  userToken: string, 
  type: 'submissions' | 'queries'
): Promise<RateLimitData> {
  const key = getRateLimitKey(userToken, type);
  
  try {
    const data = await kv.get(key);
    if (data) {
      return JSON.parse(data) as RateLimitData;
    }
  } catch (error) {
    console.warn('Failed to get rate limit data:', error);
  }
  
  // Return default data if not found or error
  const now = Date.now();
  const resetTime = type === 'submissions' 
    ? now + (24 * 60 * 60 * 1000) // 24 hours
    : now + (60 * 60 * 1000); // 1 hour
    
  return {
    count: 0,
    resetTime,
  };
}

/**
 * Update rate limit data in KV
 */
async function updateRateLimitData(
  kv: any, // KVNamespace
  userToken: string, 
  type: 'submissions' | 'queries',
  data: RateLimitData
): Promise<void> {
  const key = getRateLimitKey(userToken, type);
  
  try {
    // Set TTL based on type
    const ttl = type === 'submissions' 
      ? 24 * 60 * 60 // 24 hours
      : 60 * 60; // 1 hour
      
    await kv.put(key, JSON.stringify(data), { expirationTtl: ttl });
  } catch (error) {
    console.error('Failed to update rate limit data:', error);
    // Don't throw - rate limiting failure shouldn't break the app
  }
}

/**
 * Increment rate limit counter
 */
async function incrementRateLimit(
  kv: any, // KVNamespace
  userToken: string, 
  type: 'submissions' | 'queries'
): Promise<RateLimitData> {
  const data = await getRateLimitData(kv, userToken, type);
  const now = Date.now();
  
  // Check if reset time has passed
  if (now >= data.resetTime) {
    // Reset counter
    const resetTime = type === 'submissions' 
      ? now + (24 * 60 * 60 * 1000) // 24 hours
      : now + (60 * 60 * 1000); // 1 hour
      
    data.count = 1;
    data.resetTime = resetTime;
  } else {
    // Increment counter
    data.count += 1;
  }
  
  await updateRateLimitData(kv, userToken, type, data);
  return data;
}

/**
 * Check if rate limit is exceeded
 */
function isRateLimitExceeded(data: RateLimitData, type: 'submissions' | 'queries'): boolean {
  const limit = type === 'submissions' 
    ? RATE_LIMIT_SUBMISSIONS_PER_DAY 
    : RATE_LIMIT_QUERIES_PER_HOUR;
    
  return data.count > limit;
}

/**
 * Get retry-after seconds for rate limit
 */
function getRetryAfterSeconds(resetTime: number): number {
  const now = Date.now();
  return Math.max(0, Math.ceil((resetTime - now) / 1000));
}

/**
 * Middleware for submission rate limiting (10 per day)
 */
export async function rateLimitSubmissions(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  const userToken = c.get('userToken');
  
  if (!userToken) {
    await next();
    return;
  }
  
  try {
    const data = await getRateLimitData(c.env.RATE_LIMITS, userToken, 'submissions');
    
    // Check current limit before incrementing
    if (isRateLimitExceeded(data, 'submissions')) {
      const retryAfter = getRetryAfterSeconds(data.resetTime);
      throw new RateLimitError(
        retryAfter,
        `Submission limit exceeded. You can submit ${RATE_LIMIT_SUBMISSIONS_PER_DAY} artworks per day.`
      );
    }
    
    // Increment counter for this request
    const newData = await incrementRateLimit(c.env.RATE_LIMITS, userToken, 'submissions');
    
    // Check if we've now exceeded the limit
    if (isRateLimitExceeded(newData, 'submissions')) {
      const retryAfter = getRetryAfterSeconds(newData.resetTime);
      throw new RateLimitError(
        retryAfter,
        `Submission limit exceeded. You can submit ${RATE_LIMIT_SUBMISSIONS_PER_DAY} artworks per day.`
      );
    }
    
    // Add rate limit info to response headers
    c.res.headers.set('X-RateLimit-Submissions-Limit', RATE_LIMIT_SUBMISSIONS_PER_DAY.toString());
    c.res.headers.set('X-RateLimit-Submissions-Remaining', (RATE_LIMIT_SUBMISSIONS_PER_DAY - newData.count).toString());
    c.res.headers.set('X-RateLimit-Submissions-Reset', new Date(newData.resetTime).toISOString());
    
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error;
    }
    // Rate limit check failed - log but continue
    console.warn('Rate limit check failed for submissions:', error);
  }
  
  await next();
}

/**
 * Middleware for query rate limiting (60 per hour)
 */
export async function rateLimitQueries(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  const userToken = c.get('userToken');
  
  if (!userToken) {
    await next();
    return;
  }
  
  try {
    const data = await getRateLimitData(c.env.RATE_LIMITS, userToken, 'queries');
    
    // Check current limit before incrementing
    if (isRateLimitExceeded(data, 'queries')) {
      const retryAfter = getRetryAfterSeconds(data.resetTime);
      throw new RateLimitError(
        retryAfter,
        `Query limit exceeded. You can make ${RATE_LIMIT_QUERIES_PER_HOUR} queries per hour.`
      );
    }
    
    // Increment counter for this request
    const newData = await incrementRateLimit(c.env.RATE_LIMITS, userToken, 'queries');
    
    // Check if we've now exceeded the limit
    if (isRateLimitExceeded(newData, 'queries')) {
      const retryAfter = getRetryAfterSeconds(newData.resetTime);
      throw new RateLimitError(
        retryAfter,
        `Query limit exceeded. You can make ${RATE_LIMIT_QUERIES_PER_HOUR} queries per hour.`
      );
    }
    
    // Add rate limit info to response headers
    c.res.headers.set('X-RateLimit-Queries-Limit', RATE_LIMIT_QUERIES_PER_HOUR.toString());
    c.res.headers.set('X-RateLimit-Queries-Remaining', (RATE_LIMIT_QUERIES_PER_HOUR - newData.count).toString());
    c.res.headers.set('X-RateLimit-Queries-Reset', new Date(newData.resetTime).toISOString());
    
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error;
    }
    // Rate limit check failed - log but continue
    console.warn('Rate limit check failed for queries:', error);
  }
  
  await next();
}

/**
 * Get current rate limit status for a user
 */
export async function getRateLimitStatus(
  kv: any, // KVNamespace
  userToken: string
): Promise<RateLimitInfo> {
  const [submissionsData, queriesData] = await Promise.all([
    getRateLimitData(kv, userToken, 'submissions'),
    getRateLimitData(kv, userToken, 'queries'),
  ]);
  
  return {
    submissions_remaining: Math.max(0, RATE_LIMIT_SUBMISSIONS_PER_DAY - submissionsData.count),
    submissions_reset_at: new Date(submissionsData.resetTime).toISOString(),
    queries_remaining: Math.max(0, RATE_LIMIT_QUERIES_PER_HOUR - queriesData.count),
    queries_reset_at: new Date(queriesData.resetTime).toISOString(),
  };
}

/**
 * Middleware to add rate limit status to response (for user endpoints)
 */
export async function addRateLimitStatus(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next
): Promise<void | Response> {
  await next();
  
  const userToken = c.get('userToken');
  
  if (userToken) {
    try {
      const status = await getRateLimitStatus(c.env.RATE_LIMITS, userToken);
      
      // Add to response headers
      c.res.headers.set('X-RateLimit-Status', JSON.stringify(status));
    } catch (error) {
      console.warn('Failed to get rate limit status:', error);
    }
  }
}

/**
 * Reset rate limits for a user (admin function)
 */
export async function resetRateLimits(
  kv: any, // KVNamespace
  userToken: string
): Promise<void> {
  // Get keys for current period
  const submissionKey = getRateLimitKey(userToken, 'submissions');
  const queryKey = getRateLimitKey(userToken, 'queries');
  
  try {
    await Promise.all([
      kv.delete(submissionKey),
      kv.delete(queryKey),
    ]);
  } catch (error) {
    console.error('Failed to reset rate limits:', error);
    throw error;
  }
}