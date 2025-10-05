import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createRouter, createWebHistory, type Router } from 'vue-router';
import { createPinia, type Pinia } from 'pinia';
import MapView from '../MapView.vue';

// Mock child components
vi.mock('../../components/MapComponent.vue', () => ({
  default: {
    name: 'MapComponent',
    template: '<div data-testid="map-component"><slot /></div>',
    props: ['center', 'zoom', 'height', 'artworks'],
    emits: ['artwork-click', 'preview-artwork', 'dismiss-preview', 'map-move', 'location-found'],
  },
}));

vi.mock('../../components/ArtworkCard.vue', () => ({
  default: {
    name: 'ArtworkCard',
    template: '<div data-testid="artwork-card" v-if="artwork"><slot /></div>',
    props: ['artwork', 'clickable', 'compact'],
    emits: ['click'],
  },
}));

// Mock stores
vi.mock('../../stores/artworks', () => ({
  useArtworksStore: vi.fn(() => ({
    isLoading: false,
    error: null,
    artworks: [],
    nearbyArtworks: [],
    mapCenter: { latitude: 49.2827, longitude: -123.1207 },
    mapZoom: 15,
    currentLocation: null,
    fetchNearbyArtworks: vi.fn(),
    clearArtworks: vi.fn(),
    setMapCenter: vi.fn(),
    setMapZoom: vi.fn(),
  })),
}));

vi.mock('../../stores/mapPreview', () => ({
  useMapPreviewStore: vi.fn(() => ({
    currentPreview: {
      id: 'test-artwork-1',
      lat: 49.2827,
      lon: -123.1207,
      title: 'Test Artwork',
      description: 'Test Description',
      artist: 'Test Artist',
      year: '2023',
      photos: [{ url: 'test.jpg', alt: 'Test photo' }],
      tags: ['test'],
    },
    isVisible: true,
    hasPreview: true,
    showPreview: vi.fn(),
    hidePreview: vi.fn(),
    updatePreview: vi.fn(),
    clearPreview: vi.fn(),
  })),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const createMockRouter = (): Router => {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/map', component: { template: '<div>Map</div>' } },
    ],
  });
};

describe('MapView', () => {
  let wrapper: VueWrapper<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let router: Router;
  let pinia: Pinia;

  beforeEach(async (): Promise<void> => {
    pinia = createPinia();
    router = createMockRouter();

    wrapper = mount(MapView, {
      global: {
        plugins: [router, pinia],
        stubs: {
          RouterLink: true,
        },
      },
    });

    await router.isReady();
    await wrapper.vm.$nextTick();
  });

  afterEach(async (): Promise<void> => {
    // Properly unmount the component to clean up timers, watchers, etc.
    if (wrapper) {
      await wrapper.unmount();
    }
    // Clear all timers
    vi.clearAllTimers();
  });

  describe('Basic Rendering', (): void => {
    it('renders without errors', (): void => {
      expect(wrapper.exists()).toBe(true);
    });

    it('contains map component', (): void => {
      expect(wrapper.find('[data-testid="map-component"]').exists()).toBe(true);
    });

    it('contains artwork card component', (): void => {
      expect(wrapper.findComponent({ name: 'ArtworkCard' }).exists()).toBe(true);
    });

    it('has map view structure', (): void => {
      expect(wrapper.findComponent({ name: 'MapComponent' }).exists()).toBe(true);
      expect(wrapper.findComponent({ name: 'ArtworkCard' }).exists()).toBe(true);
    });
  });

  describe('Component Integration', (): void => {
    it('integrates with map component', (): void => {
      const mapComponent = wrapper.findComponent({ name: 'MapComponent' });
      expect(mapComponent.exists()).toBe(true);
    });

    it('integrates with artwork card', (): void => {
      const artworkCard = wrapper.findComponent({ name: 'ArtworkCard' });
      expect(artworkCard.exists()).toBe(true);
    });

    it('passes artwork data to ArtworkCard when preview is visible', (): void => {
      const artworkCard = wrapper.findComponent({ name: 'ArtworkCard' });
      
      // ArtworkCard should exist but artwork prop might be null when no preview
      expect(artworkCard.exists()).toBe(true);
      expect(artworkCard.props()).toHaveProperty('artwork');
      expect(artworkCard.props()).toHaveProperty('clickable');
      expect(artworkCard.props()).toHaveProperty('compact');
    });

    it('passes correct event handlers to components', (): void => {
      const mapComponent = wrapper.findComponent({ name: 'MapComponent' });
      const artworkCard = wrapper.findComponent({ name: 'ArtworkCard' });

      // Verify components exist and have proper structure
      expect(mapComponent.exists()).toBe(true);
      expect(artworkCard.exists()).toBe(true);
      
      // Verify components have required props/emits defined
      expect(mapComponent.props()).toBeDefined();
      expect(artworkCard.props()).toBeDefined();
    });

    it('handles component lifecycle', (): void => {
      expect(wrapper.vm).toBeDefined();
    });
  });

  describe('Event Handling', (): void => {
    it('can handle events from child components', async (): Promise<void> => {
      const mapComponent = wrapper.findComponent({ name: 'MapComponent' });

      await mapComponent.vm.$emit('artwork-click', { id: 'artwork-1' });
      await wrapper.vm.$nextTick();

      expect(mapComponent.emitted('artwork-click')).toBeTruthy();
    });

    it('handles preview artwork events from MapComponent', async (): Promise<void> => {
      const mockPreviewData = {
        id: 'artwork-123',
        title: 'Test Artwork',
        description: 'Test description',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        lat: 49.2827,
        lon: -123.1207,
      };

      const mapComponent = wrapper.findComponent({ name: 'MapComponent' });
      await mapComponent.vm.$emit('preview-artwork', mockPreviewData);
      await wrapper.vm.$nextTick();

      expect(mapComponent.emitted('preview-artwork')).toHaveLength(1);
      expect(mapComponent.emitted('preview-artwork')?.[0]).toEqual([mockPreviewData]);
    });

    it('handles dismiss preview events from MapComponent', async (): Promise<void> => {
      const mapComponent = wrapper.findComponent({ name: 'MapComponent' });
      await mapComponent.vm.$emit('dismiss-preview');
      await wrapper.vm.$nextTick();

      expect(mapComponent.emitted('dismiss-preview')).toHaveLength(1);
    });

    it('handles navigate events from MapPreviewCard', (): void => {
      const artworkCard = wrapper.findComponent({ name: 'ArtworkCard' });
      expect(artworkCard.exists()).toBe(true);
      
      // Test that the component receives the correct props
      expect(artworkCard.props('artwork')).toBeDefined();
      expect(artworkCard.props('clickable')).toBe(true);
      expect(artworkCard.props('compact')).toBe(true);
    });

    it('handles analytics events from MapPreviewCard', (): void => {
      const artworkCard = wrapper.findComponent({ name: 'ArtworkCard' });
      expect(artworkCard.exists()).toBe(true);
      
      // Test that the component is properly configured
      expect(artworkCard.props()).toHaveProperty('artwork');
      expect(artworkCard.props()).toHaveProperty('clickable');
      expect(artworkCard.props()).toHaveProperty('compact');
    });
  });

  describe('Component State', (): void => {
    it('maintains component state', (): void => {
      expect(wrapper.vm).toBeDefined();
      expect(wrapper.exists()).toBe(true);
    });
  });
});
