import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import MapComponent from '../MapComponent.vue'
import { useArtworkStore } from '../../stores/artworks'

// Mock Leaflet
vi.mock('leaflet', () => ({
  map: vi.fn(() => ({
    setView: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    whenReady: vi.fn((callback) => callback()),
    invalidateSize: vi.fn(),
    flyTo: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
  })),
  tileLayer: vi.fn(() => ({
    addTo: vi.fn(),
    remove: vi.fn(),
  })),
  marker: vi.fn(() => ({
    addTo: vi.fn(),
    bindPopup: vi.fn(),
    openPopup: vi.fn(),
    setLatLng: vi.fn(),
    remove: vi.fn(),
    on: vi.fn(),
  })),
  icon: vi.fn(() => ({})),
  popup: vi.fn(() => ({
    setContent: vi.fn(),
    openOn: vi.fn(),
  })),
  markerClusterGroup: vi.fn(() => ({
    addLayer: vi.fn(),
    clearLayers: vi.fn(),
    addTo: vi.fn(),
  })),
}))

// Mock @vue-leaflet/vue-leaflet
vi.mock('@vue-leaflet/vue-leaflet', () => ({
  LMap: {
    name: 'LMap',
    template: '<div data-testid="leaflet-map"><slot /></div>',
    props: ['zoom', 'center', 'options'],
  },
  LTileLayer: {
    name: 'LTileLayer', 
    template: '<div data-testid="tile-layer"></div>',
    props: ['url', 'attribution'],
  },
  LMarker: {
    name: 'LMarker',
    template: '<div data-testid="marker"><slot /></div>',
    props: ['latLng'],
  },
  LPopup: {
    name: 'LPopup',
    template: '<div data-testid="popup"><slot /></div>',
  },
}))

// Mock useAnnouncer
vi.mock('../../composables/useAnnouncer', () => ({
  useAnnouncer: () => ({
    announceToScreenReader: vi.fn(),
    announceMapUpdate: vi.fn(),
    announceError: vi.fn(),
  }),
}))

