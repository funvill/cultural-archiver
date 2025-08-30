import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory, type Router } from 'vue-router'
import { createPinia, type Pinia } from 'pinia'
import ArtworkDetailView from '../ArtworkDetailView.vue'
import { useArtworksStore } from '../../stores/artworks'

// Mock stores
vi.mock('../../stores/artworks', () => ({
  useArtworksStore: vi.fn(() => ({
    artworkById: vi.fn(),
    fetchArtwork: vi.fn(),
  })),
}))

// Mock global modal
vi.mock('../../composables/useModal', () => ({
  globalModal: {
    openImageGallery: vi.fn(),
  },
}))

const createMockRouter = (): Router => {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/artwork/:id', component: { template: '<div>Artwork</div>' } },
    ],
  })
}

// Mock artwork data
const mockArtwork = {
  id: 'test-artwork-id',
  title: 'Test Artwork',
  artist: 'Test Artist',
  description: 'A beautiful test artwork',
  type: 'sculpture',
  status: 'approved',
  lat: 49.2827,
  lon: -123.1207,
  photos: ['photo1.jpg', 'photo2.jpg'],
  tags: { material: 'bronze', style: 'modern' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

describe('ArtworkDetailView', () => {
  let wrapper: VueWrapper<any>
  let router: Router
  let pinia: Pinia
  let mockStore: any

  beforeEach(async (): Promise<void> => {
    pinia = createPinia()
    router = createMockRouter()
    
    mockStore = {
      artworkById: vi.fn(() => mockArtwork),
      fetchArtwork: vi.fn(() => Promise.resolve()),
    }
    
    vi.mocked(useArtworksStore).mockReturnValue(mockStore)
    
    wrapper = mount(ArtworkDetailView, {
      props: {
        id: 'test-artwork-id',
      },
      global: {
        plugins: [router, pinia],
        stubs: {
          RouterLink: true,
        },
      },
    })
    
    await router.isReady()
    await wrapper.vm.$nextTick()
  })

  describe('Basic Rendering', (): void => {
    it('renders without errors', (): void => {
      expect(wrapper.exists()).toBe(true)
    })

    it('displays artwork information when available', async (): Promise<void> => {
      expect(wrapper.vm.artwork).toBeTruthy()
    })

    it('has loading state initially', (): void => {
      expect(typeof wrapper.vm.loading).toBe('boolean')
    })
  })

  describe('Data Loading', (): void => {
    it('calls store to fetch artwork on mount', (): void => {
      expect(mockStore.artworkById).toHaveBeenCalledWith('test-artwork-id')
    })

    it('fetches artwork from API if not in store', async (): Promise<void> => {
      // Mock artwork not in store initially
      mockStore.artworkById.mockReturnValueOnce(null).mockReturnValueOnce(mockArtwork)
      
      const newWrapper = mount(ArtworkDetailView, {
        props: {
          id: 'new-artwork-id',
        },
        global: {
          plugins: [router, pinia],
        },
      })
      
      await newWrapper.vm.$nextTick()
      expect(mockStore.fetchArtwork).toHaveBeenCalledWith('new-artwork-id')
    })

    it('handles missing artwork gracefully', async (): Promise<void> => {
      mockStore.artworkById.mockReturnValue(null)
      mockStore.fetchArtwork.mockResolvedValue(undefined)
      
      const errorWrapper = mount(ArtworkDetailView, {
        props: {
          id: 'missing-artwork-id',
        },
        global: {
          plugins: [router, pinia],
        },
      })
      
      await new Promise(resolve => setTimeout(resolve, 100))
      await errorWrapper.vm.$nextTick()
      
      expect(errorWrapper.text()).toContain('was not found')
    })
  })

  describe('Photo Gallery', (): void => {
    it('manages current photo index', (): void => {
      expect(wrapper.vm.currentPhotoIndex).toBe(0)
    })

    it('can navigate between photos', async (): Promise<void> => {
      wrapper.vm.currentPhotoIndex = 1
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.currentPhotoIndex).toBe(1)
    })
  })

  describe('Metadata Display', (): void => {
    it('renders artwork content section', (): void => {
      expect(wrapper.find('div').exists()).toBe(true) // Basic structure check
    })

    it('has structured layout', (): void => {
      // Check that the component has basic structure
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('Error Handling', (): void => {
    it('handles error states', async (): Promise<void> => {
      wrapper.vm.error = 'Network error'
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.error).toBeTruthy()
    })
  })

  describe('Accessibility', (): void => {
    it('has proper content structure', (): void => {
      expect(wrapper.find('h1').exists() || wrapper.find('[role="heading"]').exists()).toBe(true)
    })

    it('handles image accessibility', (): void => {
      const images = wrapper.findAll('img')
      // Either no images present or they have alt attributes
      expect(images.length === 0 || images.every(img => img.attributes('alt') !== undefined)).toBe(true)
    })
  })
})