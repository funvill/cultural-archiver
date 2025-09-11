/**
 * Mass Import System - Duplicate Detection
 * 
 * This module handles duplicate detection using multiple approaches:
 * 1. Exact matches (external ID, content hash)
 * 2. Geographic proximity with enhanced similarity scoring
 * 3. Fuzzy string matching with proper normalization
 */

import fuzzy from 'fuzzy';
import type {
  DuplicateDetectionResult,
  DuplicateCandidate,
  ProcessedImportData,
  MassImportConfig,
} from '../types';

// ================================
// Enhanced Duplicate Detection
// ================================

/**
 * Detect potential duplicates for import data using multiple methods
 */
export async function detectDuplicates(
  importData: ProcessedImportData,
  config: MassImportConfig,
  existingArtworks: ExistingArtwork[]
): Promise<DuplicateDetectionResult> {
  const candidates: DuplicateCandidate[] = [];

  // Method 1: Check for exact external ID matches (highest priority)
  const externalIdMatch = checkExternalIdDuplicate(
    String(importData.tags?.external_id || ''),
    importData.tags?.source?.toString() || 'vancouver-opendata',
    existingArtworks
  );
  if (externalIdMatch) {
    return {
      isDuplicate: true,
      candidates: [externalIdMatch],
      bestMatch: externalIdMatch
    };
  }

  // Method 2: Check for content hash matches (near-exact duplicates)
  const contentHashMatch = checkContentHashDuplicate(importData, existingArtworks);
  if (contentHashMatch) {
    return {
      isDuplicate: true,
      candidates: [contentHashMatch],
      bestMatch: contentHashMatch
    };
  }

  // Method 3: Geographic proximity with enhanced similarity scoring
  const nearbyArtworks = findNearbyArtworks(
    importData.lat,
    importData.lon,
    config.duplicateDetectionRadius,
    existingArtworks
  );

  // Calculate enhanced similarity scores for nearby artworks
  for (const artwork of nearbyArtworks) {
    const candidate = await calculateSimilarity(importData, artwork, config);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  // Step 3: Sort candidates by confidence score
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Step 4: Determine if this is likely a duplicate
  const bestMatch = candidates.length > 0 ? candidates[0] : undefined;
  const isDuplicate = bestMatch ? bestMatch.confidence > 0.8 : false;

  const result: DuplicateDetectionResult = {
    isDuplicate,
    candidates: candidates.slice(0, 5), // Return top 5 candidates
  };

  if (bestMatch) {
    result.bestMatch = bestMatch;
  }

  return result;
}

// ================================
// Enhanced Detection Methods  
// ================================

/**
 * Check for content hash duplicates (near-exact matches)
 */
function checkContentHashDuplicate(
  importData: ProcessedImportData,
  existingArtworks: ExistingArtwork[]
): DuplicateCandidate | null {
  const importHash = generateContentHash(importData);
  
  for (const artwork of existingArtworks) {
    const artworkHash = generateContentHashForExisting(artwork);
    
    if (importHash === artworkHash) {
      const candidate: DuplicateCandidate = {
        id: artwork.id,
        lat: artwork.lat,
        lon: artwork.lon,
        distance: 0,
        titleSimilarity: 1,
        confidence: 0.95, // Very high confidence for content hash match
        reason: `Identical content hash: ${importHash.substring(0, 8)}...`,
      };
      
      if (artwork.title) {
        candidate.title = artwork.title;
      }
      
      return candidate;
    }
  }
  
  return null;
}

/**
 * Generate content hash for import data
 */
function generateContentHash(importData: ProcessedImportData): string {
  const title = (importData.title || '').toLowerCase().trim();
  const coords = `${importData.lat.toFixed(6)},${importData.lon.toFixed(6)}`;
  const tags = JSON.stringify(importData.tags || {});
  
  const content = [title, coords, tags].filter(Boolean).join('|');
  
  // Simple hash - in production you might want crypto.subtle
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Generate content hash for existing artwork
 */
function generateContentHashForExisting(artwork: ExistingArtwork): string {
  const title = (artwork.title || '').toLowerCase().trim();
  const coords = `${artwork.lat.toFixed(6)},${artwork.lon.toFixed(6)}`;
  const tags = JSON.stringify(artwork.tags_parsed || {});
  
  const content = [title, coords, tags].filter(Boolean).join('|');
  
  // Simple hash - in production you might want crypto.subtle
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Find artworks within geographic radius using haversine distance
 */
function findNearbyArtworks(
  lat: number,
  lon: number,
  radiusMeters: number,
  existingArtworks: ExistingArtwork[]
): ExistingArtwork[] {
  return existingArtworks.filter(artwork => {
    const distance = calculateHaversineDistance(lat, lon, artwork.lat, artwork.lon);
    return distance <= radiusMeters;
  });
}

/**
 * Calculate similarity between import data and existing artwork
 */
async function calculateSimilarity(
  importData: ProcessedImportData,
  artwork: ExistingArtwork,
  config: MassImportConfig
): Promise<DuplicateCandidate | null> {
  // Calculate geographic distance
  const distance = calculateHaversineDistance(
    importData.lat,
    importData.lon,
    artwork.lat,
    artwork.lon
  );

  // Skip if too far away
  if (distance > config.duplicateDetectionRadius) {
    return null;
  }

  // Use the actual title field from import data (not extracted from note)
  const importTitle = importData.title || '';
  const artworkTitle = artwork.title || '';

  // Debug logging for title comparison
  console.log(`[DUPLICATE_DEBUG] Comparing titles:`);
  console.log(`[DUPLICATE_DEBUG]   Import title: "${importTitle}"`);
  console.log(`[DUPLICATE_DEBUG]   Artwork title: "${artworkTitle}"`);

  // Calculate title similarity
  const titleSimilarity = calculateTitleSimilarity(importTitle, artworkTitle);
  
  console.log(`[DUPLICATE_DEBUG]   Title similarity score: ${titleSimilarity}`);

  // Calculate overall confidence based on distance and title similarity
  const confidence = calculateConfidence(distance, titleSimilarity, config);

  // Generate reason for potential duplicate
  const reason = generateDuplicateReason(distance, titleSimilarity, config);

  const candidate: DuplicateCandidate = {
    id: artwork.id,
    lat: artwork.lat,
    lon: artwork.lon,
    distance: Math.round(distance),
    titleSimilarity,
    confidence,
    reason,
  };

  if (artwork.title) {
    candidate.title = artwork.title;
  }

  return candidate;
}

/**
 * Enhanced title similarity using multiple approaches
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  if (!title1 || !title2) {
    return 0;
  }

  // Method 1: Exact match (highest priority)
  if (title1.toLowerCase().trim() === title2.toLowerCase().trim()) {
    return 1.0;
  }

  // Normalize titles for comparison
  const normalized1 = normalizeTitle(title1);
  const normalized2 = normalizeTitle(title2);

  // Method 2: Normalized exact match
  if (normalized1 === normalized2 && normalized1.length > 0) {
    return 1.0;
  }

  // Method 3: Levenshtein distance
  const levenshteinScore = calculateLevenshteinSimilarity(normalized1, normalized2);
  
  // Method 4: Fuzzy matching (as fallback)
  const fuzzyScore = calculateFuzzyScore(normalized1, normalized2);
  
  // Return the highest score from different methods
  const finalScore = Math.max(levenshteinScore, fuzzyScore);
  
  // Debug logging for title similarity issues
  if (finalScore === 0 && title1.toLowerCase().trim() === title2.toLowerCase().trim()) {
    console.warn(`[SIMILARITY] Title similarity returned 0 for identical titles: "${title1}" vs "${title2}"`);
    return 1.0; // Force match for identical titles
  }
  
  return finalScore;
}

/**
 * Calculate Levenshtein similarity (same as API system)
 */
function calculateLevenshteinSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) {
    return str1.length === str2.length ? 1 : 0;
  }

  const matrix: number[][] = [];
  const len1 = str1.length;
  const len2 = str2.length;

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [];
    matrix[i]![0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0]![j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j]! + 1,     // deletion
          matrix[i]![j - 1]! + 1,     // insertion
          matrix[i - 1]![j - 1]! + 1  // substitution
        );
      }
    }
  }

  const distance = matrix[len1]![len2]!;
  const maxLength = Math.max(len1, len2);
  
  // Convert distance to similarity (0-1)
  return maxLength === 0 ? 1 : 1 - (distance / maxLength);
}

