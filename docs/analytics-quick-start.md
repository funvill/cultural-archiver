# Quick Start: Adding Analytics to Components

This guide shows you how to quickly add Google Analytics tracking to existing components in 3 simple steps.

## Step 1: Import the Composable

Add this to your component's `<script setup>`:

```typescript
import { useAnalytics } from '@/composables/useAnalytics';

const analytics = useAnalytics();
```

## Step 2: Track Events

Add tracking calls where users interact with your component:

```typescript
// Example: Track a button click
const handleButtonClick = (): void => {
  // Track the event
  analytics.trackEvent('button_click', {
    event_category: 'navigation',
    event_label: 'submit_form',
  });
  
  // Your existing logic
  submitForm();
};
```

## Step 3: Test

1. In **development**: Check browser console for `[Analytics]` logs
2. In **production**: View events in GA4 Real-Time reports

## Common Patterns

### Track Component Mount

```typescript
import { onMounted } from 'vue';

onMounted(() => {
  analytics.trackEvent('view_page', {
    event_category: 'navigation',
    event_label: route.name,
  });
});
```

### Track Artwork Interactions

```typescript
// View artwork
analytics.trackArtworkView({
  artwork_id: artwork.id,
  artwork_title: artwork.title,
  artist_name: artwork.artist,
});

// Share artwork
analytics.trackArtworkShare({
  artwork_id: artwork.id,
  event_label: 'twitter', // or 'facebook', 'copy_link'
});

// Get directions
analytics.trackArtworkDirections({
  artwork_id: artwork.id,
});
```

### Track Form Submissions

```typescript
// Start
analytics.trackSubmissionStart({
  submission_type: 'artwork',
});

// Success
analytics.trackSubmissionComplete({
  submission_type: 'artwork',
  photo_count: photos.length,
});

// Error
analytics.trackSubmissionError({
  submission_type: 'artwork',
  error_message: error.message,
});
```

### Track Search

```typescript
analytics.trackSearch({
  search_term: query,
  results_count: results.length,
});
```

### Track Map Interactions

```typescript
// Marker click
analytics.trackMapMarkerClick({
  artwork_id: artwork.id,
  zoom_level: map.getZoom(),
});

// Zoom/pan
analytics.trackMapInteraction({
  interaction_type: 'zoom',
  zoom_level: newZoom,
});
```

### Track Errors

```typescript
try {
  await apiCall();
} catch (error) {
  analytics.trackError(
    'api_error',
    error.message,
    { endpoint: '/api/artwork' }
  );
}
```

## Priority Components

Add analytics to these components first for maximum impact:

1. ✅ **Router** - Already done (automatic page tracking)
2. 🔲 **ArtworkDetailView** - View, share, directions
3. 🔲 **MapView** - Marker clicks, zoom, pan
4. 🔲 **FastPhotoUploadView** - Submission flow
5. 🔲 **SearchView** - Search queries and results
6. 🔲 **Navigation components** - Menu clicks

## Need Help?

- Full docs: `docs/analytics.md`
- Code examples: `src/frontend/src/examples/analytics-integration-examples.ts`
- Summary: `docs/analytics-implementation-summary.md`
