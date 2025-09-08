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
import type { ExistingArtwork } from './duplicate-detection';
import { detectDuplicates, checkExternalIdDuplicate } from './duplicate-detection';

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

    // Add request interceptor for authentication
    this.axios.interceptors.request.use(request => {
      // Add mass import user token to requests
      if (request.data) {
        request.data.user_token = config.massImportUserToken;
      }
      return request;
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
      }

      // If no exact match, do fuzzy duplicate detection
      if (!duplicateDetection) {
        duplicateDetection = await detectDuplicates(data, this.config, existingArtworks);
      }

      // Skip if duplicate detected (unless dry run mode)
      if (duplicateDetection.isDuplicate && !this.config.dryRun) {
        return {
          id: recordId,
          success: false,
          error: `Duplicate detected: ${duplicateDetection.bestMatch?.reason}`,
          warnings: [],
          duplicateDetection,
          photosProcessed: 0,
          photosFailed: 0,
        };
      }

      // Step 2: Process photos if not in dry-run mode
      let photosProcessed = 0;
      let photosFailed = 0;
      let processedPhotos: string[] = [];

      if (!this.config.dryRun && data.photos.length > 0) {
        const photoResults = await this.processPhotos(data.photos);
        photosProcessed = photoResults.successful.length;
        photosFailed = photoResults.failed.length;
        processedPhotos = photoResults.successful;
      }

      // Step 3: Submit to logbook API if not in dry-run mode
      let submissionId: string | undefined;
      const warnings: string[] = [];

      if (!this.config.dryRun) {
        const submissionResult = await this.submitToLogbook(data, processedPhotos);
        submissionId = submissionResult.id;
        warnings.push(...submissionResult.warnings);
      }

      const result: ImportResult = {
        id: recordId,
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
      const response = await this.axios.get('/api/artwork/nearby', {
        params: {
          lat,
          lon,
          radius: this.config.duplicateDetectionRadius,
          limit: 20, // Limit to prevent large responses
        },
      });

      return response.data.artworks || [];
    } catch (error) {
      console.warn('Failed to fetch nearby artworks for duplicate detection:', error);
      return []; // Continue without duplicate detection rather than failing
    }
  }

  /**
   * Submit data to the logbook API
   */
  private async submitToLogbook(
    data: ProcessedImportData,
    photoUrls: string[]
  ): Promise<{ id: string; warnings: string[] }> {
    const payload = {
      lat: data.lat,
      lon: data.lon,
      note: data.note,
      user_token: this.config.massImportUserToken,
      photos: photoUrls,
      tags: JSON.stringify(data.tags),
    };

    const response = await this.axios.post('/api/logbook', payload);
    
    return {
      id: response.data.id,
      warnings: response.data.warnings || [],
    };
  }

  /**
   * Process photos for upload
   */
  private async processPhotos(photos: PhotoInfo[]): Promise<{
    successful: string[];
    failed: Array<{ photo: PhotoInfo; error: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ photo: PhotoInfo; error: string }> = [];

    for (const photo of photos) {
      try {
        const processedUrl = await this.processPhoto(photo);
        successful.push(processedUrl);
      } catch (error) {
        console.warn(`Failed to process photo ${photo.url}:`, error);
        failed.push({
          photo,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Process a single photo for upload
   */
  private async processPhoto(photo: PhotoInfo): Promise<string> {
    // For now, return the original URL
    // In a full implementation, this would:
    // 1. Download the photo
    // 2. Validate format and size
    // 3. Upload to R2 storage
    // 4. Generate thumbnails
    // 5. Return the R2 URL
    
    // Validate that the photo URL is accessible
    try {
      const response = await axios.head(photo.url, { timeout: 10000 });
      
      // Check if it's actually an image
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`URL does not point to an image: ${contentType}`);
      }

      return photo.url; // Return original URL for now
    } catch (error) {
      throw new Error(`Photo not accessible: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Setup retry logic for failed requests
   */
  private setupRetryLogic(): void {
    this.axios.interceptors.response.use(
      response => response,
      async (error: AxiosError) => {
        const config = error.config as any; // Cast to any to add custom properties
        
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
        success: true,
        warnings: photoValidation.warnings,
        duplicateDetection,
        photosProcessed: photoValidation.validPhotos,
        photosFailed: photoValidation.invalidPhotos,
      };

    } catch (error) {
      return {
        id: recordId,
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