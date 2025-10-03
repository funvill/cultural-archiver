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

  if (isProduction) {
    // Production: Use the full API domain with /api path
    return 'https://api.publicartregistry.com/api';
  } else {
    // Development: Use relative path (proxied by Vite dev server)
    return '/api';
  }
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
