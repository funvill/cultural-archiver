/**
 * Search utility functions for Cultural Archiver
 * Provides full-text search capabilities across artworks and logbook entries
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { ArtworkWithPhotos } from '../types';
import { createDatabaseService } from './database';
import { safeJsonParse } from './errors';

export interface SearchOptions {
  limit?: number;
  offset?: number;
  status?: 'approved' | 'pending' | 'removed';
}

export interface SearchResult {
  artworks: ArtworkWithPhotos[];
  total: number;
  has_more: boolean;
  query: string;
}

/**
 * Search artworks using full-text search across titles, descriptions, and notes
 * Searches artwork tags and logbook notes for matching content
 */
export async function searchArtworks(
  db: D1Database,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const dbService = createDatabaseService(db);
  
  // Default options
  const {
    limit = 20,
    offset = 0,
    status = 'approved'
  } = options;

  // Validate query
  if (!query || query.trim().length === 0) {
    return {
      artworks: [],
      total: 0,
      has_more: false,
      query: query.trim()
    };
  }

  const searchTerm = query.trim();
  
  try {
    // For MVP, we'll use LIKE queries on artwork tags and logbook notes
    // In production, this could be enhanced with SQLite FTS
    const stmt = db.prepare(`
      SELECT DISTINCT 
        a.*,
        at.name as type_name,
        0 as distance_km,
        -- Search relevance scoring (basic)
        CASE 
          WHEN at.name LIKE ? THEN 3
          WHEN a.tags LIKE ? THEN 2
          ELSE 1
        END as relevance_score
      FROM artwork a
      JOIN artwork_types at ON a.type_id = at.id
      LEFT JOIN logbook l ON a.id = l.artwork_id AND l.status = 'approved'
      WHERE a.status = ?
        AND (
          at.name LIKE ? OR
          a.tags LIKE ? OR
          l.note LIKE ?
        )
      ORDER BY relevance_score DESC, a.created_at DESC
      LIMIT ? OFFSET ?
    `);

    const likePattern = `%${searchTerm}%`;
    const results = await stmt.bind(
      likePattern, // type name relevance
      likePattern, // tags relevance
      status,
      likePattern, // type name search
      likePattern, // tags search
      likePattern, // logbook notes search
      limit + 1, // Get one extra to check if there are more results
      offset
    ).all();

    // Check if there are more results
    const has_more = results.results.length > limit;
    const artworks = results.results.slice(0, limit) as unknown as ArtworkWithPhotos[];

    // Format results with photos
    const artworksWithPhotos: ArtworkWithPhotos[] = await Promise.all(
      artworks.map(async artwork => {
        const logbookEntries = await dbService.getLogbookEntriesForArtwork(artwork.id);

        const allPhotos: string[] = [];
        logbookEntries.forEach(entry => {
          if (entry.photos) {
            const photos = safeJsonParse<string[]>(entry.photos, []);
            allPhotos.push(...photos);
          }
        });

        return {
          ...artwork,
          recent_photo: allPhotos.length > 0 ? allPhotos[0] : undefined,
          photo_count: allPhotos.length,
        } as ArtworkWithPhotos;
      })
    );

    // Get total count for pagination (without LIMIT)
    const countStmt = db.prepare(`
      SELECT COUNT(DISTINCT a.id) as total
      FROM artwork a
      JOIN artwork_types at ON a.type_id = at.id
      LEFT JOIN logbook l ON a.id = l.artwork_id AND l.status = 'approved'
      WHERE a.status = ?
        AND (
          at.name LIKE ? OR
          a.tags LIKE ? OR
          l.note LIKE ?
        )
    `);

    const countResult = await countStmt.bind(
      status,
      likePattern,
      likePattern,
      likePattern
    ).first();

    const total = (countResult as { total: number })?.total || 0;

    return {
      artworks: artworksWithPhotos,
      total,
      has_more,
      query: searchTerm
    };
  } catch (error) {
    console.error('Search failed:', error);
    throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse search query to extract potential advanced search terms
 * For future implementation of advanced search syntax like "tag:street-art"
 */
export function parseSearchQuery(query: string): {
  text: string;
  tags: string[];
  filters: Record<string, string>;
} {
  const trimmed = query.trim();
  
  // For MVP, return simple text search
  // Future enhancement: parse "tag:value" and other advanced syntax
  return {
    text: trimmed,
    tags: [],
    filters: {}
  };
}

/**
 * Validate search query for length and content
 */
export function validateSearchQuery(query: string): {
  valid: boolean;
  error?: string;
  sanitized: string;
} {
  const trimmed = query.trim();
  
  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'Search query cannot be empty',
      sanitized: ''
    };
  }
  
  if (trimmed.length > 200) {
    return {
      valid: false,
      error: 'Search query too long (max 200 characters)',
      sanitized: trimmed.substring(0, 200)
    };
  }
  
  // Basic sanitization - remove excessive whitespace
  const sanitized = trimmed.replace(/\s+/g, ' ');
  
  return {
    valid: true,
    sanitized
  };
}

/**
 * Get search suggestions based on popular search terms and artwork types
 * For future implementation of search autocomplete
 */
export async function getSearchSuggestions(
  db: D1Database,
  partial: string,
  limit: number = 5
): Promise<string[]> {
  // For MVP, return basic artwork type suggestions
  try {
    const stmt = db.prepare(`
      SELECT name
      FROM artwork_types
      WHERE name LIKE ?
      ORDER BY name
      LIMIT ?
    `);
    
    const likePattern = `%${partial.trim()}%`;
    const results = await stmt.bind(likePattern, limit).all();
    
    return results.results.map((row: any) => row.name);
  } catch (error) {
    console.error('Failed to get search suggestions:', error);
    return [];
  }
}