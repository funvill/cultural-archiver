import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AuthModal from '../AuthModal.vue';

// Mock the composables
vi.mock('../../composables/useAuth', () => ({
  useAuth: (): any => ({
    requestMagicLink: vi.fn().mockResolvedValue({ success: true }),
    isLoading: { value: false },
    error: { value: null },
    clearError: vi.fn(),
  }),
}));

describe('AuthModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Mount', () => {
    it('mounts successfully when open', () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true },
      });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.vm).toBeDefined();
    });

    it('mounts successfully when closed', () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: false },
      });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.vm).toBeDefined();
    });

    it('accepts mode prop', () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true, mode: 'signup' },
      });

      expect(wrapper.props('mode')).toBe('signup');
    });

    it('can emit close event', async () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true },
      });

      await wrapper.vm.$emit('close');
      expect(wrapper.emitted('close')).toBeTruthy();
    });
  });
});
