import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AnonymousUserWarning from '../AnonymousUserWarning.vue';

describe('AnonymousUserWarning', () => {
  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      const wrapper = mount(AnonymousUserWarning);

      expect(wrapper.find('[role="alert"]')).toBeTruthy();
      expect(wrapper.text()).toContain('You are browsing anonymously');
      expect(wrapper.find('button').text()).toContain('Sign In / Create Account');
    });

    it('renders submission context warning', () => {
      const wrapper = mount(AnonymousUserWarning, {
        props: { context: 'submission' },
      });

      expect(wrapper.text()).toContain(
        'Your submissions are anonymous and cannot be claimed later'
      );
      expect(wrapper.find('.bg-orange-50')).toBeTruthy();
      expect(wrapper.text()).toContain('⚠️');
    });

    it('renders general context warning', () => {
      const wrapper = mount(AnonymousUserWarning, {
        props: { context: 'general' },
      });

      expect(wrapper.text()).toContain('You are browsing anonymously');
      expect(wrapper.find('.bg-blue-50')).toBeTruthy();
      expect(wrapper.text()).toContain('ℹ️');
    });
  });

  describe('Props Configuration', () => {
    it('hides sign in button when showSignIn is false', () => {
      const wrapper = mount(AnonymousUserWarning, {
        props: { showSignIn: false },
      });

      expect(wrapper.find('button').exists()).toBe(false);
    });

    it('shows sign in button when showSignIn is true', () => {
      const wrapper = mount(AnonymousUserWarning, {
        props: { showSignIn: true },
      });

      expect(wrapper.find('button').exists()).toBe(true);
    });

    it('applies compact styling', () => {
      const wrapper = mount(AnonymousUserWarning, {
        props: { compact: true },
      });

      expect(wrapper.find('.p-3')).toBeTruthy();
      expect(wrapper.find('.text-xs')).toBeTruthy();
    });

    it('applies normal styling by default', () => {
      const wrapper = mount(AnonymousUserWarning);

      expect(wrapper.find('.p-4')).toBeTruthy();
      expect(wrapper.find('.text-sm')).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    it('emits signIn event when button is clicked', async () => {
      const wrapper = mount(AnonymousUserWarning);

      await wrapper.find('button').trigger('click');

      expect(wrapper.emitted('signIn')).toBeTruthy();
      expect(wrapper.emitted('signIn')).toHaveLength(1);
    });

    it('does not emit signIn when button is not shown', () => {
      const wrapper = mount(AnonymousUserWarning, {
        props: { showSignIn: false },
      });

      expect(wrapper.find('button').exists()).toBe(false);
      expect(wrapper.emitted('signIn')).toBeFalsy();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const wrapper = mount(AnonymousUserWarning);

      const alert = wrapper.find('[role="alert"]');
      expect(alert.exists()).toBe(true);
      expect(alert.attributes('aria-label')).toContain('Anonymous user warning');
    });

    it('has aria-hidden on icon', () => {
      const wrapper = mount(AnonymousUserWarning);

      const icon = wrapper.find('[aria-hidden="true"]');
      expect(icon.exists()).toBe(true);
    });

    it('button has proper focus styles', () => {
      const wrapper = mount(AnonymousUserWarning);

      const button = wrapper.find('button');
      expect(button.classes()).toContain('focus:outline-none');
      expect(button.classes()).toContain('focus:ring-2');
    });
  });

  describe('Context Styling', () => {
    it('applies correct styling for submission context', () => {
      const wrapper = mount(AnonymousUserWarning, {
        props: { context: 'submission' },
      });

      expect(wrapper.classes()).toContain('bg-orange-50');
      expect(wrapper.classes()).toContain('border-orange-200');
      expect(wrapper.classes()).toContain('text-orange-800');
    });

    it('applies correct styling for general context', () => {
      const wrapper = mount(AnonymousUserWarning, {
        props: { context: 'general' },
      });

      expect(wrapper.classes()).toContain('bg-blue-50');
      expect(wrapper.classes()).toContain('border-blue-200');
      expect(wrapper.classes()).toContain('text-blue-800');
    });

    it('applies correct button styling for submission context', () => {
      const wrapper = mount(AnonymousUserWarning, {
        props: { context: 'submission' },
      });

      const button = wrapper.find('button');
      expect(button.classes()).toContain('bg-orange-100');
      expect(button.classes()).toContain('text-orange-900');
    });

    it('applies correct button styling for general context', () => {
      const wrapper = mount(AnonymousUserWarning, {
        props: { context: 'general' },
      });

      const button = wrapper.find('button');
      expect(button.classes()).toContain('bg-blue-100');
      expect(button.classes()).toContain('text-blue-900');
    });
  });
});
