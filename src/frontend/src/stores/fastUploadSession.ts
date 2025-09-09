import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Coordinates } from '../types';

export interface FastUploadPhotoMeta {
  id: string;
  name: string;
  preview?: string; // data URL or object URL (not persisted to sessionStorage)
  exifLat?: number;
  exifLon?: number;
  file?: File; // raw File kept only in-memory (not serialized) for fast artwork submission
}

interface LocationSourcesState {
  exif: { detected: boolean; error: boolean; coordinates: Coordinates | null };
  browser: { detected: boolean; error: boolean; coordinates: Coordinates | null };
  ip: { detected: boolean; error: boolean; coordinates: Coordinates | null };
}

export const useFastUploadSessionStore = defineStore('fastUploadSession', () => {
  const photos = ref<FastUploadPhotoMeta[]>([]);
  const location = ref<Coordinates | null>(null);
  const detectedSources = ref<LocationSourcesState | null>(null);

  function setSession(data: {
  photos: FastUploadPhotoMeta[]; // Accept photos including optional file field
    location: Coordinates | null;
    detectedSources: LocationSourcesState;
  }): void {
    photos.value = data.photos;
    location.value = data.location;
    detectedSources.value = data.detectedSources;
  }

  function clear(): void {
    photos.value = [];
    location.value = null;
    detectedSources.value = null;
    try { sessionStorage.removeItem('fast-upload-session'); } catch {}
  }

  const hasPhotos = computed(() => photos.value.length > 0);

  return { photos, location, detectedSources, hasPhotos, setSession, clear };
});
