/**
 * Pinia store for managing fast photo-first artwork submission state
 * Handles transient submission data, location resolution, and similarity checking
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CONSENT_VERSION } from '../../../shared/consent';

// Remove unused import
// import type {
//   ArtworkWithPhotos
// } from '../../../shared/types';

export interface FastArtworkSubmissionResponse {
  id: string; // Artwork ID or logbook entry ID
  submission_type: 'new_artwork' | 'logbook_entry';
  status: 'pending';
  message: string;
  artwork_id?: string; // Present when creating logbook entry
  similarity_warnings?: Array<{
    artwork_id: string;
    similarity_score: number;
    similarity_explanation: string;
  }>;
}

export interface LocationData {
  lat: number;
  lon: number;
  accuracy?: number;
  source: 'exif' | 'geolocation' | 'ip' | 'manual';
  address?: string; // Reverse geocoded address
}

export interface SubmissionPhoto {
  file: File;
  url: string; // Object URL for preview
  exifData?: {
    lat?: number;
    lon?: number;
    timestamp?: string;
    camera?: string;
  };
}

export interface SimilarityCandidate {
  id: string;
  lat: number;
  lon: number;
  type_name: string;
  distance_meters: number;
  title?: string;
  photos: string[];
  recent_photo?: string; // First photo for preview
  photo_count?: number;
  similarity_score?: number;
  similarity_threshold?: 'warning' | 'high';
  similarity_explanation?: string;
}

export interface SubmissionState {
  // Step 1: Photo Upload
  photos: SubmissionPhoto[];

  // Step 2: Location Resolution
  location: LocationData | null;
  locationLoading: boolean;
  locationError: string | null;

  // Step 3: Nearby & Similarity
  nearbyArtworks: SimilarityCandidate[];
  similarityWarnings: SimilarityCandidate[];
  similarityLoading: boolean;

  // Step 4: Artwork Selection
  selectedArtwork: string | null; // null = create new artwork

  // Step 5: Artwork Details (for new artwork)
  title: string;
  tags: Record<string, string | number>;
  note: string;

  // Step 6: Consent
  consentVersion: string;

  // Submission State
  isSubmitting: boolean;
  submitError: string | null;
  submissionResult: FastArtworkSubmissionResponse | null;
}

export const useArtworkSubmissionStore = defineStore('artworkSubmission', () => {
  // State
  const state = ref<SubmissionState>({
    photos: [],
    location: null,
    locationLoading: false,
    locationError: null,
    nearbyArtworks: [],
    similarityWarnings: [],
    similarityLoading: false,
    selectedArtwork: null,
    title: '',
    tags: { artwork_type: 'public_art' },
    note: '',
    consentVersion: CONSENT_VERSION,
    isSubmitting: false,
    submitError: null,
    submissionResult: null,
  });

  // Computed
  const hasPhotos = computed(() => state.value.photos.length > 0);
  const hasLocation = computed(() => state.value.location !== null);
  const hasHighSimilarity = computed(() =>
    state.value.similarityWarnings.some(w => w.similarity_threshold === 'high')
  );
  const isNewArtwork = computed(() => state.value.selectedArtwork === null);
  const canSubmit = computed(() => {
    return (
      hasPhotos.value &&
      hasLocation.value &&
      !state.value.isSubmitting &&
      (isNewArtwork.value ? state.value.title.trim().length > 0 : true) &&
      state.value.consentVersion === CONSENT_VERSION
    );
  });

  // Actions

  /**
   * Add photos to submission
   */
  function addPhotos(files: File[]): void {
    const newPhotos: SubmissionPhoto[] = files.map(file => ({
      file,
      url: URL.createObjectURL(file),
    }));

    state.value.photos.push(...newPhotos);

    // Try to extract location from first photo EXIF
    if (newPhotos.length > 0 && !state.value.location) {
      extractLocationFromPhotos(newPhotos);
    }
  }

  /**
   * Remove photo from submission
   */
  function removePhoto(index: number): void {
    const photo = state.value.photos[index];
    if (photo) {
      URL.revokeObjectURL(photo.url);
      state.value.photos.splice(index, 1);
    }
  }

  /**
   * Extract location from photo EXIF data
   */
  async function extractLocationFromPhotos(photos: SubmissionPhoto[]): Promise<void> {
    // This is a simplified version - in the real implementation,
    // you would use a library like 'exif-js' or 'piexifjs'
    // For now, we'll just set a flag that we attempted EXIF extraction
    for (const photo of photos) {
      try {
        // TODO: Implement actual EXIF extraction
        // const exifData = await extractExifData(photo.file);
        // if (exifData.lat && exifData.lon) {
        //   setLocation({
        //     lat: exifData.lat,
        //     lon: exifData.lon,
        //     accuracy: 10,
        //     source: 'exif'
        //   });
        //   break;
        // }

        // Placeholder - mark that we attempted EXIF extraction
        photo.exifData = { timestamp: new Date().toISOString() };
      } catch (error) {
        console.warn('EXIF extraction failed:', error);
      }
    }
  }

  /**
   * Set location data
   */
  function setLocation(location: LocationData): void {
    state.value.location = location;
    state.value.locationError = null;

    // Clear previous similarity results since location changed
    state.value.nearbyArtworks = [];
    state.value.similarityWarnings = [];
  }

  /**
   * Get current location using geolocation API
   */
  async function getCurrentLocation(): Promise<void> {
    if (!navigator.geolocation) {
      state.value.locationError = 'Geolocation is not supported by this browser';
      return;
    }

    state.value.locationLoading = true;
    state.value.locationError = null;

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        position => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: 'geolocation',
          });
          state.value.locationLoading = false;
          resolve();
        },
        error => {
          let errorMessage = 'Failed to get location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }

          state.value.locationError = errorMessage;
          state.value.locationLoading = false;
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        }
      );
    });
  }

  /**
   * Set location manually (from map picker)
   */
  function setManualLocation(lat: number, lon: number, address?: string): void {
    setLocation({
      lat,
      lon,
      source: 'manual',
      ...(address && { address }),
    });
  }

  /**
   * Check for similar nearby artworks
   */
  async function checkSimilarity(): Promise<void> {
    if (!state.value.location) {
      throw new Error('Location is required for similarity checking');
    }

    state.value.similarityLoading = true;

    try {
      // API call to check similarity
      const response = await fetch('/api/artworks/check-similarity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lat: state.value.location.lat,
          lon: state.value.location.lon,
          title: state.value.title || undefined,
          tags: Object.values(state.value.tags).filter(Boolean),
          dev_mode: process.env.NODE_ENV === 'development',
        }),
      });

      if (!response.ok) {
        throw new Error(`Similarity check failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        state.value.nearbyArtworks = result.data.candidates || [];
        state.value.similarityWarnings =
          result.data.candidates?.filter(
            (c: SimilarityCandidate) => c.similarity_threshold === 'high'
          ) || [];
      } else {
        throw new Error(result.message || 'Similarity check failed');
      }
    } catch (error) {
      console.error('Similarity check failed:', error);
      // Don't throw - similarity check is optional
      state.value.nearbyArtworks = [];
      state.value.similarityWarnings = [];
    } finally {
      state.value.similarityLoading = false;
    }
  }

  /**
   * Select an existing artwork for logbook entry
   */
  function selectArtwork(artworkId: string): void {
    state.value.selectedArtwork = artworkId;
  }

  /**
   * Select to create a new artwork
   */
  function selectNewArtwork(): void {
    state.value.selectedArtwork = null;
  }

  /**
   * Update artwork details
   */
  function updateArtworkDetails(details: {
    title?: string;
    artworkType?: string;
    tags?: Record<string, string | number>;
    note?: string;
  }): void {
    if (details.title !== undefined) state.value.title = details.title;
    if (details.artworkType !== undefined) state.value.tags.artwork_type = details.artworkType;
    if (details.tags !== undefined) state.value.tags = { ...state.value.tags, ...details.tags };
    if (details.note !== undefined) state.value.note = details.note;
  }

  /**
   * Submit the artwork
   */
  async function submitArtwork(): Promise<FastArtworkSubmissionResponse> {
    if (!canSubmit.value) {
      throw new Error('Submission is not ready');
    }

    state.value.isSubmitting = true;
    state.value.submitError = null;

    try {
      const formData = new FormData();

      // Add photos
      state.value.photos.forEach(photo => {
        formData.append('photos', photo.file);
      });

      // Add location
      formData.append('lat', state.value.location!.lat.toString());
      formData.append('lon', state.value.location!.lon.toString());

      // Add consent version
      formData.append('consent_version', state.value.consentVersion);

      // Add artwork-specific data
      if (isNewArtwork.value) {
        formData.append('title', state.value.title);
        if (Object.keys(state.value.tags).length > 0) {
          formData.append('tags', JSON.stringify(state.value.tags));
        }
      } else {
        formData.append('existing_artwork_id', state.value.selectedArtwork!);
      }

      if (state.value.note) {
        formData.append('notes', state.value.note); // Fix: send as 'notes' not 'note'
      }

      const response = await fetch('/api/artworks/fast', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Submission failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        state.value.submissionResult = result.data;
        return result.data;
      } else {
        throw new Error(result.message || 'Submission failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Submission failed';
      state.value.submitError = errorMessage;
      throw error;
    } finally {
      state.value.isSubmitting = false;
    }
  }

  /**
   * Reset the submission state
   */
  function reset(): void {
    // Cleanup object URLs
    state.value.photos.forEach(photo => {
      URL.revokeObjectURL(photo.url);
    });

    state.value = {
      photos: [],
      location: null,
      locationLoading: false,
      locationError: null,
      nearbyArtworks: [],
      similarityWarnings: [],
      similarityLoading: false,
      selectedArtwork: null,
      title: '',
      tags: { artwork_type: 'public_art' },
      note: '',
      consentVersion: CONSENT_VERSION,
      isSubmitting: false,
      submitError: null,
      submissionResult: null,
    };
  }

  return {
    // State
    state: state.value,

    // Computed
    hasPhotos,
    hasLocation,
    hasHighSimilarity,
    isNewArtwork,
    canSubmit,

    // Actions
    addPhotos,
    removePhoto,
    getCurrentLocation,
    setManualLocation,
    checkSimilarity,
    selectArtwork,
    selectNewArtwork,
    updateArtworkDetails,
    submitArtwork,
    reset,
  };
});
