import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import SubmitView from '../SubmitView.vue'
import { useAuthStore } from '../../stores/auth'

// Mock child components
vi.mock('../../components/PhotoUpload.vue', () => ({
  default: {
    name: 'PhotoUpload',
    template: '<div data-testid="photo-upload"><button @click="$emit(\'photos-changed\', mockPhotos)">Upload Photos</button></div>',
    props: ['maxFiles', 'acceptedTypes', 'maxSize'],
    emits: ['photos-changed'],
    setup(props, { emit }) {
      const mockPhotos = [
        { file: new File([''], 'test1.jpg'), preview: 'blob:test1', location: null },
        { file: new File([''], 'test2.jpg'), preview: 'blob:test2', location: { lat: 49.2827, lon: -123.1207 } },
      ]
      return { mockPhotos }
    },
  },
}))

vi.mock('../../components/ConsentForm.vue', () => ({
  default: {
    name: 'ConsentForm',
    template: '<div data-testid="consent-form"><input type="checkbox" @change="$emit(\'consent-changed\', $event.target.checked)" /></div>',
    emits: ['consent-changed'],
  },
}))

vi.mock('../../components/MapComponent.vue', () => ({
  default: {
    name: 'MapComponent',
    template: '<div data-testid="map-component">Map</div>',
    props: ['center', 'zoom', 'height'],
  },
}))

// Mock composables
vi.mock('../../composables/useGeolocation', () => ({
  useGeolocation: () => ({
    getCurrentPosition: vi.fn().mockResolvedValue({
      coords: { latitude: 49.2827, longitude: -123.1207 },
    }),
    isLoading: false,
    error: null,
  }),
}))

vi.mock('../../composables/useApi', () => ({
  useApi: () => ({
    execute: vi.fn(),
    isLoading: false,
    error: null,
  }),
}))

vi.mock('../../composables/useAnnouncer', () => ({
  useAnnouncer: () => ({
    announceFormSuccess: vi.fn(),
    announceFormError: vi.fn(),
  }),
}))

// Mock services
vi.mock('../../services/api', () => ({
  apiService: {
    submitLogbookEntry: vi.fn().mockResolvedValue({ id: '123', status: 'pending' }),
    getNearbyArtworks: vi.fn().mockResolvedValue([
      { id: '1', title: 'Nearby Artwork 1', lat: 49.283, lon: -123.121, distance: 50 },
      { id: '2', title: 'Nearby Artwork 2', lat: 49.282, lon: -123.120, distance: 100 },
    ]),
  },
}))

const createMockRouter = () => {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/submit', component: { template: '<div>Submit</div>' } },
      { path: '/artwork/:id', component: { template: '<div>Artwork</div>' } },
    ],
  })
}

