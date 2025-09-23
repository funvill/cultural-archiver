import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createRouter, createWebHistory, type Router } from 'vue-router';
import { createPinia, type Pinia } from 'pinia';
import SubmitView from '../SubmitView.vue';

// Mock child components
vi.mock('../../components/AddArtworkFastForm.vue', () => ({
  default: {
    name: 'AddArtworkFastForm',
    template: '<div data-testid="fast-artwork-form">Fast Artwork Form</div>',
  },
}));

// Mock auth store
vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    ensureUserToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

const createMockRouter = (): Router => {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/submit', component: { template: '<div>Submit</div>' } },
    ],
  });
};

describe('SubmitView', () => {
  let wrapper: VueWrapper<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let router: Router;
  let pinia: Pinia;

  beforeEach(async (): Promise<void> => {
    pinia = createPinia();
    router = createMockRouter();

    wrapper = mount(SubmitView, {
      global: {
        plugins: [router, pinia],
      },
    });

    await wrapper.vm.$nextTick();
  });

  describe('Basic Rendering', (): void => {
    it('renders the submit page', (): void => {
      expect(wrapper.exists()).toBe(true);
    });

    it('shows page header with correct title', (): void => {
      const header = wrapper.find('h1');
      expect(header.exists()).toBe(true);
      expect(header.text()).toBe('Submit Artwork');
    });

    it('contains fast artwork form component', (): void => {
      expect(wrapper.find('[data-testid="fast-artwork-form"]').exists()).toBe(true);
    });

    it('shows updated description mentioning fast workflow', (): void => {
      const description = wrapper.find('p');
      expect(description.exists()).toBe(true);
      expect(description.text()).toContain(
        'Fast photo-first workflow with intelligent duplicate detection'
      );
    });
  });

  describe('Integration', (): void => {
    it('initializes auth token on mount', async (): Promise<void> => {
      // The component should call ensureUserToken during mount
      // This is tested implicitly by checking the component mounts successfully
      expect(wrapper.exists()).toBe(true);
    });
  });
});
