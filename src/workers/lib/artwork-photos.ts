import type { D1Database } from '@cloudflare/workers-types';
import { safeJsonParse } from './errors';
import { getAllLogbookEntriesForArtworkFromSubmissions } from './database-patch.js';

export interface ArtworkPhotoContext {
  id: string;
  photos?: unknown;
  tags?: unknown;
}

export interface ArtworkPhotoSources {
  artworkPhotos: string[];
  logbookPhotos: string[];
  tagPhotos: string[];
  logbookEntryCount: number;
}

type PhotoPriority = 'artwork-first' | 'logbook-first';

const addUniquePhoto = (target: string[], seen: Set<string>, candidate: unknown) => {
  if (typeof candidate !== 'string') return;
  const trimmed = candidate.trim();
  if (!trimmed || seen.has(trimmed)) return;
  seen.add(trimmed);
  target.push(trimmed);
};

const extractPhotosFromValue = (value: unknown): string[] => {
  const photos: string[] = [];
  const seen = new Set<string>();

  if (typeof value === 'string') {
    const parsed = safeJsonParse<string[]>(value, []);
    parsed.forEach(photo => addUniquePhoto(photos, seen, photo));
    return photos;
  }

  if (Array.isArray(value)) {
    value.forEach(photo => addUniquePhoto(photos, seen, photo));
    return photos;
  }

  return photos;
};

export async function collectArtworkPhotoSources(
  db: D1Database,
  artwork: ArtworkPhotoContext
): Promise<ArtworkPhotoSources> {
  const artworkPhotos = extractPhotosFromValue(artwork.photos);
  const tagPhotos: string[] = [];

  if (artwork.tags && typeof artwork.tags === 'string') {
    const raw = safeJsonParse<Record<string, unknown>>(artwork.tags, {});
    if (raw && Array.isArray((raw as Record<string, unknown>)._photos)) {
      (raw._photos as unknown[]).forEach(photo => {
        if (typeof photo === 'string') tagPhotos.push(photo);
      });
    }
  }

  let logbookPhotos: string[] = [];
  let logbookEntryCount = 0;
  try {
    const entries = await getAllLogbookEntriesForArtworkFromSubmissions(db, artwork.id);
    logbookEntryCount = entries.length;
    const seen = new Set<string>();
    const collected: string[] = [];
    entries.forEach(entry => {
      if (!entry.photos) return;
      const parsed = safeJsonParse<string[]>(entry.photos, []);
      parsed.forEach(photo => addUniquePhoto(collected, seen, photo));
    });
    logbookPhotos = collected;
  } catch {
    // swallow errors; fall back to whatever photo data we already have
    logbookPhotos = [];
  }

  return {
    artworkPhotos,
    logbookPhotos,
    tagPhotos,
    logbookEntryCount,
  };
}

export function combineArtworkPhotos(
  sources: ArtworkPhotoSources,
  priority: PhotoPriority = 'logbook-first'
): string[] {
  const order =
    priority === 'artwork-first'
      ? [sources.artworkPhotos, sources.logbookPhotos, sources.tagPhotos]
      : [sources.logbookPhotos, sources.artworkPhotos, sources.tagPhotos];

  const seen = new Set<string>();
  const combined: string[] = [];
  order.forEach(list => {
    list.forEach(photo => addUniquePhoto(combined, seen, photo));
  });
  return combined;
}
