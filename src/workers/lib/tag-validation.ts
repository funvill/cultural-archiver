/**
 * Server-side Tag Validation for Cloudflare Workers
 *
 * This module provides server-side validation for structured tags,
 * integrating with the existing validation middleware and artwork editing system.
 */

import type {
  TagDefinition,
  StructuredTags,
  TagValidationResult,
} from '../../shared/tag-schema.js';
import {
  TAG_DEFINITIONS,
  getTagDefinition,
  isValidTagKey,
  generateOSMTags,
  INTERNAL_TAG_PREFIX,
} from '../../shared/tag-schema.js';
import {
  validateTagValue,
  validateStructuredTags,
  getValidationSummary,
  sanitizeStructuredTags,
} from '../../shared/tag-validation.js';
import type {
  TagValidationError,
  TagValidationResponse,
  StructuredTagsData,
} from '../../shared/types.js';

// ================================
// Server-side Validation Service
// ================================

export class ServerTagValidationService {
  private readonly tagDefinitions: Record<string, TagDefinition>;

  constructor() {
    this.tagDefinitions = TAG_DEFINITIONS;
  }

  /**
   * Validate structured tags with comprehensive error reporting
   */
  validateTags(tags: StructuredTags): TagValidationResponse {
    try {
      console.log('[TAG VALIDATION DEBUG] Starting tag validation:', {
        tags,
        timestamp: new Date().toISOString(),
      });
      // Strip internal/system tags (underscore-prefixed) before any sanitization/validation
      // These are reserved for internal metadata (_photos, _internal, etc.) and not user-editable
      const externalTags: StructuredTags = {};
      Object.entries(tags || {}).forEach(([k, v]) => {
        if (!k.startsWith(INTERNAL_TAG_PREFIX)) {
          externalTags[k] = v as string | number | boolean;
        } else {
          console.log('[TAG VALIDATION DEBUG] Ignoring internal tag key:', k);
        }
      });

      // First sanitize the tags
      const sanitizedTags = sanitizeStructuredTags(externalTags, this.tagDefinitions);
      console.log('[TAG VALIDATION DEBUG] Tags sanitized:', { sanitizedTags });

      // Then validate the sanitized tags
      const validationResults = validateStructuredTags(sanitizedTags, this.tagDefinitions);
      console.log('[TAG VALIDATION DEBUG] Validation results:', { validationResults });

      const summary = getValidationSummary(validationResults);
      console.log('[TAG VALIDATION DEBUG] Validation summary:', { summary });

      // Convert validation results to API format
      const errors: TagValidationError[] = [];
      const warnings: TagValidationError[] = [];

      Object.entries(validationResults).forEach(([key, result]) => {
        result.errors.forEach(message => {
          console.log('[TAG VALIDATION DEBUG] Adding validation error:', { key, message });
          errors.push({
            key,
            field: key,
            message,
            code: this.getErrorCode(message),
            suggestions: this.generateSuggestions(key, message),
          });
        });

        result.warnings.forEach(message => {
          warnings.push({
            key,
            field: key,
            message,
            code: 'warning',
            suggestions: this.generateSuggestions(key, message),
          });
        });
      });

      console.log('[TAG VALIDATION DEBUG] Final validation response:', {
        valid: summary.isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
        errors: errors.map(e => ({ key: e.key, message: e.message })),
      });

      return {
        valid: summary.isValid,
        errors,
        warnings,
        sanitized_tags: summary.isValid ? sanitizedTags : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            key: 'validation',
            field: 'tags',
            message: 'Tag validation failed',
            code: 'validation_error',
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Validate a single tag key-value pair
   */
  validateSingleTag(key: string, value: unknown): TagValidationResult {
    const definition = getTagDefinition(key);
    if (!definition) {
      return {
        isValid: false,
        errors: [`Unknown tag key: ${key}`],
        warnings: [],
      };
    }

    return validateTagValue(value, definition);
  }

  /**
   * Generate OpenStreetMap-compatible export for approved artwork
   */
  generateOSMExport(tags: StructuredTags): Record<string, string> {
    // Only include valid, non-empty tags
    const validTags: StructuredTags = {};

    Object.entries(tags).forEach(([key, value]) => {
      if (isValidTagKey(key) && value !== null && value !== undefined && value !== '') {
        validTags[key] = value;
      }
    });

    return generateOSMTags(validTags);
  }

  /**
   * Validate tags for artwork editing workflow
   */
  validateForArtworkEdit(
    oldTags: StructuredTags | null,
    newTags: StructuredTags
  ): TagValidationResponse {
    // Validate the new tags
    const validationResponse = this.validateTags(newTags);

    // If there are old tags, check for breaking changes
    if (oldTags && validationResponse.valid) {
      const breakingChanges = this.detectBreakingChanges(oldTags, newTags);
      if (breakingChanges.length > 0) {
        validationResponse.warnings.push(...breakingChanges);
      }
    }

    return validationResponse;
  }

  /**
   * Create structured tags data with metadata
   */
  createStructuredTagsData(tags: StructuredTags, version: string = '1.0.0'): StructuredTagsData {
    return {
      tags,
      version,
      lastModified: new Date().toISOString(),
    };
  }

  // ================================
  // Private Helper Methods
  // ================================

  /**
   * Generate error codes based on validation messages
   */
  private getErrorCode(message: string): TagValidationError['code'] {
    if (message.includes('required') || message.includes('missing')) {
      return 'required';
    }
    if (message.includes('Invalid value') || message.includes('must be one of')) {
      return 'invalid_enum';
    }
    if (message.includes('format') || message.includes('pattern')) {
      return 'invalid_format';
    }
    if (
      message.includes('must be between') ||
      message.includes('at least') ||
      message.includes('at most')
    ) {
      return 'out_of_range';
    }
    if (message.includes('Unknown tag')) {
      return 'unknown_key';
    }
    return 'invalid_format';
  }

  /**
   * Generate helpful suggestions based on validation errors
   */
  private generateSuggestions(key: string, _message: string): string[] {
    const definition = getTagDefinition(key);
    const suggestions: string[] = [];

    if (!definition) {
      // Suggest similar tag keys
      const similarKeys = this.findSimilarTagKeys(key);
      if (similarKeys.length > 0) {
        suggestions.push(`Did you mean: ${similarKeys.slice(0, 3).join(', ')}?`);
      }
      return suggestions;
    }

    // Add examples if available
    if (definition.examples && definition.examples.length > 0) {
      suggestions.push(`Examples: ${definition.examples.slice(0, 3).join(', ')}`);
    }

    // Add enum values for enum fields
    if (definition.dataType === 'enum' && definition.enumValues) {
      suggestions.push(`Valid values: ${definition.enumValues.join(', ')}`);
    }

    // Add format hints
    if (definition.dataType === 'date') {
      suggestions.push('Use format: YYYY, YYYY-MM, or YYYY-MM-DD');
    }
    if (definition.dataType === 'url') {
      suggestions.push('Must start with http:// or https://');
    }
    if (definition.dataType === 'yes_no') {
      suggestions.push('Use "yes" or "no"');
    }

    // Add help URL if available
    if (definition.helpUrl) {
      suggestions.push(`See: ${definition.helpUrl}`);
    }

    return suggestions;
  }

  /**
   * Find similar tag keys for typo suggestions
   */
  private findSimilarTagKeys(inputKey: string): string[] {
    const allKeys = Object.keys(this.tagDefinitions);
    return allKeys
      .filter(key => this.calculateSimilarity(inputKey, key) > 0.6)
      .sort(
        (a, b) => this.calculateSimilarity(inputKey, b) - this.calculateSimilarity(inputKey, a)
      );
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   */
  private calculateSimilarity(a: string, b: string): number {
    const matrix = Array(a.length + 1)
      .fill(null)
      .map(() => Array(b.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) {
      const row = matrix[i];
      if (row) row[0] = i;
    }
    for (let j = 0; j <= b.length; j++) {
      const row = matrix[0];
      if (row) row[j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        const currentRow = matrix[i];
        const prevRow = matrix[i - 1];
        if (currentRow && prevRow) {
          currentRow[j] = Math.min(
            (prevRow[j] ?? 0) + 1,
            (currentRow[j - 1] ?? 0) + 1,
            (prevRow[j - 1] ?? 0) + cost
          );
        }
      }
    }

    const finalRow = matrix[a.length];
    const distance = finalRow ? (finalRow[b.length] ?? 0) : 0;
    return 1 - distance / Math.max(a.length, b.length);
  }

  /**
   * Detect potentially breaking changes between old and new tags
   */
  private detectBreakingChanges(
    oldTags: StructuredTags,
    newTags: StructuredTags
  ): TagValidationError[] {
    const warnings: TagValidationError[] = [];

    // Check for removed required tags
    Object.keys(oldTags).forEach(key => {
      const definition = getTagDefinition(key);
      if (definition?.required && !(key in newTags)) {
        warnings.push({
          key,
          field: key,
          message: `Required tag "${definition.label}" was removed`,
          code: 'required',
        });
      }
    });

    // Check for significant changes to core identification tags
    const coreIdentificationTags = ['tourism', 'artwork_type', 'name'];
    coreIdentificationTags.forEach(key => {
      if (key in oldTags && key in newTags && oldTags[key] !== newTags[key]) {
        const definition = getTagDefinition(key);
        if (definition) {
          warnings.push({
            key,
            field: key,
            message: `Core identification tag "${definition.label}" changed from "${oldTags[key]}" to "${newTags[key]}"`,
            code: 'warning',
          });
        }
      }
    });

    return warnings;
  }
}

// ================================
// Validation Helpers
// ================================

/**
 * Parse tags from artwork record (handles both old and new formats)
 */
export function parseArtworkTags(tagsField: string | null): StructuredTags {
  if (!tagsField) return {};

  try {
    const parsed = JSON.parse(tagsField);

    // Check if it's already structured tags format
    if (parsed && typeof parsed === 'object' && 'tags' in parsed && 'version' in parsed) {
      return (parsed as StructuredTagsData).tags;
    }

    // Handle legacy flat key-value format
    if (parsed && typeof parsed === 'object') {
      return parsed as StructuredTags;
    }

    return {};
  } catch {
    return {};
  }
}

/**
 * Serialize tags back to artwork record format
 */
export function serializeArtworkTags(tags: StructuredTags, version: string = '1.0.0'): string {
  const structuredData: StructuredTagsData = {
    tags,
    version,
    lastModified: new Date().toISOString(),
  };

  return JSON.stringify(structuredData);
}

/**
 * Convert validation errors to middleware-compatible format
 */
export function convertToValidationApiError(
  validationResponse: TagValidationResponse
): { field: string; message: string; code: string }[] {
  return validationResponse.errors.map(error => ({
    field: error.field,
    message: error.message,
    code: error.code.toUpperCase(),
  }));
}

/**
 * Check if tags contain any required fields
 * NOTE: Currently no tags are required - all tags are optional
 */
export function hasRequiredTags(_tags: StructuredTags): boolean {
  // All tags are optional, so this always returns true
  return true;
}

/**
 * Extract tag changes for artwork edit tracking
 */
export function extractTagChanges(
  oldTags: StructuredTags,
  newTags: StructuredTags
): Array<{
  action: 'add' | 'update' | 'remove';
  key: string;
  old_value?: unknown;
  new_value?: unknown;
}> {
  const changes: Array<{
    action: 'add' | 'update' | 'remove';
    key: string;
    old_value?: unknown;
    new_value?: unknown;
  }> = [];

  // Find added and updated tags
  Object.entries(newTags).forEach(([key, newValue]) => {
    if (!(key in oldTags)) {
      changes.push({
        action: 'add',
        key,
        new_value: newValue,
      });
    } else if (oldTags[key] !== newValue) {
      changes.push({
        action: 'update',
        key,
        old_value: oldTags[key],
        new_value: newValue,
      });
    }
  });

  // Find removed tags
  Object.keys(oldTags).forEach(key => {
    if (!(key in newTags)) {
      changes.push({
        action: 'remove',
        key,
        old_value: oldTags[key],
      });
    }
  });

  return changes;
}

// ================================
// Global Service Instance
// ================================

export const tagValidationService = new ServerTagValidationService();
