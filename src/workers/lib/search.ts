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
 * Supports structured tag searches with "tag:key" and "tag:key:value" syntax
 */
export async function searchArtworks(
  db: D1Database,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const dbService = createDatabaseService(db);

  // Default options
  const { limit = 20, offset = 0, status = 'approved' } = options;

  // Validate query
  if (!query || query.trim().length === 0) {
    return {
      artworks: [],
      total: 0,
      has_more: false,
      query: query.trim(),
    };
  }

  // Parse the search query to extract text and tag searches
  const parsed = parseSearchQuery(query.trim());

  try {
    // Build dynamic SQL conditions based on parsed query
    const conditions: string[] = [];
    const params: any[] = [];
    let relevanceSelects: string[] = [];

    // Base condition for status
    conditions.push('a.status = ?');
    params.push(status);

    // Text search conditions (if there's text to search)
    if (parsed.text) {
      const likePattern = `%${parsed.text}%`;
      conditions.push(`(
        at.name LIKE ? OR 
        a.title LIKE ? OR
        a.description LIKE ? OR
        a.created_by LIKE ? OR
        a.tags LIKE ? OR
        l.note LIKE ?
      )`);
      
      // Add parameters for text search
      for (let i = 0; i < 6; i++) {
        params.push(likePattern);
      }

      // Add relevance scoring for text matches
      relevanceSelects.push(`
        CASE 
          WHEN a.title LIKE ? THEN 5
          WHEN at.name LIKE ? THEN 4
          WHEN a.description LIKE ? THEN 3
          WHEN a.created_by LIKE ? THEN 3
          WHEN a.tags LIKE ? THEN 2
          WHEN l.note LIKE ? THEN 1
          ELSE 0
        END
      `);
      
      // Add relevance parameters
      for (let i = 0; i < 6; i++) {
        params.push(likePattern);
      }
    }

    // Tag key searches ("tag:key" format)
    parsed.tagKeys.forEach((key) => {
      conditions.push(`json_extract(a.tags, '$.tags.${key}') IS NOT NULL`);
      relevanceSelects.push('3'); // High relevance for tag key matches
    });

    // Tag key-value searches ("tag:key:value" format)  
    parsed.tagPairs.forEach((pair) => {
      conditions.push(`json_extract(a.tags, '$.tags.${pair.key}') LIKE ?`);
      params.push(`%${pair.value}%`);
      relevanceSelects.push('4'); // Highest relevance for exact tag matches
    });

    // If no conditions, return empty results
    if (conditions.length <= 1) {
      return {
        artworks: [],
        total: 0,
        has_more: false,
        query: query.trim(),
      };
    }

    // Build the relevance score calculation
    const relevanceScore = relevanceSelects.length > 0 
      ? relevanceSelects.map(score => `(${score})`).join(' + ')
      : '0';

    // Main search query
    const searchSQL = `
      SELECT DISTINCT 
        a.*,
        at.name as type_name,
        0 as distance_km,
        (${relevanceScore}) as relevance_score
      FROM artwork a
      JOIN artwork_types at ON a.type_id = at.id
      LEFT JOIN logbook l ON a.id = l.artwork_id AND l.status = 'approved'
      WHERE ${conditions.join(' AND ')}
      ORDER BY relevance_score DESC, a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit + 1); // Get one extra to check if there are more results
    params.push(offset);

    const stmt = db.prepare(searchSQL);
    const results = await stmt.bind(...params).all();

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

    // Get total count for pagination (without LIMIT and OFFSET)
    const countConditions = conditions.slice(); // Copy conditions
    const countParams = params.slice(0, params.length - 2); // Remove LIMIT and OFFSET params

    const countSQL = `
      SELECT COUNT(DISTINCT a.id) as total
      FROM artwork a
      JOIN artwork_types at ON a.type_id = at.id
      LEFT JOIN logbook l ON a.id = l.artwork_id AND l.status = 'approved'
      WHERE ${countConditions.join(' AND ')}
    `;

    const countStmt = db.prepare(countSQL);
    const countResult = await countStmt.bind(...countParams).first();
    const total = (countResult as { total: number })?.total || 0;

    return {
      artworks: artworksWithPhotos,
      total,
      has_more,
      query: query.trim(),
    };
  } catch (error) {
    console.error('Search failed:', error);
    throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}



/**
 * Parse search query to extract potential advanced search terms
 * Supports:
 * - "tag:key" - Search for artworks with specific tag key
 * - "tag:key:value" - Search for artworks with specific tag key and value
 * - Regular text search for everything else
 */
export function parseSearchQuery(query: string): {
  text: string;
  tagKeys: string[];
  tagPairs: Array<{ key: string; value: string }>;
  filters: Record<string, string>;
} {
  const trimmed = query.trim();
  
  if (!trimmed) {
    return {
      text: '',
      tagKeys: [],
      tagPairs: [],
      filters: {},
    };
  }

  const tagKeys: string[] = [];
  const tagPairs: Array<{ key: string; value: string }> = [];
  const textParts: string[] = [];
  
  // Split query into parts and process each
  const parts = trimmed.split(/\s+/);
  
  for (const part of parts) {
    // Check for tag search syntax (case insensitive)
    const tagMatch = part.match(/^tag:([^:]+)(?::(.+))?$/i);

    if (tagMatch && tagMatch[1]) {
      const key = tagMatch[1].toLowerCase().trim();
      const value = tagMatch[2]?.trim();
      
      if (value) {
        // "tag:key:value" format
        tagPairs.push({ key, value });
      } else {
        // "tag:key" format
        tagKeys.push(key);
      }
    } else {
      // Regular text search
      textParts.push(part);
    }
  }

  return {
    text: textParts.join(' ').trim(),
    tagKeys,
    tagPairs,
    filters: {},
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
      sanitized: '',
    };
  }

  if (trimmed.length > 200) {
    return {
      valid: false,
      error: 'Search query too long (max 200 characters)',
      sanitized: trimmed.substring(0, 200),
    };
  }

  // Basic sanitization - remove excessive whitespace
  const sanitized = trimmed.replace(/\s+/g, ' ');

  return {
    valid: true,
    sanitized,
  };
}

/**
 * Get search suggestions based on popular search terms, artwork types, and tag keys/values
 * Supports completion for tag search syntax
 */
export async function getSearchSuggestions(
  db: D1Database,
  partial: string,
  limit: number = 8
): Promise<string[]> {
  const trimmed = partial.trim().toLowerCase();
  
  try {
    const suggestions: string[] = [];
    
    // Check if user is typing tag search syntax
    if (trimmed.startsWith('tag:')) {
      const tagPart = trimmed.substring(4);
      
      if (tagPart.includes(':')) {
        // User is typing "tag:key:" - suggest values for this key
        const [key] = tagPart.split(':');
        const valueStmt = db.prepare(`
          SELECT DISTINCT json_extract(tags, '$.tags.${key}') as tag_value
          FROM artwork 
          WHERE json_extract(tags, '$.tags.${key}') IS NOT NULL
          AND status = 'approved'
          LIMIT ?
        `);
        
        const valueResults = await valueStmt.bind(Math.ceil(limit / 2)).all();
        valueResults.results.forEach((row: any) => {
          if (row.tag_value) {
            suggestions.push(`tag:${key}:${row.tag_value}`);
          }
        });
      } else {
        // User is typing "tag:k..." - suggest tag keys
        const keyStmt = db.prepare(`
          SELECT DISTINCT key
          FROM json_each((
            SELECT json_object(key, COUNT(*)) as keys
            FROM artwork a,
            json_each(json_extract(a.tags, '$.tags')) as tag_data
            WHERE a.status = 'approved'
            GROUP BY key
            ORDER BY COUNT(*) DESC
          ))
          WHERE key LIKE ?
          LIMIT ?
        `);
        
        const keyPattern = `%${tagPart}%`;
        const keyResults = await keyStmt.bind(keyPattern, Math.ceil(limit / 2)).all();
        
        keyResults.results.forEach((row: any) => {
          suggestions.push(`tag:${row.key}`);
        });
        
        // Also suggest some complete tag:key:value pairs for popular tags
        if (suggestions.length < limit) {
          const popularStmt = db.prepare(`
            SELECT DISTINCT 
              key,
              json_extract(tags, '$.tags.' || key) as value
            FROM artwork a,
            json_each(json_extract(a.tags, '$.tags')) as tag_data
            WHERE a.status = 'approved'
            AND key LIKE ?
            ORDER BY key
            LIMIT ?
          `);
          
          const popularResults = await popularStmt.bind(keyPattern, limit - suggestions.length).all();
          popularResults.results.forEach((row: any) => {
            if (row.value) {
              suggestions.push(`tag:${row.key}:${row.value}`);
            }
          });
        }
      }
    } else {
      // Regular text suggestions - artwork types, creators, common terms
      
      // Artwork type suggestions
      const typeStmt = db.prepare(`
        SELECT name
        FROM artwork_types
        WHERE name LIKE ?
        ORDER BY name
        LIMIT ?
      `);
      
      const typePattern = `%${trimmed}%`;
      const typeResults = await typeStmt.bind(typePattern, Math.ceil(limit / 3)).all();
      typeResults.results.forEach((row: any) => {
        suggestions.push(row.name);
      });
      
      // Creator suggestions
      if (suggestions.length < limit) {
        const creatorStmt = db.prepare(`
          SELECT DISTINCT created_by
          FROM artwork
          WHERE created_by IS NOT NULL 
          AND created_by LIKE ?
          AND status = 'approved'
          ORDER BY created_by
          LIMIT ?
        `);
        
        const creatorResults = await creatorStmt.bind(typePattern, Math.ceil(limit / 3)).all();
        creatorResults.results.forEach((row: any) => {
          if (row.created_by) {
            suggestions.push(row.created_by);
          }
        });
      }
      
      // Common tag values as suggestions
      if (suggestions.length < limit) {
        const tagValueStmt = db.prepare(`
          SELECT DISTINCT value
          FROM artwork a,
          json_each(json_extract(a.tags, '$.tags')) as tag_data
          WHERE a.status = 'approved'
          AND value LIKE ?
          ORDER BY value
          LIMIT ?
        `);
        
        const tagValueResults = await tagValueStmt.bind(typePattern, limit - suggestions.length).all();
        tagValueResults.results.forEach((row: any) => {
          if (row.value && typeof row.value === 'string') {
            suggestions.push(row.value);
          }
        });
      }
    }
    
    // Remove duplicates and limit results
    return Array.from(new Set(suggestions)).slice(0, limit);
    
  } catch (error) {
    console.error('Failed to get search suggestions:', error);
    
    // Fallback to basic artwork type suggestions
    try {
      const stmt = db.prepare(`
        SELECT name
        FROM artwork_types
        WHERE name LIKE ?
        ORDER BY name
        LIMIT ?
      `);

      const likePattern = `%${trimmed}%`;
      const results = await stmt.bind(likePattern, limit).all();
      return results.results.map((row: any) => row.name);
    } catch {
      return [];
    }
  }
}
