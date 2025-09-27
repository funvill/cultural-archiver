/**
 * Lists route handlers
 * Handles all list-related operations for User Lists MVP
 */

import type { Context } from 'hono';
import type { 
  WorkerEnv,
  ListRecord,
  ListApiResponse,
  CreateListRequest,
  CreateListResponse,
  AddToListRequest,
  ListItemsResponse,
  ArtworkApiResponse,
  ValidationError
} from '../types';
import { createDatabaseService } from '../lib/database';
import {
  createSuccessResponse,
  UnauthorizedError,
  ValidationApiError,
  NotFoundError,
  ConflictError,
} from '../lib/errors';
import { getUserToken } from '../middleware/auth';
import { generateUUID } from '../../shared/constants';

const MAX_LIST_ITEMS = 1000; // Per PRD requirements

/**
 * POST /api/lists - Create a new list
 */
export async function createList(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);
  if (!userToken) {
    throw new UnauthorizedError('Authentication required to create lists');
  }

  const db = createDatabaseService(c.env.DB);
  const request = await c.req.json() as CreateListRequest;

  // Validate request
  if (!request.name || typeof request.name !== 'string') {
    const error: ValidationError = {
      field: 'name',
      message: 'List name is required',
      code: 'REQUIRED'
    };
    throw new ValidationApiError([error]);
  }

  const name = request.name.trim();
  if (name.length === 0 || name.length > 255) {
    const error: ValidationError = {
      field: 'name', 
      message: 'List name must be between 1 and 255 characters',
      code: 'INVALID'
    };
    throw new ValidationApiError([error]);
  }

  // Check for duplicate name for this user (case-insensitive)
  const existingListStmt = db.db.prepare(
    'SELECT id FROM lists WHERE owner_user_id = ? AND LOWER(name) = LOWER(?)'
  );
  const existingList = await existingListStmt.bind(userToken, name).first<{ id: string }>();

  if (existingList) {
    throw new ConflictError('You already have a list with this name');
  }

  // Create the list
  const listId = generateUUID();
  const now = new Date().toISOString();

  const insertStmt = db.db.prepare(`
    INSERT INTO lists (id, owner_user_id, name, visibility, is_readonly, is_system_list, created_at, updated_at)
    VALUES (?, ?, ?, 'unlisted', 0, 0, ?, ?)
  `);
  await insertStmt.bind(listId, userToken, name, now, now).run();

  const response: CreateListResponse = {
    id: listId,
    name: name,
    created_at: now,
  };

  return c.json(createSuccessResponse(response, 'List created successfully'));
}

/**
 * GET /api/lists/:id - Get list details with paginated items
 */
