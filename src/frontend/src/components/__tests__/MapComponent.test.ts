import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import MapComponent from '../MapComponent.vue'

// Mock Leaflet completely
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => ({
      setView: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      remove: vi.fn(),
      whenReady: vi.fn((callback: () => void) => callback()),
      invalidateSize: vi.fn(),
    })),
    tileLayer: vi.fn(() => ({
      addTo: vi.fn(),
    })),
  },
}))

// Mock vue-leaflet
vi.mock('@vue-leaflet/vue-leaflet', () => ({
  LMap: { name: 'LMap', template: '<div data-testid="leaflet-map"><slot /></div>' },
  LTileLayer: { name: 'LTileLayer', template: '<div></div>' },
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
  let wrapper: VueWrapper<any>
  let pinia: Pinia

  beforeEach(async (): Promise<void> => {
    pinia = createPinia()
    
    wrapper = mount(MapComponent, {
      global: {
        plugins: [pinia],
        stubs: {
          LMap: true,
          LTileLayer: true,
        },
      },
      props: {
        center: [49.2827, -123.1207],
        zoom: 13,
        height: '400px',
      },
    })
    
    await wrapper.vm.$nextTick()
  })

  describe('Basic Rendering', (): void => {
    it('renders without errors', (): void => {
      expect(wrapper.exists()).toBe(true)
    })

    it('contains map component wrapper', (): void => {
      expect(wrapper.find('.map-component').exists()).toBe(true)
    })
  })
})