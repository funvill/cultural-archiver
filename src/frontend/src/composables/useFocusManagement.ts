import { ref, nextTick } from 'vue';
import type { Ref } from 'vue';

export interface FocusableElement {
  focus(): void;
  blur(): void;
  tabIndex?: number;
}
export interface UseFocusManagementReturn {
  previouslyFocused: Ref<HTMLElement | null>;
  saveFocus: () => void;
  restoreFocus: () => void;
  focusFirstElement: (container: HTMLElement | null) => boolean;
  focusLastElement: (container: HTMLElement | null) => boolean;
  getFocusableElements: (container: HTMLElement) => HTMLElement[];
  trapFocus: (container: HTMLElement, event: KeyboardEvent) => boolean;
  focusElement: (element: HTMLElement | null, selectText?: boolean) => boolean;
  createFocusGuard: (container: HTMLElement) => () => void;
  handleKeyboardNavigation: (
    event: KeyboardEvent,
    options?: {
      container?: HTMLElement | null;
      allowEscape?: boolean;
      onEscape?: () => void;
      trapFocus?: boolean;
    }
  ) => boolean;
  disableBodyScroll: () => void;
  enableBodyScroll: () => void;
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
}


export function useFocusManagement(): UseFocusManagementReturn {
  const previouslyFocused = ref<HTMLElement | null>(null);

  /**
   * Save the currently focused element
   */
  function saveFocus(): void {
    previouslyFocused.value = document.activeElement as HTMLElement;
  }

  /**
   * Restore focus to the previously focused element
   */
  function restoreFocus(): void {
    nextTick(() => {
      if (previouslyFocused.value && typeof previouslyFocused.value.focus === 'function') {
        previouslyFocused.value.focus();
      }
      previouslyFocused.value = null;
    });
  }

  /**
   * Focus the first focusable element within a container
   */
  function focusFirstElement(container: HTMLElement | null): boolean {
    if (!container) return false;

    const focusableElements = getFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[0]?.focus();
      return true;
    }
    return false;
  }

  /**
   * Focus the last focusable element within a container
   */
  function focusLastElement(container: HTMLElement | null): boolean {
    if (!container) return false;

    const focusableElements = getFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[focusableElements.length - 1]?.focus();
      return true;
    }
    return false;
  }

  /**
   * Get all focusable elements within a container
   */
  function getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"]):not([disabled])',
      'summary',
    ].join(', ');

    return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
  }

  /**
   * Trap focus within a container (for modal dialogs)
   */
  function trapFocus(container: HTMLElement, event: KeyboardEvent): boolean {
    if (event.key !== 'Tab') return false;

    const focusableElements = getFocusableElements(container);
    if (focusableElements.length === 0) return false;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const currentElement = document.activeElement as HTMLElement;

    if (event.shiftKey) {
      // Shift+Tab: moving backwards
      if (currentElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
        return true;
      }
    } else {
      // Tab: moving forwards
      if (currentElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
        return true;
      }
    }

    return false;
  }

  /**
   * Move focus to a specific element with error handling
   */
  function focusElement(element: HTMLElement | null, selectText = false): boolean {
    if (!element || typeof element.focus !== 'function') return false;

    try {
      element.focus();

      // Select text if it's an input element and selectText is true
      if (selectText && element instanceof HTMLInputElement && element.type === 'text') {
        element.select();
      }

      return true;
    } catch (error) {
      console.warn('Failed to focus element:', error);
      return false;
    }
  }

  /**
   * Create a focus guard for preventing focus from leaving a specific area
   */
  function createFocusGuard(container: HTMLElement): () => void {
    const handleFocusIn = (event: FocusEvent): void => {
      const target = event.target as HTMLElement;
      if (!container.contains(target)) {
        event.preventDefault();
        focusFirstElement(container);
      }
    };

    document.addEventListener('focusin', handleFocusIn);

    // Return cleanup function
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }

  /**
   * Enhanced keyboard navigation handler
   */
  function handleKeyboardNavigation(
    event: KeyboardEvent,
    options: {
      container?: HTMLElement | null;
      allowEscape?: boolean;
      onEscape?: () => void;
      trapFocus?: boolean;
    } = {}
  ): boolean {
    const { container, allowEscape = true, onEscape, trapFocus: shouldTrapFocus = false } = options;

    // Handle Escape key
    if (event.key === 'Escape' && allowEscape && onEscape) {
      event.preventDefault();
      onEscape();
      return true;
    }

    // Handle Tab key for focus trapping
    if (event.key === 'Tab' && shouldTrapFocus && container) {
      return trapFocus(container, event);
    }

    return false;
  }

  /**
   * Manage body scroll (prevent background scrolling when modal is open)
   */
  function disableBodyScroll(): void {
    document.body.style.overflow = 'hidden';
  }

  function enableBodyScroll(): void {
    document.body.style.overflow = '';
  }

  /**
   * Announce content to screen readers
   */
  function announceToScreenReader(
    message: string,
    priority: 'polite' | 'assertive' = 'polite'
  ): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  return {
    previouslyFocused,
    saveFocus,
    restoreFocus,
    focusFirstElement,
    focusLastElement,
    getFocusableElements,
    trapFocus,
    focusElement,
    createFocusGuard,
    handleKeyboardNavigation,
    disableBodyScroll,
    enableBodyScroll,
    announceToScreenReader,
  };
}
