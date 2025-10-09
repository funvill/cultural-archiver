# Frontend Architecture & Accessibility Guide

## Overview

The Cultural Archiver frontend is a Vue 3 + TypeScript application designed with accessibility-first principles and mobile-responsive design. It achieves WCAG AA compliance while providing a smooth user experience across all devices.

## Architecture

### Core Technologies

- **Vue 3.4+**: Composition API with `<script setup>` syntax and enhanced TypeScript integration
- **TypeScript 5.0+**: Strict mode with comprehensive type coverage and modern ESNext features
- **Tailwind CSS 3.0+**: Utility-first CSS with mobile-first responsive design and dark mode support
- **Vite 5.0+**: Fast development server, optimized production builds, and modern bundling
- **Pinia 2.0+**: Type-safe state management with reactive stores and DevTools integration
- **Vue Router 4.0+**: Client-side routing with lazy loading and route-level code splitting
- **Leaflet**: Interactive maps with OpenStreetMap tiles and custom markers
- **EXIF.js**: Photo metadata extraction for GPS coordinates and camera information

### Project Structure

```
src/frontend/
├── components/          # Reusable UI components
│   ├── AppShell.vue    # Main application shell with responsive navigation
│   ├── MapComponent.vue # Interactive Leaflet map with clustering and popups
│   ├── PhotoUpload.vue # File upload with drag-drop, preview, and EXIF extraction
│   ├── PhotoCarousel.vue # Image gallery with lightbox and navigation
│   ├── TagBadge.vue    # Styled tag display components
│   ├── MiniMap.vue     # Compact map for detail views
│   ├── Modal.vue       # Accessible modal dialogs with focus management
│   ├── LoadingSpinner.vue # Loading states and skeleton screens
│   ├── LiveRegion.vue  # Screen reader announcements
│   ├── BadgeGrid.vue   # Badge collection display with responsive grid layout
│   ├── BadgeCard.vue   # Individual badge component with hover effects and detailed modal
│   └── ProfileNameEditor.vue # Profile name editing with real-time validation
├── views/              # Page-level components (route components)
│   ├── MapView.vue     # Home page with interactive map and search
│   ├── SubmitView.vue  # Photo submission workflow with consent management
│   ├── ArtworkDetailView.vue # Artwork details with photo gallery and timeline
│   ├── ArtworkIndexView.vue # Browsable list of artworks with sorting
│   ├── ProfileView.vue # User submissions dashboard, badge collection, and profile settings
│   ├── PublicProfileView.vue # Public profile pages showcasing user badges and achievements
│   ├── ReviewView.vue  # Content moderation interface with photo aggregation support (admin/moderator only)
│   ├── SearchView.vue  # Advanced search with filters and facets
│   ├── LogbookSubmissionView.vue # Logbook visit submission with photo proof and condition assessment
│   └── PhotoSearchView.vue # Reverse image search interface
├── composables/        # Reusable business logic (Vue 3 Composition API)
│   ├── useApi.ts       # API integration with error handling and retries
│   ├── useAuth.ts      # Authentication state management and role checking
│   ├── useAnnouncer.ts # Screen reader announcements for dynamic content
│   ├── useFocusManagement.ts # Keyboard navigation and focus trapping
│   ├── useGeolocation.ts # GPS location access with fallbacks
│   ├── usePhotoUpload.ts # Photo handling, EXIF extraction, and validation
│   └── usePermissions.ts # Role-based permission checking
├── stores/             # Pinia state stores
│   ├── auth.ts         # User authentication state and session management
│   ├── artworks.ts     # Artwork data and map state
│   ├── submissions.ts  # User submission history and pending items
│   ├── logbookSubmission.ts # Logbook visit submission form state and API integration
│   └── ui.ts           # UI state (modals, loading, notifications)
├── services/           # External service integrations
│   ├── api.ts          # Type-safe API client with request/response interceptors
│   ├── consent.ts      # Legal consent management and validation
│   └── analytics.ts    # Privacy-focused usage analytics
├── test/               # Test utilities and mocks
│   ├── setup.ts        # Test environment configuration
│   ├── mocks/          # API and service mocks
│   └── fixtures/       # Test data fixtures
├── assets/             # Static assets
│   ├── images/         # Icons, logos, and graphics
│   ├── fonts/          # Web fonts (if any)
│   └── styles/         # Global CSS and Tailwind configuration
└── utils/              # Utility functions
    ├── validation.ts   # Form validation helpers
    ├── formatting.ts   # Date, number, and text formatting
    ├── coordinates.ts  # GPS coordinate utilities
    └── accessibility.ts # A11y helper functions
```

