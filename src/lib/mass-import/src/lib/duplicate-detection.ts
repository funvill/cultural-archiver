/**
 * Mass Import System - Duplicate Detection
 * 
 * This module handles duplicate detection using geographic proximity
 * and fuzzy string matching on titles.
 */

import fuzzy from 'fuzzy';
import type {
  DuplicateDetectionResult,
  DuplicateCandidate,
  ProcessedImportData,
  MassImportConfig,
} from '../types';

// ================================
// Core Duplicate Detection
// ================================

/**
 * Detect potential duplicates for import data
 */
export async function detectDuplicates(
  importData: ProcessedImportData,
  config: MassImportConfig,
  existingArtworks: ExistingArtwork[]
): Promise<DuplicateDetectionResult> {
  const candidates: DuplicateCandidate[] = [];

  // Step 1: Find artworks within geographic proximity
  const nearbyArtworks = findNearbyArtworks(
    importData.lat,
    importData.lon,
    config.duplicateDetectionRadius,
    existingArtworks
  );

  // Step 2: Calculate similarity scores for nearby artworks
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

  // Extract title from import note
  const importTitle = extractTitleFromNote(importData.note || '');
  const artworkTitle = artwork.title || '';

  // Calculate title similarity
  const titleSimilarity = calculateTitleSimilarity(importTitle, artworkTitle);

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
 * Calculate title similarity using fuzzy string matching
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  if (!title1 || !title2) {
    return 0;
  }

  // Normalize titles for comparison
  const normalized1 = normalizeTitle(title1);
  const normalized2 = normalizeTitle(title2);

  // Use fuzzy string matching
  const results = fuzzy.filter(normalized1, [normalized2]);
  if (results.length === 0) {
    return 0;
  }

  // Convert fuzzy score to 0-1 range
  const score = results[0]?.score ?? 0;
  return Math.min(score / 100, 1);
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

/**
 * Extract title from note field (handles various formats)
 */
function extractTitleFromNote(note: string): string {
  // Look for "Title: ..." pattern
  const titleMatch = note.match(/Title:\s*([^\n]+)/i);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }

  // Fallback to first line
  const firstLine = note.split('\n')[0];
  if (!firstLine) return '';
  
  return firstLine.length > 100 ? firstLine.substring(0, 100) : firstLine;
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
  tags_parsed?: Record<string, any>;
}