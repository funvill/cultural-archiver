/**
 * Discovery route handlers - Simplified for Schema Migration
 * Temporary implementation while schema migration is in progress
 */

import type { Context } from 'hono';
import { createSuccessResponse } from '../lib/errors';

/**
 * GET /api/artworks/nearby - Find Nearby Artworks
 */
export async function getNearbyArtworks(c: Context): Promise<Response> {
  return c.json(createSuccessResponse({
    artworks: [],
    count: 0,
    message: 'Nearby artworks endpoint temporarily simplified during schema migration'
  }));
}

/**
 * GET /api/artworks/:id - Get Artwork Details
 */
export async function getArtworkDetails(c: Context): Promise<Response> {
  return c.json(createSuccessResponse({
    artwork: null,
    message: 'Artwork details endpoint temporarily simplified during schema migration'
  }));
}

/**
 * GET /api/artworks - List All Artworks with Pagination
 */
export async function listArtworks(c: Context): Promise<Response> {
  return c.json(createSuccessResponse({
    artworks: [],
    pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    message: 'List artworks endpoint temporarily simplified during schema migration'
  }));
}

/**
 * GET /api/artists - List All Artists with Basic Information
 */
export async function listArtists(c: Context): Promise<Response> {
  return c.json(createSuccessResponse({
    artists: [],
    pagination: { page: 1, limit: 25, total: 0, pages: 0 },
    message: 'List artists endpoint temporarily simplified during schema migration'
  }));
}