## Badge System Components

## Notifications & Toasts

Transient UI notifications (toasts) are handled by a centralized system. See `docs/toasts.md` for details on the `useToasts()` composable, store types, and the badge payload convention.


The badge system provides gamification and profile management through a set of Vue components that integrate seamlessly with the existing design system.

### BadgeGrid.vue

**Purpose**: Displays user's earned badges in a responsive grid layout with empty states.

**Props**:

- `badges: UserBadgeWithDetails[]` - Array of user's earned badges
- `loading: boolean` - Loading state for API requests

**Features**:

- Responsive grid layout (1-4 columns based on screen size)
- Empty state with encouraging messaging for new users
- Loading skeleton with shimmer effects
- Accessibility labels and keyboard navigation
- Mobile-optimized touch targets

**Usage**:

```vue
<BadgeGrid :badges="userBadges" :loading="badgesLoading" />
```

### BadgeCard.vue

**Purpose**: Individual badge component with hover effects and detailed modal popup.

**Props**:

- `badge: BadgeRecord` - Badge definition with title, description, icon
- `awardedAt: string` - ISO timestamp when badge was earned
- `awardReason: string` - Reason the badge was awarded
- `metadata?: Record<string, unknown>` - Optional achievement metadata

**Features**:

- Hover effects with subtle animations
- Modal popup with detailed achievement information
- Emoji icon display with fallback text
- Award date formatting with relative time
- Mobile-responsive design with touch interactions
- Focus management and keyboard accessibility

**Usage**:

```vue
<BadgeCard :badge="userBadge.badge" :awarded-at="userBadge.awarded_at" :award-reason="userBadge.award_reason" :metadata="userBadge.metadata" />
```

### ProfileNameEditor.vue

**Purpose**: Profile name editing interface with real-time validation and availability checking.

**Props**:

- `currentProfileName: string | null` - User's current profile name

**Events**:

- `@profile-updated: (profileName: string) => void` - Emitted when profile name is successfully updated

**Features**:

- Real-time validation with immediate feedback
- Debounced availability checking (300ms delay)
- Visual indicators for validation states (valid, invalid, checking, taken)
- Comprehensive error messaging with specific guidance
- Progressive enhancement for users without verified emails
- Accessible form design with proper labeling and aria attributes

**Validation Rules**:

- 3-20 characters long
- Alphanumeric characters and dashes only
- Cannot start or end with dash
- Cannot use banned names (admin, moderator, etc.)
- Must be unique across all users

**Usage**:

```vue
<ProfileNameEditor :currentProfileName="currentProfileName" @profile-updated="onProfileUpdated" />
```

### PublicProfileView.vue

**Purpose**: Public profile page component showcasing user achievements and badges.

**Route**: `/users/:uuid`

**Features**:

- Public profile information display (profile name, member since date)
- Badge collection with earned badges only
- Member statistics and achievements
- Responsive layout with mobile optimization
- SEO-friendly meta tags and structured data
- Error handling for non-existent or private profiles

**API Integration**:

- `GET /api/users/:uuid` - Fetch public profile data
- Handles 404 errors gracefully for invalid user UUIDs
- No authentication required for public viewing

## Integration with ProfileView.vue

The existing ProfileView.vue has been enhanced with badge system integration:

**New Sections Added**:

1. **Profile Settings Section**: Profile name editor with setup encouragement
2. **Badges Section**: Badge grid showing earned achievements with empty state
3. **Enhanced Navigation**: Updated to support public profile sharing

**Authentication Requirements**:

- Badge system requires email verification
- Profile name editing requires verified email address
- Anonymous users see encouraging messaging to complete verification

**State Management**:

- Badge data fetched via `getUserBadges()` API method
- Profile name state managed through reactive refs
- Error handling for unauthorized badge access

## Accessibility Features

### WCAG AA Compliance

The application implements comprehensive accessibility features:

#### Keyboard Navigation

- **Tab navigation**: All interactive elements are keyboard accessible
- **Focus management**: Proper focus trapping in modal dialogs
- **Escape handling**: Close modals and menus with Escape key
- **Arrow keys**: Navigate through lists and map controls

