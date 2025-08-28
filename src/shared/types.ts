// ================================
// Database Schema Types
// ================================

export interface ArtworkTypeRecord {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface ArtworkRecord {
  id: string;
  lat: number;
  lon: number;
  type_id: string;
  created_at: string;
  status: 'pending' | 'approved' | 'removed';
  tags: string | null; // JSON object for key-value metadata like {"material": "bronze", "style": "modern"}
}

export interface LogbookRecord {
  id: string;
  artwork_id: string | null;
  user_token: string;
  note: string | null;
  photos: string | null; // JSON array of R2 URLs like ["url1", "url2", "url3"]
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface TagRecord {
  id: string;
  artwork_id: string | null;
  logbook_id: string | null;
  label: string;
  value: string;
  created_at: string;
}

// ================================
// API Request/Response Types
// ================================

export interface CreateArtworkRequest {
  lat: number;
  lon: number;
  type_id: string;
  tags?: Record<string, unknown>;
}

export interface UpdateArtworkRequest extends Partial<CreateArtworkRequest> {
  id: string;
  status?: ArtworkRecord['status'];
}

export interface CreateArtworkTypeRequest {
  name: string;
  description?: string;
}

export interface CreateTagRequest {
  artwork_id?: string;
  logbook_id?: string;
  label: string;
  value: string;
}

export interface CreateLogbookEntryRequest {
  artwork_id?: string;
  user_token: string;
  note?: string;
  photos?: string[];
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
export interface ArtworkTypeListResponse extends PaginatedResponse<ArtworkTypeRecord> {}
export interface TagListResponse extends PaginatedResponse<TagRecord> {}
export interface LogbookListResponse extends PaginatedResponse<LogbookRecord> {}

// ================================
// Search and Filter Types
// ================================

export interface ArtworkFilters {
  type_id?: string;
  status?: ArtworkRecord['status'];
  lat?: number;
  lon?: number;
  radius?: number; // In meters
  created_after?: string;
  created_before?: string;
  search?: string;
}

export interface LogbookFilters {
  artwork_id?: string;
  user_token?: string;
  status?: LogbookRecord['status'];
  created_after?: string;
  created_before?: string;
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
  return ['pending', 'approved', 'removed'].includes(status);
};

export const isValidLogbookStatus = (status: string): status is LogbookRecord['status'] => {
  return ['pending', 'approved', 'rejected'].includes(status);
};

export const isValidArtworkType = (type: string): type is ArtworkTypeRecord['name'] => {
  return ['public_art', 'street_art', 'monument', 'sculpture', 'other'].includes(type);
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

export const ARTWORK_STATUSES = ['pending', 'approved', 'removed'] as const;
export const LOGBOOK_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const ARTWORK_TYPES = [
  'public_art',
  'street_art', 
  'monument',
  'sculpture',
  'other',
] as const;

// Default search radius in meters
export const DEFAULT_SEARCH_RADIUS = 500;
export const MAX_SEARCH_RADIUS = 10000; // 10km
export const MIN_SEARCH_RADIUS = 50; // 50m
