/**
 * Google Analytics composable for event tracking
 * 
 * This provides a typed interface for tracking events throughout the app.
 * Events are only sent in production environments when GA is configured.
 */

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js',
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}

// Event categories
export const EventCategory = {
  ARTWORK: 'artwork',
  USER: 'user',
  NAVIGATION: 'navigation',
  SUBMISSION: 'submission',
  SEARCH: 'search',
  MAP: 'map',
  SOCIAL: 'social',
  ERROR: 'error',
  PERFORMANCE: 'performance',
} as const;

export type EventCategoryType = typeof EventCategory[keyof typeof EventCategory];

// Common event parameters
export interface EventParams {
  event_category?: EventCategoryType;
  event_label?: string;
  value?: number;
  [key: string]: unknown;
}

// Specific event types for better type safety
export interface ArtworkEventParams extends EventParams {
  artwork_id?: string;
  artwork_title?: string;
  artist_name?: string;
  artwork_type?: string;
}

export interface UserEventParams extends EventParams {
  user_id?: string;
  user_role?: string;
}

export interface SearchEventParams extends EventParams {
  search_term?: string;
  results_count?: number;
}

export interface MapEventParams extends EventParams {
  zoom_level?: number;
  latitude?: number;
  longitude?: number;
}

export interface SubmissionEventParams extends EventParams {
  submission_type?: 'artwork' | 'edit' | 'feedback';
  has_photos?: boolean;
  photo_count?: number;
}

/**
 * Check if Google Analytics is enabled and available
 */
function isAnalyticsEnabled(): boolean {
  // Only track in production
  if (import.meta.env.MODE !== 'production') {
    return false;
  }

  // Check if gtag is available
  if (typeof window === 'undefined' || !window.gtag) {
    return false;
  }

  return true;
}

/**
 * Main analytics composable
 */