#### Screen Reader Support

- **ARIA labels**: Descriptive labels for all UI elements
- **Live regions**: Dynamic content announcements
- **Landmark roles**: Proper semantic structure (navigation, main, etc.)
- **Form accessibility**: Associated labels and error messages

#### Visual Accessibility

- **Color contrast**: Meets WCAG AA standards (4.5:1 ratio minimum)
- **Focus indicators**: Clear visual focus rings for keyboard users
- **Responsive text**: Scales properly at all zoom levels
- **High contrast mode**: Compatible with system high contrast settings

### Implementation Examples

#### Modal Dialog Focus Management

```typescript
// useFocusManagement.ts
export function useFocusManagement() {
  const trapFocus = (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Focus trapping logic...
  };
}
```

#### Screen Reader Announcements

```typescript
// useAnnouncer.ts
export function useAnnouncer() {
  const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.textContent = message;
    // Implementation details...
  };
}
```

## Responsive Design

### Mobile-First Approach

The design system starts with mobile (320px) and progressively enhances for larger screens:

```css
/* Base styles for mobile (320px+) */
.container {
  padding: 1rem;
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .container {
    padding: 3rem;
  }
}
```

### Breakpoint Strategy

- **Mobile**: 320px - 767px (single column, touch-optimized)
- **Tablet**: 768px - 1023px (two columns, hover states)
- **Desktop**: 1024px+ (multi-column, keyboard shortcuts)

### Touch Targets

All interactive elements meet the minimum 44x44px touch target size:

```css
/* Minimum touch target for accessibility */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}
```

## State Management

### Pinia Stores

#### Authentication Store (auth.ts)

```typescript
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const isAuthenticated = computed(() => !!token.value);

  const login = async (userToken: string) => {
    token.value = userToken;
    await loadUserProfile();
  };

  return { user, token, isAuthenticated, login };
});
```

#### Artwork Store (artworks.ts)

```typescript
export const useArtworksStore = defineStore('artworks', () => {
  const artworks = ref<ArtworkPin[]>([]);
  const currentLocation = ref<Coordinates | null>(null);

  const fetchNearbyArtworks = async (location: Coordinates) => {
    // Efficient caching and API integration
  };

  return { artworks, currentLocation, fetchNearbyArtworks };
});
```

## Component Patterns

### Composition API Usage

Components use the `<script setup>` syntax with TypeScript:

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

interface Props {
  modelValue: string;
  required?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  required: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  submit: [data: FormData];
}>();

const isValid = computed(() => (props.required ? !!props.modelValue : true));
</script>
```

### Error Boundaries

```vue
<!-- ErrorBoundary.vue -->
<template>
  <div v-if="error" class="error-boundary" role="alert">
    <h2>Something went wrong</h2>
    <p>{{ error.message }}</p>
    <button @click="retry">Try Again</button>
  </div>
  <slot v-else />
</template>
```

## API Integration

### Type-Safe API Client

```typescript
// services/api.ts
class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: this.createHeaders(options.headers),
    });

    return this.handleResponse<T>(response);
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }
}
```

### Error Handling

```typescript
// composables/useApi.ts
export function useApi<T>() {
  const data = ref<T | null>(null);
  const error = ref<string | null>(null);
  const isLoading = ref(false);

  const execute = async (apiCall: () => Promise<T>) => {
    try {
      isLoading.value = true;
      error.value = null;
      data.value = await apiCall();
    } catch (err) {
      error.value = getErrorMessage(err);
    } finally {
      isLoading.value = false;
    }
  };

  return { data, error, isLoading, execute };
}
```

## Performance Optimizations

### Code Splitting

Routes are lazy-loaded for optimal bundle sizes:

```typescript
// router/index.ts
const routes = [
  {
    path: '/',
    component: () => import('../views/MapView.vue'),
  },
  {
    path: '/submit',
    component: () => import('../views/SubmitView.vue'),
  },
];
```

### Image Optimization

```typescript
// utils/image.ts
export const optimizeImage = (file: File, maxWidth: number = 800): Promise<Blob> => {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();

    img.onload = () => {
      // Resize and compress logic
      canvas.toBlob(resolve, 'image/jpeg', 0.85);
    };

    img.src = URL.createObjectURL(file);
  });
};
```

## Testing Strategy

### Unit Tests (82 Tests Passing)

The frontend has comprehensive unit test coverage across components, views, and API integration:

**Test Files (9 test files):**

- **AppShell.test.ts**: Navigation rendering and accessibility (2 tests)
- **MapComponent.test.ts**: Leaflet integration and error handling (2 tests)
- **Modal.test.ts**: Global modal system and accessibility (12 tests)
- **PhotoUpload.test.ts**: File upload workflow and consent management (9 tests)
- **ArtworkDetailView.test.ts**: Artwork detail pages and data loading (13 tests)
- **HomeView.test.ts**: Landing page and API status checks (12 tests)
- **MapView.test.ts**: Main map interface and geolocation (4 tests)
- **ProfileView.test.ts**: User profile management and submissions (22 tests)
- **SubmitView.test.ts**: Photo submission workflow and form validation (3 tests)

**Testing Framework:**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    globals: true,
  },
});
```