describe('SubmitView', () => {
  let wrapper: any
  let router: any
  let pinia: any

  beforeEach(async () => {
    pinia = createPinia()
    router = createMockRouter()
    
    wrapper = mount(SubmitView, {
      global: {
        plugins: [router, pinia],
        stubs: {
          PhotoUpload: true,
          ConsentForm: true,
          MapComponent: true,
        },
      },
    })
    
    await router.isReady()
  })

  describe('Initial State', () => {
    it('renders the submit form with all required sections', () => {
      expect(wrapper.find('h1').text()).toBe('Add Cultural Artwork')
      expect(wrapper.find('[data-testid="photo-upload"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="consent-form"]').exists()).toBe(true)
      expect(wrapper.find('textarea[placeholder="Optional note about this artwork..."]').exists()).toBe(true)
    })

    it('shows location section with current position', () => {
      const locationSection = wrapper.find('.location-section')
      expect(locationSection.exists()).toBe(true)
      expect(locationSection.text()).toContain('Your Location')
    })

    it('initializes with correct default values', () => {
      expect(wrapper.vm.currentStep).toBe(1)
      expect(wrapper.vm.photos).toEqual([])
      expect(wrapper.vm.note).toBe('')
      expect(wrapper.vm.artworkType).toBe('public_art')
      expect(wrapper.vm.hasConsented).toBe(false)
    })
  })

  describe('Photo Upload Workflow', () => {
    it('handles photo uploads and updates state', async () => {
      const photoUpload = wrapper.find('[data-testid="photo-upload"]')
      const uploadButton = photoUpload.find('button')
      
      await uploadButton.trigger('click')
      
      expect(wrapper.vm.photos).toHaveLength(2)
      expect(wrapper.vm.photos[0].file.name).toBe('test1.jpg')
      expect(wrapper.vm.photos[1].location).toEqual({ lat: 49.2827, lon: -123.1207 })
    })

    it('extracts location from photos and updates nearby artworks', async () => {
      const photoUpload = wrapper.find('[data-testid="photo-upload"]')
      await photoUpload.vm.$emit('photos-changed', [
        { file: new File([''], 'test.jpg'), location: { lat: 49.3, lon: -123.1 } },
      ])

      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.photoLocation).toEqual({ lat: 49.3, lon: -123.1 })
    })

    it('validates photo requirements before allowing submission', () => {
      wrapper.vm.photos = []
      expect(wrapper.vm.canSubmit).toBe(false)
      
      wrapper.vm.photos = [{ file: new File([''], 'test.jpg') }]
      wrapper.vm.hasConsented = true
      expect(wrapper.vm.canSubmit).toBe(true)
    })
  })

  describe('Artwork Type Selection', () => {
    it('renders all artwork type options', () => {
      const typeSelect = wrapper.find('select[name="artworkType"]')
      expect(typeSelect.exists()).toBe(true)
      
      const options = typeSelect.findAll('option')
      expect(options).toHaveLength(5) // public_art, street_art, monument, sculpture, other
      expect(options[0].text()).toBe('Public Art')
      expect(options[1].text()).toBe('Street Art')
    })

    it('updates artwork type when selection changes', async () => {
      const typeSelect = wrapper.find('select[name="artworkType"]')
      await typeSelect.setValue('street_art')
      
      expect(wrapper.vm.artworkType).toBe('street_art')
    })
  })

  describe('Nearby Artworks', () => {
    it('displays nearby artworks when location is available', async () => {
      wrapper.vm.userLocation = [49.2827, -123.1207]
      await wrapper.vm.loadNearbyArtworks()
      await wrapper.vm.$nextTick()

      const nearbySection = wrapper.find('.nearby-artworks')
      expect(nearbySection.exists()).toBe(true)
      expect(nearbySection.text()).toContain('Nearby Artwork 1')
      expect(nearbySection.text()).toContain('Nearby Artwork 2')
    })

    it('allows selection of existing artwork for logbook entry', async () => {
      wrapper.vm.nearbyArtworks = [
        { id: '1', title: 'Test Artwork', distance: 50 },
      ]
      await wrapper.vm.$nextTick()

      const artworkCard = wrapper.find('[data-artwork-id="1"]')
      await artworkCard.trigger('click')

      expect(wrapper.vm.selectedArtwork).toEqual({ id: '1', title: 'Test Artwork', distance: 50 })
      expect(wrapper.vm.submissionType).toBe('logbook')
    })

    it('shows option to create new artwork when none selected', () => {
      wrapper.vm.selectedArtwork = null
      expect(wrapper.vm.submissionType).toBe('artwork')
      
      const newArtworkOption = wrapper.find('.create-new-artwork')
      expect(newArtworkOption.exists()).toBe(true)
    })
  })

  describe('Form Validation', () => {
    it('validates note length limit', async () => {
      const longNote = 'a'.repeat(501)
      const noteTextarea = wrapper.find('textarea')
      await noteTextarea.setValue(longNote)

      expect(wrapper.vm.noteError).toBeTruthy()
      expect(wrapper.vm.canSubmit).toBe(false)
    })

    it('requires consent before allowing submission', () => {
      wrapper.vm.photos = [{ file: new File([''], 'test.jpg') }]
      wrapper.vm.hasConsented = false
      
      expect(wrapper.vm.canSubmit).toBe(false)
    })

    it('enables submission when all requirements are met', async () => {
      wrapper.vm.photos = [{ file: new File([''], 'test.jpg') }]
      wrapper.vm.hasConsented = true
      wrapper.vm.note = 'Valid note'
      
      expect(wrapper.vm.canSubmit).toBe(true)
    })
  })

  describe('Submission Process', () => {
    beforeEach(() => {
      wrapper.vm.photos = [{ file: new File([''], 'test.jpg') }]
      wrapper.vm.hasConsented = true
      wrapper.vm.userLocation = [49.2827, -123.1207]
    })

    it('submits new artwork when no existing artwork selected', async () => {
      wrapper.vm.selectedArtwork = null
      wrapper.vm.note = 'Test note'
      wrapper.vm.artworkType = 'street_art'

      await wrapper.vm.submitForm()

      const apiService = await import('../../services/api')
      expect(apiService.apiService.submitLogbookEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          lat: 49.2827,
          lon: -123.1207,
          note: 'Test note',
          type: 'street_art',
          photos: expect.any(Array),
        })
      )
    })

    it('submits logbook entry when existing artwork selected', async () => {
      wrapper.vm.selectedArtwork = { id: 'artwork-123' }
      wrapper.vm.note = 'Logbook note'

      await wrapper.vm.submitForm()

      const apiService = await import('../../services/api')
      expect(apiService.apiService.submitLogbookEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          artworkId: 'artwork-123',
          note: 'Logbook note',
          photos: expect.any(Array),
        })
      )
    })

    it('shows success message and redirects after successful submission', async () => {
      const routerPushSpy = vi.spyOn(router, 'push')
      
      await wrapper.vm.submitForm()

      expect(wrapper.vm.showSuccess).toBe(true)
      expect(wrapper.vm.submissionId).toBe('123')
      
      // Should redirect after delay
      setTimeout(() => {
        expect(routerPushSpy).toHaveBeenCalledWith('/profile')
      }, 2000)
    })

    it('handles submission errors gracefully', async () => {
      const apiService = await import('../../services/api')
      apiService.apiService.submitLogbookEntry.mockRejectedValueOnce(
        new Error('Network error')
      )

      await wrapper.vm.submitForm()

      expect(wrapper.vm.submitError).toBe('Network error')
      expect(wrapper.vm.showSuccess).toBe(false)
    })
  })

  describe('Two-Step Process', () => {
    it('advances to step 2 after photos are uploaded', async () => {
      wrapper.vm.photos = [{ file: new File([''], 'test.jpg') }]
      await wrapper.vm.goToStep2()

      expect(wrapper.vm.currentStep).toBe(2)
    })

    it('allows going back to step 1', async () => {
      wrapper.vm.currentStep = 2
      await wrapper.vm.goToStep1()

      expect(wrapper.vm.currentStep).toBe(1)
    })

    it('shows correct content for each step', async () => {
      // Step 1: Photo upload
      expect(wrapper.find('[data-testid="photo-upload"]').exists()).toBe(true)
      
      // Step 2: Details and submission
      wrapper.vm.currentStep = 2
      await wrapper.vm.$nextTick()
      
      expect(wrapper.find('textarea').exists()).toBe(true)
      expect(wrapper.find('[data-testid="consent-form"]').exists()).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('provides proper ARIA labels for form sections', () => {
      expect(wrapper.find('[role="form"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="Photo upload section"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="Artwork details"]').exists()).toBe(true)
    })

    it('announces form state changes to screen readers', async () => {
      const announcer = wrapper.vm.announcer
      
      wrapper.vm.showSuccess = true
      await wrapper.vm.$nextTick()
      
      expect(announcer.announceFormSuccess).toHaveBeenCalled()
    })

    it('handles keyboard navigation for artwork selection', async () => {
      wrapper.vm.nearbyArtworks = [{ id: '1', title: 'Test' }]
      await wrapper.vm.$nextTick()

      const artworkCard = wrapper.find('[data-artwork-id="1"]')
      await artworkCard.trigger('keydown.enter')

      expect(wrapper.vm.selectedArtwork).toBeTruthy()
    })
  })
})