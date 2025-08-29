# Frontend Architecture & Accessibility Guide

## Overview

The Cultural Archiver frontend is a Vue 3 + TypeScript application designed with accessibility-first principles and mobile-responsive design. It achieves WCAG AA compliance while providing a smooth user experience across all devices.

## Architecture

### Core Technologies

- **Vue 3**: Composition API with `<script setup>` syntax
- **TypeScript**: Strict mode with comprehensive type coverage
- **Tailwind CSS**: Utility-first CSS with mobile-first responsive design
- **Vite**: Fast development server and optimized production builds
- **Pinia**: Type-safe state management with reactive stores
- **Vue Router**: Client-side routing with lazy loading

### Project Structure

```
src/frontend/
├── components/          # Reusable UI components
│   ├── AppShell.vue    # Main application shell with navigation
│   ├── MapComponent.vue # Interactive Leaflet map
│   ├── PhotoUpload.vue # File upload with preview
│   ├── Modal.vue       # Accessible modal dialogs
│   └── LiveRegion.vue  # Screen reader announcements
├── views/              # Page-level components
│   ├── MapView.vue     # Home page with map
│   ├── SubmitView.vue  # Photo submission workflow
│   ├── ArtworkDetailView.vue # Artwork details
│   ├── ProfileView.vue # User submissions
│   └── ReviewView.vue  # Content moderation
├── composables/        # Reusable business logic
│   ├── useApi.ts      # API integration with error handling
│   ├── useAuth.ts     # Authentication state management
│   ├── useAnnouncer.ts # Screen reader announcements
│   └── useFocusManagement.ts # Keyboard navigation
├── stores/             # Pinia state stores
│   ├── auth.ts        # User authentication state
│   └── artworks.ts    # Artwork and map state
└── services/           # External service integrations
    └── api.ts         # Type-safe API client
```

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
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
    
    // Focus trapping logic...
  }
}
```

#### Screen Reader Announcements
```typescript
// useAnnouncer.ts
export function useAnnouncer() {
  const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', priority)
    announcement.setAttribute('aria-atomic', 'true')
    announcement.textContent = message
    // Implementation details...
  }
}
```

## Responsive Design

### Mobile-First Approach

The design system starts with mobile (320px) and progressively enhances for larger screens:

```css
/* Base styles for mobile (320px+) */
.container { padding: 1rem; }

/* Tablet (768px+) */
@media (min-width: 768px) {
  .container { padding: 2rem; }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .container { padding: 3rem; }
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
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const isAuthenticated = computed(() => !!token.value)
  
  const login = async (userToken: string) => {
    token.value = userToken
    await loadUserProfile()
  }
  
  return { user, token, isAuthenticated, login }
})
```

#### Artwork Store (artworks.ts)
```typescript
export const useArtworksStore = defineStore('artworks', () => {
  const artworks = ref<ArtworkPin[]>([])
  const currentLocation = ref<Coordinates | null>(null)
  
  const fetchNearbyArtworks = async (location: Coordinates) => {
    // Efficient caching and API integration
  }
  
  return { artworks, currentLocation, fetchNearbyArtworks }
})
```

## Component Patterns

### Composition API Usage

Components use the `<script setup>` syntax with TypeScript:

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Props {
  modelValue: string
  required?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  required: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'submit': [data: FormData]
}>()

const isValid = computed(() => props.required ? !!props.modelValue : true)
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
    })
    
    return this.handleResponse<T>(response)
  }
  
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }
}
```

### Error Handling

```typescript
// composables/useApi.ts
export function useApi<T>() {
  const data = ref<T | null>(null)
  const error = ref<string | null>(null)
  const isLoading = ref(false)
  
  const execute = async (apiCall: () => Promise<T>) => {
    try {
      isLoading.value = true
      error.value = null
      data.value = await apiCall()
    } catch (err) {
      error.value = getErrorMessage(err)
    } finally {
      isLoading.value = false
    }
  }
  
  return { data, error, isLoading, execute }
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
    component: () => import('../views/MapView.vue')
  },
  {
    path: '/submit',
    component: () => import('../views/SubmitView.vue')
  }
]
```

### Image Optimization

```typescript
// utils/image.ts
export const optimizeImage = (file: File, maxWidth: number = 800): Promise<Blob> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    
    img.onload = () => {
      // Resize and compress logic
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    }
    
    img.src = URL.createObjectURL(file)
  })
}
```

## Testing Strategy

### Unit Tests

Components are tested using Vitest and Vue Test Utils:

```typescript
// components/__tests__/AppShell.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppShell from '../AppShell.vue'

describe('AppShell', () => {
  it('renders navigation correctly', () => {
    const wrapper = mount(AppShell)
    expect(wrapper.find('nav').exists()).toBe(true)
  })
})
```

### Accessibility Testing

```typescript
// Accessibility-focused tests
it('provides proper ARIA labels', () => {
  const wrapper = mount(MapComponent)
  expect(wrapper.attributes('role')).toBe('application')
  expect(wrapper.attributes('aria-label')).toContain('Interactive map')
})
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

- **ESLint**: 0 errors, TypeScript strict mode
- **Prettier**: Consistent code formatting
- **TypeScript**: Comprehensive type coverage
- **Testing**: Unit tests for critical components

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
- **Custom domains**: art.abluestar.com
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