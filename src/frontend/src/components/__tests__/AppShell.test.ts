import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import AppShell from '../AppShell.vue'
import { useAuthStore } from '../../stores/auth'

// Mock the LiveRegion component
vi.mock('../LiveRegion.vue', () => ({
  default: {
    name: 'LiveRegion',
    template: '<div data-testid="live-region"></div>',
  },
}))

// Create a mock router
const createMockRouter = () => {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/submit', component: { template: '<div>Submit</div>' } },
      { path: '/profile', component: { template: '<div>Profile</div>' } },
      { path: '/review', component: { template: '<div>Review</div>' } },
      { path: '/home', component: { template: '<div>About</div>' } },
      { path: '/help', component: { template: '<div>Help</div>' } },
    ],
  })
}

describe('AppShell', () => {
  let wrapper: any
  let router: any
  let pinia: any

  beforeEach(async () => {
    pinia = createPinia()
    router = createMockRouter()
    
    wrapper = mount(AppShell, {
      global: {
        plugins: [router, pinia],
        stubs: {
          RouterLink: true,
          RouterView: true,
          LiveRegion: true,
        },
      },
    })
    
    await router.isReady()
  })

  describe('Rendering', () => {
    it('renders the app shell with header and main content', () => {
      expect(wrapper.find('header[role="banner"]').exists()).toBe(true)
      expect(wrapper.find('main[role="main"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="live-region"]').exists()).toBe(true)
    })

    it('displays the logo and title', () => {
      const header = wrapper.find('header')
      expect(header.text()).toContain('🎨')
      expect(header.text()).toContain('Cultural Archiver')
    })

    it('includes skip navigation link for accessibility', () => {
      const skipLink = wrapper.find('a[href="#main-content"]')
      expect(skipLink.exists()).toBe(true)
      expect(skipLink.text()).toBe('Skip to main content')
    })
  })

  describe('Desktop Navigation', () => {
    it('shows desktop navigation on larger screens', () => {
      const desktopNav = wrapper.find('nav.hidden.md\\:flex')
      expect(desktopNav.exists()).toBe(true)
    })

    it('renders navigation items for unauthenticated users', () => {
      const authStore = useAuthStore(pinia)
      authStore.isAuthenticated = false
      authStore.isReviewer = false

      expect(wrapper.vm.visibleNavItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Map', path: '/' }),
          expect.objectContaining({ name: 'Add', path: '/submit' }),
          expect.objectContaining({ name: 'About', path: '/home' }),
          expect.objectContaining({ name: 'Help', path: '/help' }),
        ])
      )
    })

    it('renders additional navigation items for authenticated users', async () => {
      const authStore = useAuthStore(pinia)
      authStore.isAuthenticated = true
      authStore.isReviewer = false

      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.visibleNavItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Profile', path: '/profile' }),
        ])
      )
    })

    it('renders reviewer navigation for reviewer users', async () => {
      const authStore = useAuthStore(pinia)
      authStore.isAuthenticated = true
      authStore.isReviewer = true

      await wrapper.vm.$nextTick()
      
      expect(wrapper.vm.visibleNavItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Review', path: '/review' }),
        ])
      )
    })
  })

  describe('Mobile Navigation', () => {
    it('shows mobile menu button on small screens', () => {
      const mobileButton = wrapper.find('button.md\\:hidden')
      expect(mobileButton.exists()).toBe(true)
      expect(mobileButton.attributes('aria-label')).toBe('Open navigation menu')
    })

    it('toggles drawer when mobile button is clicked', async () => {
      const mobileButton = wrapper.find('button.md\\:hidden')
      
      expect(wrapper.vm.showDrawer).toBe(false)
      
      await mobileButton.trigger('click')
      expect(wrapper.vm.showDrawer).toBe(true)
      
      await mobileButton.trigger('click')
      expect(wrapper.vm.showDrawer).toBe(false)
    })

    it('shows drawer with correct ARIA attributes when open', async () => {
      wrapper.vm.showDrawer = true
      await wrapper.vm.$nextTick()

      const drawer = wrapper.find('[role="dialog"]')
      expect(drawer.exists()).toBe(true)
      expect(drawer.attributes('aria-modal')).toBe('true')
      expect(drawer.attributes('aria-labelledby')).toBe('drawer-title')
    })

    it('renders overlay when drawer is open', async () => {
      wrapper.vm.showDrawer = true
      await wrapper.vm.$nextTick()

      const overlay = wrapper.find('.fixed.inset-0.z-40')
      expect(overlay.exists()).toBe(true)
    })
  })

  describe('Keyboard Navigation', () => {
    it('closes drawer on escape key', async () => {
      wrapper.vm.showDrawer = true
      await wrapper.vm.$nextTick()

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(escapeEvent)

      expect(wrapper.vm.showDrawer).toBe(false)
    })

    it('handles tab trapping in open drawer', async () => {
      wrapper.vm.showDrawer = true
      await wrapper.vm.$nextTick()

      // Mock focusable elements in drawer
      const mockElements = [
        { focus: vi.fn() },
        { focus: vi.fn() },
      ]
      
      vi.spyOn(document, 'querySelector').mockReturnValue({
        querySelectorAll: vi.fn().mockReturnValue(mockElements),
      } as any)

      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' })
      Object.defineProperty(document, 'activeElement', {
        value: mockElements[1],
        configurable: true,
      })

      // This tests the tab trapping logic
      wrapper.vm.handleTabTrapping(tabEvent)
      
      // Should cycle to first element when at last element
      expect(mockElements[0].focus).toHaveBeenCalled()
    })
  })

  describe('Route Changes', () => {
    it('closes drawer when route changes', async () => {
      wrapper.vm.showDrawer = true
      await wrapper.vm.$nextTick()

      // Simulate route change
      wrapper.vm.handleRouteChange()

      expect(wrapper.vm.showDrawer).toBe(false)
    })
  })

  describe('Focus Management', () => {
    it('focuses first drawer element when opening', async () => {
      const mockElement = { focus: vi.fn() }
      vi.spyOn(document, 'querySelector').mockReturnValue(mockElement)

      wrapper.vm.toggleDrawer()
      await wrapper.vm.$nextTick()

      expect(mockElement.focus).toHaveBeenCalled()
    })

    it('returns focus to menu button when closing drawer', async () => {
      const mockMenuButton = { focus: vi.fn() }
      vi.spyOn(document, 'querySelector').mockReturnValue(mockMenuButton)

      wrapper.vm.showDrawer = true
      wrapper.vm.closeDrawer()
      await wrapper.vm.$nextTick()

      expect(mockMenuButton.focus).toHaveBeenCalled()
    })
  })
})