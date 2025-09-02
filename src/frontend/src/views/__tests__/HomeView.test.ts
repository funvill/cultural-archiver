import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory, type Router } from 'vue-router'
import { createPinia, type Pinia } from 'pinia'
import HomeView from '../HomeView.vue'

// Mock API service
vi.mock('../../services/api', () => ({
  apiService: {
    getStatus: vi.fn(() => Promise.resolve({ message: 'API connected successfully' })),
  },
  getErrorMessage: vi.fn((error) => error.message || 'Unknown error'),
}))

const createMockRouter = (): Router => {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/submit', component: { template: '<div>Submit</div>' } },
      { path: '/map', component: { template: '<div>Map</div>' } },
    ],
  })
}

describe('HomeView', () => {
  let wrapper: VueWrapper<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  let router: Router
  let pinia: Pinia

  beforeEach(async (): Promise<void> => {
    pinia = createPinia()
    router = createMockRouter()
    
    wrapper = mount(HomeView, {
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

    it('contains hero section', (): void => {
      expect(wrapper.find('.hero').exists()).toBe(true)
    })

    it('displays main heading', (): void => {
      expect(wrapper.text()).toContain('Cultural Archiver')
    })

    it('shows mission statement', (): void => {
      expect(wrapper.text()).toContain('Discover, document')
    })
  })

  describe('API Status Check', (): void => {
    it('checks API status on mount', async (): Promise<void> => {
      // Wait for async status check
      await new Promise(resolve => setTimeout(resolve, 100))
      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.isLoading).toBe(false)
      expect(wrapper.vm.status).toContain('API connected successfully')
    })

    it('handles API errors gracefully', async (): Promise<void> => {
      const { apiService } = await import('../../services/api')
      vi.mocked(apiService.getStatus).mockRejectedValueOnce(new Error('Connection failed'))
      
      // Create new wrapper to trigger onMounted again
      const errorWrapper = mount(HomeView, {
        global: {
          plugins: [router, pinia],
          stubs: {
            RouterLink: true,
          },
        },
      })
      
      await new Promise(resolve => setTimeout(resolve, 100))
      await errorWrapper.vm.$nextTick()
      
      expect(errorWrapper.text()).toContain('API connection failed')
    })
  })

  describe('Navigation Elements', (): void => {
    it('contains navigation links', (): void => {
      const text = wrapper.text()
      expect(text).toContain('Submit Artwork') // Updated to match actual text
    })

    it('shows feature sections', (): void => {
      const text = wrapper.text()
      expect(text).toContain('How It Works')
      expect(text).toContain('Community Guidelines')
    })
  })

  describe('Accessibility', (): void => {
    it('has proper heading structure', (): void => {
      expect(wrapper.find('h1').exists()).toBe(true)
      expect(wrapper.findAll('h2').length).toBeGreaterThan(0)
    })

    it('contains semantic sections', (): void => {
      expect(wrapper.find('section').exists() || wrapper.find('.hero').exists()).toBe(true)
    })
  })

  describe('Responsive Design', (): void => {
    it('includes responsive classes', (): void => {
      const heroSection = wrapper.find('.hero')
      expect(heroSection.html()).toContain('max-w-4xl') // Check HTML content instead
    })

    it('has mobile-friendly spacing', (): void => {
      const content = wrapper.find('.px-4')
      expect(content.exists()).toBe(true)
    })
  })
})