/**
 * Example Analytics Integration
 * 
 * This file demonstrates how to add Google Analytics tracking to Vue components.
 * Copy these patterns to add analytics throughout the application.
 */

// ==========================================
// EXAMPLE 1: Artwork Detail View
// ==========================================

import { defineComponent, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAnalytics } from '@/composables/useAnalytics';
import type { Artwork } from '@shared/types';

export default defineComponent({
  name: 'ArtworkDetailView',
  setup() {
    const route = useRoute();
    const analytics = useAnalytics();
    
    const artwork = ref<Artwork | null>(null);
    
    // Track artwork view when component mounts
    onMounted(() => {
      if (artwork.value) {
        analytics.trackArtworkView({
          artwork_id: artwork.value.id,
          artwork_title: artwork.value.title,
          artist_name: artwork.value.artist,
          artwork_type: artwork.value.type,
        });
      }
    });
    
    // Track photo carousel interaction
    const handlePhotoClick = (index: number): void => {
      analytics.trackArtworkPhotoView({
        artwork_id: artwork.value!.id,
        photo_index: index,
      });
    };
    
    // Track directions button
    const handleGetDirections = (): void => {
      analytics.trackArtworkDirections({
        artwork_id: artwork.value!.id,
        artwork_title: artwork.value!.title,
      });
      
      // Open Google Maps...
      const url = `https://www.google.com/maps/dir/?api=1&destination=${artwork.value!.lat},${artwork.value!.lon}`;
      window.open(url, '_blank');
    };
    
    // Track share button
    const handleShare = (platform: string): void => {
      analytics.trackArtworkShare({
        artwork_id: artwork.value!.id,
        event_label: platform,
      });
      
      // Share logic...
    };
    
    return {
      artwork,
      handlePhotoClick,
      handleGetDirections,
      handleShare,
    };
  },
});

// ==========================================
// EXAMPLE 2: Map View with Marker Clicks
// ==========================================

export const MapViewExample = defineComponent({
  name: 'MapView',
  setup() {
    const analytics = useAnalytics();
    const map = ref(null);
    
    // Track map marker click
    const handleMarkerClick = (artwork: Artwork): void => {
      analytics.trackMapMarkerClick({
        artwork_id: artwork.id,
        zoom_level: map.value?.getZoom(),
        latitude: artwork.lat,
        longitude: artwork.lon,
      });
      
      // Show artwork preview...
    };
    
    // Track map zoom
    const handleZoomEnd = (): void => {
      const center = map.value?.getCenter();
      analytics.trackMapInteraction({
        interaction_type: 'zoom',
        zoom_level: map.value?.getZoom(),
        latitude: center?.lat,
        longitude: center?.lng,
      });
    };
    
    // Track locate me button
    const handleLocateMe = (): void => {
      analytics.trackEvent('locate_me_click', {
        event_category: 'map',
      });
      
      // Get user location...
    };
    
    return {
      handleMarkerClick,
      handleZoomEnd,
      handleLocateMe,
    };
  },
});

// ==========================================
// EXAMPLE 3: Submission Form
// ==========================================

export const SubmissionFormExample = defineComponent({
  name: 'FastPhotoUploadView',
  setup() {
    const analytics = useAnalytics();
    
    // Track when user starts submission
    onMounted(() => {
      analytics.trackSubmissionStart({
        submission_type: 'artwork',
      });
    });
    
    // Track photo upload
    const handlePhotoUpload = (files: File[]): void => {
      analytics.trackEvent('photo_upload', {
        event_category: 'submission',
        photo_count: files.length,
      });
    };
    
    // Track successful submission
    const handleSubmitSuccess = (submissionId: string, photoCount: number): void => {
      analytics.trackSubmissionComplete({
        submission_type: 'artwork',
        has_photos: photoCount > 0,
        photo_count: photoCount,
        value: 1, // Count as 1 successful submission
      });
    };
    
    // Track submission error
    const handleSubmitError = (error: Error): void => {
      analytics.trackSubmissionError({
        submission_type: 'artwork',
        error_message: error.message,
      });
    };
    
    return {
      handlePhotoUpload,
      handleSubmitSuccess,
      handleSubmitError,
    };
  },
});

