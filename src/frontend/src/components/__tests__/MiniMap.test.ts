import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import MiniMap from '../MiniMap.vue';

// Mock Leaflet
const mockMarker = {
  addTo: vi.fn().mockReturnThis(),
  setLatLng: vi.fn().mockReturnThis(),
  bindPopup: vi.fn().mockReturnThis(),
  openPopup: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
};

const mockTileLayer = {
  addTo: vi.fn().mockReturnThis(),
};

const mockMap = {
  setView: vi.fn().mockReturnThis(),
  zoomIn: vi.fn().mockReturnThis(),
  zoomOut: vi.fn().mockReturnThis(),
  remove: vi.fn().mockReturnThis(),
};

const mockLeaflet = {
  map: vi.fn().mockReturnValue(mockMap),
  marker: vi.fn().mockReturnValue(mockMarker),
  tileLayer: vi.fn().mockReturnValue(mockTileLayer),
  latLng: vi.fn().mockImplementation((lat, lng) => ({ lat, lng })),
};

// Mock dynamic import of Leaflet
vi.mock('leaflet', () => ({
  default: mockLeaflet,
  map: mockLeaflet.map,
  marker: mockLeaflet.marker,
  tileLayer: mockLeaflet.tileLayer,
  latLng: mockLeaflet.latLng,
}));

// Mock dynamic CSS import
vi.mock('leaflet/dist/leaflet.css', () => ({}));

describe('MiniMap', () => {
  const defaultProps = {
    latitude: 49.2827,
    longitude: -123.1207,
    title: 'Test Artwork',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders correctly with default props', () => {
      const wrapper = mount(MiniMap, {
        props: defaultProps,
      });

      expect(wrapper.find('.mini-map').exists()).toBe(true);
      expect(wrapper.find('[role="application"]').exists()).toBe(true);
    });

    it('shows loading state initially', () => {
      const wrapper = mount(MiniMap, {
        props: defaultProps,
      });

      expect(wrapper.text()).toContain('Loading map...');
    });

    it('displays coordinates', () => {
      const wrapper = mount(MiniMap, {
        props: defaultProps,
      });

      expect(wrapper.text()).toContain('49.282700, -123.120700');
    });

    it('shows directions link by default', () => {
      const wrapper = mount(MiniMap, {
        props: defaultProps,
      });

      expect(wrapper.text()).toContain('Get Directions');
    });

    it('hides directions link when showDirectionsLink is false', () => {
      const wrapper = mount(MiniMap, {
        props: {
          ...defaultProps,
          showDirectionsLink: false,
        },
      });

      expect(wrapper.text()).not.toContain('Get Directions');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const wrapper = mount(MiniMap, {
        props: defaultProps,
      });

      const mapElement = wrapper.find('[role="application"]');
      expect(mapElement.exists()).toBe(true);
      expect(mapElement.attributes('aria-label')).toContain('Interactive map');
      expect(mapElement.attributes('aria-label')).toContain('Test Artwork');
      expect(mapElement.attributes('tabindex')).toBe('0');
    });

    it('includes keyboard shortcuts help', () => {
      const wrapper = mount(MiniMap, {
        props: defaultProps,
      });

      expect(wrapper.text()).toContain('Keyboard: Enter/Space for directions');
    });
  });

  describe('Directions', () => {
    it('opens directions in new tab when button clicked', async () => {
      // Mock window.open
      const mockOpen = vi.fn();
      Object.defineProperty(window, 'open', {
        value: mockOpen,
        writable: true,
      });

      const wrapper = mount(MiniMap, {
        props: defaultProps,
      });

      const directionsButton = wrapper.find('button');
      await directionsButton.trigger('click');

      expect(mockOpen).toHaveBeenCalledWith(
        'https://www.google.com/maps?q=49.2827,-123.1207',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });

  describe('Customization', () => {
    it('uses custom height', () => {
      const wrapper = mount(MiniMap, {
        props: {
          ...defaultProps,
          height: '300px',
        },
      });

      const mapContainer = wrapper.find('[role="application"]');
      expect(mapContainer.attributes('style')).toContain('height: 300px');
    });

    it('uses custom zoom level', async () => {
      const wrapper = mount(MiniMap, {
        props: {
          ...defaultProps,
          zoom: 18,
        },
      });

      // Wait for async map initialization
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Map initialization should use the custom zoom
      expect(mockMap.setView).toHaveBeenCalledWith([49.2827, -123.1207], 18);
    });

    it('uses custom title', () => {
      const customTitle = 'Custom Artwork Title';
      const wrapper = mount(MiniMap, {
        props: {
          ...defaultProps,
          title: customTitle,
        },
      });

      expect(wrapper.find('[role="application"]').attributes('aria-label')).toContain(customTitle);
    });
  });

  describe('Error Handling', () => {
    it('shows error state when map fails to load', async () => {
      // Mock import to reject
      vi.mocked(mockLeaflet.map).mockImplementationOnce(() => {
        throw new Error('Map initialization failed');
      });

      const wrapper = mount(MiniMap, {
        props: defaultProps,
      });

      // Wait for component to handle the error
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(wrapper.text()).toContain('Failed to load map');
    });
  });

  describe('Map Events', () => {
    it('emits mapReady when map is initialized', async () => {
      const wrapper = mount(MiniMap, {
        props: defaultProps,
      });

      // Wait for async map initialization
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(wrapper.emitted('mapReady')).toBeTruthy();
    });

    it('sets up marker click handler', async () => {
      const wrapper = mount(MiniMap, {
        props: defaultProps,
      });

      // Wait for async map initialization
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockMarker.on).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('Responsive Design', () => {
    it('applies proper styling classes', () => {
      const wrapper = mount(MiniMap, {
        props: defaultProps,
      });

      expect(wrapper.find('.mini-map').exists()).toBe(true);
      expect(wrapper.find('.rounded-lg').exists()).toBe(true);
      expect(wrapper.find('.border').exists()).toBe(true);
    });
  });
});
