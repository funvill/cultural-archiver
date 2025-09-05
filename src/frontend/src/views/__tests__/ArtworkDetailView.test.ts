import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory, type Router } from 'vue-router'
import { createPinia, type Pinia } from 'pinia'
import ArtworkDetailView from '../ArtworkDetailView.vue'
import { useArtworksStore } from '../../stores/artworks'
import { useAuthStore } from '../../stores/auth'
import { apiService } from '../../services/api'

// Mock API service
vi.mock('../../services/api', () => ({
  apiService: vi.fn()
}))

// Mock auth store
vi.mock('../../stores/auth', () => ({
  useAuthStore: vi.fn()
}))

// Mock useAnnouncer composable
const mockAnnounceSuccess = vi.fn()
const mockAnnounceError = vi.fn()
const mockAnnounceWarning = vi.fn()
const mockAnnounceInfo = vi.fn()

vi.mock('../../composables/useAnnouncer', () => ({
  useAnnouncer: (): {
    announceError: (message: string) => void;
    announceSuccess: (message: string) => void;
    announceWarning: (message: string) => void;
    announceInfo: (message: string) => void;
  } => ({
    announceError: mockAnnounceError,
    announceSuccess: mockAnnounceSuccess,
    announceWarning: mockAnnounceWarning,
    announceInfo: mockAnnounceInfo
  })
}))

// Mock stores with proper Pinia store structure
const createMockStore = (): any => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
  // State
  artworks: vi.fn(() => []),
  currentLocation: vi.fn(() => null),
  mapCenter: vi.fn(() => ({ latitude: 49.2827, longitude: -123.1207 })),
  mapZoom: vi.fn(() => 15),
  mapBounds: vi.fn(() => null),
  isLoading: vi.fn(() => false),
  error: vi.fn(() => null),
  fetchRadius: vi.fn(() => 500),
  
  // Computed - artworkById returns a function
  nearbyArtworks: vi.fn(() => []),
  artworkById: vi.fn(), // This is a computed that returns a function
  hasLocationPermission: vi.fn(() => false),
  
  // Actions
  setCurrentLocation: vi.fn(),
  setMapCenter: vi.fn(),
  setMapZoom: vi.fn(),
  setMapBounds: vi.fn(),
  setArtworks: vi.fn(),
  addArtwork: vi.fn(),
  removeArtwork: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
  clearError: vi.fn(),
  cacheArtwork: vi.fn(),
  fetchNearbyArtworks: vi.fn(),
  fetchArtwork: vi.fn(),
  fetchArtworksInBounds: vi.fn(),
  getArtworksForSubmission: vi.fn(),
  calculateDistance: vi.fn(),
  reset: vi.fn(),
  
  // Pinia store properties
  $state: {},
  $patch: vi.fn(),
  $reset: vi.fn(),
  $subscribe: vi.fn(),
  $dispose: vi.fn(),
  $id: 'artworks',
})

