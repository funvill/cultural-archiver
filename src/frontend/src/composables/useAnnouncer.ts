import { ref } from 'vue'

// Global announcement state
const announcement = ref('')
const announcementLevel = ref<'polite' | 'assertive'>('polite')

/**
 * Composable for making screen reader announcements
 * Provides a global live region for accessibility announcements
 */
export function useAnnouncer() {
  /**
   * Announce a message to screen readers
   * @param message - The message to announce
   * @param level - The politeness level ('polite' or 'assertive')
   */
  function announce(message: string, level: 'polite' | 'assertive' = 'polite') {
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
  function clearAnnouncement() {
    announcement.value = ''
  }

  /**
   * Announce a success message
   */
  function announceSuccess(message: string) {
    announce(`Success: ${message}`, 'polite')
  }

  /**
   * Announce an error message
   */
  function announceError(message: string) {
    announce(`Error: ${message}`, 'assertive')
  }

  /**
   * Announce a warning message
   */
  function announceWarning(message: string) {
    announce(`Warning: ${message}`, 'assertive')
  }

  /**
   * Announce an info message
   */
  function announceInfo(message: string) {
    announce(`Information: ${message}`, 'polite')
  }

  return {
    announcement,
    announcementLevel,
    announce,
    clearAnnouncement,
    announceSuccess,
    announceError,
    announceWarning,
    announceInfo
  }
}