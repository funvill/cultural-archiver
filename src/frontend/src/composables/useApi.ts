/**
 * API interaction composable for common patterns
 */

import { ref } from 'vue';
import { getErrorMessage, isNetworkError, ApiError } from '../services/api';

export function useApi() {
  // eslint-disable-line @typescript-eslint/explicit-function-return-type
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Execute API call with loading and error handling
   */
  const execute = async <T>(
    apiCall: () => Promise<T>,
    options: {
      retries?: number;
      showError?: boolean;
      onRetry?: (attempt: number) => void;
    } = {}
  ): Promise<T | null> => {
    const { retries = 2, showError = true, onRetry } = options;

    isLoading.value = true;
    error.value = null;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await apiCall();
        isLoading.value = false;
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error');

        // If network error and we have retries left, try again
        if (isNetworkError(err) && attempt < retries) {
          if (onRetry) {
            onRetry(attempt + 1);
          }

          // Exponential backoff delay
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // No more retries or non-retryable error
        break;
      }
    }

    isLoading.value = false;

    if (showError) {
      error.value = getErrorMessage(lastError);
    }

    return null;
  };

  /**
   * Execute multiple API calls in parallel with error handling
   */
  const executeParallel = async <T>(
    apiCalls: (() => Promise<T>)[],
    options: {
      failFast?: boolean;
      showErrors?: boolean;
    } = {}
  ): Promise<(T | null)[]> => {
    const { failFast = false, showErrors = true } = options;

    isLoading.value = true;
    error.value = null;

    try {
      let results: (T | null)[];

      if (failFast) {
        // Fail if any request fails
        results = await Promise.all(apiCalls.map(call => call()));
      } else {
        // Continue even if some requests fail
        const settledResults = await Promise.allSettled(apiCalls.map(call => call()));
        results = settledResults.map(result =>
          result.status === 'fulfilled' ? result.value : null
        );

        // Collect any errors
        const errors = settledResults
          .filter(result => result.status === 'rejected')
          .map(result => (result as PromiseRejectedResult).reason);

        if (errors.length > 0 && showErrors) {
          error.value = `${errors.length} requests failed`;
        }
      }

      isLoading.value = false;
      return results;
    } catch (err) {
      isLoading.value = false;

      if (showErrors) {
        error.value = getErrorMessage(err);
      }

      throw err;
    }
  };

  /**
   * Paginated API call helper
   */
  const executePaginated = async <T>( // eslint-disable-line @typescript-eslint/explicit-function-return-type
    apiCall: (
      page: number,
      limit: number
    ) => Promise<{ items: T[]; total: number; hasMore: boolean }>,
    options: {
      initialPage?: number;
      pageSize?: number;
      maxPages?: number;
    } = {}
  ): Promise<any> => {
    // eslint-disable-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-explicit-any
    const { initialPage = 1, pageSize = 20, maxPages = 10 } = options;

    const allItems = ref<T[]>([]);
    const currentPage = ref(initialPage);
    const hasMore = ref(true);
    const total = ref(0);

    const loadMore = async (): Promise<boolean> => {
      if (!hasMore.value || currentPage.value > maxPages) {
        return false;
      }

      const result = await execute(() => apiCall(currentPage.value, pageSize), { showError: true });

      if (result) {
        allItems.value = [...(allItems.value as T[]), ...result.items];
        total.value = result.total;
        hasMore.value = result.hasMore;
        currentPage.value++;
        return true;
      }

      return false;
    };

    const reset = (): void => {
      allItems.value = [];
      currentPage.value = initialPage;
      hasMore.value = true;
      total.value = 0;
    };

    return {
      items: allItems,
      total,
      hasMore,
      currentPage,
      isLoading,
      error,
      loadMore,
      reset,
    };
  };

  /**
   * File upload with progress tracking
   */
  const uploadFile = async <T>(
    file: File,
    uploadFunction: (file: File, onProgress?: (progress: number) => void) => Promise<T>,
    options: {
      onProgress?: (progress: number) => void;
      maxSize?: number; // in bytes
      allowedTypes?: string[];
    } = {}
  ): Promise<T | null> => {
    const { onProgress, maxSize, allowedTypes } = options;
    const uploadProgress = ref(0);
    const uploadError = ref<string | null>(null);

    // Validate file size
    if (maxSize && file.size > maxSize) {
      uploadError.value = `File size exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`;
      return null;
    }

    // Validate file type
    if (allowedTypes && !allowedTypes.includes(file.type)) {
      uploadError.value = `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`;
      return null;
    }

    isLoading.value = true;
    uploadError.value = null;
    uploadProgress.value = 0;

    try {
      const result = await uploadFunction(file, progress => {
        uploadProgress.value = progress;
        if (onProgress) {
          onProgress(progress);
        }
      });

      isLoading.value = false;
      uploadProgress.value = 100;
      return result;
    } catch (err) {
      isLoading.value = false;
      uploadError.value = getErrorMessage(err);
      return null;
    }
  };

  /**
   * Clear error state
   */
  const clearError = (): void => {
    error.value = null;
  };

  /**
   * Check if error is retryable
   */
  const isRetryableError = (err: unknown): boolean => {
    return isNetworkError(err) || (err instanceof ApiError && err.status >= 500);
  };

  return {
    // State
    isLoading,
    error,

    // Methods
    execute,
    executeParallel,
    executePaginated,
    uploadFile,
    clearError,
    isRetryableError,
  };
}
