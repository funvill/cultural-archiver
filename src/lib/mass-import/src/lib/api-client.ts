/**
 * Mass Import System - API Integration
 * 
 * This module handles integration with the existing Cultural Archiver API
 * endpoints for submitting logbook entries and managing photos.
 */

import axios, { type AxiosInstance, AxiosError } from 'axios';
import type {
  ProcessedImportData,
  ImportResult,
  MassImportConfig,
  PhotoInfo,
} from '../types';
import type { ExistingArtwork } from './duplicate-detection.js';
import { detectDuplicates, checkExternalIdDuplicate } from './duplicate-detection.js';

// ================================
// API Client Configuration
// ================================

export class MassImportAPIClient {
  private axios: AxiosInstance;
  protected config: MassImportConfig;

  constructor(config: MassImportConfig) {
    this.config = config;
    this.axios = axios.create({
      baseURL: config.apiEndpoint,
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'cultural-archiver-mass-import/1.0.0',
      },
    });

    // Add retry logic for failed requests
    this.setupRetryLogic();
  }

  /**
   * Submit a single import record
   */
  async submitImportRecord(data: ProcessedImportData): Promise<ImportResult> {
    const recordId = data.externalId || `import_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    try {
      // Step 1: Check for duplicates
      const existingArtworks = await this.fetchNearbyArtworks(data.lat, data.lon);
      
      // Debug logging for the specific records we're importing
      console.log(`[DUPLICATE_DEBUG] Processing import record: external_id="${data.externalId}", source="${data.source}"`);
      
      // Check external ID first (exact match)
      let duplicateDetection = null;
      if (data.externalId && data.source) {
        const exactDuplicate = checkExternalIdDuplicate(data.externalId, data.source, existingArtworks);
        if (exactDuplicate) {
          duplicateDetection = {
            isDuplicate: true,
            candidates: [exactDuplicate],
            bestMatch: exactDuplicate,
          };
        }
      } else {
        console.log(`[DUPLICATE_DEBUG] Missing external_id or source for exact duplicate check`);
      }

      // If no exact match, do fuzzy duplicate detection
      if (!duplicateDetection) {
        duplicateDetection = await detectDuplicates(data, this.config, existingArtworks);
      }

      // Skip if duplicate detected (unless dry run mode)
      if (duplicateDetection.isDuplicate && !this.config.dryRun) {
        return {
          id: recordId,
          title: data.title || 'Unknown',
          success: false,
          error: `Duplicate detected: ${duplicateDetection.bestMatch?.reason}`,
          warnings: [],
          duplicateDetection,
          photosProcessed: 0,
          photosFailed: 0,
        };
      }

      // Step 2: Extract photo URLs for mass import endpoint
      let photosProcessed = 0;
      let photosFailed = 0;
      const photoUrls: string[] = data.photos.map(photo => photo.url); // Extract URLs from photo objects

      if (!this.config.dryRun && data.photos.length > 0) {
        // The mass import endpoint will handle photo downloading and processing
        photosProcessed = data.photos.length; // Assume all will be processed by backend
        photosFailed = 0; // Backend will handle failures internally
      }

      // Step 3: Submit to mass import API if not in dry-run mode
      let submissionId: string | undefined;
      const warnings: string[] = [];

      if (!this.config.dryRun) {
        const submissionResult = await this.submitToMassImport(data, photoUrls);
        submissionId = submissionResult.id;
        warnings.push(...submissionResult.warnings);
      }

      const result: ImportResult = {
        id: recordId,
        title: data.title || 'Untitled Artwork',
        success: true,
        warnings,
        duplicateDetection,
        photosProcessed,
        photosFailed,
      };

      if (submissionId) {
        result.submissionId = submissionId;
      }

      return result;

    } catch (error) {
      console.error(`Failed to process import record ${recordId}:`, error);
      
      return {
        id: recordId,
        title: data.title || 'Unknown',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        warnings: [],
        duplicateDetection: {
          isDuplicate: false,
          candidates: [],
        },
        photosProcessed: 0,
        photosFailed: 0,
      };
    }
  }

  /**
   * Fetch nearby artworks for duplicate detection
   */
  protected async fetchNearbyArtworks(lat: number, lon: number): Promise<ExistingArtwork[]> {
    try {
      // NOTE: Backend exposes /api/artworks/nearby (plural). Previous implementation
      // used singular '/api/artwork/nearby' which returned 404 and disabled
      // duplicate detection. Keep a fallback request path for any legacy
      // deployments just in case.
      const endpoint = '/api/artworks/nearby';
      
      // Use a larger radius for duplicate detection to ensure we catch nearby artworks
      // The duplicate detection algorithm will filter by precise distance anyway
      const searchRadius = Math.max(this.config.duplicateDetectionRadius, 100); // minimum 100m search
      
      const response = await this.axios.get(endpoint, {
        params: {
          lat,
          lon,
          radius: searchRadius,
          limit: 50, // Increase limit to catch more potential duplicates
        },
      });
      
      // Debug logging for duplicate detection issues
      console.log(`[DUPLICATE_DEBUG] Fetching nearby artworks at ${lat},${lon} within ${searchRadius}m`);
      
      // Worker responses are wrapped with ApiResponse { success, data: { artworks: [...] }}
      const raw: unknown = response.data;

      interface NearbyWrapped { 
        data?: { artworks?: ExistingArtwork[] }; 
        artworks?: ExistingArtwork[] 
      }
      
      const candidate = raw as NearbyWrapped;
      let artworks: ExistingArtwork[] = [];
      
      if (candidate) {
        if (Array.isArray(candidate.artworks)) {
          artworks = candidate.artworks;
        } else if (candidate.data && Array.isArray(candidate.data.artworks)) {
          artworks = candidate.data.artworks;
        }
      }
      
      console.log(`[DUPLICATE_DEBUG] Found ${artworks.length} nearby artworks`);
      
      // Log details about each artwork for debugging
      artworks.forEach(artwork => {
        const tags = artwork.tags_parsed || {};
        console.log(`[DUPLICATE_DEBUG] Artwork ${artwork.id}: title="${artwork.title}", external_id="${tags.external_id || 'none'}", source="${tags.source || 'none'}"`);
      });
      
      return artworks;
    } catch (error) {
      console.warn('Failed to fetch nearby artworks for duplicate detection:', error);
      return []; // Continue without duplicate detection rather than failing
    }
  }

  /**
   * Submit data to the mass import API with the new endpoint format
   */
  private async submitToMassImport(
    data: ProcessedImportData,
    photoUrls: string[]
  ): Promise<{ id: string; warnings: string[] }> {
    // Use the new mass import endpoint that matches our documentation
    const requestBody = {
      user_uuid: this.config.massImportUserToken,
      artwork: {
        title: data.title || 'Untitled Artwork',
        lat: data.lat,
        lon: data.lon,
        photos: photoUrls.map(url => ({ url })),
      },
      // Create logbook entry with notes and tags
      logbook: [{
        note: data.note || `Imported from ${data.source}`,
        timestamp: new Date().toISOString(),
        tags: data.tags ? Object.entries(data.tags).map(([label, value]) => ({
          label,
          value: String(value),
        })) : [],
      }],
    };

    const response = await this.axios.post('/api/mass-import', requestBody, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Parse response matching new endpoint format
    const raw: unknown = response.data;
    type SubmissionShape = { 
      success: boolean; 
      data: { 
        artwork_id: string; 
        status: string; 
        message: string;
      } 
    };
    
    if (!raw || typeof raw !== 'object' || !('success' in raw)) {
      throw new Error('Unexpected mass import response format');
    }
    
    const submission = raw as SubmissionShape;
    if (!submission.success || !submission.data) {
      throw new Error(`Mass import failed: ${submission.data?.message || 'Unknown error'}`);
    }
    
    return {
      id: submission.data.artwork_id,
      warnings: [], // New endpoint doesn't return warnings in response
    };
  }

  /**
   * Setup retry logic for failed requests
   */
  private setupRetryLogic(): void {
    this.axios.interceptors.response.use(
      response => response,
      async (error: AxiosError) => {
  // Extend axios request config with retry metadata dynamically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = error.config as Record<string, any> | undefined;
        
        if (!config || config.retry === false) {
          return Promise.reject(error);
        }

        // Set initial retry count
        config.retryCount = config.retryCount || 0;

        // Check if we should retry
        if (
          config.retryCount >= this.config.maxRetries ||
          !this.shouldRetry(error)
        ) {
          return Promise.reject(error);
        }

        // Increment retry count
        config.retryCount++;

        // Calculate delay (exponential backoff)
        const delay = this.config.retryDelay * Math.pow(2, config.retryCount - 1);

        console.warn(
          `Request failed, retrying in ${delay}ms (attempt ${config.retryCount}/${this.config.maxRetries}):`,
          error.message
        );

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry the request
        return this.axios(config);
      }
    );
  }

  /**
   * Determine if a request should be retried
   */
  private shouldRetry(error: AxiosError): boolean {
    // Don't retry on client errors (4xx)
    if (error.response && error.response.status >= 400 && error.response.status < 500) {
      return false;
    }

    // Retry on network errors, timeouts, and server errors (5xx)
    return (
      !error.response || // Network error
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      (error.response.status >= 500) // Server error
    );
  }
}

// ================================
// Dry Run API Client
// ================================

/**
 * API client for dry-run operations (validation only)
 */
export class DryRunAPIClient extends MassImportAPIClient {
  override async submitImportRecord(data: ProcessedImportData): Promise<ImportResult> {
    const recordId = data.externalId || `dryrun_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    try {
      // Still do duplicate detection for dry runs
      const existingArtworks = await this.fetchNearbyArtworks(data.lat, data.lon);
      
      let duplicateDetection = null;
      if (data.externalId && data.source) {
        const exactDuplicate = checkExternalIdDuplicate(data.externalId, data.source, existingArtworks);
        if (exactDuplicate) {
          duplicateDetection = {
            isDuplicate: true,
            candidates: [exactDuplicate],
            bestMatch: exactDuplicate,
          };
        }
      }

      if (!duplicateDetection) {
        duplicateDetection = await detectDuplicates(data, this.config, existingArtworks);
      }

      // For dry runs, validate photos without actually processing them
      const photoValidation = await this.validatePhotos(data.photos);

      return {
        id: recordId,
        title: data.title || 'Unknown',
        success: true,
        warnings: photoValidation.warnings,
        duplicateDetection,
        photosProcessed: photoValidation.validPhotos,
        photosFailed: photoValidation.invalidPhotos,
      };

    } catch (error) {
      return {
        id: recordId,
        title: data.title || 'Unknown',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        warnings: [],
        duplicateDetection: {
          isDuplicate: false,
          candidates: [],
        },
        photosProcessed: 0,
        photosFailed: 0,
      };
    }
  }

  /**
   * Validate photos without downloading/processing them
   */
  private async validatePhotos(photos: PhotoInfo[]): Promise<{
    validPhotos: number;
    invalidPhotos: number;
    warnings: string[];
  }> {
    let validPhotos = 0;
    let invalidPhotos = 0;
    const warnings: string[] = [];

    for (const photo of photos) {
      try {
        // Quick HEAD request to validate URL
        await axios.head(photo.url, { timeout: 5000 });
        validPhotos++;
      } catch (error) {
        invalidPhotos++;
        warnings.push(`Photo not accessible: ${photo.url}`);
      }
    }

    return { validPhotos, invalidPhotos, warnings };
  }

  // Override to prevent actual API calls
  protected override async fetchNearbyArtworks(_lat: number, _lon: number): Promise<ExistingArtwork[]> {
    // In dry-run mode, we could return mock data or fetch from a cached source
    // For now, return empty array to skip duplicate detection
    return [];
  }
}