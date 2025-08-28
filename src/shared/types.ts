// ================================
// Database Schema Types
// ================================

export interface ArtworkRecord {
  id: string;
  title: string;
  artist: string;
  description: string | null;
  medium: string | null;
  dimensions: string | null;
  created_date: string | null;
  acquisition_date: string;
  condition: string | null;
  location: string | null;
  value: number | null;
  status: 'active' | 'archived' | 'damaged' | 'missing';
  tags: string | null; // JSON array of tag IDs
  photo_urls: string | null; // JSON array of R2 URLs
  metadata: string | null; // JSON object for flexible data
  created_at: string;
  updated_at: string;
}

export interface TagRecord {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogbookRecord {
  id: string;
  entry_type: 'artwork_added' | 'artwork_updated' | 'event_logged' | 'maintenance' | 'note';
  title: string;
  description: string;
  related_artwork_id: string | null;
  metadata: string | null; // JSON object
  photos: string | null; // JSON array of R2 URLs
  timestamp: string;
  created_at: string;
}

// ================================
// API Request/Response Types
// ================================

export interface CreateArtworkRequest {
  title: string;
  artist: string;
  description?: string;
  medium?: string;
  dimensions?: string;
  created_date?: string;
  condition?: string;
  location?: string;
  value?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateArtworkRequest extends Partial<CreateArtworkRequest> {
  id: string;
  status?: ArtworkRecord['status'];
}

export interface CreateTagRequest {
  name: string;
  description?: string;
  color?: string;
  category?: string;
}

export interface CreateLogbookEntryRequest {
  entry_type: LogbookRecord['entry_type'];
  title: string;
  description: string;
  related_artwork_id?: string;
  metadata?: Record<string, unknown>;
}

// ================================
// API Response Types
// ================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface ArtworkListResponse extends PaginatedResponse<ArtworkRecord> {}
export interface TagListResponse extends PaginatedResponse<TagRecord> {}
export interface LogbookListResponse extends PaginatedResponse<LogbookRecord> {}

// ================================
// Search and Filter Types
// ================================

export interface ArtworkFilters {
  artist?: string;
  medium?: string;
  status?: ArtworkRecord['status'];
  location?: string;
  tags?: string[];
  created_after?: string;
  created_before?: string;
  search?: string;
}

export interface LogbookFilters {
  entry_type?: LogbookRecord['entry_type'];
  related_artwork_id?: string;
  after?: string;
  before?: string;
  search?: string;
}

// ================================
// File Upload Types
// ================================

export interface PhotoUploadRequest {
  file: File | Uint8Array;
  filename: string;
  artwork_id?: string;
  logbook_entry_id?: string;
  metadata?: Record<string, unknown>;
}

export interface PhotoRecord {
  id: string;
  filename: string;
  original_url: string;
  thumbnail_url: string;
  size: number;
  mime_type: string;
  artwork_id?: string;
  logbook_entry_id?: string;
  metadata?: Record<string, unknown>;
  uploaded_at: string;
}

// ================================
// Configuration Types
// ================================

export interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  frontend_url: string;
  api_base_url: string;
  r2_public_url?: string;
  log_level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
}

// ================================
// Utility Types
// ================================

export type SortDirection = 'asc' | 'desc';

export interface SortOptions {
  field: string;
  direction: SortDirection;
}

export interface PaginationOptions {
  page: number;
  per_page: number;
}

export interface SearchOptions extends PaginationOptions {
  sort?: SortOptions;
  filters?: Record<string, unknown>;
}

// ================================
// Error Types
// ================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  validation_errors?: ValidationError[];
}

// ================================
// Authentication Types (for future use)
// ================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'curator' | 'viewer';
  created_at: string;
  last_login: string | null;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

// ================================
// Type Guards and Validators
// ================================

export const isValidArtworkStatus = (status: string): status is ArtworkRecord['status'] => {
  return ['active', 'archived', 'damaged', 'missing'].includes(status);
};

export const isValidLogbookEntryType = (type: string): type is LogbookRecord['entry_type'] => {
  return ['artwork_added', 'artwork_updated', 'event_logged', 'maintenance', 'note'].includes(type);
};

export const isValidSortDirection = (direction: string): direction is SortDirection => {
  return ['asc', 'desc'].includes(direction);
};

// ================================
// Constants
// ================================

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const ARTWORK_STATUSES = ['active', 'archived', 'damaged', 'missing'] as const;
export const LOGBOOK_ENTRY_TYPES = [
  'artwork_added',
  'artwork_updated',
  'event_logged',
  'maintenance',
  'note',
] as const;
