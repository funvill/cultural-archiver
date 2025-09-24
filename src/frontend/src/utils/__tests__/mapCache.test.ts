import { describe, it, expect, beforeEach } from 'vitest';
import { mapCache, MAP_CACHE_INTERNALS } from '../mapCache';
import type { CachedPin } from '../mapCache';
import type { ArtworkPin, MapBounds } from '../../types';

// Use a fake localStorage via jsdom already present in Vitest env

describe('mapCache', () => {
  const CACHE_KEY = 'map:artworkPins:v1';

  const samplePins: ArtworkPin[] = [
    { id: '1', latitude: 1, longitude: 1, type: 'mural', photos: [] },
    { id: '2', latitude: 2, longitude: 2, type: 'statue', photos: [] },
  ];

  const bounds: MapBounds = { north: 3, south: 0, east: 3, west: 0 };

  beforeEach(() => {
    localStorage.removeItem(CACHE_KEY);
  });

  it('upserts and reads pins in bounds', () => {
    mapCache.upsertPins(samplePins);
    const result = mapCache.getPinsInBounds(bounds);
    expect(result.length).toBe(2);
  });

  it('prunes expired entries', () => {
    mapCache.upsertPins(samplePins);
    // Manually age the entries by overwriting cachedAt
    const all = MAP_CACHE_INTERNALS.loadAll();
    const old = Date.now() - MAP_CACHE_INTERNALS.DEFAULT_TTL_MS - 1000;
    (Object.values(all) as CachedPin[]).forEach(p => (p.cachedAt = old));
    MAP_CACHE_INTERNALS.saveAll(all);

    mapCache.prune();
    const result = mapCache.getPinsInBounds(bounds);
    expect(result.length).toBe(0);
  });

  it('clear removes all', () => {
    mapCache.upsertPins(samplePins);
    expect(mapCache.size()).toBe(2);
    mapCache.clear();
    expect(mapCache.size()).toBe(0);
  });
});
