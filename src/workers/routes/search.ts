/**
 * Search API endpoints for Cultural Archiver
 * Handles GET /api/search with full-text search capabilities
 */

import type { Context } from 'hono';
import type { WorkerEnv, ArtworkRecord } from '../types'; // Use local workers type
import { createSuccessResponse, ApiError } from '../lib/errors';
import { searchArtworks, validateSearchQuery, getSearchSuggestions } from '../lib/search';

export interface SearchQuery {
  q: string;
  page?: string;
  per_page?: string;
  status?: 'approved' | 'pending' | 'removed';
}

export interface SearchResponse {
  artworks: ArtworkRecord[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
  query: {
    original: string;
    sanitized: string;
  };
  suggestions?: string[];
}

/**
 * GET /api/search - Search artworks by text query
 * Query parameters:
 * - q: search query (required)
 * - page: page number (default: 1)
 * - per_page: results per page (default: 20, max: 50)
 * - status: filter by status (default: 'approved')
 */
export async function handleSearchRequest(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  try {
    // Get query parameters
    const query = c.req.query('q') || '';
    const page = parseInt(c.req.query('page') || '1', 10);
    const perPage = Math.min(parseInt(c.req.query('per_page') || '20', 10), 50);
    const status = (c.req.query('status') as 'approved' | 'pending' | 'removed') || 'approved';

    // Validate search query
    const validation = validateSearchQuery(query);
    if (!validation.valid) {
      throw new ApiError('VALIDATION_ERROR', validation.error || 'Invalid search query', 400);
    }

    // Validate pagination parameters
    if (page < 1) {
      throw new ApiError('VALIDATION_ERROR', 'Page number must be >= 1', 400);
    }
    if (perPage < 1 || perPage > 50) {
      throw new ApiError('VALIDATION_ERROR', 'Per page must be between 1 and 50', 400);
    }

    const offset = (page - 1) * perPage;

    // Perform search
    const searchResult = await searchArtworks(c.env.DB, validation.sanitized, {
      limit: perPage,
      offset,
      status,
    });

    // Calculate pagination info
    const totalPages = Math.ceil(searchResult.total / perPage);

    // Get search suggestions for empty or short queries
    let suggestions: string[] | undefined;
    if (validation.sanitized.length <= 2) {
      suggestions = await getSearchSuggestions(c.env.DB, validation.sanitized);
    }

    const response: SearchResponse = {
      artworks: searchResult.artworks,
      pagination: {
        page,
        per_page: perPage,
        total: searchResult.total,
        total_pages: totalPages,
        has_more: searchResult.has_more,
      },
      query: {
        original: query,
        sanitized: validation.sanitized,
      },
      ...(suggestions && { suggestions }),
    };

    return c.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Search request failed:', error);
    throw error;
  }
}

/**
 * GET /api/search/suggestions - Get search suggestions
 * Query parameters:
 * - q: partial search query (required)
 * - limit: number of suggestions (default: 5, max: 10)
 */
export async function handleSearchSuggestions(
  c: Context<{ Bindings: WorkerEnv }>
): Promise<Response> {
  try {
    const query = c.req.query('q') || '';
    const limit = Math.min(parseInt(c.req.query('limit') || '5', 10), 10);

    if (query.trim().length === 0) {
      return c.json(createSuccessResponse({ suggestions: [] }));
    }

    const suggestions = await getSearchSuggestions(c.env.DB, query.trim(), limit);

    return c.json(createSuccessResponse({ suggestions }));
  } catch (error) {
    console.error('Search suggestions failed:', error);
    throw error;
  }
}