export async function getListDetails(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const listId = c.req.param('id');
  if (!listId) {
    const error: ValidationError = {
      field: 'id',
      message: 'List ID is required',
      code: 'REQUIRED'
    };
    throw new ValidationApiError([error]);
  }

  const userToken = getUserToken(c);
  const db = createDatabaseService(c.env.DB);

  // Get list metadata
  const listStmt = db.db.prepare('SELECT * FROM lists WHERE id = ?');
  const list = await listStmt.bind(listId).first<ListRecord>();

  if (!list) {
    throw new NotFoundError('List not found. It may have been deleted by its owner.');
  }

  // Check if list is private and user is not owner
  if (list.visibility === 'private' && list.owner_user_id !== userToken) {
    throw new NotFoundError('List not found. It may have been deleted by its owner.');
  }

  // Get pagination parameters
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
  const offset = (page - 1) * limit;

  // Get total count of items
  const countStmt = db.db.prepare('SELECT COUNT(*) as count FROM list_items WHERE list_id = ?');
  const countResult = await countStmt.bind(listId).first<{ count: number }>();
  
  const totalItems = countResult?.count || 0;

  // Get paginated artwork items (newest first per PRD)
  const itemsQuery = `
    SELECT 
      a.id, a.lat, a.lon, a.created_at, a.status, a.tags, a.photos,
      a.title, a.description, a.type_name
    FROM list_items li
    JOIN artwork a ON li.artwork_id = a.id
    WHERE li.list_id = ?
    ORDER BY li.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const artworkStmt = db.db.prepare(itemsQuery);
  const artworkResults = await artworkStmt.bind(listId, limit, offset).all<ArtworkApiResponse>();

  const artworks = artworkResults.results || [];

  // Parse photos for each artwork
  const artworksWithPhotos = artworks.map((artwork: any) => ({
    ...artwork,
    photos: artwork.photos ? JSON.parse(artwork.photos) : null,
  }));

  const totalPages = Math.ceil(totalItems / limit);
  const hasMore = page < totalPages;

  const listResponse: ListApiResponse = {
    id: list.id,
    owner_user_id: list.owner_user_id,
    name: list.name,
    visibility: list.visibility,
    is_readonly: list.is_readonly === 1,
    is_system_list: list.is_system_list === 1,
    created_at: list.created_at,
    updated_at: list.updated_at,
    item_count: totalItems,
  };

  const response: ListItemsResponse = {
    list: listResponse,
    items: artworksWithPhotos,
    total: totalItems,
    page: page,
    per_page: limit,
    has_more: hasMore,
  };

  return c.json(createSuccessResponse(response));
}

/**
 * POST /api/lists/:id/items - Add artwork to list
 */
export async function addArtworkToList(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);
  if (!userToken) {
    throw new UnauthorizedError('Authentication required to add items to lists');
  }

  const listId = c.req.param('id');
  if (!listId) {
    const error: ValidationError = {
      field: 'id',
      message: 'List ID is required',
      code: 'REQUIRED'
    };
    throw new ValidationApiError([error]);
  }

  const db = createDatabaseService(c.env.DB);
  const request = await c.req.json() as AddToListRequest;

  if (!request.artwork_id || typeof request.artwork_id !== 'string') {
    const error: ValidationError = {
      field: 'artwork_id',
      message: 'Artwork ID is required',
      code: 'REQUIRED'
    };
    throw new ValidationApiError([error]);
  }

  // Verify list exists and user owns it (unless it's a system list they can add to)
  const listStmt = db.db.prepare('SELECT * FROM lists WHERE id = ?');
  const list = await listStmt.bind(listId).first<ListRecord>();

  if (!list) {
    throw new NotFoundError('List not found');
  }

  // Check permissions (owner can add, or anyone can add to their own system lists)
  const canAddToList = list.owner_user_id === userToken && !list.is_readonly;
  
  if (!canAddToList) {
    throw new UnauthorizedError('You do not have permission to add items to this list');
  }

  // Verify artwork exists and is approved
  const artworkStmt = db.db.prepare('SELECT id FROM artwork WHERE id = ? AND status = ?');
  const artwork = await artworkStmt.bind(request.artwork_id, 'approved').first<{ id: string }>();

  if (!artwork) {
    throw new NotFoundError('Artwork not found or not approved');
  }

  // Check if list is at capacity
  const countStmt = db.db.prepare('SELECT COUNT(*) as count FROM list_items WHERE list_id = ?');
  const countResult = await countStmt.bind(listId).first<{ count: number }>();

  const currentCount = countResult?.count || 0;
  if (currentCount >= MAX_LIST_ITEMS) {
    throw new ConflictError('List is full. Maximum 1,000 artworks per list.');
  }

  // Check if artwork is already in the list (no-op if duplicate per PRD)
  const existingItemStmt = db.db.prepare('SELECT id FROM list_items WHERE list_id = ? AND artwork_id = ?');
  const existingItem = await existingItemStmt.bind(listId, request.artwork_id).first<{ id: string }>();

  if (existingItem) {
    // No-op for duplicates per PRD
    return c.json(createSuccessResponse({ message: 'Artwork already in list' }));
  }

  // Add the item
  const itemId = generateUUID();
  const now = new Date().toISOString();

  const insertItemStmt = db.db.prepare(`
    INSERT INTO list_items (id, list_id, artwork_id, added_by_user_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  await insertItemStmt.bind(itemId, listId, request.artwork_id, userToken, now).run();

  // Update list's updated_at timestamp
  const updateListStmt = db.db.prepare('UPDATE lists SET updated_at = ? WHERE id = ?');
  await updateListStmt.bind(now, listId).run();

  return c.json(createSuccessResponse({ 
    message: 'Artwork added to list successfully',
    item_id: itemId 
  }));
}

/**
 * DELETE /api/lists/:id/items - Remove artworks from list (bulk operation)
 */
export async function removeArtworksFromList(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);
  if (!userToken) {
    throw new UnauthorizedError('Authentication required to remove items from lists');
  }

  return c.json(createSuccessResponse({ 
    message: 'Lists feature in development'
  }));
}

/**
 * DELETE /api/lists/:id - Delete list
 */
export async function deleteList(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);
  if (!userToken) {
    throw new UnauthorizedError('Authentication required to delete lists');
  }

  return c.json(createSuccessResponse({ 
    message: 'Lists feature in development'
  }));
}

/**
 * GET /api/me/lists - Get user's lists
 */
export async function getUserLists(c: Context<{ Bindings: WorkerEnv }>): Promise<Response> {
  const userToken = getUserToken(c);
  if (!userToken) {
    throw new UnauthorizedError('Authentication required to view lists');
  }

  const db = createDatabaseService(c.env.DB);

  // Get user's lists with item counts, ordered by updated_at DESC per PRD
  const listsQuery = `
    SELECT 
      l.*,
      COUNT(li.id) as item_count
    FROM lists l
    LEFT JOIN list_items li ON l.id = li.list_id
    WHERE l.owner_user_id = ?
    GROUP BY l.id
    ORDER BY l.is_system_list DESC, l.updated_at DESC
  `;

  const listsStmt = db.db.prepare(listsQuery);
  const listsResult = await listsStmt.bind(userToken).all<ListRecord & { item_count: number }>();

  const lists = (listsResult.results || []).map((list: any) => ({
    id: list.id,
    owner_user_id: list.owner_user_id,
    name: list.name,
    visibility: list.visibility,
    is_readonly: list.is_readonly === 1,
    is_system_list: list.is_system_list === 1,
    created_at: list.created_at,
    updated_at: list.updated_at,
    item_count: list.item_count,
  }));

  return c.json(createSuccessResponse(lists));
}