// ==========================================
// EXAMPLE 4: Search View
// ==========================================

export const SearchViewExample = defineComponent({
  name: 'SearchView',
  setup() {
    const analytics = useAnalytics();
    const searchResults = ref<Artwork[]>([]);
    
    // Track search query
    const handleSearch = async (query: string): Promise<void> => {
      const results = await searchArtworks(query);
      
      analytics.trackSearch({
        search_term: query,
        results_count: results.length,
      });
      
      searchResults.value = results;
    };
    
    // Track search result click
    const handleResultClick = (artwork: Artwork, position: number): void => {
      analytics.trackSearchResultClick({
        search_term: currentQuery.value,
        result_position: position,
        artwork_id: artwork.id,
      });
      
      // Navigate to artwork...
    };
    
    return {
      handleSearch,
      handleResultClick,
    };
  },
});

// ==========================================
// EXAMPLE 5: User Authentication
// ==========================================

export const AuthExample = (): void => {
  const analytics = useAnalytics();
  const authStore = useAuthStore();
  
  // Track login
  const handleLogin = async (email: string): Promise<void> => {
    await authStore.login(email);
    
    analytics.trackLogin({
      user_role: authStore.user?.role,
    });
  };
  
  // Track signup
  const handleSignup = async (email: string): Promise<void> => {
    await authStore.signup(email);
    
    analytics.trackSignup();
  };
  
  // Track logout
  const handleLogout = (): void => {
    analytics.trackLogout();
    authStore.logout();
  };
};

// ==========================================
// EXAMPLE 6: Error Tracking in API Service
// ==========================================

export const apiServiceExample = async (): Promise<void> => {
  const analytics = useAnalytics();
  
  try {
    const response = await fetch('/api/artwork/123');
    
    if (!response.ok) {
      analytics.trackError(
        'api_error',
        `Failed to fetch artwork: ${response.statusText}`,
        {
          status_code: response.status,
          endpoint: '/api/artwork/123',
        }
      );
    }
  } catch (error) {
    analytics.trackError(
      'network_error',
      error instanceof Error ? error.message : 'Unknown error',
      {
        endpoint: '/api/artwork/123',
      }
    );
  }
};

// ==========================================
// EXAMPLE 7: Performance Tracking
// ==========================================

export const performanceExample = (): void => {
  const analytics = useAnalytics();
  
  // Track artwork load time
  const startTime = performance.now();
  
  // Load artwork...
  const artwork = await loadArtwork(id);
  
  const loadTime = performance.now() - startTime;
  analytics.trackPerformance('artwork_load_time', loadTime, {
    artwork_id: id,
  });
};

// ==========================================
// EXAMPLE 8: Navigation Tracking
// ==========================================

export const NavigationExample = defineComponent({
  name: 'NavigationBar',
  setup() {
    const analytics = useAnalytics();
    const router = useRouter();
    
    const handleNavClick = (destination: string): void => {
      analytics.trackNavigationClick(destination);
      router.push(destination);
    };
    
    return {
      handleNavClick,
    };
  },
});

// ==========================================
// EXAMPLE 9: Custom Events
// ==========================================

export const customEventExample = (): void => {
  const analytics = useAnalytics();
  
  // Track any custom event
  analytics.trackEvent('custom_feature_used', {
    event_category: 'feature',
    event_label: 'filter_by_artist',
    value: 1,
    filter_type: 'artist',
    filter_value: 'Emily Carr',
  });
};

// ==========================================
// BEST PRACTICES
// ==========================================

// 1. Always track user intent, not just clicks
// 2. Include context in event parameters
// 3. Use consistent event names
// 4. Don't track PII (personally identifiable information)
// 5. Test in development mode (check console logs)
// 6. Consider performance - don't track every mousemove
// 7. Track both successes and failures
// 8. Use meaningful event categories
