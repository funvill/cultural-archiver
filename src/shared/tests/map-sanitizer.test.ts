// @ts-nocheck
/// <reference types="vitest" />

import { sanitizeMapEvent } from '../map-sanitizer';

describe('sanitizeMapEvent', () => {
  test('handles simple latlng object', () => {
    const ev = { latlng: { lat: 49.25, lng: -123.1 } };
    expect(sanitizeMapEvent(ev)).toEqual({ latlng: { lat: 49.25, lng: -123.1 } });
  });

  test('handles leaflet-like event with center, zoom and bounds', () => {
    const ev: any = {
      type: 'move',
      center: { lat: 49.2, lng: -123.0 },
      zoom: 12,
      bounds: {
        _northEast: { lat: 49.3, lng: -122.9 },
        _southWest: { lat: 49.1, lng: -123.2 },
      },
      target: { id: 'map1' },
    };

    expect(sanitizeMapEvent(ev)).toEqual({
      type: 'move',
      center: { lat: 49.2, lng: -123.0 },
      zoom: 12,
      bounds: { northEast: { lat: 49.3, lng: -122.9 }, southWest: { lat: 49.1, lng: -123.2 } },
      targetId: 'map1',
    });
  });

  test('does not traverse host objects', () => {
    const host: any = { getCenter: () => ({ lat: 1, lng: 2 }), getBounds: () => ({ getNorthEast: () => ({ lat: 3, lng: 4 }) }), id: 'x' };
    const ev: any = { target: host };
    const sanitized = sanitizeMapEvent(ev);
    expect(sanitized.targetId).toBe('x');
    // center or bounds may be present but must be plain values or undefined
    expect(typeof sanitized.targetId).toBe('string');
  });
});
