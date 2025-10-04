/**
 * Tag Validation Functions
 *
 * This module provides comprehensive validation for all tag data types
 * used in the structured tagging system.
 */

import type {
  TagDefinition,
  TagDataType,
  TagValidationResult,
  StructuredTags,
} from './tag-schema.js';

// ================================
// Core Validation Functions
// ================================

/**
 * Validate a single tag value against its definition
 */
export function validateTagValue(value: unknown, definition: TagDefinition): TagValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Handle null/undefined values
  if (value === null || value === undefined || value === '') {
    if (definition.required) {
      errors.push(`${definition.label} is required`);
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  // Convert value to string for validation
  const stringValue = String(value).trim();

  // Validate based on data type
  switch (definition.dataType) {
    case 'enum':
      validateEnumValue(stringValue, definition, errors, warnings);
      break;
    case 'text':
      validateTextValue(stringValue, definition, errors, warnings);
      break;
    case 'number':
      validateNumberValue(value, definition, errors, warnings);
      break;
    case 'date':
      validateDateValue(stringValue, definition, errors, warnings);
      break;
    case 'yes_no':
      validateYesNoValue(stringValue, definition, errors, warnings);
      break;
    case 'url':
      validateUrlValue(stringValue, definition, errors, warnings);
      break;
    case 'wikidata_id':
      validateWikidataIdValue(stringValue, definition, errors, warnings);
      break;
    default:
      errors.push(`Unknown data type: ${definition.dataType}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate enum values
 */
function validateEnumValue(
  value: string,
  definition: TagDefinition,
  errors: string[],
  _warnings: string[]
): void {
  if (!definition.enumValues) {
    errors.push(`No valid values defined for ${definition.label}`);
    return;
  }

  if (!definition.enumValues.includes(value)) {
    errors.push(
      `Invalid value for ${definition.label}. Must be one of: ${definition.enumValues.join(', ')}`
    );
  }
}

/**
 * Validate text values
 */
function validateTextValue(
  value: string,
  definition: TagDefinition,
  errors: string[],
  warnings: string[]
): void {
  // Check length constraints
  if (definition.validation?.maxLength && value.length > definition.validation.maxLength) {
    errors.push(
      `${definition.label} must be ${definition.validation.maxLength} characters or less (currently ${value.length})`
    );
  }

  // Check pattern if defined
  if (definition.validation?.pattern) {
    const regex = new RegExp(definition.validation.pattern);
    if (!regex.test(value)) {
      let message = `${definition.label} format is invalid`;

      // Add helpful format hints for common patterns
      if (definition.key === 'wikipedia') {
        message += '. Expected format: language:Article_Name (e.g., en:Statue_of_Liberty)';
      }

      errors.push(message);
    }
  }

  // Basic sanitization checks (warnings)
  if (value !== value.trim()) {
    warnings.push(`${definition.label} has leading or trailing whitespace`);
  }

  // Check for potentially problematic characters
  if (/[<>"]/.test(value)) {
    warnings.push(`${definition.label} contains HTML-like characters that may need escaping`);
  }
}

/**
 * Validate numeric values
 */
function validateNumberValue(
  value: unknown,
  definition: TagDefinition,
  errors: string[],
  _warnings: string[]
): void {
  const numValue = Number(value);

  if (isNaN(numValue)) {
    errors.push(`${definition.label} must be a valid number`);
    return;
  }

  // Check range constraints
  if (definition.validation?.min !== undefined && numValue < definition.validation.min) {
    errors.push(`${definition.label} must be at least ${definition.validation.min}`);
  }

  if (definition.validation?.max !== undefined && numValue > definition.validation.max) {
    errors.push(`${definition.label} must be at most ${definition.validation.max}`);
  }

  // Warning for extremely precise values that might be measurement errors
  // No legacy special-cases here; numeric validations handled by min/max in definition
}

/**
 * Validate date values (YYYY, YYYY-MM, or YYYY-MM-DD format)
 */
function validateDateValue(
  value: string,
  definition: TagDefinition,
  errors: string[],
  warnings: string[]
): void {
  // Basic pattern check
  const datePattern = /^\d{4}(-\d{2}(-\d{2})?)?$/;
  if (!datePattern.test(value)) {
    errors.push(
      `${definition.label} must be in format YYYY, YYYY-MM, or YYYY-MM-DD (e.g., 2023, 2023-07, 2023-07-15)`
    );
    return;
  }

  // Parse and validate actual date components
  const parts = value.split('-');
  if (parts.length === 0 || !parts[0]) {
    errors.push(`${definition.label} is invalid`);
    return;
  }

  const year = parseInt(parts[0], 10);

  // Validate year range (reasonable bounds for artwork)
  if (year < 1000 || year > new Date().getFullYear() + 10) {
    errors.push(
      `${definition.label} year must be between 1000 and ${new Date().getFullYear() + 10}`
    );
    return;
  }

  if (parts.length > 1 && parts[1]) {
    const month = parseInt(parts[1], 10);
    if (month < 1 || month > 12) {
      errors.push(`${definition.label} month must be between 01 and 12`);
      return;
    }

    if (parts.length > 2 && parts[2]) {
      const day = parseInt(parts[2], 10);
      if (day < 1 || day > 31) {
        errors.push(`${definition.label} day must be between 01 and 31`);
        return;
      }

      // Check for valid date
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        errors.push(`${definition.label} is not a valid date`);
        return;
      }
    }
  }

  // Warning for future dates
  const currentYear = new Date().getFullYear();
  if (year > currentYear) {
    warnings.push(`${definition.label} is in the future - please verify the date is correct`);
  }
}

/**
 * Validate yes/no values
 */
function validateYesNoValue(
  value: string,
  definition: TagDefinition,
  errors: string[],
  warnings: string[]
): void {
  const validValues = ['yes', 'no'];
  const lowerValue = value.toLowerCase();

  if (!validValues.includes(lowerValue)) {
    errors.push(`${definition.label} must be 'yes' or 'no'`);
    return;
  }

  // Warning for case mismatch
  if (value !== lowerValue) {
    warnings.push(
      `${definition.label} should be lowercase ('${lowerValue}' instead of '${value}')`
    );
  }
}

/**
 * Validate URL values
 */
function validateUrlValue(
  value: string,
  definition: TagDefinition,
  errors: string[],
  warnings: string[]
): void {
  // Basic URL pattern check
  const urlPattern = /^https?:\/\/.+/;
  if (!urlPattern.test(value)) {
    errors.push(`${definition.label} must be a valid URL starting with http:// or https://`);
    return;
  }

  try {
    const url = new URL(value);

    // Warning for HTTP (not HTTPS)
    if (url.protocol === 'http:') {
      warnings.push(
        `${definition.label} uses HTTP instead of HTTPS - consider using a secure connection`
      );
    }

    // Basic length check
    if (value.length > 500) {
      warnings.push(
        `${definition.label} is very long (${value.length} characters) - consider using a shorter URL`
      );
    }
  } catch (error) {
    errors.push(`${definition.label} is not a valid URL`);
  }
}

/**
 * Validate Wikidata ID values
 */
function validateWikidataIdValue(
  value: string,
  definition: TagDefinition,
  errors: string[],
  warnings: string[]
): void {
  // Wikidata IDs start with Q followed by numbers
  const wikidataPattern = /^Q\d+$/;
  if (!wikidataPattern.test(value)) {
    errors.push(`${definition.label} must be a valid Wikidata ID (format: Q123456)`);
    return;
  }

  // Extract the numeric part
  const numericPart = value.substring(1);
  const numericValue = parseInt(numericPart, 10);

  // Basic range check (Wikidata IDs should be reasonable)
  if (numericValue < 1 || numericValue > 999999999) {
    warnings.push(`${definition.label} has an unusual ID number - please verify it's correct`);
  }
}

// ================================
// Batch Validation Functions
// ================================

/**
 * Validate all tags in a structured tags object
 */
export function validateStructuredTags(
  tags: StructuredTags,
  tagDefinitions: Record<string, TagDefinition>
): Record<string, TagValidationResult> {
  const results: Record<string, TagValidationResult> = {};

  // Validate each provided tag
  Object.entries(tags).forEach(([key, value]) => {
    const definition = tagDefinitions[key];
    if (!definition) {
      // For unknown tags, validate them as text/string type
      const defaultDefinition: TagDefinition = {
        key,
        label: key,
        dataType: 'text',
        required: false,
        category: 'reference_data', // Default category for user-defined tags
        description: `User-defined tag: ${key}`,
        validation: {
          maxLength: 500, // Reasonable default limit
        },
      };
      results[key] = validateTagValue(value, defaultDefinition);
      return;
    }

    results[key] = validateTagValue(value, definition);
  });

  // Check for missing required tags
  // NOTE: Currently all tags are optional, so we skip required tag validation
  console.log('[SHARED VALIDATION DEBUG] Skipping required tag validation - all tags are optional');
  // Object.values(tagDefinitions).forEach(definition => {
  //   if (definition.required && !(definition.key in tags)) {
  //     results[definition.key] = {
  //       isValid: false,
  //       errors: [`Required tag ${definition.label} is missing`],
  //       warnings: [],
  //     };
  //   }
  // });

  return results;
}

/**
 * Get overall validation summary
 */
export function getValidationSummary(validationResults: Record<string, TagValidationResult>): {
  isValid: boolean;
  totalErrors: number;
  totalWarnings: number;
  errorMessages: string[];
  warningMessages: string[];
} {
  const errorMessages: string[] = [];
  const warningMessages: string[] = [];

  Object.values(validationResults).forEach(result => {
    errorMessages.push(...result.errors);
    warningMessages.push(...result.warnings);
  });

  return {
    isValid: errorMessages.length === 0,
    totalErrors: errorMessages.length,
    totalWarnings: warningMessages.length,
    errorMessages,
    warningMessages,
  };
}

// ================================
// Sanitization Functions
// ================================

/**
 * Sanitize tag value based on its data type
 */
export function sanitizeTagValue(
  value: unknown,
  dataType: TagDataType
): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  const stringValue = String(value);

  switch (dataType) {
    case 'text':
    case 'url':
    case 'wikidata_id':
      return stringValue.trim();

    case 'enum':
      return stringValue.trim().toLowerCase();

    case 'number':
      const numValue = Number(stringValue);
      return isNaN(numValue) ? stringValue.trim() : numValue;

    case 'date':
      return stringValue.trim();

    case 'yes_no':
      return stringValue.trim().toLowerCase();

    default:
      return stringValue.trim();
  }
}

/**
 * Sanitize all tags in a structured tags object
 */
export function sanitizeStructuredTags(
  tags: StructuredTags,
  tagDefinitions: Record<string, TagDefinition>
): StructuredTags {
  const sanitized: StructuredTags = {};

  Object.entries(tags).forEach(([key, value]) => {
    const definition = tagDefinitions[key];
    if (definition) {
      const sanitizedValue = sanitizeTagValue(value, definition.dataType);
      if (sanitizedValue !== null) {
        sanitized[key] = sanitizedValue;
      }
    } else {
      // Keep unknown tags as-is but sanitized
      const sanitizedValue = sanitizeTagValue(value, 'text');
      if (sanitizedValue !== null) {
        sanitized[key] = sanitizedValue;
      }
    }
  });

  return sanitized;
}
