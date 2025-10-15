/**
 * Mass Import Plugin System - API Exporter
 *
 * This plugin exports unified data to REST APIs with configurable endpoints,
 * authentication, batch processing, and comprehensive error handling.
 */

import type {
  ExporterPlugin,
  ExporterConfig,
  ExportResult,
  ExportRecordResult,
} from '../types/plugin.js';
import type { RawImportData, ValidationResult } from '../types/index.js';

// ================================
// API Exporter Configuration
// ================================

export interface ApiExporterConfig extends ExporterConfig {
  apiEndpoint: string;
  /**
   * When true, artists created by this exporter will be created with status 'approved'.
   * Use with caution; intended for trusted/imported datasets.
   */
  autoApproveArtists?: boolean;
  /**
   * Duplicate detection confidence threshold (0-1).
   * Records with similarity scores above this threshold are considered duplicates.
   * Default: 0.75
   */
  duplicateThreshold?: number;
  /**
   * When true, completely disables duplicate detection and imports all records.
   * Use when re-importing datasets or when you want to create duplicate records.
   * Default: false
   */
  skipDuplicateDetection?: boolean;
  method?: 'POST' | 'PUT' | 'PATCH'; // HTTP method
  headers?: Record<string, string>; // Custom headers
  authentication?: {
    type: 'bearer' | 'apikey' | 'basic' | 'none';
    token?: string;
    username?: string;
    password?: string;
    headerName?: string; // For API key authentication
  };
  timeout?: number; // Request timeout in ms
  retryAttempts?: number; // Number of retry attempts
  retryDelay?: number; // Delay between retries in ms
  validateResponse?: boolean; // Validate API responses
  transformData?: boolean; // Transform data before sending
}

export interface ApiExporterOptions {
  verbose?: boolean;
  dryRun?: boolean;
  logRequests?: boolean;
  logResponses?: boolean;
}

// ================================
// API Response Types
// ================================

interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  statusCode: number;
  headers?: Record<string, string>;
}

interface BatchApiResponse {
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  duplicateRecords: number; // Track duplicate records separately
  responses: ApiResponse[];
  errors: string[];
  processedRecords: ExportRecordResult[]; // Add detailed record results
}

// ================================
// API Exporter Plugin
// ================================

export class ApiExporter implements ExporterPlugin {
  name = 'api';
  description = 'Export data to REST APIs with authentication and batch processing';

  metadata = {
    name: 'api',
    description: 'Export data to REST APIs with authentication and batch processing',
    version: '1.0.0',
    author: 'Cultural Archiver',
    supportedFormats: ['json'],
    requiredFields: ['apiEndpoint'],
    optionalFields: [
      'method',
      'headers',
      'authentication',
      'autoApproveArtists',
      'duplicateThreshold',
      'skipDuplicateDetection',
      'timeout',
      'retryAttempts',
      'retryDelay',
      'validateResponse',
      'transformData',
    ],
  };

  supportedFormats = ['json'];
  requiresNetwork = true;
  outputType = 'api' as const;

  private config: ApiExporterConfig | null = null;
  private options: ApiExporterOptions = {};

  // ================================
  // Plugin Interface Implementation
  // ================================

  async configure(options: Record<string, unknown>): Promise<void> {
    this.options = {
      verbose: false,
      dryRun: false,
      logRequests: false,
      logResponses: false,
      ...options,
    } as ApiExporterOptions;

    // If verbose is true, enable request and response logging
    if (this.options.verbose) {
      this.options.logRequests = true;
      this.options.logResponses = true;
    }

    console.log(`🔧 API Exporter configured:`, this.options);
  }