describe('MapComponent', () => {
  let wrapper: any
  let pinia: any

  beforeEach(async () => {
    pinia = createPinia()
    
    wrapper = mount(MapComponent, {
      global: {
        plugins: [pinia],
        stubs: {
          LMap: true,
          LTileLayer: true,
          LMarker: true,
          LPopup: true,
        },
      },
      props: {
        center: [49.2827, -123.1207], // Vancouver coordinates
        zoom: 13,
        height: '400px',
      },
    })
  })

  describe('Rendering', () => {
    it('renders the map container with correct accessibility attributes', () => {
      const mapContainer = wrapper.find('[role="application"]')
      expect(mapContainer.exists()).toBe(true)
      expect(mapContainer.attributes('aria-label')).toBe('Interactive map showing cultural artworks')
    })

    it('applies correct height styling', () => {
      const mapContainer = wrapper.find('.map-container')
      expect(mapContainer.attributes('style')).toContain('height: 400px')
    })

    it('shows loading state initially', () => {
      wrapper.vm.isLoading = true
      expect(wrapper.find('[aria-live="polite"]').text()).toContain('Loading map')
    })
  })

  describe('Map Controls', () => {
    it('renders zoom controls with accessibility labels', () => {
      const zoomIn = wrapper.find('[aria-label="Zoom in"]')
      const zoomOut = wrapper.find('[aria-label="Zoom out"]')
      
      expect(zoomIn.exists()).toBe(true)
      expect(zoomOut.exists()).toBe(true)
    })

    it('renders location button when user location is available', async () => {
      wrapper.vm.userLocation = [49.2827, -123.1207]
      await wrapper.vm.$nextTick()

      const locationButton = wrapper.find('[aria-label="Go to your location"]')
      expect(locationButton.exists()).toBe(true)
    })

    it('handles zoom in action', async () => {
      const zoomInButton = wrapper.find('[aria-label="Zoom in"]')
      await zoomInButton.trigger('click')

      expect(wrapper.vm.currentZoom).toBe(14) // Initial 13 + 1
    })

    it('handles zoom out action', async () => {
      wrapper.vm.currentZoom = 14
      const zoomOutButton = wrapper.find('[aria-label="Zoom out"]')
      await zoomOutButton.trigger('click')

      expect(wrapper.vm.currentZoom).toBe(13)
    })
  })

  describe('Artwork Loading', () => {
    it('loads artworks from store when map moves', async () => {
      const artworkStore = useArtworkStore(pinia)
      const loadNearbyArtworksSpy = vi.spyOn(artworkStore, 'loadNearbyArtworks')
      
      wrapper.vm.handleMapMoveEnd()

      expect(loadNearbyArtworksSpy).toHaveBeenCalledWith(
        wrapper.vm.currentCenter[0],
        wrapper.vm.currentCenter[1],
        500 // default radius
      )
    })

    it('displays error state when artwork loading fails', async () => {
      wrapper.vm.error = 'Failed to load artworks'
      await wrapper.vm.$nextTick()

      const errorMessage = wrapper.find('[role="alert"]')
      expect(errorMessage.exists()).toBe(true)
      expect(errorMessage.text()).toContain('Failed to load artworks')
    })
  })

  describe('Geolocation', () => {
    it('requests user location on mount', () => {
      expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled()
    })

    it('handles successful geolocation', async () => {
      const mockPosition = {
        coords: {
          latitude: 49.2827,
          longitude: -123.1207,
          accuracy: 10,
        },
      }

      wrapper.vm.handleLocationSuccess(mockPosition)

      expect(wrapper.vm.userLocation).toEqual([49.2827, -123.1207])
      expect(wrapper.vm.locationAccuracy).toBe(10)
    })

    it('handles geolocation errors gracefully', async () => {
      const mockError = {
        code: 1,
        message: 'User denied location access',
      }

      wrapper.vm.handleLocationError(mockError)

      expect(wrapper.vm.locationError).toBe('User denied location access')
      expect(wrapper.vm.userLocation).toBeNull()
    })

    it('goes to user location when location button is clicked', async () => {
      wrapper.vm.userLocation = [49.2827, -123.1207]
      await wrapper.vm.$nextTick()

      const locationButton = wrapper.find('[aria-label="Go to your location"]')
      await locationButton.trigger('click')

      expect(wrapper.vm.currentCenter).toEqual([49.2827, -123.1207])
    })
  })

  describe('Popup Management', () => {
    it('creates popup content for artwork markers', () => {
      const mockArtwork = {
        id: '1',
        title: 'Test Artwork',
        type: 'public_art',
        photos: ['photo1.jpg'],
        lat: 49.2827,
        lon: -123.1207,
      }

      const popupContent = wrapper.vm.createPopupContent(mockArtwork)
      
      expect(popupContent).toContain('Test Artwork')
      expect(popupContent).toContain('View Details')
      expect(popupContent).toContain('photo1.jpg')
    })

    it('handles artwork selection from popup', async () => {
      const mockArtwork = {
        id: '1',
        title: 'Test Artwork',
        type: 'public_art',
      }

      wrapper.vm.selectArtwork(mockArtwork)

      expect(wrapper.emitted('artwork-selected')).toBeTruthy()
      expect(wrapper.emitted('artwork-selected')?.[0]?.[0]).toEqual(mockArtwork)
    })
  })

  describe('Accessibility Features', () => {
    it('announces map updates to screen readers', async () => {
      const mockAnnouncer = wrapper.vm.announcer
      
      wrapper.vm.handleMapMoveEnd()
      
      expect(mockAnnouncer.announceMapUpdate).toHaveBeenCalled()
    })

    it('supports keyboard navigation for map controls', async () => {
      const zoomInButton = wrapper.find('[aria-label="Zoom in"]')
      
      await zoomInButton.trigger('keydown.enter')
      expect(wrapper.vm.currentZoom).toBe(14)

      await zoomInButton.trigger('keydown.space')
      expect(wrapper.vm.currentZoom).toBe(15)
    })

    it('provides proper ARIA labels for dynamic content', async () => {
      wrapper.vm.isLoading = false
      wrapper.vm.artworkCount = 5
      await wrapper.vm.$nextTick()

      const statusMessage = wrapper.find('[aria-live="polite"]')
      expect(statusMessage.text()).toContain('Showing 5 artworks')
    })
  })

  describe('Props and Events', () => {
    it('accepts center prop and updates map accordingly', async () => {
      const newCenter = [50.0, -120.0]
      await wrapper.setProps({ center: newCenter })

      expect(wrapper.vm.currentCenter).toEqual(newCenter)
    })

    it('accepts zoom prop and updates map accordingly', async () => {
      await wrapper.setProps({ zoom: 15 })

      expect(wrapper.vm.currentZoom).toBe(15)
    })

    it('emits map-ready event when map is initialized', () => {
      wrapper.vm.handleMapReady()

      expect(wrapper.emitted('map-ready')).toBeTruthy()
    })

    it('emits location-found event when user location is obtained', () => {
      const mockPosition = {
        coords: {
          latitude: 49.2827,
          longitude: -123.1207,
          accuracy: 10,
        },
      }

      wrapper.vm.handleLocationSuccess(mockPosition)

      expect(wrapper.emitted('location-found')).toBeTruthy()
      expect(wrapper.emitted('location-found')?.[0]?.[0]).toEqual([49.2827, -123.1207])
    })
  })
})