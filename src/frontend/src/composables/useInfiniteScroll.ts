/**
 * Infinite scroll composable for loading more content
 * Provides intersection observer-based infinite scrolling
 */

import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import type { Ref } from 'vue';

export interface UseInfiniteScrollOptions {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
  immediate?: boolean;
}

export interface UseInfiniteScrollReturn {
  targetRef: Ref<Element | null>;
  isIntersecting: Ref<boolean>;
  isEnabled: Ref<boolean>;
  trigger: () => void;
  enable: () => void;
  disable: () => void;
  reset: () => void;
}

/**
 * Creates an infinite scroll composable
 * @param loadMore - Function to call when more content should be loaded
 * @param options - Configuration options
 */
export function useInfiniteScroll(
  loadMore: () => void | Promise<void>,
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollReturn {
  const { threshold = 0.1, rootMargin = '100px', enabled = true, immediate = false } = options;

  // State
  const targetRef = ref<Element | null>(null);
  const isIntersecting = ref(false);
  const isEnabled = ref(enabled);
  const observer = ref<IntersectionObserver | null>(null);
  const isLoading = ref(false);

  // Computed
  const shouldLoad = computed(() => isEnabled.value && isIntersecting.value && !isLoading.value);

  // Methods
  async function trigger(): Promise<void> {
    if (!isEnabled.value || isLoading.value) return;

    isLoading.value = true;
    try {
      await loadMore();
    } catch (error) {
      console.error('Error loading more content:', error);
    } finally {
      isLoading.value = false;
    }
  }

  function enable(): void {
    isEnabled.value = true;
  }

  function disable(): void {
    isEnabled.value = false;
  }

  function reset(): void {
    isIntersecting.value = false;
    isLoading.value = false;
  }

  function createObserver(): void {
    if (!window.IntersectionObserver) {
      console.warn('IntersectionObserver not supported');
      return;
    }

    observer.value = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry) {
          isIntersecting.value = entry.isIntersecting;

          if (shouldLoad.value) {
            trigger();
          }
        }
      },
      {
        threshold,
        rootMargin,
      }
    );
  }

  function startObserving(): void {
    if (observer.value && targetRef.value) {
      observer.value.observe(targetRef.value);
    }
  }

  function stopObserving(): void {
    if (observer.value) {
      observer.value.disconnect();
    }
  }

  // Watch for target changes
  function watchTarget(): void {
    // Use a MutationObserver to watch for when targetRef becomes available
    const checkTarget = () => {
      if (targetRef.value && observer.value) {
        startObserving();
        return true;
      }
      return false;
    };

    // Try immediately
    if (checkTarget()) return;

    // If not available, watch for it
    const interval = setInterval(() => {
      if (checkTarget()) {
        clearInterval(interval);
      }
    }, 100);

    // Cleanup after 5 seconds
    setTimeout(() => clearInterval(interval), 5000);
  }

  // Lifecycle
  onMounted(() => {
    createObserver();

    if (immediate) {
      nextTick(() => {
        watchTarget();
      });
    } else {
      watchTarget();
    }
  });

  onUnmounted(() => {
    stopObserving();
  });

  return {
    targetRef,
    isIntersecting: computed(() => isIntersecting.value),
    isEnabled: computed(() => isEnabled.value),
    trigger,
    enable,
    disable,
    reset,
  };
}

/**
 * Simple infinite scroll composable that triggers on scroll position
 * Alternative implementation for when intersection observer is not suitable
 */
export function useScrollBasedInfiniteScroll(
  loadMore: () => void | Promise<void>,
  options: {
    threshold?: number;
    enabled?: boolean;
  } = {}
): {
  isEnabled: Ref<boolean>;
  trigger: () => void;
  enable: () => void;
  disable: () => void;
} {
  const { threshold = 100, enabled = true } = options;

  const isEnabled = ref(enabled);
  const isLoading = ref(false);

  async function trigger(): Promise<void> {
    if (!isEnabled.value || isLoading.value) return;

    isLoading.value = true;
    try {
      await loadMore();
    } catch (error) {
      console.error('Error loading more content:', error);
    } finally {
      isLoading.value = false;
    }
  }

  function handleScroll(): void {
    if (!isEnabled.value || isLoading.value) return;

    const scrollHeight = document.documentElement.scrollHeight;
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const clientHeight = document.documentElement.clientHeight;

    if (scrollTop + clientHeight >= scrollHeight - threshold) {
      trigger();
    }
  }

  function enable(): void {
    isEnabled.value = true;
  }

  function disable(): void {
    isEnabled.value = false;
  }

  // Lifecycle
  onMounted(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
  });

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll);
  });

  return {
    isEnabled: computed(() => isEnabled.value),
    trigger,
    enable,
    disable,
  };
}

export default useInfiniteScroll;
