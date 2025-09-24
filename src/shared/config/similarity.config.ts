/**
 * Similarity configuration - Environment-specific settings for similarity calculations
 * Extracted from hardcoded values to support different environments and tuning
 */

// ================================
// Environment Configuration Types
// ================================

export interface SimilarityConfig {
  // Similarity thresholds for duplicate detection
  thresholds: {
    warn: number; // Show warning badge
    high: number; // Require explicit confirmation
  };

  // Weights for different similarity signals (must sum to 1.0)
  weights: {
    distance: number; // Geographic proximity
    title: number; // Title fuzzy matching
    tags: number; // Tag/type overlap
  };

  // Distance normalization parameters
  distance: {
    maxDistanceMeters: number; // Distance beyond which similarity = 0
    optimalDistanceMeters: number; // Distance at which similarity = 1
  };

  // Title matching parameters
  title: {
    minTitleLength: number; // Minimum title length for comparison
    stopWords: readonly string[]; // Words to ignore in comparisons
  };
}

// ================================
// Default Configuration
// ================================

export const DEFAULT_SIMILARITY_CONFIG: SimilarityConfig = {
  thresholds: {
    warn: 0.65, // Show warning badge at 65% similarity
    high: 0.8, // Require explicit confirmation at 80% similarity
  },

  weights: {
    distance: 0.5, // Geographic proximity (50% weight)
    title: 0.35, // Title fuzzy matching (35% weight)
    tags: 0.15, // Tag/type overlap (15% weight)
  },

  distance: {
    maxDistanceMeters: 1000, // Distance beyond which similarity = 0
    optimalDistanceMeters: 50, // Distance at which similarity = 1
  },

  title: {
    minTitleLength: 3, // Minimum title length for comparison
    stopWords: [
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
    ] as const,
  },
};

// ================================
// Environment-Specific Configuration Loading
// ================================

/**
 * Load similarity configuration from environment variables with fallbacks to defaults
 */
export function createSimilarityConfig(): SimilarityConfig {
  // Parse environment variables with fallbacks to defaults
  const config: SimilarityConfig = {
    thresholds: {
      warn:
        parseFloat(process.env.SIMILARITY_THRESHOLD_WARN || '') ||
        DEFAULT_SIMILARITY_CONFIG.thresholds.warn,
      high:
        parseFloat(process.env.SIMILARITY_THRESHOLD_HIGH || '') ||
        DEFAULT_SIMILARITY_CONFIG.thresholds.high,
    },

    weights: {
      distance:
        parseFloat(process.env.SIMILARITY_WEIGHT_DISTANCE || '') ||
        DEFAULT_SIMILARITY_CONFIG.weights.distance,
      title:
        parseFloat(process.env.SIMILARITY_WEIGHT_TITLE || '') ||
        DEFAULT_SIMILARITY_CONFIG.weights.title,
      tags:
        parseFloat(process.env.SIMILARITY_WEIGHT_TAGS || '') ||
        DEFAULT_SIMILARITY_CONFIG.weights.tags,
    },

    distance: {
      maxDistanceMeters:
        parseInt(process.env.SIMILARITY_MAX_DISTANCE_METERS || '') ||
        DEFAULT_SIMILARITY_CONFIG.distance.maxDistanceMeters,
      optimalDistanceMeters:
        parseInt(process.env.SIMILARITY_OPTIMAL_DISTANCE_METERS || '') ||
        DEFAULT_SIMILARITY_CONFIG.distance.optimalDistanceMeters,
    },

    title: {
      minTitleLength:
        parseInt(process.env.SIMILARITY_MIN_TITLE_LENGTH || '') ||
        DEFAULT_SIMILARITY_CONFIG.title.minTitleLength,
      stopWords: DEFAULT_SIMILARITY_CONFIG.title.stopWords, // Keep stop words constant
    },
  };

  // Validate configuration
  validateSimilarityConfig(config);

  return config;
}

/**
 * Validate similarity configuration for consistency and sanity
 */
function validateSimilarityConfig(config: SimilarityConfig): void {
  // Validate thresholds
  if (config.thresholds.warn < 0 || config.thresholds.warn > 1) {
    throw new Error(`Invalid warn threshold: ${config.thresholds.warn}. Must be between 0 and 1.`);
  }
  if (config.thresholds.high < 0 || config.thresholds.high > 1) {
    throw new Error(`Invalid high threshold: ${config.thresholds.high}. Must be between 0 and 1.`);
  }
  if (config.thresholds.high <= config.thresholds.warn) {
    throw new Error(
      `High threshold (${config.thresholds.high}) must be greater than warn threshold (${config.thresholds.warn}).`
    );
  }

  // Validate weights sum to 1.0 (with small tolerance for floating point)
  const totalWeight = config.weights.distance + config.weights.title + config.weights.tags;
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    throw new Error(`Similarity weights must sum to 1.0, got ${totalWeight}`);
  }

  // Validate individual weights
  if (config.weights.distance < 0 || config.weights.title < 0 || config.weights.tags < 0) {
    throw new Error('All similarity weights must be non-negative');
  }

  // Validate distance parameters
  if (config.distance.optimalDistanceMeters >= config.distance.maxDistanceMeters) {
    throw new Error(
      `Optimal distance (${config.distance.optimalDistanceMeters}m) must be less than max distance (${config.distance.maxDistanceMeters}m)`
    );
  }

  // Validate title parameters
  if (config.title.minTitleLength < 1) {
    throw new Error(`Minimum title length must be at least 1, got ${config.title.minTitleLength}`);
  }
}

// ================================
// Development/Testing Configurations
// ================================

/**
 * Create lenient configuration for development (lower thresholds)
 */
export function createDevSimilarityConfig(): SimilarityConfig {
  return {
    ...DEFAULT_SIMILARITY_CONFIG,
    thresholds: {
      warn: 0.5, // Lower threshold for development
      high: 0.7, // Lower threshold for development
    },
  };
}

/**
 * Create strict configuration for production (higher thresholds)
 */
export function createProdSimilarityConfig(): SimilarityConfig {
  return {
    ...DEFAULT_SIMILARITY_CONFIG,
    thresholds: {
      warn: 0.7, // Higher threshold for production
      high: 0.85, // Higher threshold for production
    },
  };
}