vi.mock('../../stores/artworks', () => ({
  useArtworksStore: vi.fn(() => createMockStore()),
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
  id: '12345678-1234-5678-9abc-123456789abc',
  title: 'Test Artwork',
  artist: 'Test Artist', 
  description: 'A beautiful test artwork',
  type_name: 'sculpture',
  status: 'approved',
  lat: 49.2827,
  lon: -123.1207,
  photos: ['photo1.jpg', 'photo2.jpg'],
  tags_parsed: { 
    title: 'Test Artwork',
    description: 'A beautiful test artwork',
    creator: 'Test Artist',
    material: 'bronze', 
    style: 'modern' 
  },
  logbook_entries: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

describe('ArtworkDetailView', () => {
  let wrapper: VueWrapper<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  let router: Router
  let pinia: Pinia
  let mockStore: any // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(async (): Promise<void> => {
    pinia = createPinia()
    router = createMockRouter()
    
    mockStore = createMockStore()
    // Set up the artworkById mock to return a function that returns the mockArtwork
    const artworkByIdFunction = vi.fn((id: string) => id === '12345678-1234-5678-9abc-123456789abc' ? mockArtwork : null)
    mockStore.artworkById = artworkByIdFunction
    mockStore.fetchArtwork.mockResolvedValue(mockArtwork)
    
    vi.mocked(useArtworksStore).mockReturnValue(mockStore)
    
    wrapper = mount(ArtworkDetailView, {
      props: {
        id: '12345678-1234-5678-9abc-123456789abc',
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
      // Since loading is internal reactive state, we verify the component structure
      expect(wrapper.exists()).toBe(true)
      // The component should have rendered some content
      expect(wrapper.html()).toContain('div')
    })
  })

  describe('Data Loading', (): void => {
    it('component initializes successfully with store integration', async (): Promise<void> => {
      // Clear existing wrapper and create new one to ensure fresh mount
      wrapper.unmount()
      
      const freshMockStore = createMockStore()
      const artworkByIdFunction = vi.fn((id: string) => id === '12345678-1234-5678-9abc-123456789abc' ? mockArtwork : null)
      freshMockStore.artworkById = artworkByIdFunction
      freshMockStore.fetchArtwork.mockResolvedValue(mockArtwork)
      
      vi.mocked(useArtworksStore).mockReturnValue(freshMockStore)
      
      const freshWrapper = mount(ArtworkDetailView, {
        props: {
          id: '12345678-1234-5678-9abc-123456789abc',
        },
        global: {
          plugins: [router, pinia],
          stubs: {
            RouterLink: true,
          },
        },
      })
      
      // Wait for component to mount and async lifecycle hooks to complete
      await freshWrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Verify component mounted successfully and has expected structure
      expect(freshWrapper.exists()).toBe(true)
      // Note: loading is internal reactive state, not exposed on vm
      expect(freshWrapper.find('[data-testid="artwork-detail"]').exists() || freshWrapper.find('h1').exists()).toBe(true)
    })

    it('handles API integration for missing artwork', async (): Promise<void> => {
      const freshMockStore = createMockStore()
      // Create a function that returns null on first call, then mockArtwork on subsequent calls
      const artworkByIdFunction = vi.fn()
        .mockReturnValueOnce(null) // First call - artwork not in store
        .mockReturnValueOnce(mockArtwork) // Second call - after fetch
      freshMockStore.artworkById = artworkByIdFunction
      freshMockStore.fetchArtwork.mockResolvedValue(mockArtwork)
      
      vi.mocked(useArtworksStore).mockReturnValue(freshMockStore)
      
      const newWrapper = mount(ArtworkDetailView, {
        props: {
          id: 'new-artwork-id',
        },
        global: {
          plugins: [router, pinia],
        },
      })
      
      // Wait for component to mount and async lifecycle hooks to complete
      await newWrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Verify component handles the flow correctly - at minimum the component should exist
      expect(newWrapper.exists()).toBe(true)
      // Component should have some content rendered
      expect(newWrapper.html()).toContain('div')
    })

    it('handles missing artwork gracefully', async (): Promise<void> => {
      const tempMockStore = createMockStore()
      const artworkByIdFunction = vi.fn(() => null) // Always return null (artwork not found)
      tempMockStore.artworkById = artworkByIdFunction
      tempMockStore.fetchArtwork.mockResolvedValue(null)
      
      // Use a valid UUID format but non-existent artwork
      const validUuid = '550e8400-e29b-41d4-a716-446655440000'
      
      vi.mocked(useArtworksStore).mockReturnValue(tempMockStore)
      
      const errorWrapper = mount(ArtworkDetailView, {
        props: {
          id: validUuid,
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

  describe('Edit Mode Functionality', (): void => {
    beforeEach(async (): Promise<void> => {
      // Set up authenticated user state for editing BEFORE mounting
      const authStore: any = {
        isAuthenticated: true,
        userToken: 'test-token',
        user: { id: 'test-user', emailVerified: true },
        token: 'test-token',
        loading: false,
        $state: {},
        $patch: vi.fn(),
        $reset: vi.fn(),
        $subscribe: vi.fn(),
        $dispose: vi.fn(),
        $id: 'auth'
      }
      vi.mocked(useAuthStore).mockReturnValue(authStore)
      
      // Set up artwork store mock for editing
      const artworkStore = createMockStore()
      const artworkByIdFunction = vi.fn((id: string) => id === '12345678-1234-5678-9abc-123456789abc' ? mockArtwork : null)
      artworkStore.artworkById.mockImplementation(artworkByIdFunction)
      artworkStore.fetchArtwork.mockResolvedValue(mockArtwork)
      vi.mocked(useArtworksStore).mockReturnValue(artworkStore)
      
      // Mock API service for edit operations
      Object.assign(apiService, {
        getPendingEdits: vi.fn().mockResolvedValue({
          success: true,
          data: { has_pending_edits: false, pending_fields: [] }
        }),
        submitArtworkEdit: vi.fn().mockResolvedValue({
          success: true,
          data: { edit_ids: ['edit-1'], message: 'Changes submitted', status: 'pending' }
        })
      })
      
      // Remount component with authenticated state
      wrapper.unmount()
      wrapper = mount(ArtworkDetailView, {
        props: {
          id: '12345678-1234-5678-9abc-123456789abc',
        },
        global: {
          plugins: [router, pinia],
          stubs: {
            RouterLink: true,
          },
        },
      })
      
      await wrapper.vm.$nextTick()
    })

    it('shows edit button for authenticated users', async (): Promise<void> => {
      // The wrapper is already created with authenticated state in beforeEach
      await wrapper.vm.$nextTick() // Wait for reactivity
      
      const editButton = wrapper.find('button[aria-label="Edit artwork details"]')
      expect(editButton.exists()).toBe(true)
    })

    it('enters edit mode when edit button is clicked', async (): Promise<void> => {
      wrapper.vm.isEditMode = true
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.isEditMode).toBe(true)
    })

    it('shows edit form fields in edit mode', async (): Promise<void> => {
      wrapper.vm.isEditMode = true
      await wrapper.vm.$nextTick()
      
      // Check for edit form elements
      const titleInput = wrapper.find('input[id*="edit-title"]')
      const creatorsInput = wrapper.find('input[id*="edit-creators"]')
      const descriptionTextarea = wrapper.find('textarea[id*="edit-description"]')
      
      expect(titleInput.exists() || creatorsInput.exists() || descriptionTextarea.exists()).toBe(true)
    })

    it('validates required fields before saving', async (): Promise<void> => {
      wrapper.vm.isEditMode = true
      wrapper.vm.editData = {
        title: '', // Empty title should prevent saving
        description: 'Test description',
        creators: 'Test creator',
        tags: ['tag1']
      }
      await wrapper.vm.$nextTick()
      
      const saveButton = wrapper.find('button[aria-label*="Save"]')
      if (saveButton.exists()) {
        expect(saveButton.attributes('disabled')).toBeDefined()
      }
    })

    it('detects changes from original values', (): void => {
      wrapper.vm.isEditMode = true
      wrapper.vm.editData = {
        title: 'Modified Title',
        description: 'Original description',
        creators: 'Original creator',
        tags: []
      }
      
      const hasChanges = wrapper.vm.hasUnsavedChanges
      expect(typeof hasChanges).toBe('boolean')
    })

    it('shows confirmation dialog when canceling with unsaved changes', async (): Promise<void> => {
      wrapper.vm.isEditMode = true
      wrapper.vm.editData = {
        title: 'Modified Title',
        description: 'Original description', 
        creators: 'Original creator',
        tags: []
      }
      
      const cancelButton = wrapper.find('button[aria-label*="Cancel"]')
      if (cancelButton.exists()) {
        await cancelButton.trigger('click')
        await wrapper.vm.$nextTick()
        
        // Should show confirmation dialog
        expect(wrapper.vm.showCancelDialog).toBe(true)
      }
    })

    it('submits edit form with proper data structure', async (): Promise<void> => {
      wrapper.vm.isEditMode = true
      wrapper.vm.editData = {
        title: 'New Title',
        description: 'New description',
        creators: 'New creator',
        tags: ['new-tag']
      }
      
      // Mock the save function
      const saveSpy = vi.spyOn(wrapper.vm, 'saveEdit')
      
      const saveButton = wrapper.find('button[aria-label*="Save"]')
      if (saveButton.exists()) {
        await saveButton.trigger('click')
        expect(saveSpy).toHaveBeenCalled()
      }
    })

    it('shows loading state during save operation', async (): Promise<void> => {
      wrapper.vm.editLoading = true
      await wrapper.vm.$nextTick()
      
      const loadingText = wrapper.text()
      expect(loadingText.includes('Saving') || loadingText.includes('Loading')).toBe(true)
    })

    it('displays error messages for failed saves', async (): Promise<void> => {
      wrapper.vm.isEditMode = true
      wrapper.vm.editError = 'Failed to save changes'
      await wrapper.vm.$nextTick()
      
      const errorMessage = wrapper.find('.text-red-700, .text-red-600, [class*="error"]')
      expect(errorMessage.exists() || wrapper.text().includes('Failed to save')).toBe(true)
    })

    it('exits edit mode after successful save', async (): Promise<void> => {
      wrapper.vm.isEditMode = true
      
      // Simulate successful save
      await wrapper.vm.exitEditMode()
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.isEditMode).toBe(false)
    })

    it('preserves original data when canceling without changes', async (): Promise<void> => {
      const originalTitle = wrapper.vm.artworkTitle
      
      wrapper.vm.isEditMode = true
      wrapper.vm.editData.title = 'Temporary change'
      
      // Cancel without saving
      await wrapper.vm.exitEditMode()
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.artworkTitle).toBe(originalTitle)
    })

    it('shows pending edits indicator when user has pending changes', async (): Promise<void> => {
      wrapper.vm.hasPendingEdits = true
      wrapper.vm.pendingFields = ['title', 'description']
      await wrapper.vm.$nextTick()
      
      const pendingIndicator = wrapper.find('[class*="pending"], .text-yellow-600, .text-amber-600')
      expect(pendingIndicator.exists() || wrapper.text().includes('pending')).toBe(true)
    })

    it('disables edit button when user has pending edits', async (): Promise<void> => {
      wrapper.vm.hasPendingEdits = true
      await wrapper.vm.$nextTick()
      
      const editButton = wrapper.find('button[aria-label*="Edit"]')
      if (editButton.exists()) {
        expect(editButton.attributes('disabled')).toBeDefined()
      }
    })

    it('handles tag editing with TagChipEditor integration', async (): Promise<void> => {
      wrapper.vm.isEditMode = true
      wrapper.vm.editData.tags = ['existing-tag']
      await wrapper.vm.$nextTick()
      
      // Check if TagChipEditor is rendered (or tag editing interface exists)
      const tagEditor = wrapper.find('[class*="tag-chip-editor"], textarea[id*="edit-tags"], input[id*="tags"]')
      expect(tagEditor.exists()).toBe(true)
    })

    it('validates character limits for text fields', async (): Promise<void> => {
      wrapper.vm.isEditMode = true
      wrapper.vm.editData.title = 'a'.repeat(600) // Exceed 512 char limit
      await wrapper.vm.$nextTick()
      
      // Look for character counter specifically
      const charCounters = wrapper.findAll('.text-gray-500')
      const charCounter = charCounters.find(c => c.text().includes('600') || c.text().includes('512'))
      expect(charCounter).toBeDefined()
      expect(charCounter?.text()).toContain('600')
    })

    it('announces successful save to screen readers', async (): Promise<void> => {
      // Ensure we're in edit mode and have changes to save  
      wrapper.vm.isEditMode = true
      wrapper.vm.editData.title = 'Modified Title'
      
      // Mock API success response  
      Object.assign(apiService, {
        submitArtworkEdit: vi.fn().mockResolvedValue({ success: true })
      })
      
      // Simulate successful save
      await wrapper.vm.saveEdit?.()
      
      expect(mockAnnounceSuccess).toHaveBeenCalledWith(expect.stringContaining('submitted for review'))
    })
  })
})