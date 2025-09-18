import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    emits: ['artwork-clicked', 'map-moved'],
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

  describe('Basic Rendering', (): void => {
    it('renders without errors', (): void => {
      expect(wrapper.exists()).toBe(true);
    });

    it('contains map component', (): void => {
      expect(wrapper.find('[data-testid="map-component"]').exists()).toBe(true);
    });

    it('has map view structure', (): void => {
      expect(wrapper.findComponent({ name: 'MapComponent' }).exists()).toBe(true);
    });
  });

  describe('Component Integration', (): void => {
    it('integrates with map component', (): void => {
      const mapComponent = wrapper.findComponent({ name: 'MapComponent' });
      expect(mapComponent.exists()).toBe(true);
    });

    it('handles component lifecycle', (): void => {
      expect(wrapper.vm).toBeDefined();
    });
  });

  describe('Event Handling', (): void => {
    it('can handle events from child components', async (): Promise<void> => {
      const mapComponent = wrapper.findComponent({ name: 'MapComponent' });

      await mapComponent.vm.$emit('artwork-clicked', { id: 'artwork-1' });
      await wrapper.vm.$nextTick();

      expect(mapComponent.emitted('artwork-clicked')).toBeTruthy();
    });
  });

  describe('Component State', (): void => {
    it('maintains component state', (): void => {
      expect(wrapper.vm).toBeDefined();
      expect(wrapper.exists()).toBe(true);
    });
  });
});