export function useAnalytics(): {
  trackEvent: (eventName: string, params?: EventParams) => void;
  trackPageView: (pagePath: string, pageTitle?: string) => void;
  trackArtworkView: (params: ArtworkEventParams) => void;
  trackArtworkShare: (params: ArtworkEventParams) => void;
  trackArtworkDirections: (params: ArtworkEventParams) => void;
  trackArtworkPhotoView: (params: ArtworkEventParams & { photo_index: number }) => void;
  trackSubmissionStart: (params: SubmissionEventParams) => void;
  trackSubmissionComplete: (params: SubmissionEventParams) => void;
  trackSubmissionError: (params: SubmissionEventParams & { error_message?: string }) => void;
  trackSearch: (params: SearchEventParams) => void;
  trackSearchResultClick: (params: SearchEventParams & { result_position?: number }) => void;
  trackMapInteraction: (params: MapEventParams & { interaction_type: string }) => void;
  trackMapMarkerClick: (params: MapEventParams & ArtworkEventParams) => void;
  trackLogin: (params?: UserEventParams) => void;
  trackSignup: (params?: UserEventParams) => void;
  trackLogout: () => void;
  trackNavigationClick: (destination: string) => void;
  trackError: (errorType: string, errorMessage?: string, errorDetails?: Record<string, unknown>) => void;
  trackPerformance: (metricName: string, value: number, params?: EventParams) => void;
  isEnabled: () => boolean;
} {
  /**
   * Track a custom event
   */
  const trackEvent = (eventName: string, params?: EventParams): void => {
    if (!isAnalyticsEnabled()) {
      // In development, log to console for debugging
      if (import.meta.env.MODE === 'development') {
        console.log('[Analytics]', eventName, params);
      }
      return;
    }

    try {
      window.gtag?.('event', eventName, params);
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  };

  /**
   * Track page view
   */
  const trackPageView = (pagePath: string, pageTitle?: string): void => {
    if (!isAnalyticsEnabled()) {
      return;
    }

    try {
      window.gtag?.('event', 'page_view', {
        page_path: pagePath,
        page_title: pageTitle,
      });
    } catch (error) {
      console.error('Failed to track page view:', error);
    }
  };

  // Artwork Events
  const trackArtworkView = (params: ArtworkEventParams): void => {
    trackEvent('view_artwork', {
      event_category: EventCategory.ARTWORK,
      ...params,
    });
  };

  const trackArtworkShare = (params: ArtworkEventParams): void => {
    trackEvent('share_artwork', {
      event_category: EventCategory.SOCIAL,
      ...params,
    });
  };

  const trackArtworkDirections = (params: ArtworkEventParams): void => {
    trackEvent('get_directions', {
      event_category: EventCategory.ARTWORK,
      ...params,
    });
  };

  const trackArtworkPhotoView = (params: ArtworkEventParams & { photo_index: number }): void => {
    trackEvent('view_artwork_photo', {
      event_category: EventCategory.ARTWORK,
      ...params,
    });
  };

  // Submission Events
  const trackSubmissionStart = (params: SubmissionEventParams): void => {
    trackEvent('submission_start', {
      event_category: EventCategory.SUBMISSION,
      ...params,
    });
  };

  const trackSubmissionComplete = (params: SubmissionEventParams): void => {
    trackEvent('submission_complete', {
      event_category: EventCategory.SUBMISSION,
      ...params,
    });
  };

  const trackSubmissionError = (params: SubmissionEventParams & { error_message?: string }): void => {
    trackEvent('submission_error', {
      event_category: EventCategory.ERROR,
      ...params,
    });
  };

  // Search Events
  const trackSearch = (params: SearchEventParams): void => {
    trackEvent('search', {
      event_category: EventCategory.SEARCH,
      ...params,
    });
  };

  const trackSearchResultClick = (params: SearchEventParams & { result_position?: number }): void => {
    trackEvent('search_result_click', {
      event_category: EventCategory.SEARCH,
      ...params,
    });
  };

  // Map Events
  const trackMapInteraction = (params: MapEventParams & { interaction_type: string }): void => {
    trackEvent('map_interaction', {
      event_category: EventCategory.MAP,
      ...params,
    });
  };

  const trackMapMarkerClick = (params: MapEventParams & ArtworkEventParams): void => {
    trackEvent('map_marker_click', {
      event_category: EventCategory.MAP,
      ...params,
    });
  };

  // User Events
  const trackLogin = (params?: UserEventParams): void => {
    trackEvent('login', {
      event_category: EventCategory.USER,
      ...params,
    });
  };

  const trackSignup = (params?: UserEventParams): void => {
    trackEvent('sign_up', {
      event_category: EventCategory.USER,
      ...params,
    });
  };

  const trackLogout = (): void => {
    trackEvent('logout', {
      event_category: EventCategory.USER,
    });
  };

  // Navigation Events
  const trackNavigationClick = (destination: string): void => {
    trackEvent('navigation_click', {
      event_category: EventCategory.NAVIGATION,
      event_label: destination,
    });
  };

  // Error Events
  const trackError = (errorType: string, errorMessage?: string, errorDetails?: Record<string, unknown>): void => {
    trackEvent('error', {
      event_category: EventCategory.ERROR,
      event_label: errorType,
      error_message: errorMessage,
      ...errorDetails,
    });
  };

  // Performance Events
  const trackPerformance = (metricName: string, value: number, params?: EventParams): void => {
    trackEvent('performance_metric', {
      event_category: EventCategory.PERFORMANCE,
      event_label: metricName,
      value: Math.round(value),
      ...params,
    });
  };

  return {
    // Core functions
    trackEvent,
    trackPageView,
    
    // Artwork events
    trackArtworkView,
    trackArtworkShare,
    trackArtworkDirections,
    trackArtworkPhotoView,
    
    // Submission events
    trackSubmissionStart,
    trackSubmissionComplete,
    trackSubmissionError,
    
    // Search events
    trackSearch,
    trackSearchResultClick,
    
    // Map events
    trackMapInteraction,
    trackMapMarkerClick,
    
    // User events
    trackLogin,
    trackSignup,
    trackLogout,
    
    // Navigation events
    trackNavigationClick,
    
    // Error events
    trackError,
    
    // Performance events
    trackPerformance,
    
    // Utilities
    isEnabled: isAnalyticsEnabled,
  };
}
