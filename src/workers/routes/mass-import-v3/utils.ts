/**
 * Mass Import v3 Utilities
 * 
 * Helper functions for validation, sanitization, and formatting.
 */

import { ZodError } from 'zod';
import { createValidationError, MassImportError } from './errors';

/**
 * Sanitize Markdown content
 * Removes <script> tags and other potentially dangerous HTML
 */
export function sanitizeMarkdown(content: string): string {
  if (!content) return '';

  // Remove <script> tags and their content
  let sanitized = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove other potentially dangerous tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed\b[^<]*>/gi, '');

  // Remove inline JavaScript event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');

  return sanitized.trim();
}

/**
 * Format Zod validation errors into API error format
 */
export function formatValidationErrors(error: ZodError): MassImportError {
  const issues = error.issues;

  if (issues.length === 0) {
    return createValidationError('Validation failed');
  }

  // Get the first error for the main message
  const firstIssue = issues[0];
  if (!firstIssue) {
    return createValidationError('Validation failed');
  }

  const fieldPath = firstIssue.path.join('.');
  const message = firstIssue.message;

  // Build details object
  const details: Record<string, any> = {
    field: fieldPath,
    message: message,
  };

  // Add received value if available
  if ('received' in firstIssue) {
    details.value = firstIssue.received;
  }

  // Add all validation errors if multiple
  if (issues.length > 1) {
    details.allErrors = issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
  }

  return createValidationError(
    `Validation error: ${message}`,
    fieldPath,
    details.value,
    message
  );
}

/**
 * Validate coordinates
 * Returns error message if invalid, null if valid
 */
export function validateCoordinates(lon: number, lat: number): string | null {
  // Check latitude range
  if (lat < -90 || lat > 90) {
    return `Latitude ${lat} is out of range (-90 to 90)`;
  }

  // Check longitude range
  if (lon < -180 || lon > 180) {
    return `Longitude ${lon} is out of range (-180 to 180)`;
  }

  // Reject (0, 0) as likely error
  if (lon === 0 && lat === 0) {
    return 'Coordinates at (0, 0) are likely an error';
  }

  return null;
}

/**
 * Parse artist field(s) from properties
 * Handles single artist string or comma-separated list
 * Returns array of artist names
 */
export function parseArtistField(artistField?: string): string[] {
  if (!artistField) return [];

  // Split by comma and trim whitespace
  const rawTokens = artistField.split(',').map(t => t.trim()).filter(t => t.length > 0);

  // Heuristics:
  // - If there is a single comma (two tokens) and one or both tokens contain spaces,
  //   assume it's two separate full names (e.g., "John Doe, Jane Smith").
  // - If there is a single comma and both tokens have no spaces, treat as "Last, First" (single name).
  // - If there are an even number of tokens and none of the tokens contain spaces,
  //   assume pairs of [Last, First, Last, First] and reconstruct into Last, First pairs.
  // - Otherwise, treat each token as a full artist name.

  if (rawTokens.length === 0) return [];

  if (rawTokens.length === 1) return [rawTokens[0] as string];

  if (rawTokens.length === 2) {
    const [aRaw, bRaw] = rawTokens;
    const a = aRaw as string;
    const b = bRaw as string;
    const aHasSpace = a.includes(' ');
    const bHasSpace = b.includes(' ');
    // If either looks like a full name (contains space), treat as two artists
    if (aHasSpace || bHasSpace) return [a, b];
    // Otherwise it's likely "Last, First"
    return [`${a}, ${b}`];
  }

  // More than 2 tokens
  const anyTokenHasSpace = rawTokens.some(t => t.includes(' '));
  if (!anyTokenHasSpace && rawTokens.length % 2 === 0) {
    // Group into pairs: [Last, First, Last2, First2] -> ["Last, First", "Last2, First2"]
    const pairs: string[] = [];
    for (let i = 0; i < rawTokens.length; i += 2) {
      pairs.push(`${rawTokens[i]}, ${rawTokens[i + 1]}`);
    }
    return pairs;
  }

  // Default: each token is an artist
  const artists = rawTokens;

  return artists;
}

/**
 * Generate a simple UUID v4
 * Used for generating database IDs
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validate URL format
 * Returns true if URL is valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
