/**
 * Shared geographic constants and utilities for the cultural archiver system.
 * Used across frontend and backend for consistent location handling.
 */

// ================================
// Geographic Constants
// ================================

// Default search radius for nearby artwork discovery (meters)
// This is the radius used in the fast photo-first workflow for finding potential duplicates
export const DEFAULT_ARTWORK_SEARCH_RADIUS = 250;

// Available radius presets for user selection (meters)
export const ARTWORK_SEARCH_RADIUS_PRESETS = [100, 250, 500, 1000] as const;

// Maximum and minimum allowed search radius (meters)
export const MAX_ARTWORK_SEARCH_RADIUS = 10000; // 10km
export const MIN_ARTWORK_SEARCH_RADIUS = 50; // 50m

// Coordinate precision for storage (decimal places)
export const COORDINATE_PRECISION = 5; // ~1 meter precision

// Geographic bounds validation constants
export const VALID_LATITUDE_RANGE = { min: -90, max: 90 } as const;
export const VALID_LONGITUDE_RANGE = { min: -180, max: 180 } as const;

// ================================
// Geographic Types
// ================================

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface CoordinatesWithAltitude extends Coordinates {
  altitude?: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface LocationResolution {
  coordinates: Coordinates;
  source: 'exif' | 'geolocation' | 'manual' | 'ip_fallback';
  accuracy?: number; // meters
  timestamp?: string;
}

// ================================
// Utility Functions
// ================================

/**
 * Normalize coordinates to specified precision
 */
export function normalizeCoordinates(coordinates: Coordinates, precision = COORDINATE_PRECISION): Coordinates {
  const factor = Math.pow(10, precision);
  return {
    lat: Math.round(coordinates.lat * factor) / factor,
    lon: Math.round(coordinates.lon * factor) / factor,
  };
}

/**
 * Validate latitude value
 */
export function isValidLatitude(lat: number): boolean {
  return !isNaN(lat) && lat >= VALID_LATITUDE_RANGE.min && lat <= VALID_LATITUDE_RANGE.max;
}

/**
 * Validate longitude value
 */
export function isValidLongitude(lon: number): boolean {
  return !isNaN(lon) && lon >= VALID_LONGITUDE_RANGE.min && lon <= VALID_LONGITUDE_RANGE.max;
}

/**
 * Validate coordinate pair
 */
export function isValidCoordinates(coordinates: Coordinates): boolean {
  return isValidLatitude(coordinates.lat) && isValidLongitude(coordinates.lon);
}

/**
 * Calculate haversine distance between two points in meters
 */
export function calculateDistance(point1: Coordinates, point2: Coordinates): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(point2.lat - point1.lat);
  const dLon = toRadians(point2.lon - point1.lon);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.lat)) * Math.cos(toRadians(point2.lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Generate bounding box for spatial filtering
 * Uses approximate degree conversion for initial filtering
 */
export function getBoundingBox(center: Coordinates, radiusMeters: number): BoundingBox {
  // Approximate conversions (good enough for initial filtering)
  const latDegPerMeter = 1 / 111000; // 1 degree lat ≈ 111km
  const lonDegPerMeter = 1 / (111000 * Math.cos(toRadians(center.lat))); // Adjusts for latitude
  
  const latOffset = radiusMeters * latDegPerMeter;
  const lonOffset = radiusMeters * lonDegPerMeter;
  
  return {
    north: center.lat + latOffset,
    south: center.lat - latOffset,
    east: center.lon + lonOffset,
    west: center.lon - lonOffset,
  };
}

/**
 * Check if coordinates are within bounding box
 */
export function isWithinBounds(coordinates: Coordinates, bounds: BoundingBox): boolean {
  return (
    coordinates.lat >= bounds.south &&
    coordinates.lat <= bounds.north &&
    coordinates.lon >= bounds.west &&
    coordinates.lon <= bounds.east
  );
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(coordinates: Coordinates, precision = 4): string {
  return `${coordinates.lat.toFixed(precision)}, ${coordinates.lon.toFixed(precision)}`;
}

/**
 * Parse coordinates from string
 */
export function parseCoordinates(coordString: string): Coordinates | null {
  const match = coordString.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (!match) return null;
  
  const lat = parseFloat(match[1]!);
  const lon = parseFloat(match[2]!);
  
  if (!isValidCoordinates({ lat, lon })) return null;
  
  return { lat, lon };
}