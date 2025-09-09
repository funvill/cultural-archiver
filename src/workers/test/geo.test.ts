/**
 * Test suite for geographic utilities and constants
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ARTWORK_SEARCH_RADIUS,
  ARTWORK_SEARCH_RADIUS_PRESETS,
  normalizeCoordinates,
  isValidLatitude,
  isValidLongitude,
  isValidCoordinates,
  calculateDistance,
  getBoundingBox,
  isWithinBounds,
  formatCoordinates,
  parseCoordinates,
} from '../../shared/geo';

describe('Geographic Utilities', () => {
  describe('Constants', () => {
    it('should have valid default search radius', () => {
      expect(DEFAULT_ARTWORK_SEARCH_RADIUS).toBe(250);
    });

    it('should have ascending radius presets', () => {
      expect(ARTWORK_SEARCH_RADIUS_PRESETS).toEqual([100, 250, 500, 1000]);
      
      // Check that presets are in ascending order
      for (let i = 1; i < ARTWORK_SEARCH_RADIUS_PRESETS.length; i++) {
        expect(ARTWORK_SEARCH_RADIUS_PRESETS[i]).toBeGreaterThan(ARTWORK_SEARCH_RADIUS_PRESETS[i - 1]);
      }
    });
  });

  describe('Coordinate Validation', () => {
    it('should validate latitude values', () => {
      expect(isValidLatitude(0)).toBe(true);
      expect(isValidLatitude(49.2827)).toBe(true);
      expect(isValidLatitude(-49.2827)).toBe(true);
      expect(isValidLatitude(90)).toBe(true);
      expect(isValidLatitude(-90)).toBe(true);
      
      expect(isValidLatitude(91)).toBe(false);
      expect(isValidLatitude(-91)).toBe(false);
      expect(isValidLatitude(NaN)).toBe(false);
      expect(isValidLatitude(Infinity)).toBe(false);
    });

    it('should validate longitude values', () => {
      expect(isValidLongitude(0)).toBe(true);
      expect(isValidLongitude(-123.1207)).toBe(true);
      expect(isValidLongitude(123.1207)).toBe(true);
      expect(isValidLongitude(180)).toBe(true);
      expect(isValidLongitude(-180)).toBe(true);
      
      expect(isValidLongitude(181)).toBe(false);
      expect(isValidLongitude(-181)).toBe(false);
      expect(isValidLongitude(NaN)).toBe(false);
      expect(isValidLongitude(Infinity)).toBe(false);
    });

    it('should validate coordinate pairs', () => {
      expect(isValidCoordinates({ lat: 49.2827, lon: -123.1207 })).toBe(true);
      expect(isValidCoordinates({ lat: 0, lon: 0 })).toBe(true);
      
      expect(isValidCoordinates({ lat: 91, lon: -123.1207 })).toBe(false);
      expect(isValidCoordinates({ lat: 49.2827, lon: 181 })).toBe(false);
      expect(isValidCoordinates({ lat: NaN, lon: -123.1207 })).toBe(false);
    });
  });

  describe('Coordinate Normalization', () => {
    it('should normalize coordinates to specified precision', () => {
      const coords = { lat: 49.28273456, lon: -123.12073456 };
      const normalized = normalizeCoordinates(coords, 5);
      
      expect(normalized.lat).toBe(49.28273);
      expect(normalized.lon).toBe(-123.12073);
    });

    it('should use default precision', () => {
      const coords = { lat: 49.2827345678, lon: -123.1207345678 };
      const normalized = normalizeCoordinates(coords);
      
      // Default precision is 5 decimal places
      expect(normalized.lat).toBe(49.28273);
      expect(normalized.lon).toBe(-123.12073);
    });
  });

  describe('Distance Calculations', () => {
    it('should calculate zero distance for same point', () => {
      const point = { lat: 49.2827, lon: -123.1207 };
      const distance = calculateDistance(point, point);
      
      expect(distance).toBe(0);
    });

    it('should calculate reasonable distances for Vancouver locations', () => {
      // Vancouver coordinates
      const downtown = { lat: 49.2827, lon: -123.1207 };
      const ubc = { lat: 49.2606, lon: -123.2460 };
      
      const distance = calculateDistance(downtown, ubc);
      
      // Distance should be approximately 10-15 km
      expect(distance).toBeGreaterThan(9000);
      expect(distance).toBeLessThan(16000);
    });

    it('should calculate distance symmetrically', () => {
      const point1 = { lat: 49.2827, lon: -123.1207 };
      const point2 = { lat: 49.2606, lon: -123.2460 };
      
      const distance1 = calculateDistance(point1, point2);
      const distance2 = calculateDistance(point2, point1);
      
      expect(distance1).toBeCloseTo(distance2, 0);
    });

    it('should handle very small distances accurately', () => {
      const point1 = { lat: 49.2827, lon: -123.1207 };
      const point2 = { lat: 49.2828, lon: -123.1207 }; // ~111m north
      
      const distance = calculateDistance(point1, point2);
      
      // Should be approximately 11 meters (0.0001 degree lat ≈ 11.1m)
      expect(distance).toBeGreaterThan(10);
      expect(distance).toBeLessThan(15);
    });
  });

  describe('Bounding Box Operations', () => {
    it('should generate correct bounding box', () => {
      const center = { lat: 49.2827, lon: -123.1207 };
      const radiusMeters = 1000; // 1km
      
      const bounds = getBoundingBox(center, radiusMeters);
      
      expect(bounds.north).toBeGreaterThan(center.lat);
      expect(bounds.south).toBeLessThan(center.lat);
      expect(bounds.east).toBeGreaterThan(center.lon);
      expect(bounds.west).toBeLessThan(center.lon);
    });

    it('should create symmetric bounding box', () => {
      const center = { lat: 49.2827, lon: -123.1207 };
      const radiusMeters = 500;
      
      const bounds = getBoundingBox(center, radiusMeters);
      
      const latDelta = bounds.north - center.lat;
      const latDelta2 = center.lat - bounds.south;
      const lonDelta = bounds.east - center.lon;
      const lonDelta2 = center.lon - bounds.west;
      
      expect(latDelta).toBeCloseTo(latDelta2, 6);
      expect(lonDelta).toBeCloseTo(lonDelta2, 6);
    });

    it('should check if point is within bounds', () => {
      const center = { lat: 49.2827, lon: -123.1207 };
      const bounds = getBoundingBox(center, 1000);
      
      // Center should be within bounds
      expect(isWithinBounds(center, bounds)).toBe(true);
      
      // Point just inside should be within bounds
      const insidePoint = { lat: center.lat + 0.001, lon: center.lon + 0.001 };
      expect(isWithinBounds(insidePoint, bounds)).toBe(true);
      
      // Point far outside should not be within bounds
      const outsidePoint = { lat: center.lat + 1, lon: center.lon + 1 };
      expect(isWithinBounds(outsidePoint, bounds)).toBe(false);
    });
  });

  describe('Coordinate Formatting', () => {
    it('should format coordinates with default precision', () => {
      const coords = { lat: 49.2827, lon: -123.1207 };
      const formatted = formatCoordinates(coords);
      
      expect(formatted).toBe('49.2827, -123.1207');
    });

    it('should format coordinates with custom precision', () => {
      const coords = { lat: 49.28273456, lon: -123.12073456 };
      const formatted = formatCoordinates(coords, 2);
      
      expect(formatted).toBe('49.28, -123.12');
    });

    it('should handle negative coordinates', () => {
      const coords = { lat: -49.2827, lon: -123.1207 };
      const formatted = formatCoordinates(coords);
      
      expect(formatted).toBe('-49.2827, -123.1207');
    });
  });

  describe('Coordinate Parsing', () => {
    it('should parse valid coordinate strings', () => {
      const parsed = parseCoordinates('49.2827, -123.1207');
      
      expect(parsed).toEqual({ lat: 49.2827, lon: -123.1207 });
    });

    it('should handle whitespace variations', () => {
      const parsed1 = parseCoordinates('49.2827,-123.1207');
      const parsed2 = parseCoordinates('49.2827,  -123.1207');
      const parsed3 = parseCoordinates('49.2827 , -123.1207');
      
      expect(parsed1).toEqual({ lat: 49.2827, lon: -123.1207 });
      expect(parsed2).toEqual({ lat: 49.2827, lon: -123.1207 });
      expect(parsed3).toEqual({ lat: 49.2827, lon: -123.1207 });
    });

    it('should return null for invalid strings', () => {
      expect(parseCoordinates('invalid')).toBeNull();
      expect(parseCoordinates('49.2827')).toBeNull();
      expect(parseCoordinates('49.2827, invalid')).toBeNull();
      expect(parseCoordinates('')).toBeNull();
    });

    it('should return null for coordinates out of range', () => {
      expect(parseCoordinates('91, -123.1207')).toBeNull();
      expect(parseCoordinates('49.2827, 181')).toBeNull();
    });

    it('should handle integer coordinates', () => {
      const parsed = parseCoordinates('49, -123');
      
      expect(parsed).toEqual({ lat: 49, lon: -123 });
    });
  });

  describe('Real-world Distance Validation', () => {
    it('should match known distances approximately', () => {
      // Well-known distance: Vancouver to Seattle is approximately 200km
      const vancouver = { lat: 49.2827, lon: -123.1207 };
      const seattle = { lat: 47.6062, lon: -122.3321 };
      
      const distance = calculateDistance(vancouver, seattle);
      
      // Should be approximately 200km (allow some tolerance)
      expect(distance).toBeGreaterThan(180000);
      expect(distance).toBeLessThan(220000);
    });

    it('should handle international date line', () => {
      // Points across the international date line
      const point1 = { lat: 0, lon: 179 };
      const point2 = { lat: 0, lon: -179 };
      
      const distance = calculateDistance(point1, point2);
      
      // Should be about 2 degrees of longitude at equator ≈ 220km
      expect(distance).toBeGreaterThan(200000);
      expect(distance).toBeLessThan(250000);
    });
  });
});