/**
 * Calculate fuzzy score (improved implementation)
 */
function calculateFuzzyScore(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  try {
    const results = fuzzy.filter(str1, [str2]);
    if (results.length === 0) {
      return 0;
    }
    
    // Convert fuzzy score to 0-1 range (fuzzy scores can go above 100)
    const score = results[0]?.score ?? 0;
    return Math.min(score / 100, 1);
  } catch (error) {
    console.warn('Fuzzy matching failed:', error);
    return 0;
  }
}

/**
 * Normalize title for comparison
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\b(the|a|an)\b/g, '') // Remove articles
    .trim();
}

/**
 * Calculate overall confidence score
 */
function calculateConfidence(
  distance: number,
  titleSimilarity: number,
  _config: MassImportConfig
): number {
  // Distance factor (closer = higher confidence)
  const distanceFactor = Math.max(0, 1 - (distance / _config.duplicateDetectionRadius));
  
  // Title similarity factor
  const titleFactor = titleSimilarity;
  
  // Weighted combination
  const confidence = (distanceFactor * 0.4) + (titleFactor * 0.6);
  
  return Math.min(confidence, 1);
}

/**
 * Generate human-readable reason for duplicate detection
 */
function generateDuplicateReason(
  distance: number,
  titleSimilarity: number,
  _config: MassImportConfig
): string {
  const reasons: string[] = [];

  if (distance < 10) {
    reasons.push(`Very close proximity (${Math.round(distance)}m)`);
  } else if (distance < 50) {
    reasons.push(`Close proximity (${Math.round(distance)}m)`);
  } else {
    reasons.push(`Within detection radius (${Math.round(distance)}m)`);
  }

  if (titleSimilarity > 0.8) {
    reasons.push(`Very similar title (${Math.round(titleSimilarity * 100)}% match)`);
  } else if (titleSimilarity > 0.6) {
    reasons.push(`Similar title (${Math.round(titleSimilarity * 100)}% match)`);
  } else if (titleSimilarity > 0.3) {
    reasons.push(`Somewhat similar title (${Math.round(titleSimilarity * 100)}% match)`);
  }

  return reasons.join(', ');
}

// ================================
// Distance Calculation (Haversine)
// ================================

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// ================================
// External ID Tracking
// ================================

/**
 * Check for exact duplicate based on external ID
 */
export function checkExternalIdDuplicate(
  externalId: string,
  source: string,
  existingArtworks: ExistingArtwork[]
): DuplicateCandidate | null {
  if (!externalId || !source) {
    return null;
  }

  const duplicate = existingArtworks.find(artwork => {
    // Check if artwork has matching external ID and source in tags
    const tags = artwork.tags_parsed || {};
    return tags.external_id === externalId && tags.source === source;
  });

  if (duplicate) {
    const candidate: DuplicateCandidate = {
      id: duplicate.id,
      lat: duplicate.lat,
      lon: duplicate.lon,
      distance: 0,
      titleSimilarity: 1,
      confidence: 1,
      reason: `Exact match by external ID: ${externalId}`,
    };

    if (duplicate.title) {
      candidate.title = duplicate.title;
    }

    return candidate;
  }

  return null;
}

// ================================
// Types for External Data
// ================================

export interface ExistingArtwork {
  id: string;
  lat: number;
  lon: number;
  title?: string | null;
  tags_parsed?: Record<string, unknown>;
}