**Component Testing Example:**

```typescript
// components/__tests__/Modal.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Modal from '../Modal.vue'

describe('Modal', () => {
  it('renders when isOpen is true', () => {
    const wrapper = mount(Modal, {
      props: { isOpen: true, title: 'Test Modal' }
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('handles accessibility properly', () => {
    const wrapper = mount(Modal, {
      props: { isOpen: true }
    })
    expect(wrapper.vm.previouslyFocused).toBeDefined()
  })
})
  })
})
```

### Mocking Strategy

**API Services:**

```typescript
// Comprehensive API mocking
vi.mock('../../services/api', () => ({
  apiService: {
    searchNearbyArtwork: vi.fn().mockResolvedValue([]),
    submitLogbookEntry: vi.fn().mockResolvedValue({ success: true }),
    getVerificationStatus: vi.fn().mockResolvedValue({ verified: false }),
  },
}));
```

**Leaflet Maps:**

```typescript
// Mock Leaflet for component testing
vi.mock('leaflet', () => ({
  map: vi.fn(() => ({
    setView: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
  })),
  tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
}));
```

### Accessibility Testing

Accessibility is validated in unit tests:

```typescript
// Accessibility-focused tests
it('provides proper ARIA labels', () => {
  const wrapper = mount(MapComponent);
  expect(wrapper.attributes('role')).toBe('application');
  expect(wrapper.attributes('aria-label')).toContain('Interactive map');
});

it('supports keyboard navigation', async () => {
  const wrapper = mount(SubmitView);
  const fileInput = wrapper.find('input[type="file"]');

  await fileInput.trigger('keydown', { key: 'Enter' });
  expect(fileInput.element).toBe(document.activeElement);
});
```

### Test Execution

```bash
# Run all unit tests
npm run test:run

# Watch mode for development
npm run test

# Test with UI dashboard
npm run test:ui
```

## Browser Support

### Target Browsers

- **Chrome**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Safari**: Latest 2 versions
- **Edge**: Latest 2 versions

### Progressive Enhancement

Features degrade gracefully in older browsers:

- Map functionality requires modern JavaScript
- Photo upload uses native file input fallback
- CSS Grid with Flexbox fallback

## Development Workflow

### Local Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

### Code Quality

- **ESLint**: 1 error, 102 warnings (non-blocking) - significant improvement from 16 critical errors
- **Prettier**: Consistent code formatting
- **TypeScript**: Comprehensive type coverage with strict mode compliance
- **Testing**: 7 unit tests passing for critical components (AppShell, MapComponent, SubmitView)
- **Type Safety**: Eliminated `any` types in core functionality, proper interface definitions

## Deployment

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Cloudflare Pages Integration

The frontend deploys automatically to Cloudflare Pages with:

- **Global CDN**: Sub-100ms response times worldwide
- **Edge caching**: Optimized static asset delivery
- **Custom domains**: api.publicartregistry.com
- **HTTPS**: Automatic SSL certificates

## Future Enhancements

### Planned Features

- **Service Worker**: Offline support for core functionality
- **PWA Capabilities**: Install prompts and app-like experience
- **Advanced Caching**: Smart cache invalidation strategies
- **Performance Monitoring**: Real user metrics and optimization

### Accessibility Roadmap

- **Voice Navigation**: Speech-to-text for form inputs
- **High Contrast Themes**: User-selectable visual themes
- **Text Scaling**: Enhanced support for large text sizes
- **Cognitive Accessibility**: Simplified navigation modes
