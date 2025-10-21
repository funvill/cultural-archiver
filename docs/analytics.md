# Google Analytics Integration

## Overview

The Public Art Registry uses Google Analytics 4 (GA4) to track user interactions and gather insights about how the platform is used. This document explains how analytics is configured and how to add tracking to new features.

## Setup

### 1. Get Google Analytics Tracking ID

1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new property or use an existing one
3. Get your Measurement ID (format: `G-XXXXXXXXXX`)

### 2. Configure Environment Variables

Add the tracking ID to your environment configuration:

**For local development** (`.env.local`):
```bash
VITE_GA_TRACKING_ID=G-XXXXXXXXXX
```

**For production deployment**:
Set the `VITE_GA_TRACKING_ID` environment variable in your Cloudflare Workers environment:

```bash
# Using wrangler
wrangler secret put VITE_GA_TRACKING_ID --env production
```

Or add it to your `wrangler.toml`:
```toml
[env.production.build.upload]
vars = { VITE_GA_TRACKING_ID = "G-XXXXXXXXXX" }
```

### 3. Build and Deploy

The tracking ID is injected at build time into the HTML. Google Analytics will only be active in production environments (not on localhost).

## Architecture

### Core Components

1. **`useAnalytics` Composable** (`src/composables/useAnalytics.ts`)
   - Provides typed methods for tracking events
   - Automatically disabled in development
   - Type-safe event parameters

2. **HTML Integration** (`index.html`)
   - Loads gtag.js script in production only
   - Initializes Google Analytics with proper configuration
   - Manual page view tracking (handled by Vue Router)

3. **Router Integration** (`src/router/index.ts`)
   - Automatic page view tracking on route changes
   - Updates document title from route meta

4. **Build Configuration** (`vite.config.ts`)
   - Custom HTML transform plugin
   - Injects GA tracking ID at build time

## Event Categories

The following event categories are defined:

- **`artwork`** - Artwork-related interactions
- **`user`** - User authentication and profile actions
- **`navigation`** - Navigation within the app
- **`submission`** - Content submission events
- **`search`** - Search and discovery
- **`map`** - Map interactions
- **`social`** - Social sharing actions
- **`error`** - Error tracking
- **`performance`** - Performance metrics

## Usage Examples

### Basic Event Tracking

```typescript
import { useAnalytics } from '@/composables/useAnalytics';

const analytics = useAnalytics();

// Track a custom event
analytics.trackEvent('button_click', {
  event_category: 'navigation',
  event_label: 'submit_artwork',
});
```

### Artwork Events

```typescript
// Track artwork view
analytics.trackArtworkView({
  artwork_id: artwork.id,
  artwork_title: artwork.title,
  artist_name: artwork.artist,
});

// Track social sharing
analytics.trackArtworkShare({
  artwork_id: artwork.id,
  event_label: 'facebook', // or 'twitter', 'copy_link', etc.
});

// Track directions button click
analytics.trackArtworkDirections({
  artwork_id: artwork.id,
  artwork_title: artwork.title,
});

// Track photo carousel interaction
analytics.trackArtworkPhotoView({
  artwork_id: artwork.id,
  photo_index: 2, // which photo in the carousel
});
```

### Submission Events

```typescript
// Track submission start
analytics.trackSubmissionStart({
  submission_type: 'artwork',
  has_photos: true,
  photo_count: 3,
});

// Track successful submission
analytics.trackSubmissionComplete({
  submission_type: 'artwork',
  photo_count: 3,
});

// Track submission error
analytics.trackSubmissionError({
  submission_type: 'artwork',
  error_message: 'Invalid photo format',
});
```

### Search Events

```typescript
// Track search query
analytics.trackSearch({
  search_term: 'murals vancouver',
  results_count: 42,
});

// Track search result click
analytics.trackSearchResultClick({
  search_term: 'murals',
  result_position: 3, // position in results list
  artwork_id: 'abc123',
});
```

### Map Events

```typescript
// Track map interactions
analytics.trackMapInteraction({
  interaction_type: 'zoom',
  zoom_level: 15,
  latitude: 49.2827,
  longitude: -123.1207,
});

// Track marker click
analytics.trackMapMarkerClick({
  artwork_id: artwork.id,
  zoom_level: 14,
  latitude: artwork.lat,
  longitude: artwork.lon,
});
```

### User Events

```typescript
// Track login
analytics.trackLogin({
  user_role: 'contributor',
});

// Track signup
analytics.trackSignup();

// Track logout
analytics.trackLogout();
```

### Error Tracking

```typescript
// Track errors
analytics.trackError(
  'api_error',
  'Failed to load artwork',
  {
    endpoint: '/api/artwork/123',
    status_code: 500,
  }
);
```

