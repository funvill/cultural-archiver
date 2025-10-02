import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { ArtworkDetailResponse } from '../../../shared/types';
import { apiService, getErrorMessage, isNetworkError, isRateLimited } from '../services/api';

/**
 * Logbook submission state management store
 * Handles logbook entry form state, submission, and API interactions
 */
export const useLogbookSubmissionStore = defineStore('logbookSubmission', () => {
  // State
  const artwork = ref<ArtworkDetailResponse | null>(null);
  const isLoadingArtwork = ref(false);
  const artworkError = ref<string | null>(null);

  // Form state
  const selectedPhoto = ref<File | null>(null);
  const photoPreview = ref<string | null>(null);
  const condition = ref<string>('');
  const notes = ref<string>('');

  // Optional artwork improvement fields
  const artworkType = ref<string>('');
  const access = ref<string>('');
  const artist = ref<string>('');
  const material = ref<string>('');

  // Submission state
  const isSubmitting = ref(false);
  const submitError = ref<string | null>(null);
  const lastSubmissionId = ref<string | null>(null);

  // Computed getters
  const hasPhoto = computed(() => !!selectedPhoto.value);
  const isOnCooldown = computed(() => artwork.value?.userLogbookStatus?.onCooldown || false);
  const cooldownUntil = computed(() => {
    if (!artwork.value?.userLogbookStatus?.cooldownUntil) return null;
    return new Date(artwork.value.userLogbookStatus.cooldownUntil);
  });

  const cooldownMessage = computed(() => {
    if (!isOnCooldown.value || !cooldownUntil.value) return '';

    const formatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `Looks like you've been here recently! Come back after ${formatter.format(cooldownUntil.value)} to log another visit.`;
  });

  const canSubmit = computed(() => {
    return (
      !isOnCooldown.value &&
      hasPhoto.value &&
      !isSubmitting.value &&
      !isLoadingArtwork.value &&
      !!artwork.value
    ); // Convert to boolean
  });

  const hasFormData = computed(() => {
    return (
      hasPhoto.value ||
      condition.value.length > 0 ||
      notes.value.length > 0 ||
      artworkType.value.length > 0 ||
      access.value.length > 0 ||
      artist.value.length > 0 ||
      material.value.length > 0
    );
  });

  // Actions
  async function fetchArtworkDetails(artworkId: string): Promise<void> {
    if (!artworkId) {
      artworkError.value = 'Artwork ID is required';
      return;
    }

    try {
      isLoadingArtwork.value = true;
      artworkError.value = null;

      const response = await apiService.getArtworkDetails(artworkId);
      artwork.value = response;
    } catch (err: unknown) {
      artworkError.value = getErrorMessage(err);
      console.error('Failed to fetch artwork details:', err);
    } finally {
      isLoadingArtwork.value = false;
    }
  }

  function setPhoto(file: File): void {
    selectedPhoto.value = file;

    // Create preview
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>): void => {
      photoPreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function removePhoto(): void {
    selectedPhoto.value = null;
    photoPreview.value = null;
  }

  function setCondition(value: string): void {
    condition.value = value;
  }

  function setNotes(value: string): void {
    notes.value = value;
  }

  function setArtworkType(value: string): void {
    artworkType.value = value;
  }

  function setAccess(value: string): void {
    access.value = value;
  }

  function setArtist(value: string): void {
    artist.value = value;
  }

  function setMaterial(value: string): void {
    material.value = value;
  }

  async function submitLogbookEntry(
    artworkId: string
  ): Promise<{ success: boolean; submissionId?: string }> {
    if (!canSubmit.value) {
      throw new Error('Cannot submit: form is not ready or user is on cooldown');
    }

    if (!selectedPhoto.value) {
      throw new Error('Photo is required for logbook submissions');
    }

    try {
      isSubmitting.value = true;
      submitError.value = null;

      // Build form data
      const formData = new FormData();
      formData.append('submissionType', 'logbook');
      formData.append('artworkId', artworkId);

      if (artwork.value) {
        formData.append('lat', artwork.value.lat.toString());
        formData.append('lon', artwork.value.lon.toString());
      }

      // Add photo
      formData.append('photos', selectedPhoto.value);

      // Add condition if specified
      if (condition.value) {
        formData.append('condition', condition.value);
      }

      // Build notes from various inputs
      const allNotes = [];
      if (notes.value.trim()) {
        allNotes.push(notes.value.trim());
      }
      if (allNotes.length > 0) {
        formData.append('notes', allNotes.join('; '));
      }

      // Add optional improvement fields
      if (artworkType.value.trim()) {
        formData.append('artwork_type', artworkType.value.trim());
      }
      if (access.value.trim()) {
        formData.append('access', access.value.trim());
      }
      if (artist.value.trim()) {
        formData.append('artist', artist.value.trim());
      }
      if (material.value.trim()) {
        formData.append('material', material.value.trim());
      }

      // Submit to unified submissions endpoint
      const response = await apiService.postRaw<{
        id: string;
        status: string;
        message: string;
      }>('/submissions', formData);

      lastSubmissionId.value = response.id;

      // Clear form on success (except photo for user confirmation)
      condition.value = '';
      notes.value = '';
      artworkType.value = '';
      access.value = '';
      artist.value = '';
      material.value = '';

      return { success: true, submissionId: response.id };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);

      // Handle different error types according to PRD
      if (isNetworkError(err)) {
        // Network error - preserve form data and show retryable error
        submitError.value = 'Submission Failed. Please check your connection and try again.';
      } else if (isRateLimited(err)) {
        // Rate limit error - provide user-friendly message
        submitError.value = 'Too many submissions. Please wait a moment before trying again.';
        await fetchArtworkDetails(artworkId); // Refresh cooldown status
      } else if (errorMessage.includes('cooldown')) {
        // Cooldown error - this should trigger a re-fetch of artwork details
        submitError.value = errorMessage;
        await fetchArtworkDetails(artworkId); // Refresh cooldown status
      } else {
        // Other errors - clear form according to PRD
        submitError.value = errorMessage;
        clearForm();
      }

      console.error('Logbook submission failed:', err);
      return { success: false };
    } finally {
      isSubmitting.value = false;
    }
  }

  function clearForm(): void {
    selectedPhoto.value = null;
    photoPreview.value = null;
    condition.value = '';
    notes.value = '';
    artworkType.value = '';
    access.value = '';
    artist.value = '';
    material.value = '';
    submitError.value = null;
  }

  function clearErrors(): void {
    artworkError.value = null;
    submitError.value = null;
  }

  // Reset store state
  function reset(): void {
    artwork.value = null;
    isLoadingArtwork.value = false;
    artworkError.value = null;
    isSubmitting.value = false;
    lastSubmissionId.value = null;
    clearForm();
  }

  return {
    // State
    artwork,
    isLoadingArtwork,
    artworkError,
    selectedPhoto,
    photoPreview,
    condition,
    notes,
    artworkType,
    access,
    artist,
    material,
    isSubmitting,
    submitError,
    lastSubmissionId,

    // Computed
    hasPhoto,
    isOnCooldown,
    cooldownUntil,
    cooldownMessage,
    canSubmit,
    hasFormData,

    // Actions
    fetchArtworkDetails,
    setPhoto,
    removePhoto,
    setCondition,
    setNotes,
    setArtworkType,
    setAccess,
    setArtist,
    setMaterial,
    submitLogbookEntry,
    clearForm,
    clearErrors,
    reset,
  };
});
