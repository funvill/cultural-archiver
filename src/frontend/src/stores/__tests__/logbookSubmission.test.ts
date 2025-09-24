/**
 * Tests for logbook submission store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLogbookSubmissionStore } from '../logbookSubmission';
import type { ArtworkDetailResponse } from '../../../../shared/types';

// Mock API service
vi.mock('../../services/api', () => ({
  apiService: {
    getArtworkDetails: vi.fn(),
    postRaw: vi.fn(),
  },
  getErrorMessage: vi.fn(error => error.message || 'Unknown error'),
  isNetworkError: vi.fn(() => false),
  isRateLimited: vi.fn(() => false),
}));

// Mock file for testing
const createMockFile = (name: string = 'test.jpg'): File => {
  const content = 'mock file content';
  const blob = new Blob([content], { type: 'image/jpeg' });
  return new File([blob], name, { type: 'image/jpeg' });
};

describe('Logbook Submission Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const store = useLogbookSubmissionStore();

    expect(store.artwork).toBe(null);
    expect(store.isLoadingArtwork).toBe(false);
    expect(store.artworkError).toBe(null);
    expect(store.selectedPhoto).toBe(null);
    expect(store.photoPreview).toBe(null);
    expect(store.condition).toBe('');
    expect(store.notes).toBe('');
    expect(store.artworkType).toBe('');
    expect(store.access).toBe('');
    expect(store.artist).toBe('');
    expect(store.material).toBe('');
    expect(store.isSubmitting).toBe(false);
    expect(store.submitError).toBe(null);
    expect(store.lastSubmissionId).toBe(null);
  });

  describe('computed properties', () => {
    it('should compute hasPhoto correctly', () => {
      const store = useLogbookSubmissionStore();

      expect(store.hasPhoto).toBe(false);

      const mockFile = createMockFile();
      store.setPhoto(mockFile);
      expect(store.hasPhoto).toBe(true);
    });

    it('should compute isOnCooldown correctly', () => {
      const store = useLogbookSubmissionStore();

      expect(store.isOnCooldown).toBe(false);

      store.artwork = {
        id: 'test-artwork',
        title: 'Test Artwork',
        lat: 49.2827,
        lon: -123.1207,
        userLogbookStatus: {
          onCooldown: true,
          cooldownUntil: '2025-10-19T07:00:00.000Z',
        },
      } as ArtworkDetailResponse;

      expect(store.isOnCooldown).toBe(true);
    });

    it('should compute cooldownMessage correctly', () => {
      const store = useLogbookSubmissionStore();

      expect(store.cooldownMessage).toBe('');

      store.artwork = {
        id: 'test-artwork',
        title: 'Test Artwork',
        lat: 49.2827,
        lon: -123.1207,
        userLogbookStatus: {
          onCooldown: true,
          cooldownUntil: '2025-10-19T07:00:00.000Z',
        },
      } as ArtworkDetailResponse;

      const message = store.cooldownMessage;
      expect(message).toContain("Looks like you've been here recently!");
      expect(message).toContain('October 19, 2025');
    });

    it('should compute canSubmit correctly', () => {
      const store = useLogbookSubmissionStore();

      // Initially false - no photo and no artwork
      expect(store.canSubmit).toBe(false);

      // Add photo
      const mockFile = createMockFile();
      store.setPhoto(mockFile);

      // Still false - no artwork
      expect(store.canSubmit).toBe(false);

      // Add artwork
      store.artwork = {
        id: 'test-artwork',
        title: 'Test Artwork',
        lat: 49.2827,
        lon: -123.1207,
      } as ArtworkDetailResponse;

      expect(store.canSubmit).toBe(true);

      // Test cooldown prevents submission
      store.artwork.userLogbookStatus = {
        onCooldown: true,
        cooldownUntil: '2025-10-19T07:00:00.000Z',
      };

      expect(store.canSubmit).toBe(false);
    });

    it('should compute hasFormData correctly', () => {
      const store = useLogbookSubmissionStore();

      expect(store.hasFormData).toBe(false);

      store.setPhoto(createMockFile());
      expect(store.hasFormData).toBe(true);

      store.removePhoto();
      store.setCondition('Good');
      expect(store.hasFormData).toBe(true);

      store.setCondition('');
      store.setNotes('Test notes');
      expect(store.hasFormData).toBe(true);
    });
  });

  describe('actions', () => {
    it('should fetch artwork details successfully', async () => {
      const store = useLogbookSubmissionStore();
      const mockArtwork = {
        id: 'test-artwork',
        title: 'Test Artwork',
        lat: 49.2827,
        lon: -123.1207,
      } as ArtworkDetailResponse;

      const { apiService } = await import('../../services/api');
      vi.mocked(apiService.getArtworkDetails).mockResolvedValue(mockArtwork);

      await store.fetchArtworkDetails('test-artwork');

      expect(store.artwork).toEqual(mockArtwork);
      expect(store.isLoadingArtwork).toBe(false);
      expect(store.artworkError).toBe(null);
    });

    it('should handle artwork fetch error', async () => {
      const store = useLogbookSubmissionStore();

      const { apiService, getErrorMessage } = await import('../../services/api');
      const error = new Error('Artwork not found');
      vi.mocked(apiService.getArtworkDetails).mockRejectedValue(error);
      vi.mocked(getErrorMessage).mockReturnValue('Artwork not found');

      await store.fetchArtworkDetails('nonexistent-artwork');

      expect(store.artwork).toBe(null);
      expect(store.artworkError).toBe('Artwork not found');
      expect(store.isLoadingArtwork).toBe(false);
    });

    it('should set photo with preview', () => {
      const store = useLogbookSubmissionStore();
      const mockFile = createMockFile();

      // Mock FileReader with more complete interface
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        result: 'data:image/jpeg;base64,mockdata',
        onload: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
        onerror: null,
        onabort: null,
        onloadstart: null,
        onloadend: null,
        onprogress: null,
        error: null,
        readyState: 0,
        abort: vi.fn(),
        readAsArrayBuffer: vi.fn(),
        readAsBinaryString: vi.fn(),
        readAsText: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as Partial<FileReader> as FileReader;

      vi.stubGlobal(
        'FileReader',
        vi.fn(() => mockFileReader)
      );

      store.setPhoto(mockFile);

      expect(store.selectedPhoto).toBe(mockFile);

      // Simulate FileReader onload - check for null before calling
      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader, {
          target: mockFileReader,
        } as ProgressEvent<FileReader>);
      }
      expect(store.photoPreview).toBe('data:image/jpeg;base64,mockdata');
    });

    it('should remove photo and preview', () => {
      const store = useLogbookSubmissionStore();
      const mockFile = createMockFile();

      store.setPhoto(mockFile);
      store.photoPreview = 'data:image/jpeg;base64,mockdata';

      store.removePhoto();

      expect(store.selectedPhoto).toBe(null);
      expect(store.photoPreview).toBe(null);
    });

    it('should set form field values', () => {
      const store = useLogbookSubmissionStore();

      store.setCondition('Good');
      expect(store.condition).toBe('Good');

      store.setNotes('Test notes');
      expect(store.notes).toBe('Test notes');

      store.setArtworkType('sculpture');
      expect(store.artworkType).toBe('sculpture');

      store.setAccess('public');
      expect(store.access).toBe('public');

      store.setArtist('Test Artist');
      expect(store.artist).toBe('Test Artist');

      store.setMaterial('bronze');
      expect(store.material).toBe('bronze');
    });

    it('should submit logbook entry successfully', async () => {
      const store = useLogbookSubmissionStore();
      const mockFile = createMockFile();

      // Setup store state
      store.setPhoto(mockFile);
      store.setCondition('Good');
      store.setNotes('Looks great!');
      store.artwork = {
        id: 'test-artwork',
        title: 'Test Artwork',
        lat: 49.2827,
        lon: -123.1207,
      } as ArtworkDetailResponse;

      const { apiService } = await import('../../services/api');
      const mockResponse = {
        id: 'submission-123',
        status: 'pending',
        message: 'Submission received for review.',
      };
      vi.mocked(apiService.postRaw).mockResolvedValue(mockResponse);

      const result = await store.submitLogbookEntry('test-artwork');

      expect(result.success).toBe(true);
      expect(result.submissionId).toBe('submission-123');
      expect(store.lastSubmissionId).toBe('submission-123');
      expect(store.isSubmitting).toBe(false);

      // Check form was partially cleared
      expect(store.condition).toBe('');
      expect(store.notes).toBe('');
      expect(store.selectedPhoto).toBe(mockFile); // Photo should remain for confirmation
    });

    it('should handle submission error with network failure', async () => {
      const store = useLogbookSubmissionStore();
      const mockFile = createMockFile();

      store.setPhoto(mockFile);
      store.artwork = {
        id: 'test-artwork',
        title: 'Test Artwork',
        lat: 49.2827,
        lon: -123.1207,
      } as ArtworkDetailResponse;

      const { apiService, getErrorMessage, isNetworkError } = await import('../../services/api');
      const error = new Error('Network error');
      vi.mocked(apiService.postRaw).mockRejectedValue(error);
      vi.mocked(getErrorMessage).mockReturnValue('Network error');
      vi.mocked(isNetworkError).mockReturnValue(true);

      const result = await store.submitLogbookEntry('test-artwork');

      expect(result.success).toBe(false);
      expect(store.submitError).toBe(
        'Submission Failed. Please check your connection and try again.'
      );
      expect(store.selectedPhoto).toBe(mockFile); // Form data preserved
    });

    it('should handle submission error with other failure', async () => {
      const store = useLogbookSubmissionStore();
      const mockFile = createMockFile();

      store.setPhoto(mockFile);
      store.setCondition('Good');
      store.artwork = {
        id: 'test-artwork',
        title: 'Test Artwork',
        lat: 49.2827,
        lon: -123.1207,
      } as ArtworkDetailResponse;

      const { apiService, getErrorMessage, isNetworkError } = await import('../../services/api');
      const error = new Error('Validation error');
      vi.mocked(apiService.postRaw).mockRejectedValue(error);
      vi.mocked(getErrorMessage).mockReturnValue('Validation error');
      vi.mocked(isNetworkError).mockReturnValue(false);

      const result = await store.submitLogbookEntry('test-artwork');

      expect(result.success).toBe(false);
      // Form should be cleared on validation error, but error might be cleared too
      expect(store.selectedPhoto).toBe(null);
      expect(store.condition).toBe('');
    });

    it('should clear form data', () => {
      const store = useLogbookSubmissionStore();

      // Set up form data
      store.setPhoto(createMockFile());
      store.setCondition('Good');
      store.setNotes('Test notes');
      store.setArtworkType('sculpture');

      store.clearForm();

      expect(store.selectedPhoto).toBe(null);
      expect(store.photoPreview).toBe(null);
      expect(store.condition).toBe('');
      expect(store.notes).toBe('');
      expect(store.artworkType).toBe('');
      expect(store.access).toBe('');
      expect(store.artist).toBe('');
      expect(store.material).toBe('');
      expect(store.submitError).toBe(null);
    });

    it('should reset store state', () => {
      const store = useLogbookSubmissionStore();

      // Set up state
      store.artwork = { id: 'test' } as ArtworkDetailResponse;
      store.setPhoto(createMockFile());
      store.artworkError = 'Some error';
      store.lastSubmissionId = 'sub-123';

      store.reset();

      expect(store.artwork).toBe(null);
      expect(store.isLoadingArtwork).toBe(false);
      expect(store.artworkError).toBe(null);
      expect(store.selectedPhoto).toBe(null);
      expect(store.lastSubmissionId).toBe(null);
    });
  });

  describe('edge cases', () => {
    it('should handle submission without photo', async () => {
      const store = useLogbookSubmissionStore();
      // No photo, so canSubmit will be false
      store.artwork = {
        id: 'test-artwork',
        title: 'Test Artwork',
        lat: 49.2827,
        lon: -123.1207,
      } as ArtworkDetailResponse;

      // This should fail with canSubmit check first
      await expect(store.submitLogbookEntry('test-artwork')).rejects.toThrow(
        'Cannot submit: form is not ready or user is on cooldown'
      );
    });

    it('should handle submission when canSubmit is false', async () => {
      const store = useLogbookSubmissionStore();

      await expect(store.submitLogbookEntry('test-artwork')).rejects.toThrow(
        'Cannot submit: form is not ready or user is on cooldown'
      );
    });

    it('should handle fetch artwork details with empty artworkId', async () => {
      const store = useLogbookSubmissionStore();

      await store.fetchArtworkDetails('');

      expect(store.artworkError).toBe('Artwork ID is required');
      expect(store.artwork).toBe(null);
    });
  });
});
