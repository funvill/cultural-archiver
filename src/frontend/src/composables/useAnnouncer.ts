import { ref, type Ref } from 'vue'

// Global announcement state
const announcement = ref('')
const announcementLevel = ref<'polite' | 'assertive'>('polite')

/**
 * Composable for making screen reader announcements
 * Provides a global live region for accessibility announcements
 */
export function useAnnouncer(): {
  announcement: Ref<string>
  announcementLevel: Ref<'polite' | 'assertive'>
  announce: (message: string, level?: 'polite' | 'assertive') => void
  clearAnnouncement: () => void
  announceSuccess: (message: string) => void
  announceError: (message: string) => void
  announceWarning: (message: string) => void
  announceInfo: (message: string) => void
  announceFormErrors: (errors: string[] | string) => void
  announceFieldError: (fieldName: string, error: string) => void
  announceFormSubmission: (status: 'submitting' | 'success' | 'error', message?: string) => void
  announceNavigation: (pageName: string) => void
  announceLoading: (isLoading: boolean, context?: string) => void
  announceUpdate: (message: string) => void
} {
  /**
   * Announce a message to screen readers
   * @param message - The message to announce
   * @param level - The politeness level ('polite' or 'assertive')
   */
  function announce(message: string, level: 'polite' | 'assertive' = 'polite'): void {
    // Clear any existing announcement first
    announcement.value = ''
    announcementLevel.value = level
    
    // Set the new announcement after a brief delay to ensure it's read
    setTimeout(() => {
      announcement.value = message
    }, 100)
  }

  /**
   * Clear the current announcement
   */
  function clearAnnouncement(): void {
    announcement.value = ''
  }

  /**
   * Announce a success message
   */
  function announceSuccess(message: string): void {
    announce(`Success: ${message}`, 'polite')
  }

  /**
   * Announce an error message
   */
  function announceError(message: string): void {
    announce(`Error: ${message}`, 'assertive')
  }

  /**
   * Announce a warning message
   */
  function announceWarning(message: string): void {
    announce(`Warning: ${message}`, 'assertive')
  }

  /**
   * Announce an info message
   */
  function announceInfo(message: string): void {
    announce(`Information: ${message}`, 'polite')
  }

  /**
   * Announce form validation errors
   */
  function announceFormErrors(errors: string[] | string): void {
    const errorList = Array.isArray(errors) ? errors : [errors]
    const errorCount = errorList.length
    
    if (errorCount === 0) return
    
    let message = ''
    if (errorCount === 1) {
      message = `Form error: ${errorList[0]}`
    } else {
      message = `Form has ${errorCount} errors: ${errorList.join(', ')}`
    }
    
    announce(message, 'assertive')
  }

  /**
   * Announce field-specific error
   */
  function announceFieldError(fieldName: string, error: string): void {
    announce(`${fieldName} error: ${error}`, 'assertive')
  }

  /**
   * Announce form submission status
   */
  function announceFormSubmission(status: 'submitting' | 'success' | 'error', message?: string): void {
    switch (status) {
      case 'submitting':
        announce('Form is being submitted...', 'polite')
        break
      case 'success':
        announceSuccess(message || 'Form submitted successfully')
        break
      case 'error':
        announceError(message || 'Form submission failed')
        break
    }
  }

  /**
   * Announce navigation change
   */
  function announceNavigation(pageName: string): void {
    announce(`Navigated to ${pageName}`, 'polite')
  }

  /**
   * Announce loading state changes
   */
  function announceLoading(isLoading: boolean, context = ''): void {
    if (isLoading) {
      announce(`Loading ${context}...`.trim(), 'polite')
    } else {
      announce(`Finished loading ${context}`.trim(), 'polite')
    }
  }

  /**
   * Announce content updates
   */
  function announceUpdate(message: string): void {
    announce(`Updated: ${message}`, 'polite')
  }

  return {
    announcement,
    announcementLevel,
    announce,
    clearAnnouncement,
    announceSuccess,
    announceError,
    announceWarning,
    announceInfo,
    announceFormErrors,
    announceFieldError,
    announceFormSubmission,
    announceNavigation,
    announceLoading,
    announceUpdate
  }
}