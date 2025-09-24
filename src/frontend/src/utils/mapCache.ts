/**
 * Lightweight browser cache for map pins with time-based expiry and manual busting.
 *
 * Storage strategy:
 * - localStorage single key storing an object map of id -> CachedPin
 * - Each entry has cachedAt timestamp to support expiry (default 30 days)
 * - Provides queries by bounds and helpers to upsert/clear/prune
 *
 * Note: Using localStorage for simplicity and broad support. If the dataset grows beyond
 * ~5-10MB limits, consider migrating to IndexedDB with an identical API surface.
 */
import type { ArtworkPin, MapBounds } from '../types';

export interface CachedPin extends ArtworkPin {
  cachedAt: number; // epoch ms
}

const CACHE_KEY = 'map:artworkPins:v1';
const DEFAULT_TTL_MS = 30 /* days */ * 24 * 60 * 60 * 1000; // 30 days

type CacheShape = Record<string, CachedPin>; // id -> pin

function now(): number {
  return Date.now();
}

function loadAll(): CacheShape {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CacheShape;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // ignore parse errors
  }
  return {};
}

function saveAll(data: CacheShape): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Storage quota exceeded or disabled; ignore to avoid breaking UX
  }
}

function isExpired(pin: CachedPin, ttlMs: number = DEFAULT_TTL_MS): boolean {
  return now() - pin.cachedAt > ttlMs;
}

export const mapCache = {
  // Return non-expired pins that fall within bounds
  getPinsInBounds(bounds: MapBounds, ttlMs: number = DEFAULT_TTL_MS): ArtworkPin[] {
    const all = loadAll();
    const list: ArtworkPin[] = [];
    for (const id in all) {
      const p = all[id];
      if (!p) continue;
      if (isExpired(p, ttlMs)) continue;
      if (
        p.latitude <= bounds.north &&
        p.latitude >= bounds.south &&
        p.longitude <= bounds.east &&
        p.longitude >= bounds.west
      ) {
        // Strip metadata before returning
        const { cachedAt, ...pin } = p as unknown as CachedPin & Record<string, unknown>;
        void cachedAt; // prevent unused var lint
        list.push(pin as ArtworkPin);
      }
    }
    return list;
  },

  // Upsert pins, stamping cachedAt
  upsertPins(pins: ArtworkPin[]): void {
    if (!pins?.length) return;
    const all = loadAll();
    const stamp = now();
    for (const pin of pins) {
      all[pin.id] = {
        ...(all[pin.id] as CachedPin | undefined),
        ...pin,
        cachedAt: stamp,
      } as CachedPin;
    }
    saveAll(all);
  },

  // Remove expired entries
  prune(ttlMs: number = DEFAULT_TTL_MS): void {
    const all = loadAll();
    let changed = false;
    for (const id in all) {
      const p = all[id];
      if (!p) continue;
      if (isExpired(p, ttlMs)) {
        delete all[id];
        changed = true;
      }
    }
    if (changed) saveAll(all);
  },

  // Clear cache completely
  clear(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
  },

  // For stats/diagnostics
  size(): number {
    const all = loadAll();
    return Object.keys(all).length;
  },
};

export const MAP_CACHE_INTERNALS = { loadAll, saveAll, DEFAULT_TTL_MS };
