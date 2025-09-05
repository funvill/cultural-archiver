/**
 * Form validation utilities for user input
 */

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Coordinate validation ranges
const LATITUDE_RANGE = { min: -90, max: 90 };
const LONGITUDE_RANGE = { min: -180, max: 180 };

// Text length limits
const NOTE_MAX_LENGTH = 500;
const TITLE_MAX_LENGTH = 100;
const ARTIST_MAX_LENGTH = 100;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface FieldValidationResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): FieldValidationResult {
  if (!email) {
    return { isValid: false, error: 'Email is required' };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true, error: null };
}

/**
 * Validate latitude coordinate
 */
export function validateLatitude(lat: number | string): FieldValidationResult {
  const num = typeof lat === 'string' ? parseFloat(lat) : lat;

  if (isNaN(num)) {
    return { isValid: false, error: 'Latitude must be a valid number' };
  }

  if (num < LATITUDE_RANGE.min || num > LATITUDE_RANGE.max) {
    return {
      isValid: false,
      error: `Latitude must be between ${LATITUDE_RANGE.min} and ${LATITUDE_RANGE.max}`,
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate longitude coordinate
 */
export function validateLongitude(lon: number | string): FieldValidationResult {
  const num = typeof lon === 'string' ? parseFloat(lon) : lon;

  if (isNaN(num)) {
    return { isValid: false, error: 'Longitude must be a valid number' };
  }

  if (num < LONGITUDE_RANGE.min || num > LONGITUDE_RANGE.max) {
    return {
      isValid: false,
      error: `Longitude must be between ${LONGITUDE_RANGE.min} and ${LONGITUDE_RANGE.max}`,
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate coordinate pair
 */
export function validateCoordinates(lat: number | string, lon: number | string): ValidationResult {
  const latResult = validateLatitude(lat);
  const lonResult = validateLongitude(lon);

  const errors: string[] = [];
  if (!latResult.isValid && latResult.error) {
    errors.push(latResult.error);
  }
  if (!lonResult.isValid && lonResult.error) {
    errors.push(lonResult.error);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate note text length
 */
export function validateNote(note: string): FieldValidationResult {
  if (note.length > NOTE_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Note must be ${NOTE_MAX_LENGTH} characters or less (current: ${note.length})`,
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate artwork title
 */
export function validateTitle(title: string): FieldValidationResult {
  if (title.length > TITLE_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Title must be ${TITLE_MAX_LENGTH} characters or less (current: ${title.length})`,
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate artist name
 */
export function validateArtist(artist: string): FieldValidationResult {
  if (artist.length > ARTIST_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Artist name must be ${ARTIST_MAX_LENGTH} characters or less (current: ${artist.length})`,
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate artwork type
 */
export function validateArtworkType(type: string): FieldValidationResult {
  const validTypes = ['public_art', 'street_art', 'monument', 'sculpture', 'other'];

  if (!type) {
    return { isValid: false, error: 'Artwork type is required' };
  }

  if (!validTypes.includes(type)) {
    return {
      isValid: false,
      error: `Invalid artwork type. Must be one of: ${validTypes.join(', ')}`,
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate file upload
 */
export function validateFile(
  file: File,
  options: {
    maxSize?: number; // in bytes
    allowedTypes?: string[];
    minDimensions?: { width: number; height: number };
  } = {}
): FieldValidationResult {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
  } = options;

  if (!file) {
    return { isValid: false, error: 'File is required' };
  }

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / 1024 / 1024);
    return {
      isValid: false,
      error: `File size must be less than ${maxSizeMB}MB (current: ${Math.round(file.size / 1024 / 1024)}MB)`,
    };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File type not allowed. Supported formats: ${allowedTypes.map(t => t.split('/')[1]).join(', ')}`,
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate multiple files
 */
export function validateFiles(
  files: File[],
  options: {
    maxFiles?: number;
    maxSize?: number;
    allowedTypes?: string[];
  } = {}
): ValidationResult {
  const { maxFiles = 5 } = options;
  const errors: string[] = [];

  if (files.length === 0) {
    errors.push('At least one file is required');
  }

  if (files.length > maxFiles) {
    errors.push(`Maximum ${maxFiles} files allowed (current: ${files.length})`);
  }

  // Validate each file
  files.forEach((file, index) => {
    const fileResult = validateFile(file, options);
    if (!fileResult.isValid && fileResult.error) {
      errors.push(`File ${index + 1}: ${fileResult.error}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate submission form data
 */
export function validateSubmissionForm(data: {
  files: File[];
  note?: string;
  artworkType: string;
  latitude: number | string;
  longitude: number | string;
  consentGiven: boolean;
}): ValidationResult {
  const errors: string[] = [];

  // Validate files
  const filesResult = validateFiles(data.files);
  if (!filesResult.isValid) {
    errors.push(...filesResult.errors);
  }

  // Validate note
  if (data.note) {
    const noteResult = validateNote(data.note);
    if (!noteResult.isValid && noteResult.error) {
      errors.push(noteResult.error);
    }
  }

  // Validate artwork type
  const typeResult = validateArtworkType(data.artworkType);
  if (!typeResult.isValid && typeResult.error) {
    errors.push(typeResult.error);
  }

  // Validate coordinates
  const coordsResult = validateCoordinates(data.latitude, data.longitude);
  if (!coordsResult.isValid) {
    errors.push(...coordsResult.errors);
  }

  // Validate consent
  if (!data.consentGiven) {
    errors.push('You must agree to the terms and conditions');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Helper function to get validation error for a specific field
 */
export function getFieldError(errors: string[], fieldName: string): string | null {
  const fieldError = errors.find(error => error.toLowerCase().includes(fieldName.toLowerCase()));
  return fieldError || null;
}

/**
 * Check if form has any validation errors
 */
export function hasValidationErrors(validationResults: ValidationResult[]): boolean {
  return validationResults.some(result => !result.isValid);
}

/**
 * Combine multiple validation results
 */
export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  const allErrors: string[] = [];

  results.forEach(result => {
    if (!result.isValid) {
      allErrors.push(...result.errors);
    }
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}