  async validate(config: ExporterConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const apiConfig = config as ApiExporterConfig;

      // Validate required fields
      if (!apiConfig.apiEndpoint) {
        errors.push('apiEndpoint is required');
      }

      // Validate API endpoint format
      if (apiConfig.apiEndpoint && !this.isValidUrl(apiConfig.apiEndpoint)) {
        errors.push('apiEndpoint must be a valid URL');
      }

      // Validate HTTP method
      if (apiConfig.method && !['POST', 'PUT', 'PATCH'].includes(apiConfig.method)) {
        errors.push('method must be one of: POST, PUT, PATCH');
      }

      // Validate timeout
      if (
        apiConfig.timeout !== undefined &&
        (apiConfig.timeout < 1000 || apiConfig.timeout > 300000)
      ) {
        errors.push('timeout must be between 1000ms and 300000ms (5 minutes)');
      }

      // Validate retry configuration
      if (
        apiConfig.retryAttempts !== undefined &&
        (apiConfig.retryAttempts < 0 || apiConfig.retryAttempts > 10)
      ) {
        errors.push('retryAttempts must be between 0 and 10');
      }

      if (
        apiConfig.retryDelay !== undefined &&
        (apiConfig.retryDelay < 100 || apiConfig.retryDelay > 60000)
      ) {
        errors.push('retryDelay must be between 100ms and 60000ms');
      }

      // Validate authentication
      if (apiConfig.authentication) {
        const auth = apiConfig.authentication;

        if (!['bearer', 'apikey', 'basic', 'none'].includes(auth.type)) {
          errors.push('authentication.type must be one of: bearer, apikey, basic, none');
        }

        if (auth.type === 'bearer' && !auth.token) {
          errors.push('authentication.token is required for bearer authentication');
        }

        if (auth.type === 'basic' && (!auth.username || !auth.password)) {
          errors.push(
            'authentication.username and authentication.password are required for basic authentication'
          );
        }

        if (auth.type === 'apikey' && (!auth.token || !auth.headerName)) {
          errors.push(
            'authentication.token and authentication.headerName are required for API key authentication'
          );
        }
      }

      // Add warnings for best practices
      if (!apiConfig.authentication || apiConfig.authentication.type === 'none') {
        warnings.push(
          'No authentication configured - ensure the API endpoint allows unauthenticated requests'
        );
      }

      if (!apiConfig.timeout) {
        warnings.push('No timeout configured - requests may hang indefinitely');
      }
    } catch (error) {
      errors.push(
        `Configuration validation error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors: errors.map(error => ({
        field: 'config',
        message: error,
        severity: 'error' as const,
      })),
      warnings: warnings.map(warning => ({
        field: 'config',
        message: warning,
        severity: 'warning' as const,
      })),
    };
  }

  async export(data: RawImportData[], config: ExporterConfig): Promise<ExportResult> {
    const startTime = Date.now();

    try {
      this.config = config as ApiExporterConfig;

      // Validate configuration
      const validation = await this.validate(config);
      if (!validation.isValid) {
        throw new Error(
          `Invalid configuration: ${validation.errors?.map(e => e.message).join(', ')}`
        );
      }

      console.log(
        `📤 Starting API export of ${data.length} records to ${this.config.apiEndpoint}...`
      );
      console.log(
        `[API-EXPORTER] Full config received:`,
        JSON.stringify({
          skipDuplicateDetection: this.config.skipDuplicateDetection,
          duplicateThreshold: this.config.duplicateThreshold,
          autoApproveArtists: this.config.autoApproveArtists,
        })
      );

      // Handle dry run mode
      if (this.options.dryRun) {
        return this.handleDryRun(data);
      }

      // Test API connectivity
      await this.testApiConnection();

      // Process data in batches
      const batchResult = await this.processBatches(data);

      const processingTime = Date.now() - startTime;
      console.log(`✅ API export completed in ${processingTime}ms`);

      return {
        success: batchResult.successfulRecords === data.length,
        recordsProcessed: batchResult.totalRecords,
        recordsSuccessful: batchResult.successfulRecords,
        recordsFailed: batchResult.failedRecords,
        recordsSkipped: 0,
        recordsDuplicate: batchResult.duplicateRecords,
        details: {
          processedRecords: batchResult.processedRecords,
          timing: {
            startTime: new Date(startTime),
            endTime: new Date(),
            duration: processingTime,
          },
          configuration: this.config,
        },
        ...(batchResult.errors.length > 0 && {
          errors: batchResult.errors.map(error => ({
            field: 'api',
            message: error,
            severity: 'error' as const,
          })),
        }),
        summary: `API export: ${batchResult.successfulRecords}/${batchResult.totalRecords} records successful, ${batchResult.duplicateRecords} duplicates (${processingTime}ms)`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'API export failed';
      console.error(`❌ API export failed:`, error);

      return {
        success: false,
        recordsProcessed: data.length,
        recordsSuccessful: 0,
        recordsFailed: data.length,
        recordsSkipped: 0,
        recordsDuplicate: 0,
        errors: [{ field: 'export', message: errorMessage, severity: 'error' }],
        summary: `API export failed: ${errorMessage}`,
      };
    }
  }

  // ================================
  // API Processing Methods
  // ================================

  private async testApiConnection(): Promise<void> {
    if (!this.config?.apiEndpoint) {
      throw new Error('API endpoint not configured');
    }

    try {
      const testUrl = new URL('/health', this.config.apiEndpoint).toString();
      const response = await this.makeRequest(testUrl, 'GET', {});

      if (this.options.verbose) {
        console.log(`🔍 API connectivity test: ${response.statusCode}`);
      }
    } catch (error) {
      // Connection test is optional - log warning but don't fail
      if (this.options.verbose) {
        console.warn(`⚠️ API connectivity test failed:`, error);
      }
    }
  }

  private async processBatches(data: RawImportData[]): Promise<BatchApiResponse> {
    const batchSize = this.config?.batchSize ?? 10;
    const totalBatches = Math.ceil(data.length / batchSize);

    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalDuplicates = 0; // Track duplicates
    const allResponses: ApiResponse[] = [];
    const allErrors: string[] = [];
    const processedRecords: ExportRecordResult[] = [];

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, data.length);
      const batchData = data.slice(startIndex, endIndex);

      console.log(
        `📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batchData.length} records)`
      );

      try {
        const batchResponses = await this.processBatch(batchData);

        // Process responses and build detailed results
        for (let i = 0; i < batchResponses.length; i++) {
          const response = batchResponses[i];
          const record = batchData[i];
          if (!response || !record) continue;

          allResponses.push(response);

          // Generate external ID for tracking
          const externalId = `batch_${batchIndex}_record_${i}`;

          if (response.success) {
            // Debug: Log response data to understand the structure
            if (this.options.verbose) {
              console.log(
                `🔍 DEBUG: Response data for record ${i}:`,
                JSON.stringify(response.data, null, 2)
              );
            }

            // Check if this is a duplicate detection from the API
            if (this.isDuplicateResponse(response)) {
              totalDuplicates++;
              
              // Extract duplicate detection details from API response
              const duplicateDetails = this.extractDuplicateDetails(response);
              
              processedRecords.push({
                externalId,
                status: 'skipped',
                reason: 'duplicate',
                recordData: record,
                ...(duplicateDetails && { duplicateInfo: duplicateDetails }),
              });

              if (this.options.verbose) {
                console.log(`✅ Detected duplicate for record ${i}`);
                if (duplicateDetails) {
                  console.log(`   Match: ${duplicateDetails.existingTitle || 'unknown'} (ID: ${duplicateDetails.existingId || 'unknown'})`);
                  console.log(`   Confidence: ${duplicateDetails.confidenceScore || 'unknown'}`);
                  console.log(`   Score breakdown: ${JSON.stringify(duplicateDetails.scoreBreakdown || {})}`);
                }
              }
            } else {
              totalSuccessful++;

              // Attempt to extract created resource IDs from the API response and
              // construct a canonical URL for the newly created resource. The
              // mass-import v2 API returns created items under
              // response.data.results.artworks.created or .artists.created arrays.
              const recordDataWithUrl = { ...(record as Record<string, unknown>) } as Record<string, unknown>;

              try {
                const parsed = response.data as any;

                // Responses sometimes nest payload under `data` (response.data.data.results)
                const results = parsed?.data?.results ?? parsed?.results;

                // Prefer artworks, then artists
                const createdArtwork = results?.artworks?.created?.[0];
                const createdArtist = results?.artists?.created?.[0];

                const base = this.config?.apiEndpoint ? String(this.config.apiEndpoint) : undefined;

                if (createdArtwork && createdArtwork.id) {
                  if (base) {
                    // If apiEndpoint points to the API root, build a full URL
                    try {
                      recordDataWithUrl.createdUrl = new URL(`/api/artworks/${createdArtwork.id}`, base).toString();
                    } catch {
                      recordDataWithUrl.createdUrl = `/api/artworks/${createdArtwork.id}`;
                    }
                  } else {
                    recordDataWithUrl.createdUrl = `/api/artworks/${createdArtwork.id}`;
                  }
                } else if (createdArtist && createdArtist.id) {
                  if (base) {
                    try {
                      recordDataWithUrl.createdUrl = new URL(`/api/artists/${createdArtist.id}`, base).toString();
                    } catch {
                      recordDataWithUrl.createdUrl = `/api/artists/${createdArtist.id}`;
                    }
                  } else {
                    recordDataWithUrl.createdUrl = `/api/artists/${createdArtist.id}`;
                  }
                }
              } catch (e) {
                // Non-fatal - if we can't parse response data, continue without URL
                if (this.options.verbose) {
                  console.warn('Could not extract created ID from API response', e);
                }
              }

              processedRecords.push({
                externalId,
                status: 'success',
                recordData: recordDataWithUrl as RawImportData,
              });
            }
          } else {
            totalFailed++;
            processedRecords.push({
              externalId,
              status: 'failed',
              error: response.error || 'Unknown API error',
              recordData: record,
            });
            if (response.error) {
              allErrors.push(response.error);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Batch ${batchIndex + 1} failed:`, error);
        totalFailed += batchData.length;
        allErrors.push(
          `Batch ${batchIndex + 1}: ${error instanceof Error ? error.message : String(error)}`
        );

        // Add failed responses and records for each record in the batch
        for (let i = 0; i < batchData.length; i++) {
          const record = batchData[i];
          if (!record) continue;

          const externalId = `batch_${batchIndex}_record_${i}`;

          allResponses.push({
            success: false,
            statusCode: 0,
            ...(error instanceof Error && { error: `Batch processing failed: ${error.message}` }),
          });

          processedRecords.push({
            externalId,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Batch processing failed',
            recordData: record,
          });
        }
      }
    }

    return {
      totalRecords: data.length,
      successfulRecords: totalSuccessful,
      failedRecords: totalFailed,
      duplicateRecords: totalDuplicates,
      responses: allResponses,
      errors: allErrors,
      processedRecords,
    };
  }

  private async processBatch(batchData: RawImportData[]): Promise<ApiResponse[]> {
    const responses: ApiResponse[] = [];

    // Process each record in the batch
    for (const record of batchData) {
      try {
        const transformedData = this.config?.transformData
          ? await this.transformRecord(record)
          : record;

        const response = await this.sendRecord(transformedData);
        responses.push(response);

        if (this.options.logResponses && this.options.verbose) {
          console.log(`📥 Response for record:`, response);
        }
      } catch (error) {
        const errorResponse: ApiResponse = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          statusCode: 0,
        };
        responses.push(errorResponse);
      }
    }

    return responses;
  }

  private async sendRecord(record: RawImportData | Record<string, unknown>): Promise<ApiResponse> {
    if (!this.config?.apiEndpoint) {
      throw new Error('API endpoint not configured');
    }

    const method = this.config.method ?? 'POST';

    // Transform the record to match the mass-import v2 API format
    const payload = this.transformToApiFormat(record);

    if (this.options.logRequests && this.options.verbose) {
      console.log(`📤 ${method} ${this.config.apiEndpoint}:`, payload);
    }

    return await this.makeRequestWithRetry(this.config.apiEndpoint, method, payload);
  }

  /**
   * Check if API response indicates a duplicate was detected
   * Based on the mass-import API v2 response format where duplicates return success but 0 records processed
   */
  private isDuplicateResponse(response: ApiResponse): boolean {
    if (!response.success || !response.data) {
      return false;
    }

    try {
      const data = response.data as Record<string, unknown>;

      // Handle nested response structure: response.data.data.summary
      let summary = data.summary as Record<string, unknown>;
      if (!summary && data.data) {
        const nestedData = data.data as Record<string, unknown>;
        summary = nestedData.summary as Record<string, unknown>;
      }

      if (summary) {
        // If this batch had duplicates and no successes, it's a duplicate response
        const totalDuplicates = Number(summary.totalDuplicates) || 0;
        const totalSucceeded = Number(summary.totalSucceeded) || 0;

        return totalDuplicates > 0 && totalSucceeded === 0;
      }

      // Fallback: check for older API format with "duplicate" message
      return typeof data.message === 'string' && data.message.toLowerCase().includes('duplicate');
    } catch {
      return false;
    }
  }

  /**
   * Extract duplicate detection details from API response for diagnostic purposes
   * Returns information about the matched artwork/artist including confidence scores
   */
  private extractDuplicateDetails(response: ApiResponse): Record<string, unknown> | null {
    if (!response.success || !response.data) {
      return null;
    }

    try {
      const data = response.data as Record<string, unknown>;

      // Handle nested response structure: response.data.data.results
      let results = data.results as Record<string, unknown>;
      if (!results && data.data) {
        const nestedData = data.data as Record<string, unknown>;
        results = nestedData.results as Record<string, unknown>;
      }

      if (!results) {
        return null;
      }

      // Check for duplicate in artworks
      const artworks = results.artworks as Record<string, unknown>;
      if (artworks && artworks.duplicates && Array.isArray(artworks.duplicates) && artworks.duplicates.length > 0) {
        const duplicate = artworks.duplicates[0] as Record<string, unknown>;
        return {
          type: 'artwork',
          existingId: duplicate.existingId || duplicate.id,
          existingTitle: duplicate.title,
          confidenceScore: duplicate.confidenceScore,
          scoreBreakdown: duplicate.scoreBreakdown,
          reason: duplicate.error || duplicate.reason || 'DUPLICATE_DETECTED',
        };
      }

      // Check for duplicate in artists
      const artists = results.artists as Record<string, unknown>;
      if (artists && artists.duplicates && Array.isArray(artists.duplicates) && artists.duplicates.length > 0) {
        const duplicate = artists.duplicates[0] as Record<string, unknown>;
        return {
          type: 'artist',
          existingId: duplicate.existingId || duplicate.id,
          existingTitle: duplicate.title || duplicate.name,
          confidenceScore: duplicate.confidenceScore,
          scoreBreakdown: duplicate.scoreBreakdown,
          reason: duplicate.error || duplicate.reason || 'DUPLICATE_DETECTED',
        };
      }

      return null;
    } catch (e) {
      if (this.options.verbose) {
        console.warn('Could not extract duplicate details from API response', e);
      }
      return null;
    }
  }

  private transformToApiFormat(record: RawImportData | Record<string, unknown>): unknown {
    // Transform single record to mass-import v2 API format
    const recordData = record as Record<string, unknown>;

    // Generate a unique import ID for this batch
    const importId = `mass-import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Heuristic: if this record looks like an artist-only record (no location and
    // explicit artist importer externalId or tag), send it under data.artists so the
    // server runs artist duplicate detection instead of artwork duplicate detection.
    const isLatZero = Number(recordData.lat) === 0 && Number(recordData.lon) === 0;
    const externalId = String(recordData.externalId || '');
    const tags = (recordData.tags as Record<string, unknown>) || {};
    const tagType = (tags && (tags.type as string)) || '';

    console.log(`[API-EXPORTER-DEBUG] Artist detection for "${recordData.title}":`, {
      isLatZero,
      lat: recordData.lat,
      lon: recordData.lon,
      externalId,
      tagType,
      tags,
      startsWithArtistJson: externalId.startsWith('artist-json-'),
      tagTypeIsArtist: tagType.toLowerCase() === 'artist',
    });

    const looksLikeArtist =
      isLatZero && (externalId.startsWith('artist-json-') || tagType.toLowerCase() === 'artist');

    console.log(`[API-EXPORTER] Artist detection result for "${recordData.title}": ${looksLikeArtist}`);

    if (looksLikeArtist) {
      console.log(`[API-EXPORTER] Detected artist record: ${recordData.title}, sending to data.artists`);
      return {
        metadata: {
          importId,
          source: {
            pluginName: 'mass-import-system',
            pluginVersion: '1.0.0',
            originalDataSource: String(recordData.source || 'unknown'),
          },
          timestamp: new Date().toISOString(),
        },
        config: {
          duplicateThreshold: this.config?.duplicateThreshold ?? 0.75,
          skipDuplicateDetection: this.config?.skipDuplicateDetection ?? false,
          enableTagMerging: true,
          createMissingArtists: true,
          batchSize: 1,
          // When we detect an artist-like record, request server auto-approval
          autoApproveArtists: true,
        },
        data: {
            artists: [
              {
                // Use the RawImportData shape expected by the API
                  title: String(recordData.title || ''),
                  description: String(recordData.description || ''),
                  lat: Number(recordData.lat),
                  lon: Number(recordData.lon),
                  source: String(recordData.source || ''),
                  externalId: String(recordData.externalId || ''),
                  tags: tags,
                  photos: (recordData.photos as unknown[]) || [],
                  ...(this.config?.autoApproveArtists ? { status: 'approved' } : {}),
              },
            ],
          },
      };
    }

    console.log(`[API-EXPORTER] Not detected as artist: lat=${recordData.lat}, lon=${recordData.lon}, externalId=${externalId}, sending to data.artworks`);

    return {
      metadata: {
        importId,
        source: {
          pluginName: 'mass-import-system',
          pluginVersion: '1.0.0',
          originalDataSource: String(recordData.source || 'unknown'),
        },
        timestamp: new Date().toISOString(),
      },
      config: {
        duplicateThreshold: this.config?.duplicateThreshold ?? 0.75,
        skipDuplicateDetection: this.config?.skipDuplicateDetection ?? false,
        enableTagMerging: true,
        createMissingArtists: true,
        batchSize: 1,
      },
      data: {
        artworks: [
          {
            title: String(recordData.title || ''),
            description: String(recordData.description || ''),
            lat: Number(recordData.lat),
            lon: Number(recordData.lon),
            artist: String(recordData.artist || ''),
            source: String(recordData.source || ''),
            externalId: String(recordData.externalId || ''),
            tags: tags,
            photos: (recordData.photos as unknown[]) || [],
          },
        ],
      },
    };
  }

  private async makeRequestWithRetry(
    url: string,
    method: string,
    data: unknown
  ): Promise<ApiResponse> {
    const maxAttempts = (this.config?.retryAttempts ?? 3) + 1;
    const retryDelay = this.config?.retryDelay ?? 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.makeRequest(url, method, data);
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }

        if (this.options.verbose) {
          console.warn(`⚠️ Attempt ${attempt} failed, retrying in ${retryDelay}ms:`, error);
        }

        await this.delay(retryDelay);
      }
    }

    throw new Error('All retry attempts exhausted');
  }

  private async makeRequest(url: string, method: string, data: unknown): Promise<ApiResponse> {
    const timeout = this.config?.timeout ?? 30000;
    const headers = this.buildHeaders();

    const requestOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(timeout),
    };

    if (method !== 'GET' && data) {
      requestOptions.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, requestOptions);
      const responseData = await response.text();

      let parsedData: unknown;
      try {
        parsedData = JSON.parse(responseData);
      } catch {
        parsedData = responseData;
      }

      return {
        success: response.ok,
        data: parsedData,
        statusCode: response.status,
        headers: this.extractHeaders(response.headers),
        ...(response.ok ? {} : { error: `HTTP ${response.status}: ${response.statusText}` }),
      };
    } catch (error) {
      throw new Error(`Request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ================================
  // Helper Methods
  // ================================

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': `Cultural-Archiver-API-Exporter/${this.metadata.version}`,
      ...this.config?.headers,
    };

    // Add authentication headers
    if (this.config?.authentication && this.config.authentication.type !== 'none') {
      const auth = this.config.authentication;

      switch (auth.type) {
        case 'bearer':
          if (auth.token) {
            headers['Authorization'] = `Bearer ${auth.token}`;
          }
          break;

        case 'apikey':
          if (auth.token && auth.headerName) {
            headers[auth.headerName] = auth.token;
          }
          break;

        case 'basic':
          if (auth.username && auth.password) {
            const credentials = btoa(`${auth.username}:${auth.password}`);
            headers['Authorization'] = `Basic ${credentials}`;
          }
          break;
      }
    }

    return headers;
  }

  private extractHeaders(headers: Headers): Record<string, string> {
    const headerObj: Record<string, string> = {};
    headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    return headerObj;
  }

  private async transformRecord(record: RawImportData): Promise<Record<string, unknown>> {
    // This is a placeholder for data transformation logic
    // In a real implementation, this could apply various transformations
    // based on the target API's expected format
    return {
      ...record,
      exported_at: new Date().toISOString(),
      exporter: this.name,
    };
  }

  private handleDryRun(data: RawImportData[]): ExportResult {
    console.log(`🏃‍♂️ DRY RUN: Would export ${data.length} records to ${this.config?.apiEndpoint}`);

    if (this.options.verbose) {
      console.log('Sample record that would be sent:', data[0]);
      console.log('Headers that would be used:', this.buildHeaders());
    }

    return {
      success: true,
      recordsProcessed: data.length,
      recordsSuccessful: data.length,
      recordsFailed: 0,
      recordsSkipped: 0,
      summary: `DRY RUN: Would export ${data.length} records to API`,
    };
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ================================
  // Utility Methods
  // ================================

  getCapabilities(): string[] {
    return [
      'batch-processing',
      'authentication',
      'retry-logic',
      'request-logging',
      'dry-run-mode',
      'timeout-handling',
    ];
  }

  getSupportedFormats(): string[] {
    return this.supportedFormats;
  }
}
