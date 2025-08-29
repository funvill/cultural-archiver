import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory, type Router } from 'vue-router'
import { createPinia, type Pinia } from 'pinia'
import AppShell from '../AppShell.vue'

// Mock components
vi.mock('../LiveRegion.vue', () => ({
  default: {
    name: 'LiveRegion',
    template: '<div data-testid="live-region"></div>',
  },
}))

const createMockRouter = (): Router => {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/submit', component: { template: '<div>Submit</div>' } },
    ],
  })
}

describe('AppShell', () => {
  let wrapper: VueWrapper<any>
  let router: Router
  let pinia: Pinia

  beforeEach(async (): Promise<void> => {
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

  describe('Basic Rendering', (): void => {
    it('renders without errors', (): void => {
      expect(wrapper.exists()).toBe(true)
    })

    it('contains shell structure', (): void => {
      expect(wrapper.find('.app-shell').exists()).toBe(true)
    })
  })
})