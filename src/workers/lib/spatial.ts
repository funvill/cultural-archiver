/**
 * Spatial utilities for geospatial calculations and coordinate validation
 * Handles bounding box calculations, distance calculations, and coordinate validation
 */

import { DEFAULT_SEARCH_RADIUS, MAX_SEARCH_RADIUS, MIN_SEARCH_RADIUS } from '../../shared/types';

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface DistanceResult {
  distance_meters: number;
  distance_km: number;
}

/**
 * Validates latitude coordinate
 */
export function isValidLatitude(lat: number): boolean {
  return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
}

/**
 * Validates longitude coordinate
 */
export function isValidLongitude(lon: number): boolean {
  return typeof lon === 'number' && !isNaN(lon) && lon >= -180 && lon <= 180;
}

/**
 * Validates a complete coordinate pair
 */
export function isValidCoordinates(lat: number, lon: number): boolean {
  return isValidLatitude(lat) && isValidLongitude(lon);
}

/**
 * Validates and clamps search radius to acceptable bounds
 */
export function validateSearchRadius(radius?: number): number {
  if (typeof radius !== 'number' || isNaN(radius)) {
    return DEFAULT_SEARCH_RADIUS;
  }

  if (radius < MIN_SEARCH_RADIUS) {
    return MIN_SEARCH_RADIUS;
  }

  if (radius > MAX_SEARCH_RADIUS) {
    return MAX_SEARCH_RADIUS;
  }

  return radius;
}

/**
 * Calculate bounding box for spatial queries based on center point and radius
 * Uses approximate conversion of meters to degrees
 */
export function calculateBoundingBox(lat: number, lon: number, radiusMeters: number): BoundingBox {
  // Approximate conversion: 1 degree latitude ≈ 111,000 meters
  // Longitude varies by latitude, but we use a simple approximation
  const latDelta = radiusMeters / 111000;
  const lonDelta = radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180));

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}

/**
 * Calculate distance between two points using the Haversine formula
 * Returns distance in both meters and kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): DistanceResult {
  const R = 6371000; // Earth's radius in meters

  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const deltaLatRad = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLonRad = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceMeters = R * c;

  return {
    distance_meters: Math.round(distanceMeters),
    distance_km: Math.round((distanceMeters / 1000) * 100) / 100, // Round to 2 decimal places
  };
}

/**
 * Filter an array of coordinates by distance from a center point
 */
export function filterByDistance<T extends Coordinates>(
  items: T[],
  centerLat: number,
  centerLon: number,
  maxDistanceMeters: number
): (T & DistanceResult)[] {
  return items
    .map(item => {
      const distance = calculateDistance(centerLat, centerLon, item.lat, item.lon);
      return {
        ...item,
        ...distance,
      };
    })
    .filter(item => item.distance_meters <= maxDistanceMeters)
    .sort((a, b) => a.distance_meters - b.distance_meters);
}

/**
 * Check if a point is within a bounding box
 */
export function isWithinBoundingBox(lat: number, lon: number, boundingBox: BoundingBox): boolean {
  return (
    lat >= boundingBox.minLat &&
    lat <= boundingBox.maxLat &&
    lon >= boundingBox.minLon &&
    lon <= boundingBox.maxLon
  );
}

/**
 * Find the closest point from an array of coordinates
 */
export function findClosest<T extends Coordinates>(
  items: T[],
  targetLat: number,
  targetLon: number
): (T & DistanceResult) | null {
  if (items.length === 0) {
    return null;
  }

  const itemsWithDistance = items.map(item => {
    const distance = calculateDistance(targetLat, targetLon, item.lat, item.lon);
    return {
      ...item,
      ...distance,
    };
  });

  return itemsWithDistance.reduce((closest, current) =>
    current.distance_meters < closest.distance_meters ? current : closest
  );
}

/**
 * Generate a reasonable search radius based on area type (urban vs rural)
 * This is a simple heuristic based on coordinate density
 */
export function suggestSearchRadius(lat: number, lon: number): number {
  // Simple heuristic: if coordinates are in heavily populated areas (like cities),
  // suggest smaller radius. This is very basic and could be improved with actual
  // population density data.

  // Check if coordinates are near major cities (rough approximation)
  const majorCities = [
    { lat: 49.2827, lon: -123.1207 }, // Vancouver
    { lat: 45.5017, lon: -73.5673 }, // Montreal
    { lat: 43.6532, lon: -79.3832 }, // Toronto
    { lat: 51.0447, lon: -114.0719 }, // Calgary
  ];

  const nearCity = majorCities.some(city => {
    const distance = calculateDistance(lat, lon, city.lat, city.lon);
    return distance.distance_km < 50; // Within 50km of a major city
  });

  return nearCity ? 300 : 800; // Smaller radius in cities, larger in rural areas
}

/**
 * Normalize coordinates to a standard precision to avoid floating point issues
 */
export function normalizeCoordinates(lat: number, lon: number): Coordinates {
  return {
    lat: Math.round(lat * 1000000) / 1000000, // 6 decimal places (≈ 0.1m precision)
    lon: Math.round(lon * 1000000) / 1000000,
  };
}

/**
 * Check if two coordinates are approximately equal within a tolerance
 */
export function areCoordinatesEqual(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  toleranceMeters: number = 10
): boolean {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  return distance.distance_meters <= toleranceMeters;
}

/**
 * Generate a random coordinate within a radius of a center point
 * Useful for testing
 */
export function generateRandomCoordinateNear(
  centerLat: number,
  centerLon: number,
  maxRadiusMeters: number
): Coordinates {
  const angle = Math.random() * 2 * Math.PI;
  const radius = Math.random() * maxRadiusMeters;

  const latDelta = (radius * Math.cos(angle)) / 111000;
  const lonDelta = (radius * Math.sin(angle)) / (111000 * Math.cos((centerLat * Math.PI) / 180));

  return normalizeCoordinates(centerLat + latDelta, centerLon + lonDelta);
}