### Performance Metrics

```typescript
// Track performance metrics
analytics.trackPerformance(
  'artwork_load_time',
  1234, // milliseconds
  {
    artwork_id: 'abc123',
  }
);
```

## Implementation Guide

### Adding Analytics to a New Component

1. **Import the composable**:
```typescript
import { useAnalytics } from '@/composables/useAnalytics';
```

2. **Initialize in setup**:
```typescript
const analytics = useAnalytics();
```

3. **Track events on user interactions**:
```typescript
const handleButtonClick = (): void => {
  analytics.trackEvent('button_click', {
    event_category: 'navigation',
    event_label: 'view_artwork',
  });
  
  // Your existing logic...
};
```

### Best Practices

1. **Track User Intent**: Focus on tracking what users are trying to accomplish
2. **Consistent Naming**: Use consistent event names across the application
3. **Meaningful Parameters**: Include context that helps understand user behavior
4. **Privacy First**: Never track PII (personally identifiable information)
5. **Test in Development**: Check console logs in dev mode to verify events

### Common Integration Points

Here are the key places where analytics should be added:

#### Artwork Detail View
- View artwork (on mount)
- Click photos in carousel
- Click "Get Directions" button
- Click share buttons
- Click "Edit" button (for authenticated users)

#### Map View
- Click map markers
- Zoom in/out
- Pan to new location
- Click "Locate Me" button

#### Submission Forms
- Start submission (on mount)
- Submit form (success)
- Submit form (error)
- Upload photos
- Change location

#### Search
- Perform search
- Click search results
- Filter results
- Sort results

#### User Profile
- View profile
- Update profile
- View notifications

#### Navigation
- Click navigation links
- Use breadcrumbs
- Navigate via router

## Testing

### Development Testing

In development mode, analytics events are logged to the console instead of being sent to Google Analytics:

```
[Analytics] view_artwork { artwork_id: 'abc123', event_category: 'artwork' }
```

### Production Testing

To test in production without polluting real data:

1. Create a separate GA4 property for testing
2. Use that tracking ID in a staging environment
3. Verify events in GA4 Real-Time view

### Checking Implementation

Use the Google Analytics DebugView:
1. Install [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger) extension
2. Enable the extension
3. Open your site
4. Check the browser console for detailed event information

## Privacy Considerations

### GDPR Compliance

- **Cookie Consent**: Consider implementing a cookie consent banner
- **Anonymize IPs**: GA4 anonymizes IPs by default
- **Data Retention**: Configure appropriate data retention in GA4 settings

### What We Track

✅ **We DO track**:
- Page views
- Button clicks
- Search queries (terms only, no user info)
- Feature usage
- Performance metrics
- Error messages (sanitized)

❌ **We DO NOT track**:
- Personal information (names, emails, addresses)
- User tokens or session IDs
- Private notes or content
- Location data (only city/region via IP)

## Troubleshooting

### Events Not Appearing in GA4

1. **Check tracking ID**: Verify `VITE_GA_TRACKING_ID` is set correctly
2. **Check environment**: Analytics only works in production (not localhost)
3. **Check console**: Look for `[Analytics]` logs in development
4. **Check Network tab**: Look for requests to `google-analytics.com`
5. **Wait for processing**: Events can take 24-48 hours to appear in standard reports (use Real-Time view for immediate verification)

### TypeScript Errors

If you see TypeScript errors related to `window.gtag`:
```typescript
// The types are defined in useAnalytics.ts
// Make sure the file is included in your tsconfig.json
```

### Build Issues

If the GA tracking ID isn't being replaced:
```bash
# Check that the environment variable is set during build
echo $VITE_GA_TRACKING_ID  # Unix/Mac
echo %VITE_GA_TRACKING_ID%  # Windows

# Rebuild
npm run build
```

## Resources

- [Google Analytics 4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [GA4 Event Reference](https://developers.google.com/analytics/devguides/collection/ga4/events)
- [gtag.js Reference](https://developers.google.com/analytics/devguides/collection/gtagjs)
- [Vue Router Integration](https://router.vuejs.org/guide/advanced/navigation-guards.html)

## Future Enhancements

Potential improvements for the analytics system:

1. **Event Batching**: Queue events and send in batches to reduce requests
2. **Offline Support**: Store events locally when offline, send when online
3. **A/B Testing**: Integrate with Google Optimize for experiments
4. **Custom Dimensions**: Add user properties (role, preferences)
5. **Enhanced E-commerce**: If we add premium features
6. **Heatmaps**: Integrate with tools like Hotjar or Microsoft Clarity
7. **Conversion Tracking**: Set up goals and funnels
8. **Dashboard**: Create internal analytics dashboard with key metrics
