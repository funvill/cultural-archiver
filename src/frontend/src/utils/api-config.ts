/**
 * Centralized API configuration utility
 * Provides consistent API base URL across the entire frontend application
 *
 * This replaces all scattered environment variable usage and ensures:
 * - Development: /api (proxied to localhost:8787 by Vite)
 * - Production: https://api.publicartregistry.com/api
 *
 * Usage:
 * - Import { getApiBaseUrl, createApiUrl } from '@/utils/api-config'
 * - Use createApiUrl('/endpoint') for fetch calls
 * - Use getApiBaseUrl() for passing to components as props
 */

/**
 * Get the API base URL based on the current environment
 *
 * Development: /api (proxied to localhost:8787)
 * Production: https://api.publicartregistry.com/api
 *
 * @returns The API base URL without trailing slash
 */
export function getApiBaseUrl(): string {
  // Check if we're in production mode (set by Vite build)
  const isProduction = import.meta.env.PROD;

  // Primary detection: Vite's PROD flag
  if (isProduction) {
    return 'https://api.publicartregistry.com/api';
  }

  // Fallback detection: hostname-based check for pages served from the production domain.
  // This covers cases where environment flags may not be correctly set in the deployed build
  // but the page is still served from publicartregistry.com (e.g., misconfigured worker that
  // serves static assets but doesn't set import.meta.env.PROD).
  try {
    if (typeof window !== 'undefined' && window.location && typeof window.location.hostname === 'string') {
      const hostname = window.location.hostname.toLowerCase();
      if (hostname.endsWith('publicartregistry.com')) {
        return 'https://api.publicartregistry.com/api';
      }
    }
  } catch (e) {
    // ignore any errors and fall back to dev-style relative path
  }

  // Default (development / local): Use relative path (proxied by Vite dev server)
  return '/api';
}

/**
 * Create a full API URL by combining the base URL with an endpoint
 *
 * @param endpoint - The API endpoint (should start with /)
 * @returns The complete API URL
 *
 * @example
 * createApiUrl('/auth/magic-link')
 * // Development: '/api/auth/magic-link'
 * // Production: 'https://api.publicartregistry.com/api/auth/magic-link'
 */
export function createApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();

  // Ensure endpoint starts with /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  return `${baseUrl}${cleanEndpoint}`;
}

/**
 * Debug helper to log current API configuration
 */
export function logApiConfig(): void {
  console.log('[API Config]', {
    isProduction: import.meta.env.PROD,
    mode: import.meta.env.MODE,
    baseUrl: getApiBaseUrl(),
    exampleUrl: createApiUrl('/auth/magic-link'),
  });
}
