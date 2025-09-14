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
} from '../types/plugin.js';
import type { RawImportData, ValidationResult } from '../types/index.js';

// ================================
// API Exporter Configuration
// ================================

export interface ApiExporterConfig extends ExporterConfig {
  apiEndpoint: string;
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
  responses: ApiResponse[];
  errors: string[];
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
    optionalFields: ['method', 'headers', 'authentication', 'timeout', 'retryAttempts', 'retryDelay', 'validateResponse', 'transformData'],
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
      if (apiConfig.timeout !== undefined && (apiConfig.timeout < 1000 || apiConfig.timeout > 300000)) {
        errors.push('timeout must be between 1000ms and 300000ms (5 minutes)');
      }
      
      // Validate retry configuration
      if (apiConfig.retryAttempts !== undefined && (apiConfig.retryAttempts < 0 || apiConfig.retryAttempts > 10)) {
        errors.push('retryAttempts must be between 0 and 10');
      }
      
      if (apiConfig.retryDelay !== undefined && (apiConfig.retryDelay < 100 || apiConfig.retryDelay > 60000)) {
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
          errors.push('authentication.username and authentication.password are required for basic authentication');
        }
        
        if (auth.type === 'apikey' && (!auth.token || !auth.headerName)) {
          errors.push('authentication.token and authentication.headerName are required for API key authentication');
        }
      }
      
      // Add warnings for best practices
      if (!apiConfig.authentication || apiConfig.authentication.type === 'none') {
        warnings.push('No authentication configured - ensure the API endpoint allows unauthenticated requests');
      }
      
      if (!apiConfig.timeout) {
        warnings.push('No timeout configured - requests may hang indefinitely');
      }
      
    } catch (error) {
      errors.push(`Configuration validation error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors.map(error => ({ field: 'config', message: error, severity: 'error' as const })),
      warnings: warnings.map(warning => ({ field: 'config', message: warning, severity: 'warning' as const })),
    };
  }

  async export(data: RawImportData[], config: ExporterConfig): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      this.config = config as ApiExporterConfig;
      
      // Validate configuration
      const validation = await this.validate(config);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors?.map(e => e.message).join(', ')}`);
      }
      
      console.log(`📤 Starting API export of ${data.length} records to ${this.config.apiEndpoint}...`);
      
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
        ...(batchResult.errors.length > 0 && {
          errors: batchResult.errors.map(error => ({ field: 'api', message: error, severity: 'error' as const }))
        }),
        summary: `API export: ${batchResult.successfulRecords}/${batchResult.totalRecords} records successful (${processingTime}ms)`,
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
    const allResponses: ApiResponse[] = [];
    const allErrors: string[] = [];
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, data.length);
      const batchData = data.slice(startIndex, endIndex);
      
      console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batchData.length} records)`);
      
      try {
        const batchResponses = await this.processBatch(batchData);
        
        for (const response of batchResponses) {
          allResponses.push(response);
          if (response.success) {
            totalSuccessful++;
          } else {
            totalFailed++;
            if (response.error) {
              allErrors.push(response.error);
            }
          }
        }
        
      } catch (error) {
        console.error(`❌ Batch ${batchIndex + 1} failed:`, error);
        totalFailed += batchData.length;
        allErrors.push(`Batch ${batchIndex + 1}: ${error instanceof Error ? error.message : String(error)}`);
        
        // Add failed responses for each record in the batch
        for (let i = 0; i < batchData.length; i++) {
          allResponses.push({
            success: false,
            statusCode: 0,
            ...(error instanceof Error && { error: `Batch processing failed: ${error.message}` }),
          });
        }
      }
    }
    
    return {
      totalRecords: data.length,
      successfulRecords: totalSuccessful,
      failedRecords: totalFailed,
      responses: allResponses,
      errors: allErrors,
    };
  }

  private async processBatch(batchData: RawImportData[]): Promise<ApiResponse[]> {
    const responses: ApiResponse[] = [];
    
    // Process each record in the batch
    for (const record of batchData) {
      try {
        const transformedData = this.config?.transformData ? 
          await this.transformRecord(record) : record;
        
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

  private transformToApiFormat(record: RawImportData | Record<string, unknown>): unknown {
    // Transform single record to mass-import v2 API format
    const recordData = record as Record<string, unknown>;
    
    // Generate a unique import ID for this batch
    const importId = `mass-import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      metadata: {
        importId,
        source: {
          pluginName: 'mass-import-system',
          pluginVersion: '1.0.0',
          originalDataSource: String(recordData.source || 'unknown')
        },
        timestamp: new Date().toISOString()
      },
      config: {
        duplicateThreshold: 0.7,
        enableTagMerging: true,
        createMissingArtists: true,
        batchSize: 1
      },
      data: {
        artworks: [{
          title: String(recordData.title || ''),
          description: String(recordData.description || ''),
          lat: Number(recordData.lat),
          lon: Number(recordData.lon),
          artist: String(recordData.artist || ''),
          source: String(recordData.source || ''),
          externalId: String(recordData.externalId || ''),
          tags: (recordData.tags as Record<string, unknown>) || {},
          photos: (recordData.photos as unknown[]) || []
        }]
      }
    };
  }

  private async makeRequestWithRetry(url: string, method: string, data: unknown): Promise<ApiResponse> {
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