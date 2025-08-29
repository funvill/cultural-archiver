import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory, type Router } from 'vue-router'
import { createPinia, type Pinia } from 'pinia'
import SubmitView from '../SubmitView.vue'

// Mock child components
vi.mock('../../components/PhotoUpload.vue', () => ({
  default: {
    name: 'PhotoUpload',
    template: '<div data-testid="photo-upload"><button @click="$emit(\'upload-success\', mockData)">Upload Photos</button></div>',
    props: ['maxFiles', 'acceptedTypes', 'maxSize'],
    emits: ['upload-success', 'upload-error'],
    setup(): { mockData: any } {
      const mockData = {
        submission_id: 'test-submission-id',
        photos: ['photo1.jpg', 'photo2.jpg']
      }
      return { mockData }
    },
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

describe('SubmitView', () => {
  let wrapper: VueWrapper<any>
  let router: Router
  let pinia: Pinia

  beforeEach(async (): Promise<void> => {
    pinia = createPinia()
    router = createMockRouter()
    
    wrapper = mount(SubmitView, {
      global: {
        plugins: [router, pinia],
      },
    })
    
    await wrapper.vm.$nextTick()
  })

  describe('Basic Rendering', (): void => {
    it('renders the submit page', (): void => {
      expect(wrapper.exists()).toBe(true)
    })

    it('shows step 1 initially', (): void => {
      expect(wrapper.vm.currentStep).toBe(1)
    })

    it('contains photo upload component', (): void => {
      expect(wrapper.find('[data-testid="photo-upload"]').exists()).toBe(true)
    })
  })
})